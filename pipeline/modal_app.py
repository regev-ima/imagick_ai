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
    FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])


image = (
    modal.Image.debian_slim()
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

        self.faces = FaceAnalysis(
            name="buffalo_l", providers=["CUDAExecutionProvider", "CPUExecutionProvider"]
        )
        self.faces.prepare(ctx_id=0, det_size=(640, 640))

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
        if data.get("token") != os.environ.get("PIPELINE_TOKEN"):
            return {"error": "unauthorized"}

        items = data.get("images", [])
        results = []

        # 1) Download all images in the batch in parallel (network-bound).
        def dl(it):
            try:
                r = requests.get(it["url"], timeout=30)
                r.raise_for_status()
                return it["id"], PILImage.open(io.BytesIO(r.content)).convert("RGB")
            except Exception as exc:  # noqa: BLE001
                return it["id"], exc

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
            downloaded = list(ex.map(dl, items))

        valid = [(i, img) for i, img in downloaded if not isinstance(img, Exception)]
        for iid, img in downloaded:
            if isinstance(img, Exception):
                results.append({"id": iid, "error": str(img)})

        if valid:
            # 2) CLIP + aesthetic as a single batched forward (GPU-efficient).
            with torch.no_grad():
                batch = torch.stack([self.preprocess(img) for _, img in valid]).to(self.device)
                feats = self.clip.encode_image(batch)
                feats = feats / feats.norm(dim=-1, keepdim=True)
                aesthetics = self.head(feats.float()).squeeze(-1).cpu().tolist()
                embs = feats.cpu().numpy().tolist()

            # 3) Faces per image (detection is inherently per-image).
            for idx, (iid, img) in enumerate(valid):
                results.append({
                    "id": iid,
                    "clip": embs[idx],
                    "aesthetic": float(aesthetics[idx]) if isinstance(aesthetics, list) else float(aesthetics),
                    "faces": self._faces_for(img),
                })

        return {"results": results}
