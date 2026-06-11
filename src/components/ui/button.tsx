import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold ring-offset-background transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.25)] hover:bg-primary/90 hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.25),0_0_28px_-8px_hsl(var(--glow-primary)/0.8)]",
        destructive:
          "border border-destructive/40 bg-destructive/10 text-destructive hover:shadow-[0_0_22px_-8px_hsl(var(--destructive)/0.6)]",
        outline:
          "border border-border bg-card/60 backdrop-blur-md hover:border-primary/50 hover:shadow-[0_0_24px_-8px_hsl(var(--glow-primary)/0.55)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.25)] hover:bg-secondary/85 hover:shadow-[0_0_24px_-8px_hsl(var(--secondary)/0.7)]",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // The AI signature — static tri-hue gradient, reserved for engine
        // CTAs. Deliberately NOT animated at idle: a looping hue shift on
        // a resting button reads as flashing (and fails the motion rules).
        glow: "bg-[image:var(--gradient-primary)] text-white shadow-[inset_0_1px_0_hsl(0_0%_100%/0.3),0_0_28px_-8px_hsl(var(--glow-primary)/0.8),0_0_28px_-8px_hsl(var(--secondary)/0.5)] hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35),0_0_40px_-6px_hsl(var(--glow-primary)/0.9),0_0_40px_-6px_hsl(var(--secondary)/0.6)]",
        "glow-secondary":
          "bg-secondary text-secondary-foreground shadow-lg shadow-secondary/30 hover:shadow-xl hover:shadow-secondary/40",
        gradient:
          "bg-[image:var(--gradient-primary)] text-white shadow-[inset_0_1px_0_hsl(0_0%_100%/0.3),0_0_28px_-8px_hsl(var(--glow-primary)/0.8)] hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35),0_0_40px_-6px_hsl(var(--glow-primary)/0.9)]",
        glass: "glass-card text-foreground hover:bg-muted/80 border border-border/50",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
