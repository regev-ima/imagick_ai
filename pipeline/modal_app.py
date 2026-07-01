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

# Zero-shot tag vocabulary: (label shown to the user, English CLIP prompt).
# CLIP (openai ViT-L/14) is English-trained, so the prompt must be English; the
# label is just for display. Tags are scored by cosine similarity against the image
# embedding we already compute — essentially free (one matmul on the GPU).
#
# TWO SEPARATE lists, on purpose:
#   USER_TAGS    — the domain/test list; this is what the *user's* tag list replaces.
#   GENERAL_TAGS — our own general-purpose suggestions, kept separate so they can be
#                  reused elsewhere. Both are combined for scoring (ALL_TAGS).
# The product's photo-style labels (from the in-app "What should I look for?" picker).
# General photography descriptors — framing, lighting, and style — not domain-specific.
USER_TAGS = [
    ("תקריב פנים", "a close-up portrait of a person's face filling the frame"),
    ("גוף מלא", "a full length photo of a person from head to toe"),
    ("קלוז-אפ", "an extreme close-up shot of a small detail or object"),
    ("פרופיל", "a side profile of a person's face looking sideways"),
    ("סביבתי", "an environmental portrait showing the person within their surroundings"),
    ("סטודיו", "a studio portrait against a plain seamless backdrop"),
    ("אור טבעי", "a portrait lit by soft natural daylight"),
    ("שחור-לבן", "a black and white monochrome photograph"),
    ("הבעה", "a person showing a strong emotional facial expression"),
    ("מונחה", "a posed portrait with the subject looking at the camera"),
    ("ספונטני", "a candid unposed moment captured spontaneously"),
    ("יצירתי", "a creative artistic photograph with dramatic unusual composition"),
]

# Our own general-purpose tags (separate from the user's list — reusable anywhere).
GENERAL_TAGS = [
    ("טבע", "nature, trees and green plants"),
    ("נוף", "a wide landscape view"),
    ("ים / מים", "the sea, a lake or water"),
    ("שמיים", "the sky with clouds"),
    ("אוכל", "food on a plate"),
    ("מבנה / אדריכלות", "a building or architecture"),
    ("רחוב / עיר", "a city street"),
    ("רכב", "a car or vehicle"),
    ("לילה", "a night scene with lights"),
    ("מסמך / טקסט", "a document or page with text"),
    ("חיה", "an animal"),
    ("ספורט", "people playing sports"),
]

# Score BOTH lists, but keep track of which is which so the UI can color them
# differently (user's own labels vs our general suggestions).
def _dedup_tags(*lists):
    seen, out = set(), []
    for lst in lists:
        for label, prompt in lst:
            if label not in seen:
                seen.add(label)
                out.append((label, prompt))
    return out


