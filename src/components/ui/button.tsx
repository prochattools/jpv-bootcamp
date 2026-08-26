import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/helpers/utils"

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-jpv-action text-sm font-medium ring-offset-jpv-canvas transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jpv-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-jpv-brand-deep text-jpv-canvas hover:bg-jpv-brand hover:text-jpv-canvas",
        destructive:
          "bg-jpv-danger text-jpv-canvas hover:bg-jpv-danger/90",
        outline:
          "border border-jpv-border bg-jpv-canvas hover:bg-jpv-surface hover:text-jpv-ink",
        secondary:
          "bg-jpv-surface text-jpv-ink hover:bg-jpv-surface-strong",
        ghost: "hover:bg-jpv-surface hover:text-jpv-ink",
        link: "text-jpv-brand-deep underline-offset-4 hover:text-jpv-brand hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-11 rounded-jpv-control px-3",
        lg: "h-11 rounded-jpv-control px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
