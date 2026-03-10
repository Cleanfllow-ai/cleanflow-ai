"use client";

import { useEffect, useState } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ChartTooltip } from "@/components/ui/chart";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    ResponsiveContainer,
} from "recharts";
import {
    OverallDqReportResponse,
    fileManagementAPI,
} from "@/modules/files";
import { useAuth } from "@/modules/auth";
import {
    Loader2,
    BarChart3,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_COLORS, type DqChartsProps } from "./chart-constants";

// Compact Trends for sidebar
export function MonthlyTrendsCompact({ files }: DqChartsProps) {
    const { idToken } = useAuth();
    const [overallReport, setOverallReport] =
        useState<OverallDqReportResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');

    useEffect(() => {
        const loadOverallReport = async () => {
            if (!idToken) return;
            try {
                const report = await fileManagementAPI.downloadOverallDqReport(idToken);
                setOverallReport(report);
            } catch (error: any) {
                const message = (error?.message || "").toLowerCase();
                if (!message.includes("permission denied") && !message.includes("organization membership required")) {
                    console.error("Error loading overall DQ report:", error);
                }
            } finally {
                setLoading(false);
            }
        };
        loadOverallReport();
    }, [idToken]);

    const generateCompactData = () => {
        const completedFiles = files.filter((f) => f.status === "DQ_FIXED" && (f.uploaded_at || f.created_at));

        if (timePeriod === 'day') {
            // Hourly view for today - 3-hour intervals
            const hourGroups: Record<string, { rows: number; fixed: number; hour: number }> = {};
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Initialize 3-hour intervals
            for (let i = 0; i < 24; i += 3) {
                const hour = i;
                const displayHour = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
                hourGroups[displayHour] = { rows: 0, fixed: 0, hour };
            }

            completedFiles.forEach(f => {
                const fileDate = new Date(f.uploaded_at || f.created_at!);
                // Only include today's data
                if (fileDate.toDateString() === today.toDateString()) {
                    const hour = fileDate.getHours();
                    const bucketHour = Math.floor(hour / 3) * 3;
                    const displayHour = bucketHour === 0 ? '12 AM' : bucketHour < 12 ? `${bucketHour} AM` : bucketHour === 12 ? '12 PM' : `${bucketHour - 12} PM`;

                    if (hourGroups[displayHour]) {
                        hourGroups[displayHour].rows += f.rows_in || 0;
                        hourGroups[displayHour].fixed += f.rows_fixed || 0;
                    }
                }
            });

            return Object.entries(hourGroups)
                .sort(([, a], [, b]) => a.hour - b.hour)
                .map(([period, data]) => ({
                    month: period,
                    rows: data.rows,
                    fixed: data.fixed,
                }));

        } else if (timePeriod === 'week') {
            // Last 7 days by weekday
            const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayGroups: Record<string, { rows: number; fixed: number; dayNum: number }> = {};

            weekDays.forEach((day, idx) => {
                dayGroups[day] = { rows: 0, fixed: 0, dayNum: idx };
            });

            completedFiles.forEach(f => {
                const fileDate = new Date(f.uploaded_at || f.created_at!);
                const dayOfWeek = new Date().getTime() - fileDate.getTime();
                if (dayOfWeek <= 7 * 24 * 60 * 60 * 1000) {
                    const dayNum = fileDate.getDay();
                    const key = weekDays[dayNum];
                    dayGroups[key].rows += f.rows_in || 0;
                    dayGroups[key].fixed += f.rows_fixed || 0;
                }
            });

            return Object.entries(dayGroups)
                .sort(([, a], [, b]) => a.dayNum - b.dayNum)
                .map(([period, data]) => ({
                    month: period,
                    rows: data.rows,
                    fixed: data.fixed,
                }));

        } else if (timePeriod === 'month') {
            // Month view - last 6 months
            if (overallReport?.months) {
                return Object.entries(overallReport.months)
                    .map(([month, stats]) => ({
                        month: month.split("/")[0],
                        rows: stats.rows_in,
                        fixed: stats.rows_fixed,
                    }))
                    .sort((a, b) => {
                        const months = [
                            "01", "02", "03", "04", "05", "06",
                            "07", "08", "09", "10", "11", "12",
                        ];
                        return months.indexOf(a.month) - months.indexOf(b.month);
                    })
                    .slice(-6);
            } else {
                // Fallback: aggregate by month from files
                const monthGroups: Record<string, { rows: number; fixed: number }> = {};

                completedFiles.forEach(f => {
                    const fileDate = new Date(f.uploaded_at || f.created_at!);
                    const key = fileDate.toLocaleDateString('en-US', { month: 'short' });
                    if (!monthGroups[key]) {
                        monthGroups[key] = { rows: 0, fixed: 0 };
                    }
                    monthGroups[key].rows += f.rows_in || 0;
                    monthGroups[key].fixed += f.rows_fixed || 0;
                });

                return Object.entries(monthGroups).map(([month, data]) => ({
                    month,
                    ...data,
                }));
            }
        } else {
            // Year view - all 12 months of current year
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const currentYear = new Date().getFullYear();
            const monthGroups: Record<string, { rows: number; fixed: number }> = {};

            // Initialize all 12 months
            monthNames.forEach(month => {
                monthGroups[month] = { rows: 0, fixed: 0 };
            });

            // Aggregate data for current year
            completedFiles.forEach(f => {
                const fileDate = new Date(f.uploaded_at || f.created_at!);
                if (fileDate.getFullYear() === currentYear) {
                    const monthIndex = fileDate.getMonth();
                    const key = monthNames[monthIndex];
                    monthGroups[key].rows += f.rows_in || 0;
                    monthGroups[key].fixed += f.rows_fixed || 0;
                }
            });

            return monthNames.map(month => ({
                month,
                ...monthGroups[month],
            }));
        }
    };

    const monthlyData = generateCompactData();

    if (loading) {
        return (
            <Card>
                <CardContent className="p-4 flex items-center justify-center h-[140px]">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (monthlyData.length === 0) {
        return null;
    }

    const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ];

    return (
        <Card>
            <CardHeader className="py-3 px-4 pb-1">
                <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                        Trends
                    </CardTitle>
                    <Tabs value={timePeriod} onValueChange={(value) => setTimePeriod(value as 'day' | 'week' | 'month' | 'year')}>
                        <TabsList className="h-6">
                            <TabsTrigger value="day" className="text-[10px] px-2 h-5">D</TabsTrigger>
                            <TabsTrigger value="week" className="text-[10px] px-2 h-5">W</TabsTrigger>
                            <TabsTrigger value="month" className="text-[10px] px-2 h-5">M</TabsTrigger>
                            <TabsTrigger value="year" className="text-[10px] px-2 h-5">Y</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-2">
                <div className="h-[100px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={monthlyData}
                            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                        >
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 9 }}
                                stroke="#9CA3AF"
                                tickFormatter={(val) => {
                                    // For day/week view, return as is (already formatted)
                                    if (timePeriod === 'day' || timePeriod === 'week') {
                                        return val;
                                    }
                                    // For month view, map numeric month to name
                                    return monthNames[parseInt(val) - 1] || val;
                                }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis hide />
                            <ChartTooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const period = payload[0].payload.month;
                                        let displayPeriod = period;

                                        // Format month names for numeric months
                                        if (timePeriod === 'month' && /^\d{2}$/.test(period)) {
                                            displayPeriod = monthNames[parseInt(period) - 1] || period;
                                        }

                                        return (
                                            <div className="bg-background border rounded-md shadow-sm p-2 text-xs">
                                                <p className="font-medium">{displayPeriod}</p>
                                                <p className="text-muted-foreground">
                                                    {payload[0].value?.toLocaleString()} rows
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="rows"
                                stroke={CHART_COLORS.purple}
                                fill={CHART_COLORS.purpleSoft}
                                fillOpacity={0.5}
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
