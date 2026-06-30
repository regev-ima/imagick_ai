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


# onnxruntime-gpu's CUDA provider is a separately dlopen'd plugin whose dependency
# chain (split cuDNN 9 sub-libs + libnvrtc + libnvJitLink + libcublasLt + libcudart)
# must be resolvable by the dynamic loader AT session-creation time. A build-time
# ldconfig edit or an in-process os.environ set is too late, so two robust levers are
# used together: (1) onnxruntime-gpu >= 1.22 exposes ort.preload_dlls(), the official
# bridge that loads torch's bundled CUDA/cuDNN into the process; (2) LD_LIBRARY_PATH is
# baked at the IMAGE level so the libs are on the loader path before the process starts.
# torch>=2.4 already ships cuDNN 9.x — we deliberately do NOT also pin nvidia-cudnn-cu12,
# since two cuDNN trees cause partial-load failures.
_SITE = "/usr/local/lib/python3.11/site-packages"
_LD_LIBRARY_PATH = ":".join([
    f"{_SITE}/nvidia/cudnn/lib",      # cuDNN first
    f"{_SITE}/nvidia/cublas/lib",
    f"{_SITE}/nvidia/cuda_runtime/lib",
    f"{_SITE}/nvidia/cuda_nvrtc/lib",
    f"{_SITE}/nvidia/nvjitlink/lib",
    f"{_SITE}/nvidia/cufft/lib",
    f"{_SITE}/nvidia/curand/lib",
    f"{_SITE}/torch/lib",
])

