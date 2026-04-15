import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#722F37]/40 focus-visible:ring-offset-0 aria-invalid:ring-destructive/20 aria-invalid:border-destructive active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Glass Grandmaster primary — burgundy gradient with soft glow
        default:
          "text-[#FAF8F5] bg-[linear-gradient(135deg,#722F37,#8B3A43)] shadow-[0_4px_16px_rgba(114,47,55,0.3)] hover:-translate-y-[1px] hover:shadow-[0_6px_24px_rgba(114,47,55,0.4)]",
        destructive:
          "text-[#FAF8F5] bg-[linear-gradient(135deg,#DC2626,#EF4444)] shadow-[0_4px_16px_rgba(220,38,38,0.25)] hover:-translate-y-[1px] hover:shadow-[0_6px_24px_rgba(220,38,38,0.35)]",
        // Outline → glass pill
        outline:
          "bg-white/[0.04] backdrop-blur-[16px] border-[0.5px] border-white/[0.1] text-[#FAF8F5]/80 hover:bg-white/[0.08] hover:border-white/[0.16] hover:text-[#FAF8F5]",
        // Secondary → glass (same as outline but less opinionated)
        secondary:
          "bg-white/[0.06] backdrop-blur-[16px] border-[0.5px] border-white/[0.08] text-[#FAF8F5] hover:bg-white/[0.1]",
        // Accent → terracotta gradient (use className="variant-accent" via `variant="secondary" className=..."` if needed; kept for future)
        ghost:
          "text-white/50 hover:text-[#FAF8F5] hover:bg-white/[0.04]",
        link: "text-[#C27A4A] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-5 py-2 has-[>svg]:px-4",
        sm: "h-8 rounded-[8px] gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 px-7 has-[>svg]:px-5",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
