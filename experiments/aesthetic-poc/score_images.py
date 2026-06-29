#!/usr/bin/env python3
"""
Aesthetic scoring + clustering — proof of concept.

ניסוי עצמאי לאימות הגישה לפני בניית תשתית. עובד על תיקיית תמונות מקומית,
לא נוגע באף מערכת קיימת. עושה שלושה דברים בריצה אחת:

  1. ציון אסתטי לכל תמונה (0..1)  — LAION aesthetic predictor מעל CLIP
  2. קיבוץ תמונות דומות לקבוצות    — clustering על אותם embeddings
  3. פלט גלריה HTML ממוינת לפי ציון, עם תווית קבוצה לכל תמונה

זה בדיוק ה-pipeline שירוץ ב-production, רק מוקטן: embedding אחד -> גם ציון,
גם קיבוץ. אם המיון תואם לעין שלך — ההנחה אומתה.

הרצה:
    pip install -r requirements.txt
    python score_images.py /path/to/photos
    # פתח את out/gallery.html בדפדפן

דגלים שימושיים:
    --clusters 0.18   # סף מרחק לקיבוץ (קטן יותר = קבוצות הדוקות יותר)
    --out ./out       # תיקיית פלט
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import open_clip
from PIL import Image
from sklearn.cluster import AgglomerativeClustering

# ── תצורה ──────────────────────────────────────────────────────────────────
# הראש האסתטי של LAION מאומן ספציפית מעל CLIP ViT-L/14. חייבים להתאים.
CLIP_MODEL = "ViT-L-14"
CLIP_PRETRAINED = "openai"
# משקלי הראש האסתטי (קובץ קטן ~5KB). נטען אוטומטית בריצה ראשונה.
AESTHETIC_WEIGHTS_URL = (
    "https://github.com/christophschuhmann/"
    "improved-aesthetic-predictor/raw/main/sac+logos+ava1-l14-linearMSE.pth"
)
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}


class AestheticHead(nn.Module):
    """הראש הזעיר שממפה embedding של CLIP -> ציון אסתטי (~1..10)."""

    def __init__(self, in_dim: int = 768):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(in_dim, 1024), nn.Dropout(0.2),
            nn.Linear(1024, 128), nn.Dropout(0.2),
            nn.Linear(128, 64), nn.Dropout(0.1),
            nn.Linear(64, 16),
            nn.Linear(16, 1),
        )

    def forward(self, x):
        return self.layers(x)


def load_aesthetic_head(device: str) -> AestheticHead:
    """מוריד (פעם אחת, נשמר בקאש) וטוען את משקלי הראש האסתטי."""
    state = torch.hub.load_state_dict_from_url(
        AESTHETIC_WEIGHTS_URL, map_location="cpu", progress=True
    )
    head = AestheticHead(768)
    head.load_state_dict(state)
    return head.to(device).eval()


def find_images(folder: Path) -> list[Path]:
    return sorted(p for p in folder.rglob("*") if p.suffix.lower() in IMAGE_EXTS)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", type=Path, help="תיקיית התמונות לניסוי")
    ap.add_argument("--out", type=Path, default=Path("out"))
    ap.add_argument("--clusters", type=float, default=0.18,
                    help="סף מרחק קוסינוס לקיבוץ (0.1 הדוק .. 0.3 רופף)")
    ap.add_argument("--batch", type=int, default=16)
    args = ap.parse_args()

    if not args.folder.is_dir():
        print(f"לא נמצאה תיקייה: {args.folder}", file=sys.stderr)
        return 1

    images = find_images(args.folder)
    if not images:
        print(f"אין תמונות ב-{args.folder}", file=sys.stderr)
        return 1

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"מכשיר: {device} | תמונות: {len(images)}")

    print("טוען CLIP…")
    model, _, preprocess = open_clip.create_model_and_transforms(
        CLIP_MODEL, pretrained=CLIP_PRETRAINED
    )
    model = model.to(device).eval()
    head = load_aesthetic_head(device)

    # ── 1+2: embedding לכל תמונה (משם נגזרים גם הציון וגם הקיבוץ) ──
    embeddings: list[np.ndarray] = []
    raw_scores: list[float] = []
    kept: list[Path] = []

    with torch.no_grad():
        for i in range(0, len(images), args.batch):
            batch_paths = images[i : i + args.batch]
            tensors, ok_paths = [], []
            for p in batch_paths:
                try:
                    img = Image.open(p).convert("RGB")
                    tensors.append(preprocess(img))
                    ok_paths.append(p)
                except Exception as e:  # noqa: BLE001
                    print(f"  דילוג על {p.name}: {e}", file=sys.stderr)
            if not tensors:
                continue

            x = torch.stack(tensors).to(device)
            feats = model.encode_image(x)
            feats = feats / feats.norm(dim=-1, keepdim=True)  # נרמול לקיבוץ
            scores = head(feats.float()).squeeze(-1)          # ציון אסתטי גולמי

            embeddings.extend(feats.cpu().numpy())
            raw_scores.extend(scores.cpu().numpy().tolist())
            kept.extend(ok_paths)
            print(f"  עובד… {len(kept)}/{len(images)}")

    emb = np.array(embeddings)
    raw = np.array(raw_scores)

    # נרמול הציון הגולמי (~1..10) ל-0..1 על בסיס הגלריה הזו
    lo, hi = float(raw.min()), float(raw.max())
    norm = (raw - lo) / (hi - lo) if hi > lo else np.zeros_like(raw)

    # ── 2: קיבוץ לפי דמיון (אותם embeddings, cosine) ──
    if len(kept) > 1:
        labels = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=args.clusters,
            metric="cosine",
            linkage="average",
        ).fit_predict(emb)
    else:
        labels = np.zeros(len(kept), dtype=int)
    n_clusters = len(set(labels))
    print(f"נמצאו {n_clusters} קבוצות")

    # ── 3: פלט ──
    args.out.mkdir(parents=True, exist_ok=True)
    rows = sorted(
        zip(kept, norm.tolist(), raw.tolist(), labels.tolist()),
        key=lambda r: r[1],
        reverse=True,
    )

    with open(args.out / "scores.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "score_0_1", "score_0_5", "raw_aesthetic", "cluster"])
        for path, n, r, c in rows:
            w.writerow([path.name, f"{n:.4f}", f"{n * 5:.2f}", f"{r:.3f}", c])

    write_gallery(args.out / "gallery.html", rows)
    print(f"\nהושלם. פתח: {args.out / 'gallery.html'}")
    print(f"CSV:  {args.out / 'scores.csv'}")
    return 0


def write_gallery(path: Path, rows) -> None:
    cards = []
    for img_path, n, _r, c in rows:
        uri = img_path.resolve().as_uri()
        cards.append(
            f'<figure><img loading="lazy" src="{uri}">'
            f'<figcaption><b>{n * 5:.1f}</b> / 5'
            f'<span class="g">קבוצה {c}</span></figcaption></figure>'
        )
    html = f"""<!doctype html><html dir="rtl" lang="he"><meta charset="utf-8">
<title>ניסוי ניקוד אסתטי</title>
<style>
 body{{font-family:system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:24px}}
 h1{{font-size:18px}}
 .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}}
 figure{{margin:0;background:#1c1c1c;border-radius:10px;overflow:hidden}}
 img{{width:100%;height:200px;object-fit:cover;display:block}}
 figcaption{{padding:8px 10px;font-size:13px;display:flex;justify-content:space-between}}
 .g{{color:#9aa;font-size:11px}}
 b{{color:#7fd}}
</style>
<h1>ממוין מהטוב לפחות — {len(rows)} תמונות</h1>
<div class="grid">{''.join(cards)}</div>
</html>"""
    path.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