# Keep the image SMALL (debian_slim) so cold starts on a scale-to-zero GPU stay fast
# and cheap — no multi-GB CUDA devel image is needed once the loader paths are right.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "fastapi[standard]", "torch>=2.4", "open_clip_torch", "insightface",
        "onnxruntime-gpu>=1.22,<1.23",   # >=1.21 required for preload_dlls(); 1.22 = CUDA12 + cuDNN9
        "pillow", "numpy", "requests",
    )
    .env({"LD_LIBRARY_PATH": _LD_LIBRARY_PATH})  # present at exec time, before any dlopen
    .run_function(_download_models)               # bake CLIP + aesthetic + ArcFace weights in
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
    min_containers=0,        # scale to zero → $0 when idle
    max_containers=3,        # cap parallel GPU burn (cost + capacity safety)
    timeout=300,             # hard ceiling per request — nothing runs unbounded
    scaledown_window=60,     # release the GPU ~1 min after the last call
)
class Pipeline:
    @modal.enter()
    def load(self):
        self.device = "cuda"

        # Bridge torch's bundled CUDA/cuDNN into the process so onnxruntime's CUDA
        # provider can resolve them when it builds face sessions below. torch is
        # imported first (via image.imports) and primes the loader; preload_dlls
        # (onnxruntime >= 1.21) then loads CUDA + cuDNN from site-packages/nvidia/*.
        import onnxruntime as ort
        self.preload_ok = "n/a"
        try:
            ort.preload_dlls(cuda=True, cudnn=True)
            self.preload_ok = "ok"
        except Exception as e:  # noqa: BLE001
            self.preload_ok = f"failed: {e}"
            print("[ort] preload_dlls failed (LD_LIBRARY_PATH should still cover it):", e)
        self.faces_debug = ""  # full CUDA-load stderr, surfaced via /health when CPU
        print(f"[ort] version={ort.__version__} preload={self.preload_ok} "
              f"providers={ort.get_available_providers()}")

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

        avail = ort.get_available_providers()  # ort imported + preloaded at the top

        # Only load detection + recognition — we never use gender/age or the two
        # landmark models, and skipping them removes most of the per-face cost.
        self.faces = FaceAnalysis(
            name="buffalo_l",
            allowed_modules=["detection", "recognition"],
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        self.faces.prepare(ctx_id=0, det_size=(640, 640))

        # InsightFace often builds its onnx sessions on CPU even when handed CUDA
        # providers (diagnosed as "init-ok-but-unused": the raw CUDA provider works,
        # insightface just doesn't use it). Since CUDA is healthy here, rebuild each
        # model's session on the GPU ourselves — this is what actually moves face
        # detection/recognition off the CPU.
        if "CUDAExecutionProvider" in avail:
            for mod_name, model in self.faces.models.items():
                mf = getattr(model, "model_file", None)
                if mf and "CUDA" not in model.session.get_providers()[0]:
                    model.session = ort.InferenceSession(
                        mf, providers=["CUDAExecutionProvider", "CPUExecutionProvider"]
                    )
                    print(f"[faces] rebuilt {mod_name} session on {model.session.get_providers()[0]}")

        # Confirm where the face models actually landed, surfaced in the response.
        provs = {model.session.get_providers()[0] for model in self.faces.models.values()}
        for mod_name, model in self.faces.models.items():
            print(f"[faces] {mod_name} -> {model.session.get_providers()[0]}")
        if any("CUDA" in p for p in provs):
            self.faces_provider = "GPU"
        elif "CUDAExecutionProvider" not in avail:
            self.faces_provider = "CPU (no-cuda-ep)"  # onnxruntime can't load CUDA libs
        else:
            # CUDA is listed as available but every session still falls back to CPU.
            # onnxruntime logs WHY at the C++ level (a missing/mismatched .so) but
            # only to stderr — capture that fd while forcing CUDA to read the reason.
            import os as _os
            import tempfile
            mf = next((getattr(m, "model_file", None) for m in self.faces.models.values()
                       if getattr(m, "model_file", None)), None)
            captured = ""
            if mf:
                tf = tempfile.TemporaryFile()
                old = _os.dup(2)
                _os.dup2(tf.fileno(), 2)
                try:
                    ort.set_default_logger_severity(0)  # VERBOSE — surface the real dlopen error
                    try:
                        ort.InferenceSession(mf, providers=["CUDAExecutionProvider"])
                    except Exception:  # noqa: BLE001
                        pass
                finally:
                    _os.dup2(old, 2)
                    _os.close(old)
                tf.seek(0)
                captured = tf.read().decode(errors="ignore")
                tf.close()
            print("[faces] CUDA EP stderr (full):\n", captured)
            # Keep the full text (surfaced via /health) so we see exactly which lib
            # the CUDA provider failed on, plus a short summary in the badge.
            self.faces_debug = captured.replace("\x1b[1;31m", "").replace("\x1b[0;93m", "").replace("\x1b[0m", "")
            culprit = next((ln.strip() for ln in captured.splitlines()
                            if "cannot open shared object" in ln), None)
            keys = ("Failed to load", "cannot open", "cuDNN", "libcud", "libcub", "libnv", ".so", "version")
            lines = [ln.strip() for ln in captured.splitlines() if any(k in ln for k in keys)]
            msg = (culprit or (lines[-1] if lines else "no-stderr"))[:220]
            self.faces_provider = f"CPU: {msg}"

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

    @modal.fastapi_endpoint(method="GET")
    def health(self):
        """Cheap status check — open in a browser to see if faces run on the GPU.

        Spins up one container (a fraction of a cent) and reports the provider
        WITHOUT processing any gallery, so you can confirm "GPU" before paying to
        run a full run.
        """
        import onnxruntime as ort
        return {
            "faces_provider": getattr(self, "faces_provider", "?"),
            "ort_version": ort.__version__,
            "has_preload_dlls": hasattr(ort, "preload_dlls"),
            "preload_ok": getattr(self, "preload_ok", "n/a"),
            "cuda_load_error": getattr(self, "faces_debug", "")[-1200:],  # full, untruncated
            "ort_providers": ort.get_available_providers(),
            "gpu_ok": str(getattr(self, "faces_provider", "")).startswith("GPU"),
        }

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
            "timing": {
                "download_ms": download_ms, "clip_ms": clip_ms, "faces_ms": faces_ms,
                "count": len(valid), "faces_provider": getattr(self, "faces_provider", "?"),
            },
        }
