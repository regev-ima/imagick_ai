import { useMemo, useState } from "react";
import {
  Sparkles, Star, Eye, EyeOff, Camera, Users, Crown, AlertTriangle,
  CheckCircle2, LayoutGrid, Settings2, ImagePlus, SlidersHorizontal,
} from "lucide-react";

/**
 * DESIGN MOCK (not wired to any backend) — for approval before we integrate the AI
 * pipeline into the real client gallery, the gallery-creation flow, and settings.
 * Everything here is sample data. Route: /preview/mock
 */

// ── sample data ─────────────────────────────────────────────────────────────
type Eyes = "open" | "closed" | "mixed" | "none";
interface Img {
  id: number; seed: number; rating: number; category: string; tags: string[];
  eyes: Eyes; expr: string; look: boolean; keeper: boolean; hero: boolean;
  blur: boolean; expo: boolean; people: number; group: number;
}
const CATS = ["טקס", "ריקודים", "משפחה וקבלת פנים", "הכנות", "צילום חוץ"];
const TAGS = ["ספונטני", "פרופיל", "קלוז-אפ", "תקריב פנים", "אור טבעי", "מונחה", "יצירתי", "הבעה"];
const EXPRS = ["חיוך", "רגש חזק", "ניטרלי", "צחוק"];

const IMAGES: Img[] = Array.from({ length: 15 }, (_, i) => {
  const r = 0.55 + ((i * 37) % 45) / 100; // 0.55–1.0
  return {
    id: i, seed: 30 + i, rating: Math.min(1, r), category: CATS[i % CATS.length],
    tags: [TAGS[i % TAGS.length], TAGS[(i * 3 + 2) % TAGS.length]].filter((v, k, a) => a.indexOf(v) === k),
    eyes: (["open", "open", "open", "closed", "mixed"] as Eyes[])[i % 5],
    expr: EXPRS[i % EXPRS.length], look: i % 3 !== 0,
    keeper: r >= 0.72, hero: r >= 0.9 && i % 4 === 0,
    blur: i % 7 === 3, expo: i % 9 === 4, people: 1 + (i % 4), group: i % 4,
  };
});

const stars = (r: number) => (r * 5).toFixed(1);

