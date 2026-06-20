import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQS } from "./data";

export function Faq() {
  return (
    <Accordion type="single" collapsible className="mx-auto w-full max-w-3xl">
      {FAQS.map((item, i) => (
        <AccordionItem
          key={item.q}
          value={`faq-${i}`}
          className="border-b border-border"
        >
          <AccordionTrigger className="py-5 text-left text-base font-medium text-foreground hover:no-underline [&[data-state=open]]:text-primary">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="pb-5 text-[15px] leading-relaxed text-muted-foreground">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
