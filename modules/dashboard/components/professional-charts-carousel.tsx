"use client";

import { useState, useMemo } from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Legend,
} from "recharts";
import { ChartTooltip } from "@/components/ui/chart";
import {
    FileStatusResponse,
} from "@/modules/files";
import {
    BarChart3,
    LineChart as LineChartIcon,
    Activity,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_COLORS, type DqChartsProps } from "./chart-constants";

export function ProfessionalChartsCarousel({ files }: DqChartsProps) {
    const [currentChart, setCurrentChart] = useState(0);
    const [trendView, setTrendView] = useState<"day" | "week" | "month">("month");
    const [selectedDay, setSelectedDay] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    });

    const trendData = useMemo(() => {
        const completedFiles = files.filter(
            (f) =>
                f.status === "DQ_FIXED" &&
                Boolean(f.uploaded_at || f.created_at) &&
                !Number.isNaN(new Date(f.uploaded_at || f.created_at || "").getTime()),
        );

        const aggregateRows = (file: FileStatusResponse) => {
            const rowsIn = file.rows_in || 0;
            const rowsQuarantined = file.rows_quarantined || 0;
            const rowsFixed = file.rows_fixed || 0;
            const rowsOut =
                typeof file.rows_out === "number" ? file.rows_out : rowsIn - rowsQuarantined;
            const cleanRows = Math.max(rowsOut - rowsFixed, 0);
            return { cleanRows, rowsFixed, rowsQuarantined };
        };

        if (trendView === "day") {
            const selected = new Date(`${selectedDay}T00:00:00`);
            const buckets: Record<string, { clean: number; fixed: number; quarantined: number; hour: number }> = {};

            for (let hour = 0; hour < 24; hour += 3) {
                const label =
                    hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`;
                buckets[label] = { clean: 0, fixed: 0, quarantined: 0, hour };
            }

            completedFiles.forEach((f) => {
                const fileDate = new Date(f.uploaded_at || f.created_at || "");
                const sameDay =
                    fileDate.getFullYear() === selected.getFullYear() &&
                    fileDate.getMonth() === selected.getMonth() &&
                    fileDate.getDate() === selected.getDate();
                if (!sameDay) return;

                const bucketHour = Math.floor(fileDate.getHours() / 3) * 3;
                const label =
                    bucketHour === 0
                        ? "12 AM"
                        : bucketHour < 12
                            ? `${bucketHour} AM`
                            : bucketHour === 12
                                ? "12 PM"
                                : `${bucketHour - 12} PM`;

                const rows = aggregateRows(f);
                buckets[label].clean += rows.cleanRows;
                buckets[label].fixed += rows.rowsFixed;
                buckets[label].quarantined += rows.rowsQuarantined;
            });

            return Object.entries(buckets)
                .sort(([, a], [, b]) => a.hour - b.hour)
                .map(([period, stats]) => ({
                    period,
                    clean: stats.clean,
                    fixed: stats.fixed,
                    quarantined: stats.quarantined,
                }));
        }

        if (trendView === "week") {
            const now = new Date();
            const start = new Date(now);
            start.setDate(now.getDate() - 6);
            start.setHours(0, 0, 0, 0);

            const buckets: Record<string, { clean: number; fixed: number; quarantined: number; ts: number }> = {};
            for (let i = 0; i < 7; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                const key = d.toISOString().slice(0, 10);
                const label = d.toLocaleDateString("en-US", { weekday: "short" });
                buckets[key] = {
                    clean: 0,
                    fixed: 0,
                    quarantined: 0,
                    ts: d.getTime(),
                };
                (buckets[key] as any).label = label;
            }

            completedFiles.forEach((f) => {
                const fileDate = new Date(f.uploaded_at || f.created_at || "");
                if (fileDate < start || fileDate > now) return;
                const key = `${fileDate.getFullYear()}-${String(fileDate.getMonth() + 1).padStart(2, "0")}-${String(fileDate.getDate()).padStart(2, "0")}`;
                if (!buckets[key]) return;
                const rows = aggregateRows(f);
                buckets[key].clean += rows.cleanRows;
                buckets[key].fixed += rows.rowsFixed;
                buckets[key].quarantined += rows.rowsQuarantined;
            });

            return Object.entries(buckets)
                .sort(([, a], [, b]) => a.ts - b.ts)
                .map(([_, stats]) => ({
                    period: (stats as any).label,
                    clean: stats.clean,
                    fixed: stats.fixed,
                    quarantined: stats.quarantined,
                }));
        }

        const now = new Date();
        const buckets: Record<string, { clean: number; fixed: number; quarantined: number; ts: number }> = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            buckets[key] = {
                clean: 0,
                fixed: 0,
                quarantined: 0,
                ts: d.getTime(),
            };
            (buckets[key] as any).label = d.toLocaleDateString("en-US", { month: "short" });
        }

        completedFiles.forEach((f) => {
            const d = new Date(f.uploaded_at || f.created_at || "");
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!buckets[key]) return;
            const rows = aggregateRows(f);
            buckets[key].clean += rows.cleanRows;
            buckets[key].fixed += rows.rowsFixed;
            buckets[key].quarantined += rows.rowsQuarantined;
        });

        return Object.entries(buckets)
            .sort(([, a], [, b]) => a.ts - b.ts)
            .map(([_, stats]) => ({
                period: (stats as any).label,
                clean: stats.clean,
                fixed: stats.fixed,
                quarantined: stats.quarantined,
            }));
    }, [files, trendView, selectedDay]);

    const qualityMetricsData = [
        { month: 'Jan', score: 65, errors: 35, issues: 28 },
        { month: 'Feb', score: 68, errors: 32, issues: 25 },
        { month: 'Mar', score: 72, errors: 28, issues: 22 },
        { month: 'Apr', score: 75, errors: 25, issues: 20 },
        { month: 'May', score: 78, errors: 22, issues: 18 },
        { month: 'Jun', score: 80, errors: 20, issues: 16 },
        { month: 'Jul', score: 82, errors: 18, issues: 14 },
        { month: 'Aug', score: 84, errors: 16, issues: 12 },
        { month: 'Sep', score: 85, errors: 15, issues: 11 },
        { month: 'Oct', score: 87, errors: 13, issues: 10 },
        { month: 'Nov', score: 88, errors: 12, issues: 9 },
    ];

    const processingRateData = [
        { month: 'Jan', processed: 1000, successful: 850, failed: 150 },
        { month: 'Feb', processed: 1200, successful: 1020, failed: 180 },
        { month: 'Mar', processed: 1400, successful: 1260, failed: 140 },
        { month: 'Apr', processed: 1600, successful: 1504, failed: 96 },
        { month: 'May', processed: 1800, successful: 1746, failed: 54 },
        { month: 'Jun', processed: 2000, successful: 1980, failed: 20 },
        { month: 'Jul', processed: 2200, successful: 2178, failed: 22 },
        { month: 'Aug', processed: 2400, successful: 2376, failed: 24 },
        { month: 'Sep', processed: 2600, successful: 2548, failed: 52 },
        { month: 'Oct', processed: 2800, successful: 2744, failed: 56 },
        { month: 'Nov', processed: 3000, successful: 2940, failed: 60 },
    ];

    const charts = [
        {
            title: "Data Processing Trends",
            subtitle: "Comparison of validated, fixed, and quarantined records",
            icon: LineChartIcon,
            render: () => (
                <div className="h-[360px]">
                    {trendData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                            No processed trend data available.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 15, right: 30, left: 0, bottom: 40 }}>
                                <XAxis
                                    dataKey="period"
                                    tick={{ fontSize: 12 }}
                                    stroke="#6B7280"
                                />
                                <YAxis
                                    tick={{ fontSize: 11 }}
                                    stroke="#6B7280"
                                />
                                <ChartTooltip
                                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB" }}
                                    formatter={(value) => value.toLocaleString()}
                                />
                                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
                                <Line
                                    type="monotone"
                                    dataKey="clean"
                                    stroke={CHART_COLORS.green}
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: CHART_COLORS.green }}
                                    name="Validated"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="fixed"
                                    stroke={CHART_COLORS.yellow}
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: CHART_COLORS.yellow }}
                                    name="Fixed"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="quarantined"
                                    stroke={CHART_COLORS.red}
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: CHART_COLORS.red }}
                                    name="Quarantined"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            )
        },
        {
            title: "Quality Score & Error Rates",
            subtitle: "Quality score improvement over time with error tracking",
            icon: Activity,
            render: () => (
                <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={qualityMetricsData} margin={{ top: 15, right: 30, left: 0, bottom: 40 }}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 12 }}
                                stroke="#6B7280"
                            />
                            <YAxis
                                tick={{ fontSize: 11 }}
                                stroke="#6B7280"
                            />
                            <ChartTooltip
                                contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB" }}
                                formatter={(value) => value.toLocaleString()}
                            />
                            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
                            <Area
                                type="monotone"
                                dataKey="score"
                                stroke="#8B5CF6"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorScore)"
                                name="Quality Score"
                            />
                            <Area
                                type="monotone"
                                dataKey="errors"
                                stroke="#EF4444"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorErrors)"
                                name="Error Rate %"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )
        },
        {
            title: "Processing Performance",
            subtitle: "Total records processed vs successful completion rate",
            icon: BarChart3,
            render: () => (
                <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={processingRateData} margin={{ top: 15, right: 30, left: 0, bottom: 40 }}>
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 12 }}
                                stroke="#6B7280"
                            />
                            <YAxis
                                tick={{ fontSize: 11 }}
                                stroke="#6B7280"
                            />
                            <ChartTooltip
                                contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB" }}
                                formatter={(value) => value.toLocaleString()}
                            />
                            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
                            <Bar dataKey="processed" fill="#6366F1" name="Total Processed" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="successful" fill="#10B981" name="Successful" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="failed" fill="#EF4444" name="Failed" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )
        }
    ];

    const goToPrevious = () => {
        setCurrentChart((prev) => (prev === 0 ? charts.length - 1 : prev - 1));
    };

    const goToNext = () => {
        setCurrentChart((prev) => (prev === charts.length - 1 ? 0 : prev + 1));
    };

    const currentChartData = charts[currentChart];

    return (
        <div className="space-y-4">

            {/* Chart Header */}
            <div className="flex items-start justify-between border-b pb-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        {currentChartData.icon && (
                            <currentChartData.icon className="h-5 w-5 text-blue-500" />
                        )}
                        <h3 className="font-semibold text-base">{currentChartData.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{currentChartData.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                    {currentChart === 0 && (
                        <>
                            <Tabs
                                value={trendView}
                                onValueChange={(value) => setTrendView(value as "day" | "week" | "month")}
                            >
                                <TabsList className="h-8">
                                    <TabsTrigger value="day" className="text-xs px-2">
                                        Day
                                    </TabsTrigger>
                                    <TabsTrigger value="week" className="text-xs px-2">
                                        Week
                                    </TabsTrigger>
                                    <TabsTrigger value="month" className="text-xs px-2">
                                        Month
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                            {trendView === "day" && (
                                <input
                                    type="date"
                                    value={selectedDay}
                                    onChange={(e) => setSelectedDay(e.target.value)}
                                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                />
                            )}
                        </>
                    )}
                    <span className="text-xs font-medium text-muted-foreground">
                        {currentChart + 1} / {charts.length}
                    </span>
                </div>
            </div>
            {/* Navigation Controls - Top */}
            <div className="flex items-center justify-between pb-2">
                <button
                    onClick={goToPrevious}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    title="Previous chart"
                >
                    <ChevronLeft className="h-6 w-6 text-blue-500 hover:text-blue-600" />
                </button>

                <div></div>

                <button
                    onClick={goToNext}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    title="Next chart"
                >
                    <ChevronRight className="h-6 w-6 text-blue-500 hover:text-blue-600" />
                </button>
            </div>

            {/* Chart Container */}
            <div className="relative bg-muted/20 rounded-lg p-4">
                {currentChartData.render()}
            </div>
        </div>
    );
}