// ── shared bits ─────────────────────────────────────────────────────────────
function Chip({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "fuchsia" | "amber" | "green" | "red" }) {
  const map = {
    blue: "bg-blue-600/90", fuchsia: "bg-fuchsia-600/90", amber: "bg-amber-500/90",
    green: "bg-emerald-600/90", red: "bg-red-600/90",
  };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white ${map[tone]}`}>{children}</span>;
}

function Toggle({ on, label, hint, onChange }: { on: boolean; label: string; hint?: string; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <button type="button" onClick={() => onChange(!on)}
        className={`relative h-5 w-9 rounded-full transition ${on ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "right-0.5" : "right-4"}`} />
      </button>
      <span className="text-foreground">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

// ── card ────────────────────────────────────────────────────────────────────
function Card({ im }: { im: Img }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img src={`https://picsum.photos/seed/${im.seed}/400/400`} alt="" loading="lazy"
          className="h-full w-full object-cover" />
        <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-bold text-white">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{stars(im.rating)}
        </span>
        <div className="absolute left-2 top-2 flex gap-1">
          {im.keeper && <span className="flex items-center gap-0.5 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white"><CheckCircle2 className="h-3 w-3" />שמור</span>}
          {im.hero && <span className="flex items-center gap-0.5 rounded bg-yellow-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white"><Crown className="h-3 w-3" />שער</span>}
        </div>
      </div>
      <div className="space-y-1.5 p-2">
        <div className="flex flex-wrap items-center gap-1">
          <Chip tone="fuchsia">{im.category}</Chip>
          {(im.blur || im.expo) && <Chip tone="red"><AlertTriangle className="inline h-2.5 w-2.5" /> {im.blur ? "טשטוש" : "חשיפה"}</Chip>}
        </div>
        {/* AI signal row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            {im.eyes === "closed" ? <EyeOff className="h-3 w-3 text-red-400" /> : <Eye className="h-3 w-3 text-emerald-400" />}
            {im.eyes === "open" ? "עיניים פקוחות" : im.eyes === "closed" ? "עצומות" : "חלקי"}
          </span>
          <span>· {im.expr}</span>
          {im.look && <span className="flex items-center gap-0.5">· <Camera className="h-3 w-3" /> מבט למצלמה</span>}
          <span className="flex items-center gap-0.5">· <Users className="h-3 w-3" />{im.people}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {im.tags.map((t) => <Chip key={t} tone="blue">{t}</Chip>)}
        </div>
      </div>
    </div>
  );
}

// ── TAB 1: client gallery ───────────────────────────────────────────────────
function ClientGalleryMock() {
  const [keeperOnly, setKeeperOnly] = useState(false);
  const [cat, setCat] = useState<string | null>(null);
  const [sort, setSort] = useState<"rating" | "keeper">("rating");

  const shown = useMemo(() => {
    let a = [...IMAGES];
    if (keeperOnly) a = a.filter((i) => i.keeper);
    if (cat) a = a.filter((i) => i.category === cat);
    a.sort((x, y) => sort === "rating" ? y.rating - x.rating : Number(y.keeper) - Number(x.keeper) || y.rating - x.rating);
    return a;
  }, [keeperOnly, cat, sort]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <div className="mb-2 text-sm font-medium text-foreground">כך הצלם רואה את הגלריה — עם תובנות ה-AI</div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button onClick={() => setKeeperOnly(!keeperOnly)}
            className={`flex items-center gap-1 rounded-full px-3 py-1 font-medium ${keeperOnly ? "bg-emerald-600 text-white" : "border border-border text-muted-foreground hover:text-foreground"}`}>
            <CheckCircle2 className="h-3.5 w-3.5" /> מומלצים לשמירה בלבד
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(cat === c ? null : c)}
              className={`rounded-full px-2.5 py-1 font-medium ${cat === c ? "bg-fuchsia-600 text-white" : "border border-border text-muted-foreground hover:text-foreground"}`}>{c}</button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <label className="flex items-center gap-1 text-muted-foreground">מיון:
            <select value={sort} onChange={(e) => setSort(e.target.value as "rating" | "keeper")}
              className="rounded-md border border-border bg-surface-2 px-2 py-1">
              <option value="rating">דירוג AI</option>
              <option value="keeper">מומלצים קודם</option>
            </select>
          </label>
          <span className="ms-auto text-muted-foreground">{shown.length} תמונות</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {shown.map((im) => <Card key={im.id} im={im} />)}
      </div>
    </div>
  );
}

// ── TAB 2: create gallery ───────────────────────────────────────────────────
function CreateGalleryMock() {
  const [s, setS] = useState({ rate: true, tag: true, group: true, faces: true, eyes: true, expr: true, keeper: true, hero: true });
  const set = (k: keyof typeof s) => (v: boolean) => setS((o) => ({ ...o, [k]: v }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <label className="text-sm font-medium text-foreground">שם הגלריה</label>
          <input defaultValue="חתונה — דנה ויוסי" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="flex aspect-[2/1] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface-2 text-muted-foreground">
          <ImagePlus className="h-8 w-8" />
          <span className="text-sm">גרור תמונות לכאן או לחץ להעלאה</span>
        </div>
      </div>
      <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground"><SlidersHorizontal className="h-4 w-4" /> מה ה-AI יעשה</div>
        <div className="grid grid-cols-2 gap-y-2">
          <Toggle on={s.rate} label="דירוג" hint="VLM" onChange={set("rate")} />
          <Toggle on={s.tag} label="תיוג" hint="VLM" onChange={set("tag")} />
          <Toggle on={s.group} label="קיבוץ תמונות" onChange={set("group")} />
          <Toggle on={s.faces} label="זיהוי אנשים" onChange={set("faces")} />
        </div>
        <div className="border-t border-border pt-2 text-xs font-medium text-muted-foreground">תובנות נוספות (כמעט ללא עלות):</div>
        <div className="grid grid-cols-2 gap-y-2">
          <Toggle on={s.eyes} label="עיניים פקוחות/עצומות" onChange={set("eyes")} />
          <Toggle on={s.expr} label="הבעה + מבט למצלמה" onChange={set("expr")} />
          <Toggle on={s.keeper} label="מומלץ לשמור" onChange={set("keeper")} />
          <Toggle on={s.hero} label="שער + דגלים טכניים" onChange={set("hero")} />
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
          <label className="text-xs text-muted-foreground">מודל AI
            <select className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
              <option>OpenAI: GPT-4o-mini · קלט $0.15 · פלט $0.60</option>
              <option>Google: Gemini 2.0 Flash · קלט $0.10</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">מרווח זמן קיבוץ (שנ')
            <input type="number" defaultValue={600} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
          </label>
        </div>
        <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">צור והרץ AI</button>
      </div>
    </div>
  );
}

// ── TAB 3: settings (models + router) ───────────────────────────────────────
const SAMPLE_MODELS = [
  { id: "google/gemini-2.0-flash-001", name: "Google: Gemini 2.0 Flash", in: 0.10, out: 0.40 },
  { id: "openai/gpt-4o-mini", name: "OpenAI: GPT-4o-mini", in: 0.15, out: 0.60 },
  { id: "anthropic/claude-3.5-haiku", name: "Anthropic: Claude 3.5 Haiku", in: 0.80, out: 4.0 },
  { id: "openai/gpt-4o", name: "OpenAI: GPT-4o", in: 2.5, out: 10 },
  { id: "anthropic/claude-3.5-sonnet", name: "Anthropic: Claude 3.5 Sonnet", in: 3.0, out: 15 },
  { id: "google/gemini-1.5-pro", name: "Google: Gemini 1.5 Pro", in: 1.25, out: 5.0 },
];
function SettingsMock() {
  const [router, setRouter] = useState<"specific" | "auto">("specific");
  const [target, setTarget] = useState(SAMPLE_MODELS[1].id);
  const cur = SAMPLE_MODELS.find((m) => m.id === target);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
        <span className="text-muted-foreground">יעד השידור הנוכחי (LLM):</span>{" "}
        <b className="text-foreground">{router === "auto" ? "Auto Router (בחירה אוטומטית)" : cur?.name}</b>
      </div>
      <div className="rounded-lg border border-border bg-surface-2 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground"><Settings2 className="h-4 w-4" /> מודל ניתוח התמונות (OpenRouter)</div>
        <div className="mb-3 flex gap-2 text-sm">
          {(["specific", "auto"] as const).map((r) => (
            <button key={r} onClick={() => setRouter(r)}
              className={`rounded-md border px-3 py-1.5 font-medium ${router === r ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {r === "specific" ? "מודל ספציפי" : "Auto Router"}
            </button>
          ))}
        </div>
        {router === "auto" ? (
          <p className="text-sm text-muted-foreground">OpenRouter יבחר אוטומטית מודל זמין/משתלם לכל בקשה. נוח, אבל פחות צפוי בעלות.</p>
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="text-muted-foreground"><tr className="border-b border-border">
              <th className="py-1 font-medium">מודל</th><th className="py-1 font-medium">קלט /1M</th><th className="py-1 font-medium">פלט /1M</th><th></th>
            </tr></thead>
            <tbody>
              {SAMPLE_MODELS.map((m) => (
                <tr key={m.id} className={`border-b border-border/50 ${m.id === target ? "bg-primary/5" : ""}`}>
                  <td className="py-1.5 text-foreground">{m.name}</td>
                  <td className="py-1.5">${m.in.toFixed(2)}</td>
                  <td className="py-1.5">${m.out.toFixed(2)}</td>
                  <td className="py-1.5">
                    <button onClick={() => setTarget(m.id)}
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${m.id === target ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>
                      {m.id === target ? "יעד נוכחי" : "בחר"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">הרשימה המלאה תיטען חיה מ-OpenRouter, ממוינת מהזול ליקר (כמו בדף הבדיקות). זו רק דוגמה.</p>
      </div>
    </div>
  );
}

// ── shell ───────────────────────────────────────────────────────────────────
export default function AiMock() {
  const [tab, setTab] = useState<"gallery" | "create" | "settings">("gallery");
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-1 flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Mock — שילוב ה-AI בגלריית הלקוח, יצירה והגדרות</h1>
        </header>
        <p className="mb-5 text-xs text-muted-foreground">עיצוב לאישור בלבד · נתוני דוגמה · לא מחובר ל-backend</p>

        <div className="mb-5 flex gap-2">
          {([["gallery", "גלריית לקוח", LayoutGrid], ["create", "יצירת גלריה", ImagePlus], ["settings", "הגדרות AI", Settings2]] as const).map(
            ([k, label, Icon]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium ${tab === k ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ),
          )}
        </div>

        {tab === "gallery" && <ClientGalleryMock />}
        {tab === "create" && <CreateGalleryMock />}
        {tab === "settings" && <SettingsMock />}
      </div>
    </div>
  );
}
