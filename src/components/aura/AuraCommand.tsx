import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Images,
  Sparkles,
  CreditCard,
  Settings,
  Shield,
  Plus,
  Wand2,
  ArrowRight,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Orb } from "@/components/aura/Orb";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUser } from "@/hooks/useImpersonation";
import { useUserRole } from "@/hooks/useUserRole";
import { getThumbnailUrl } from "@/lib/imageUrls";

/**
 * Aura Command — the studio's command palette (⌘K / Ctrl+K).
 *
 * This is the working version of the "Ask Aura" promise: type anything
 * and Aura takes you there — collections by name (live data), actions
 * (new collection, train a style), navigation. Free text falls through
 * to "create a collection named <query>", pre-filling the wizard.
 *
 * Open it from anywhere:
 *   - ⌘K / Ctrl+K
 *   - openAuraCommand("optional starting query")
 */
const OPEN_EVENT = "aura:command:open";

export function openAuraCommand(query?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { query: query ?? "" } }));
}

export function AuraCommand() {
  const navigate = useNavigate();
  const { effectiveUserId } = useEffectiveUser();
  const { isAdmin } = useUserRole();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // ⌘K / Ctrl+K — no animation delay matters here: this is a
  // keyboard-triggered, many-times-a-day action.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { query?: string } | undefined;
      setQuery(detail?.query ?? "");
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Live collections — fetched when the palette opens, cached briefly.
  const { data: galleries = [] } = useQuery({
    queryKey: ["aura-command-galleries", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("galleries")
        .select("id, name, status, total_images, hero_image_url")
        .eq("user_id", effectiveUserId)
        .order("updated_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: open && !!effectiveUserId,
    staleTime: 30 * 1000,
  });

  const go = (to: string) => {
    setOpen(false);
    setQuery("");
    navigate(to);
  };

  const trimmed = query.trim();

  // Royal-blue active row + crisp Lightroom item chrome. The cmdk
  // primitive marks the focused row with data-[selected=true]; we
  // override its default accent fill with a brand-blue tint + keyline.
  const itemCls =
    "rounded-[--radius] text-foreground transition-colors " +
    "data-[selected=true]:bg-primary/[0.14] data-[selected=true]:text-foreground " +
    "data-[selected=true]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.45)]";

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      {/* Aura header — the sparkle/Orb mark over a hairline */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/[0.06] px-4 py-2.5">
        <span className="aura-microlabel flex items-center gap-2 text-accent" style={{ color: "inherit" }}>
          <Orb className="h-5 w-5 shrink-0" />
          Aura
        </span>
        <span className="aura-chip" aria-hidden="true">
          <span className="aura-led" />
          Command
        </span>
      </div>
      <CommandInput
        placeholder="Search or jump to…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="px-1 py-1">
        <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
          Nothing matches. Try the create action below.
        </CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem className={itemCls} onSelect={() => go("/dashboard/galleries/new")}>
            <Plus className="text-primary" />
            New collection
          </CommandItem>
          <CommandItem className={itemCls} onSelect={() => go("/dashboard/styles/new")}>
            <Wand2 className="text-primary" />
            Train an AI style
          </CommandItem>
        </CommandGroup>

        {galleries.length > 0 && (
          <>
            <CommandSeparator className="my-1 bg-border" />
            <CommandGroup heading="Collections">
              {galleries.map((g) => (
                <CommandItem key={g.id} className={itemCls} value={`collection ${g.name}`} onSelect={() => go(`/dashboard/galleries/${g.id}`)}>
                  {g.hero_image_url ? (
                    <img src={getThumbnailUrl(g.hero_image_url)} alt="" className="h-6 w-9 rounded-[--radius] border border-border object-cover" />
                  ) : (
                    <Images className="text-muted-foreground" />
                  )}
                  <span className="truncate">{g.name}</span>
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {g.total_images || 0}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator className="my-1 bg-border" />
        <CommandGroup heading="Go to">
          <CommandItem className={itemCls} onSelect={() => go("/dashboard")}>
            <LayoutDashboard /> Dashboard
          </CommandItem>
          <CommandItem className={itemCls} onSelect={() => go("/dashboard/galleries")}>
            <Images /> Collections
          </CommandItem>
          <CommandItem className={itemCls} onSelect={() => go("/dashboard/styles")}>
            <Sparkles /> AI Styles
          </CommandItem>
          <CommandItem className={itemCls} onSelect={() => go("/dashboard/billing")}>
            <CreditCard /> Billing
          </CommandItem>
          <CommandItem className={itemCls} onSelect={() => go("/dashboard/settings")}>
            <Settings /> Settings
          </CommandItem>
          {isAdmin && (
            <CommandItem className={itemCls} onSelect={() => go("/dashboard/admin")}>
              <Shield /> Admin
            </CommandItem>
          )}
        </CommandGroup>

        {trimmed.length > 1 && (
          <>
            <CommandSeparator className="my-1 bg-border" />
            <CommandGroup heading="Ask Aura">
              <CommandItem
                className={itemCls}
                value={`create ${trimmed}`}
                onSelect={() => go(`/dashboard/galleries/new?name=${encodeURIComponent(trimmed)}`)}
              >
                <Orb className="h-5 w-5" />
                <span>
                  Start a collection named <span className="font-semibold text-primary">“{trimmed}”</span>
                </span>
                <ArrowRight className="ml-auto text-muted-foreground" />
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
