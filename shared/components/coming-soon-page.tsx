"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MainLayout } from "@/shared/layout/main-layout"

interface ComingSoonPageProps {
	feature: string
	description: string
	eta?: string
	bullets?: string[]
	backHref?: string
	backLabel?: string
}

/**
 * Reusable "Coming Soon" placeholder used by routes whose feature is on the
 * near-term roadmap (Phase 1-3 of the R3 Data-People plan) but not yet built.
 *
 * Goals:
 *  - Eliminate raw 404s from sidebar / CTA clicks (the #1 R3 complaint).
 *  - Be honest: clearly marked "Coming Soon" with an ETA — never pretend
 *    the feature is shipped.
 *  - Keep copy short + factual; let each route fill in feature-specific
 *    bullets that reflect what the personas explicitly asked for.
 */
export function ComingSoonPage({
	feature,
	description,
	eta = "Q3 2026",
	bullets,
	backHref = "/dashboard",
	backLabel = "Back to Dashboard",
}: ComingSoonPageProps) {
	return (
		<MainLayout>
			<div className="flex flex-1 items-center justify-center px-4 py-10">
				<Card className="w-full max-w-xl border-border/60 shadow-sm">
					<CardHeader className="space-y-3">
						<div className="flex items-center gap-2">
							<div className="rounded-md bg-primary/10 p-2">
								<Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
							</div>
							<Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
								Coming Soon
							</Badge>
						</div>
						<CardTitle className="text-2xl font-semibold tracking-tight">
							{feature}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-5">
						<p className="text-[14px] leading-relaxed text-muted-foreground">
							{description}
						</p>
						{bullets && bullets.length > 0 ? (
							<ul className="space-y-1.5 text-[13px] text-muted-foreground">
								{bullets.map((b) => (
									<li key={b} className="flex gap-2">
										<span aria-hidden="true" className="text-primary">·</span>
										<span>{b}</span>
									</li>
								))}
							</ul>
						) : null}
						<div className="flex items-center justify-between border-t border-border/60 pt-4">
							<div className="text-[12px] text-muted-foreground">
								Expected: <span className="font-medium text-foreground">{eta}</span>
							</div>
							<Button asChild size="sm" variant="outline">
								<Link href={backHref}>{backLabel}</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</MainLayout>
	)
}
