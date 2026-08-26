import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/helpers/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-jpv-border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-jpv-focus focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-jpv-brand-deep text-jpv-canvas hover:bg-jpv-brand",
        secondary:
          "border-transparent bg-jpv-surface text-jpv-ink hover:bg-jpv-surface-strong",
        destructive:
          "border-transparent bg-jpv-danger text-jpv-canvas hover:bg-jpv-danger/80",
        outline: "text-jpv-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
