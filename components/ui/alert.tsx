import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/shared/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border",
        destructive:
          // text-destructive on bg-card → dark mode flips destructive token
          // automatically, but we set the dark fg explicitly so any consumer
          // overriding bg still gets a readable label.
          "text-destructive bg-card border-red-200 dark:text-red-300 dark:bg-card dark:border-red-900/60 [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90 dark:*:data-[slot=alert-description]:text-red-300/90",
        warning:
          // Banner-style amber callout. Light = amber-50 bg + amber-900 text;
          // dark = amber-900/20 bg + amber-100 text — both ≥4.5:1.
          "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-100 dark:border-amber-900/60 [&>svg]:text-current *:data-[slot=alert-description]:text-amber-900/90 dark:*:data-[slot=alert-description]:text-amber-100/90",
        success:
          "bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-100 dark:border-green-900/60 [&>svg]:text-current *:data-[slot=alert-description]:text-green-900/90 dark:*:data-[slot=alert-description]:text-green-100/90",
        info:
          "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-100 dark:border-blue-900/60 [&>svg]:text-current *:data-[slot=alert-description]:text-blue-900/90 dark:*:data-[slot=alert-description]:text-blue-100/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        // Default to current colour (inherited from variant) so warning /
        // success / destructive carry through to the description. Plain
        // alerts fall back to muted-foreground via the explicit class.
        "col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed text-current/85",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