ALL_TAGS = _dedup_tags(USER_TAGS, GENERAL_TAGS)
USER_TAG_LABELS = {t[0] for t in USER_TAGS}


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
        # torch is PINNED to a CUDA-12 build: torch>=2.4 resolved to 2.9 which ships
        # CUDA *13* wheels (nvidia/cu13/lib/libcublasLt.so.13), but onnxruntime-gpu
        # 1.22 needs CUDA 12 (libcublasLt.so.12) → version mismatch, CPU fallback.
        # torch 2.6.0 ships CUDA 12.4 + cuDNN 9.1, matching onnxruntime 1.22.
        "fastapi[standard]", "torch==2.6.0", "open_clip_torch", "insightface",
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

        # Force-load EVERY bundled CUDA lib into the GLOBAL symbol namespace so
        # libonnxruntime_providers_cuda.so resolves them at dlopen. The exact error
        # we hit was "libcublasLt.so.12: cannot open" — neither preload_dlls nor
        # LD_LIBRARY_PATH made it globally visible. ctypes RTLD_GLOBAL does. Paths
        # come from `import nvidia` (no guessing); two passes so libs that depend on
        # each other resolve regardless of load order.
        import ctypes
        import glob
        self.cuda_preload = "n/a"
        try:
            import nvidia
            sos = []
            for base in nvidia.__path__:
                sos += glob.glob(os.path.join(base, "*", "lib", "*.so*"))
            loaded = 0
            for _ in range(2):
                for so in sos:
                    try:
                        ctypes.CDLL(so, mode=ctypes.RTLD_GLOBAL)
                        loaded += 1
                    except OSError:
                        pass
            self.cuda_preload = f"ctypes RTLD_GLOBAL over {len(sos)} libs"
            print(f"[cuda] ctypes-preloaded {len(sos)} nvidia libs (RTLD_GLOBAL)")
        except Exception as e:  # noqa: BLE001
            self.cuda_preload = f"ctypes preload failed: {e}"
            print("[cuda] ctypes preload failed:", e)

        # Belt-and-suspenders: onnxruntime's own bridge to torch's CUDA/cuDNN.
        import onnxruntime as ort
        self.preload_ok = "n/a"
        try:
            ort.preload_dlls(cuda=True, cudnn=True)
            self.preload_ok = "ok"
        except Exception as e:  # noqa: BLE001
            self.preload_ok = f"failed: {e}"
            print("[ort] preload_dlls failed:", e)
        self.faces_debug = ""  # full CUDA-load stderr, surfaced via /health when CPU
        print(f"[ort] version={ort.__version__} preload={self.preload_ok} "
              f"providers={ort.get_available_providers()}")

        self.clip, _, self.preprocess = open_clip.create_model_and_transforms(
            "ViT-L-14", pretrained="openai"
        )
        self.clip = self.clip.to(self.device).eval()

        # Pre-encode the tag prompts once (fixed vocabulary) → zero-shot tagging is
        # then a single image·text matmul per batch.
        self.tag_labels = [t[0] for t in ALL_TAGS]
        tokenizer = open_clip.get_tokenizer("ViT-L-14")
        with torch.no_grad():
            tok = tokenizer([f"a photo of {t[1]}" for t in ALL_TAGS]).to(self.device)
            tfeats = self.clip.encode_text(tok)
            self.tag_feats = (tfeats / tfeats.norm(dim=-1, keepdim=True)).float()

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

    def _faces_batched(self, pils):
        """Detect per image, then run ALL face recognitions across the whole batch
        in ONE GPU forward (instead of insightface's per-face calls). Uses
        insightface's own detector + alignment + recognition get_feat, so the
        embeddings are identical to the per-image path — just far fewer GPU launches,
        which is the big win on group photos with many faces.
        """
        from insightface.utils import face_align

        det = self.faces.models["detection"]
        rec = self.faces.models["recognition"]
        rec_size = rec.input_size[0] if getattr(rec, "input_size", None) else 112

        per_img = [[] for _ in pils]
        crops, owners, metas = [], [], []
        for i, pil in enumerate(pils):
            bgr = np.array(pil)[:, :, ::-1]
            bboxes, kpss = det.detect(bgr, max_num=0, metric="default")
            if bboxes is None or len(bboxes) == 0:
                continue
            for j in range(bboxes.shape[0]):
                crops.append(face_align.norm_crop(bgr, kpss[j], image_size=rec_size))
                owners.append(i)
                metas.append((bboxes[j][:4], float(bboxes[j][4])))

        if crops:
            feats = rec.get_feat(crops)               # (M, 512) in one batched forward
            norms = np.linalg.norm(feats, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            feats = feats / norms                     # == insightface normed_embedding
            for k in range(len(crops)):
                bbox, score = metas[k]
                per_img[owners[k]].append({
                    "bbox": [float(v) for v in bbox.tolist()],
                    "det_score": score,
                    "embedding": [float(v) for v in feats[k].tolist()],
                })
        return per_img

    @modal.fastapi_endpoint(method="GET")
    def health(self, url: str = ""):
        """Cheap status check — open in a browser to see if faces run on the GPU.

        Spins up one container (a fraction of a cent) and reports the provider
        WITHOUT processing any gallery, so you can confirm "GPU" before paying to
        run a full run. Pass ?url=<image-url> to also report that image's pixel
        dimensions (to check the resolution faces are actually detected on).
        """
        import onnxruntime as ort

        sample = {}
        if url:
            try:
                r = requests.get(url, timeout=30)
                r.raise_for_status()
                im = PILImage.open(io.BytesIO(r.content))
                sample = {"url": url, "dims": list(im.size), "bytes": len(r.content)}
            except Exception as e:  # noqa: BLE001
                sample = {"url": url, "error": str(e)}
        dbg = getattr(self, "faces_debug", "")
        # Keep only the error-relevant lines (drop the BFCArena INFO spam) so the
        # actual "Failed to load ... with error: <lib>" line is visible.
        err = "\n".join(
            ln for ln in dbg.splitlines()
            if any(k in ln for k in (
                "Failed to load", "TryGetProviderInfo", "cannot open",
                "ONNXRuntimeError", "error:", "FAIL", "provider_bridge"))
        )

        # Live probe: does libcublasLt.so.12 exist, and why won't it load?
        import ctypes
        import glob
        probe = {}
        try:
            search = []
            try:
                import nvidia
                probe["nvidia_path"] = list(nvidia.__path__)
                for base in nvidia.__path__:
                    probe.setdefault("nvidia_subdirs", [])
                    probe["nvidia_subdirs"] += [os.path.basename(d) for d in glob.glob(os.path.join(base, "*"))]
                    search.append(os.path.join(base, "**", "libcublasLt.so*"))
            except Exception as e:  # noqa: BLE001
                probe["nvidia_import"] = str(e)
            import torch as _t
            search.append(os.path.join(os.path.dirname(_t.__file__), "lib", "libcublasLt.so*"))
            hits = []
            for pat in search:
                hits += glob.glob(pat, recursive=True)
            probe["cublasLt_files"] = sorted(set(hits))
            if hits:
                try:
                    ctypes.CDLL(sorted(hits)[-1], mode=ctypes.RTLD_GLOBAL)
                    probe["cublasLt_load"] = "ok"
                except OSError as e:
                    probe["cublasLt_load"] = str(e)
        except Exception as e:  # noqa: BLE001
            probe["err"] = str(e)

        return {
            "faces_provider": getattr(self, "faces_provider", "?"),
            "ort_version": ort.__version__,
            "has_preload_dlls": hasattr(ort, "preload_dlls"),
            "cuda_preload": getattr(self, "cuda_preload", "n/a"),
            "preload_ok": getattr(self, "preload_ok", "n/a"),
            "cuda_load_error": err[:1200],
            "probe": probe,
            "sample": sample,
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
        do_faces = bool(data.get("faces", True))  # skip the expensive ArcFace step when off
        do_tags = bool(data.get("tags", True))    # zero-shot tags (essentially free)
        results = []

        # 1) Download all images in the batch in parallel (network-bound).
        # Try the small preview first, then fall back to the original if it's missing.
        def dl(it):
            urls = [it["url"]]
            for fb in (it.get("fallbacks") or ([it["fallback"]] if it.get("fallback") else [])):
                if fb and fb not in urls:
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
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
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
                # Zero-shot tags: cosine sim of each image to every tag prompt.
                # Return ALL tags (sorted) — the UI mean-centers per tag to cancel
                # each tag's baseline bias (otherwise one "sticky" tag wins everywhere).
                tag_lists = [[] for _ in valid]
                if do_tags:
                    sims = feats.float() @ self.tag_feats.T          # (N, T)
                    order = sims.argsort(dim=-1, descending=True)
                    for n in range(sims.shape[0]):
                        tag_lists[n] = [
                            {
                                "tag": self.tag_labels[j],
                                "score": round(float(sims[n, j]), 4),
                                "src": "user" if self.tag_labels[j] in USER_TAG_LABELS else "general",
                            }
                            for j in order[n].tolist()
                        ]
                embs = feats.cpu().numpy().tolist()
            clip_ms = (time.time() - t1) * 1000

            # 3) Faces: detect per image, recognize all faces in one batched forward.
            # Skipped entirely when faces are off (the heaviest, premium-gated step).
            t2 = time.time()
            per_img_faces = self._faces_batched([img for _, img in valid]) if do_faces else [[] for _ in valid]
            for idx, (iid, _img) in enumerate(valid):
                results.append({
                    "id": iid,
                    "clip": embs[idx],
                    "aesthetic": float(aesthetics[idx]) if isinstance(aesthetics, list) else float(aesthetics),
                    "faces": per_img_faces[idx],
                    "tags": tag_lists[idx],
                })
            faces_ms = (time.time() - t2) * 1000

        return {
            "results": results,
            "timing": {
                "download_ms": download_ms, "clip_ms": clip_ms, "faces_ms": faces_ms,
                "count": len(valid), "faces_provider": getattr(self, "faces_provider", "?"),
            },
        }
