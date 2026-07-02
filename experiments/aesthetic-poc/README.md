# ניסוי: ניקוד אסתטי + קיבוץ תמונות (PoC)

ניסוי עצמאי לאימות הגישה **לפני** בניית תשתית. אפס שרתים, אפס עלות.
מוכיח בריצה אחת את שלושת היעדים: ציון 0–1 לכל תמונה, קיבוץ תמונות דומות,
ובחירת הטובות (מיון).

זה ה-pipeline שירוץ ב-production, רק מוקטן: `CLIP embedding` אחד לכל תמונה →
ממנו נגזרים גם הציון (ראש אסתטי זעיר) וגם הקיבוץ (cosine).

## מה צריך לבדוק
קח 100–200 תמונות שאתה **כבר יודע** אילו מהן טובות. אם המיון בגלריה
תואם לעין שלך — ההנחה אומתה, שווה לבנות. אם לא — חסכת חודש פיתוח.

## הרצה מקומית

```bash
cd experiments/aesthetic-poc
pip install -r requirements.txt
python score_images.py /path/to/photos
# פתח את out/gallery.html בדפדפן
```

ריצה ראשונה מורידה את CLIP (~1.7GB) ואת הראש האסתטי (~5KB) — נשמר בקאש.
על CPU זה עובד אך איטי; עם GPU זה מהיר מאוד.

## הרצה ב-Google Colab (GPU בחינם, ללא התקנה — מומלץ)

1. פתח https://colab.research.google.com → Runtime → Change runtime type → **GPU**.
2. העלה תיקיית תמונות (או חבר Google Drive).
3. הדבק בתא:

```python
!pip -q install open_clip_torch scikit-learn
!wget -q https://raw.githubusercontent.com/<your-repo>/experiments/aesthetic-poc/score_images.py
!python score_images.py /content/photos
```

4. הורד את `out/gallery.html` וצפה.

## פלט

- `out/gallery.html` — גלריה ממוינת מהטוב לפחות, עם תווית קבוצה לכל תמונה.
- `out/scores.csv` — `file, score_0_1, score_0_5, raw_aesthetic, cluster`.

## כוונון

| דגל | ברירת מחדל | משמעות |
|---|---|---|
| `--clusters` | `0.18` | סף מרחק לקיבוץ. קטן = קבוצות הדוקות, גדול = רופפות |
| `--out` | `out` | תיקיית פלט |
| `--batch` | `16` | גודל batch (הקטן אם נגמר זיכרון GPU) |

## מה הניסוי **לא** בודק
- מודל אסתטי כללי (LAION/AVA) ולא מאומן על הסגנון הספציפי שלך. אם התוצאה
  קרובה אבל לא מושלמת — זה צפוי, וב-production מכווננים ראש משלך על דירוגים שלך.
- תיוג סמנטי (zero-shot על תגיות) — הצעד הבא אחרי שהציון אומת.
