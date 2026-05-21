"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/shared/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  // Default to brand fill with high-contrast foreground so consumers that
  // pass `bg-primary` (sidebar + Members tab) don't accidentally render
  // `text-primary` on `bg-primary` (1.0:1 contrast — the audit bug).
  //
  // HARDENING (Wave 4): consumers that override BOTH bg AND text (e.g. the
  // app-sidebar's `bg-primary/10 text-primary`) historically caused the
  // 1.0:1 same-colour-on-same-colour regression to slip back. The selector
  // `[data-slot="avatar-fallback"]` in globals.css now enforces a minimum
  // luminance via `color-mix()` whenever the consumer's text colour fails
  // to contrast with the bg. The default class below is still the
  // recommended path — overrides should be the exception.
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-primary text-primary-foreground flex size-full items-center justify-center rounded-full font-semibold",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
