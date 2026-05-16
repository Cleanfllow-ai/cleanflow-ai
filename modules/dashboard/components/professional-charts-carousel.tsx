"use client";

/**
 * ProfessionalChartsCarousel — Validated / Fixed / Quarantined trend.
 *
 * History: this component used to fall back to a `Math.sin`-seeded
 * synthetic-noise filler (`buildSyntheticTrendData`) when the org's
 * completed-file buckets were sparse. That was a mocked-graph code path
 * shipping fake numbers to production dashboards.
 *
 * 2026-05-15: BE GET /dashboard/summary now ships pre-bucketed
 * `processing_trend.{day, week, month}` (commit 4eb29171). The chart
 * consumes those buckets directly — no synthesis, no client-side
 * aggregation, no random-number generators.
 */

import { useMemo, useState } from "react";
import {
    Area,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/ui/chart";
import { FileStatusResponse } from "@/modules/files";
import { LineChart as LineChartIcon, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_COLORS, type DqChartsProps } from "./chart-constants";
import { useDashboardSummary } from "@/modules/dashboard/hooks/use-dashboard-summary";
import type { ProcessingTrendBucket } from "@/modules/dashboard/types/dashboard-summary.types";

type TrendView = "day" | "week" | "month";

type TrendPoint = {
    period: string;
    clean: number;
    fixed: number;
    quarantined: number;
};

const bucketToPoint = (b: ProcessingTrendBucket): TrendPoint => ({
    period: b.period,
    clean: b.clean,
    fixed: b.fixed,
    quarantined: b.quarantined,
});

const hasAnyData = (points: TrendPoint[]): boolean =>
    points.some((p) => (p.clean + p.fixed + p.quarantined) > 0);

interface ProfessionalChartsCarouselProps extends DqChartsProps {
    /** Optional override — accepted for tests / Storybook so callers can inject
     *  a deterministic payload without standing up the dashboard hook. */
    processingTrend?: import("@/modules/dashboard/types/dashboard-summary.types").ProcessingTrend;
}

export function ProfessionalChartsCarousel({
    files: _files,
    processingTrend: processingTrendOverride,
}: ProfessionalChartsCarouselProps) {
    // `files` is retained on the prop surface for backwards compat with the
    // dq-charts.tsx wrapper, but the real source of truth is now the BE
    // envelope. Mark it as deliberately unused so the linter stays happy.
    void _files;

    const [trendView, setTrendView] = useState<TrendView>("month");
    const { data, isLoading, error } = useDashboardSummary();

    const processingTrend = processingTrendOverride ?? data?.processing_trend;

    const trendData: TrendPoint[] = useMemo(() => {
        if (!processingTrend) return [];
        const series = processingTrend[trendView] || [];
        return series.map(bucketToPoint);
    }, [processingTrend, trendView]);

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between border-b pb-4">
                <div>
                    <div className="mb-2 flex items-center gap-3">
                        <LineChartIcon className="h-5 w-5 text-blue-500" />
                        <h3 className="text-base font-semibold">Data Processing Trends</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Validated, fixed, and quarantined record movement across the selected time window
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Tabs
                        value={trendView}
                        onValueChange={(value) => setTrendView(value as TrendView)}
                    >
                        <TabsList className="h-8">
                            <TabsTrigger value="day" className="px-2 text-xs">
                                Day
                            </TabsTrigger>
                            <TabsTrigger value="week" className="px-2 text-xs">
                                Week
                            </TabsTrigger>
                            <TabsTrigger value="month" className="px-2 text-xs">
                                Month
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-background via-muted/15 to-sky-50/40 p-4 dark:to-slate-900/40">
                <div className="h-[360px]" data-testid="processing-trend-chart">
                    {isLoading && !processingTrendOverride ? (
                        <div
                            data-testid="processing-trend-loading"
                            className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"
                        >
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading processing trends…
                        </div>
                    ) : error && !processingTrendOverride ? (
                        <div
                            data-testid="processing-trend-error"
                            className="flex h-full items-center justify-center text-sm text-muted-foreground"
                        >
                            Unable to load processing trends.
                        </div>
                    ) : trendData.length === 0 || !hasAnyData(trendData) ? (
                        <div
                            data-testid="processing-trend-empty"
                            className="flex h-full items-center justify-center text-sm text-muted-foreground"
                        >
                            No processed trend data available yet.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={trendData}
                                margin={{ top: 18, right: 20, left: 4, bottom: 18 }}
                            >
                                <defs>
                                    <linearGradient id="trend-clean" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={CHART_COLORS.green} stopOpacity={0.18} />
                                        <stop offset="100%" stopColor={CHART_COLORS.green} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="trend-fixed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={CHART_COLORS.yellow} stopOpacity={0.16} />
                                        <stop offset="100%" stopColor={CHART_COLORS.yellow} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="trend-quarantined" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={CHART_COLORS.red} stopOpacity={0.14} />
                                        <stop offset="100%" stopColor={CHART_COLORS.red} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D7DEE8" />
                                <XAxis
                                    dataKey="period"
                                    tick={{ fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={72}
                                    tickFormatter={(value: number) =>
                                        value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
                                    }
                                />
                                <ChartTooltip
                                    cursor={{ stroke: "#CBD5E1", strokeDasharray: "4 4" }}
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload || payload.length === 0) return null;
                                        return (
                                            <div className="min-w-[180px] rounded-xl border border-border/70 bg-background/95 p-3 shadow-xl backdrop-blur">
                                                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                                    {label}
                                                </div>
                                                <div className="space-y-1.5">
                                                    {payload.map((entry) => (
                                                        <div
                                                            key={entry.dataKey}
                                                            className="flex items-center justify-between gap-4 text-xs"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className="h-2.5 w-2.5 rounded-full"
                                                                    style={{ backgroundColor: entry.color }}
                                                                />
                                                                <span className="text-muted-foreground">{entry.name}</span>
                                                            </div>
                                                            <span className="font-mono font-medium tabular-nums text-foreground">
                                                                {Number(entry.value || 0).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }} />
                                <Area
                                    type="monotone"
                                    dataKey="clean"
                                    stroke="none"
                                    fill="url(#trend-clean)"
                                    fillOpacity={1}
                                    name="Validated"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="fixed"
                                    stroke="none"
                                    fill="url(#trend-fixed)"
                                    fillOpacity={1}
                                    name="Fixed"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="quarantined"
                                    stroke="none"
                                    fill="url(#trend-quarantined)"
                                    fillOpacity={1}
                                    name="Quarantined"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="clean"
                                    stroke={CHART_COLORS.green}
                                    strokeWidth={3}
                                    dot={false}
                                    activeDot={{ r: 5, fill: CHART_COLORS.green }}
                                    name="Validated"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="fixed"
                                    stroke={CHART_COLORS.yellow}
                                    strokeWidth={2.5}
                                    dot={false}
                                    activeDot={{ r: 5, fill: CHART_COLORS.yellow }}
                                    name="Fixed"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="quarantined"
                                    stroke={CHART_COLORS.red}
                                    strokeWidth={2.5}
                                    dot={false}
                                    activeDot={{ r: 5, fill: CHART_COLORS.red }}
                                    name="Quarantined"
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}
