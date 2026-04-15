import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[8px] border px-[10px] py-[3px] text-[11px] font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-2 focus-visible:ring-[#722F37]/40 transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        // Glass Grandmaster primary — burgundy tint (Premium / Active)
        default:
          "border-[rgba(184,134,11,0.1)] bg-[rgba(184,134,11,0.08)] text-[#D4AA2B]",
        // Pending — terracotta tint
        secondary:
          "border-[rgba(194,122,74,0.15)] bg-[rgba(194,122,74,0.1)] text-[#D08B5C]",
        // Cancelled — red tint
        destructive:
          "border-[rgba(220,38,38,0.1)] bg-[rgba(220,38,38,0.08)] text-[#F87171]",
        // Completed / neutral glass
        outline:
          "border-white/[0.06] bg-white/[0.04] text-white/40 backdrop-blur-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
