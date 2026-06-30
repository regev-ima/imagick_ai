"""
Phase-A GPU engine — the cheap heart of the pipeline.

ONE batched pass over a gallery's images on a serverless GPU that scales to
zero (≈$0 when idle), producing everything the cheap layers need:

  • CLIP embedding (ViT-L/14)            → image clustering + zero-shot tagging
  • aesthetic score (LAION head on CLIP) → ranking within a group (Phase B)
  • ArcFace face embeddings (InsightFace)→ accurate face grouping (Phase A)

Speed: model weights are baked into the image (fast cold starts), each request
downloads its images in parallel and runs CLIP as a single batched forward; the
edge function fans out several requests at once so Modal scales to many
containers. Deploy: `modal deploy pipeline/modal_app.py`.
"""

import io
import os
import modal

app = modal.App("imagick-pipeline")

AESTHETIC_URL = (
    "https://github.com/christophschuhmann/improved-aesthetic-predictor/"
    "raw/main/sac+logos+ava1-l14-linearMSE.pth"
)


def _download_models():
    """Run at image-build time so weights are baked in → fast cold starts."""
    import open_clip
    import torch
    from insightface.app import FaceAnalysis

    open_clip.create_model_and_transforms("ViT-L-14", pretrained="openai")
    torch.hub.load_state_dict_from_url(AESTHETIC_URL, map_location="cpu")
    FaceAnalysis(
        name="buffalo_l",
        allowed_modules=["detection", "recognition"],
        providers=["CPUExecutionProvider"],
    )


# A CUDA+cuDNN base image is what lets onnxruntime-gpu actually use the GPU for
# face detection/recognition — on debian_slim it silently falls back to slow CPU.
image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04", add_python="3.11"
    )
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "fastapi[standard]", "torch", "open_clip_torch", "insightface",
        "onnxruntime-gpu", "pillow", "numpy", "requests",
    )
    .run_function(_download_models)  # bake CLIP + aesthetic + ArcFace weights in
)

with image.imports():
    import concurrent.futures
    import numpy as np
    import requests
    import torch
    import torch.nn as nn
    import open_clip
    from PIL import Image as PILImage
    from insightface.app import FaceAnalysis


@app.cls(
    gpu="L4",
    image=image,
    secrets=[modal.Secret.from_name("imagick-pipeline-secret")],
    min_containers=0,
    max_containers=10,   # let bursts fan out across containers
)
class Pipeline:
    @modal.enter()
    def load(self):
        self.device = "cuda"
        self.clip, _, self.preprocess = open_clip.create_model_and_transforms(
            "ViT-L-14", pretrained="openai"
        )
        self.clip = self.clip.to(self.device).eval()

        class Head(nn.Module):
            def __init__(self, d=768):
                super().__init__()
                self.layers = nn.Sequential(
                    nn.Linear(d, 1024), nn.Dropout(0.2),
                    nn.Linear(1024, 128), nn.Dropout(0.2),
                    nn.Linear(128, 64), nn.Dropout(0.1),
                    nn.Linear(64, 16), nn.Linear(16, 1),
                )

            def forward(self, x):
                return self.layers(x)

        self.head = Head().to(self.device)
        self.head.load_state_dict(torch.hub.load_state_dict_from_url(AESTHETIC_URL, map_location="cpu"))
        self.head.eval()

        # Only load detection + recognition — we never use gender/age or the two
        # landmark models, and skipping them removes most of the per-face cost.
        self.faces = FaceAnalysis(
            name="buffalo_l",
            allowed_modules=["detection", "recognition"],
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        self.faces.prepare(ctx_id=0, det_size=(640, 640))
        # Confirm the face models actually landed on the GPU (CPU fallback is the
        # #1 cost trap here) — visible in the Modal logs.
        for mod_name, model in self.faces.models.items():
            print(f"[faces] {mod_name} -> {model.session.get_providers()[0]}")

    def _faces_for(self, pil):
        bgr = np.array(pil)[:, :, ::-1]
        return [
            {
                "bbox": [float(v) for v in f.bbox.tolist()],
                "det_score": float(f.det_score),
                "embedding": [float(v) for v in f.normed_embedding.tolist()],
            }
            for f in self.faces.get(bgr)
        ]

    @modal.fastapi_endpoint(method="POST")
    def process(self, data: dict):
        """
        Body: {"token": "...", "images": [{"id": "...", "url": "https://..."}]}
        Returns per image: clip (768), aesthetic (0–10), faces[].
        """
        import time

        if data.get("token") != os.environ.get("PIPELINE_TOKEN"):
            return {"error": "unauthorized"}

        items = data.get("images", [])
        results = []

        # 1) Download all images in the batch in parallel (network-bound).
        # Try the small preview first, then fall back to the original if it's missing.
        def dl(it):
            urls = [it["url"]]
            fb = it.get("fallback")
            if fb and fb != it["url"]:
                urls.append(fb)
            last_exc = None
            for url in urls:
                try:
                    r = requests.get(url, timeout=30)
                    r.raise_for_status()
                    return it["id"], PILImage.open(io.BytesIO(r.content)).convert("RGB")
                except Exception as exc:  # noqa: BLE001
                    last_exc = exc
            return it["id"], last_exc

        t0 = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
            downloaded = list(ex.map(dl, items))
        download_ms = (time.time() - t0) * 1000

        valid = [(i, img) for i, img in downloaded if not isinstance(img, Exception)]
        for iid, img in downloaded:
            if isinstance(img, Exception):
                results.append({"id": iid, "error": str(img)})

        clip_ms = 0.0
        faces_ms = 0.0
        if valid:
            # 2) CLIP + aesthetic as a single batched forward (GPU-efficient).
            t1 = time.time()
            with torch.no_grad():
                batch = torch.stack([self.preprocess(img) for _, img in valid]).to(self.device)
                feats = self.clip.encode_image(batch)
                feats = feats / feats.norm(dim=-1, keepdim=True)
                aesthetics = self.head(feats.float()).squeeze(-1).cpu().tolist()
                embs = feats.cpu().numpy().tolist()
            clip_ms = (time.time() - t1) * 1000

            # 3) Faces per image (detection is inherently per-image).
            t2 = time.time()
            for idx, (iid, img) in enumerate(valid):
                results.append({
                    "id": iid,
                    "clip": embs[idx],
                    "aesthetic": float(aesthetics[idx]) if isinstance(aesthetics, list) else float(aesthetics),
                    "faces": self._faces_for(img),
                })
            faces_ms = (time.time() - t2) * 1000

        return {
            "results": results,
            "timing": {"download_ms": download_ms, "clip_ms": clip_ms, "faces_ms": faces_ms, "count": len(valid)},
        }
