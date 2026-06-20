import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { TESTIMONIALS } from "./data";

export function Testimonials() {
  return (
    <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
      {TESTIMONIALS.map((t, i) => (
        <motion.figure
          key={t.name}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: (i % 3) * 0.08, ease: [0.22, 0.61, 0.36, 1] }}
          className="mb-5 break-inside-avoid rounded-xl border border-border bg-card/60 p-6"
        >
          <div className="mb-3 flex items-center gap-0.5">
            {[0, 1, 2, 3, 4].map((s) => (
              <Star key={s} className="h-3.5 w-3.5 fill-rating text-rating" />
            ))}
          </div>
          <blockquote className="text-[15px] leading-relaxed text-foreground/90">
            "{t.quote}"
          </blockquote>
          <figcaption className="mt-5 flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {t.initials}
            </span>
            <span>
              <span className="block text-sm font-medium text-foreground">{t.name}</span>
              <span className="block caption !tracking-normal !normal-case text-muted-foreground">
                {t.role}
              </span>
            </span>
          </figcaption>
        </motion.figure>
      ))}
    </div>
  );
}
