import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/shared/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          // Pure white on #b91c1c — clears 4.5:1; identical in dark mode so the
          // pill stays a strong danger signal.
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive dark:bg-destructive",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        // Filled status pills — label always white. Use these for the numbered
        // counters on dashboard cards.
        success:
          "border-transparent bg-[var(--status-success-fill)] text-[var(--status-success-on-fill)]",
        warning:
          "border-transparent bg-[var(--status-warning-fill)] text-[var(--status-warning-on-fill)]",
        danger:
          "border-transparent bg-[var(--status-danger-fill)] text-[var(--status-danger-on-fill)]",
        info:
          "border-transparent bg-[var(--status-info-fill)] text-[var(--status-info-on-fill)]",
        // Soft (tinted bg + dark text), AA-safe in both themes.
        "soft-success":
          "border-green-200/60 bg-green-100 text-[color:var(--status-success)] dark:bg-green-900/30 dark:border-green-900/50",
        "soft-warning":
          "border-amber-200/60 bg-amber-100 text-[color:var(--status-warning)] dark:bg-amber-900/30 dark:border-amber-900/50",
        "soft-danger":
          "border-red-200/60 bg-red-100 text-[color:var(--status-danger)] dark:bg-red-900/30 dark:border-red-900/50",
        // Filled teal pill (Snowflake-style brand chip). Brand teal #0cbeb6
        // with WHITE label clears 3.0:1 — for AA at small sizes we deepen
        // the bg to #0a8f89 (teal-700). Use this for any "connected to teal
        // service" pill instead of hand-rolling `bg-[#0cbeb6]`.
        teal:
          "border-transparent bg-[#0a8f89] text-white dark:bg-[#0a8f89]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
