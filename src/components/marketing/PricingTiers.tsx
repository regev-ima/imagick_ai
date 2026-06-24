import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appHref } from "@/lib/domains";
import { Sparkle } from "./Sparkle";
import { SITE, type Plan } from "./data";
import { useMarketingPlans } from "./useMarketingPlans";

function priceFor(plan: Plan, annual: boolean) {
  if (plan.monthly === 0) return { big: "$0", sub: "free forever" };
  if (annual) {
    const perMonth = Math.round(plan.yearly / 12);
    return { big: `$${perMonth}`, sub: `billed $${plan.yearly}/yr` };
  }
  return { big: `$${plan.monthly}`, sub: "per month" };
}

function ctaTarget(plan: Plan) {
  if (plan.slug === "studio") return `mailto:${SITE.email}?subject=Imagick.ai%20Studio`;
  if (plan.slug === "free") return "/auth?mode=signup";
  return "/auth?mode=signup";
}

export function PricingTiers({ idPrefix = "pricing" }: { idPrefix?: string }) {
  const [annual, setAnnual] = useState(true);
  const plans = useMarketingPlans();

  return (
    <div>
      {/* Billing toggle */}
      <div className="mb-10 flex items-center justify-center gap-4">
        <span className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          aria-label="Toggle annual billing"
          onClick={() => setAnnual((v) => !v)}
          className="relative h-7 w-12 cursor-pointer rounded-full border border-border bg-surface-2 transition-colors"
        >
          <span
            className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-primary shadow transition-[left] duration-200 ${
              annual ? "left-[26px]" : "left-1"
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>
          Annual
        </span>
        <span className="rounded-full bg-secondary/15 px-2.5 py-1 caption !text-secondary">
          Save ~20%
        </span>
      </div>

      {/* Cards */}
      <div className="grid gap-5 lg:grid-cols-4">
        {plans.map((plan, i) => {
          const price = priceFor(plan, annual);
          const target = ctaTarget(plan);
          const external = target.startsWith("mailto:");
          return (
            <motion.div
              key={plan.slug}
              id={`${idPrefix}-${plan.slug}`}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 0.61, 0.36, 1] }}
              className={`relative flex flex-col rounded-xl border p-6 ${
                plan.highlight
                  ? "border-primary/50 bg-card shadow-[var(--elevation-3)] lg:-mt-3 lg:mb-3"
                  : "border-border bg-card/60"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-white shadow-[0_0_18px_-4px_hsl(var(--primary)/0.8)]">
                  <Sparkle size={11} className="text-white" />
                  {plan.badge}
                </span>
              )}

              <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {plan.name}
              </div>
              <div className="flex items-end gap-1.5">
                <span className="folio text-4xl text-foreground">{price.big}</span>
                <span className="mb-1.5 caption !tracking-normal !normal-case text-muted-foreground">
                  {price.sub}
                </span>
              </div>
              <p className="mt-3 min-h-[40px] text-sm leading-relaxed text-muted-foreground">
                {plan.blurb}
              </p>

              <Button
                asChild
                variant={plan.highlight ? "glow" : "outline"}
                className="mt-5 w-full"
              >
                <a href={external ? target : appHref(target)}>{plan.cta}</a>
              </Button>

              <ul className="mt-6 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/90">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        plan.highlight ? "text-primary" : "text-secondary"
                      }`}
                      strokeWidth={2.5}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        No credit card to start · Cancel anytime · Prices in USD
      </p>
    </div>
  );
}
