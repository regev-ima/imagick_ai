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
  Share2,
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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2 px-3 pt-3">
        <Orb className="h-6 w-6 shrink-0" />
        <span className="aura-microlabel">Aura</span>
      </div>
      <CommandInput
        placeholder="Type a collection, an action, or a place to go…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nothing matches. Try the create action below.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/dashboard/galleries/new")}>
            <Plus className="text-primary" />
            New collection
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/styles/new")}>
            <Wand2 className="text-primary" />
            Train an AI style
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/galleries")}>
            <Share2 className="text-primary" />
            Share a gallery
          </CommandItem>
        </CommandGroup>

        {galleries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Collections">
              {galleries.map((g) => (
                <CommandItem key={g.id} value={`collection ${g.name}`} onSelect={() => go(`/dashboard/galleries/${g.id}`)}>
                  {g.hero_image_url ? (
                    <img src={getThumbnailUrl(g.hero_image_url)} alt="" className="h-6 w-9 rounded-md object-cover" />
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

        <CommandSeparator />
        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/galleries")}>
            <Images /> Collections
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/styles")}>
            <Sparkles /> AI Styles
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/billing")}>
            <CreditCard /> Billing
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/settings")}>
            <Settings /> Settings
          </CommandItem>
          {isAdmin && (
            <CommandItem onSelect={() => go("/dashboard/admin")}>
              <Shield /> Admin
            </CommandItem>
          )}
        </CommandGroup>

        {trimmed.length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ask Aura">
              <CommandItem
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
