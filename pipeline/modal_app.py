"""
Phase-A GPU engine — the cheap heart of the pipeline.

ONE batched pass over a gallery's images on a serverless GPU that scales to
zero (≈$0 when idle), producing everything the cheap layers need:

  • CLIP embedding (ViT-L/14)            → image clustering + zero-shot tagging
  • aesthetic score (LAION head on CLIP) → ranking within a group (Phase B)
  • ArcFace face embeddings (InsightFace)→ accurate face grouping (Phase A)

One CLIP compute → both the embedding and the aesthetic score (the head is a
tiny matrix multiply, essentially free). Faces come from InsightFace buffalo_l,
which is detection + ArcFace recognition — the production-grade model.

Deploy:
    pip install modal
    modal token new
    modal secret create imagick-pipeline-secret PIPELINE_TOKEN=<a-long-random-string>
    modal deploy pipeline/modal_app.py
Modal prints a public URL; POST to it with the same PIPELINE_TOKEN.
"""

import io
import os
import modal

app = modal.App("imagick-pipeline")

image = (
    modal.Image.debian_slim()
    .apt_install("libgl1", "libglib2.0-0")  # for insightface / opencv
    .pip_install(
        "fastapi[standard]",
        "torch",
        "open_clip_torch",
        "insightface",
        "onnxruntime-gpu",
        "pillow",
        "numpy",
        "requests",
    )
)

# LAION aesthetic predictor head for CLIP ViT-L/14 (768-d) embeddings.
AESTHETIC_URL = (
    "https://github.com/christophschuhmann/improved-aesthetic-predictor/"
    "raw/main/sac+logos+ava1-l14-linearMSE.pth"
)

with image.imports():
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
)
class Pipeline:
    @modal.enter()
    def load(self):
        """Load every model once per warm container (keeps cold starts amortized)."""
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
        self.head.load_state_dict(
            torch.hub.load_state_dict_from_url(AESTHETIC_URL, map_location="cpu")
        )
        self.head.eval()

        self.faces = FaceAnalysis(
            name="buffalo_l",
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        self.faces.prepare(ctx_id=0, det_size=(640, 640))

    def _one(self, img_id, url):
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        pil = PILImage.open(io.BytesIO(resp.content)).convert("RGB")

        with torch.no_grad():
            t = self.preprocess(pil).unsqueeze(0).to(self.device)
            feat = self.clip.encode_image(t)
            feat = feat / feat.norm(dim=-1, keepdim=True)
            aesthetic = float(self.head(feat.float()).squeeze().cpu())
            clip_emb = feat.squeeze(0).cpu().numpy().tolist()

        bgr = np.array(pil)[:, :, ::-1]  # RGB → BGR for insightface
        faces = [
            {
                "bbox": [float(v) for v in f.bbox.tolist()],
                "det_score": float(f.det_score),
                "embedding": [float(v) for v in f.normed_embedding.tolist()],  # 512-d, L2-normalized
            }
            for f in self.faces.get(bgr)
        ]
        return {"id": img_id, "clip": clip_emb, "aesthetic": aesthetic, "faces": faces}

    @modal.fastapi_endpoint(method="POST")
    def process(self, data: dict):
        """
        Body: {"token": "...", "images": [{"id": "...", "url": "https://..."}]}
        Returns per image: clip embedding (768), aesthetic (0–10), faces[].
        """
        if data.get("token") != os.environ.get("PIPELINE_TOKEN"):
            return {"error": "unauthorized"}

        results = []
        for item in data.get("images", []):
            try:
                results.append(self._one(item["id"], item["url"]))
            except Exception as exc:  # one bad image must not fail the batch
                results.append({"id": item.get("id"), "error": str(exc)})
        return {"results": results}
