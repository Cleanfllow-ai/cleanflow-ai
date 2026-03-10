import type { FileStatusResponse } from "@/modules/files";

export interface DqChartsProps {
    files: FileStatusResponse[];
}

// Color palette - softer colors for charts (easy on the eyes)
export const CHART_COLORS = {
    // Solid colors for strokes/borders
    green: "#22C55E",
    yellow: "#EAB308",
    red: "#EF4444",
    blue: "#3B82F6",
    purple: "#8B5CF6",
    pink: "#EC4899",
    teal: "#14B8A6",
    orange: "#F97316",
    // Softer fill colors with transparency - brighter for pie/bar charts
    greenSoft: "rgba(34, 197, 94, 0.75)", // green-500/75
    yellowSoft: "rgba(234, 179, 8, 0.75)", // yellow-500/75
    redSoft: "rgba(239, 68, 68, 0.7)", // red-500/70
    blueSoft: "rgba(59, 130, 246, 0.65)", // blue-500/65
    purpleSoft: "rgba(139, 92, 246, 0.4)", // purple-500/40
    tealSoft: "rgba(20, 184, 166, 0.4)", // teal-500/40
};

export const chartConfig = {
    rowsIn: {
        label: "Rows In",
        color: CHART_COLORS.purple,
    },
    rowsOut: {
        label: "Rows Out",
        color: CHART_COLORS.teal,
    },
    rowsFixed: {
        label: "Rows Fixed",
        color: CHART_COLORS.yellow,
    },
    rowsQuarantined: {
        label: "Quarantined",
        color: CHART_COLORS.red,
    },
    filesProcessed: {
        label: "Files Processed",
        color: CHART_COLORS.blue,
    },
    filesDeleted: {
        label: "Files Deleted",
        color: CHART_COLORS.red,
    },
    clean: {
        label: "Validated",
        color: CHART_COLORS.green,
    },
    fixed: {
        label: "Fixed",
        color: CHART_COLORS.yellow,
    },
    quarantined: {
        label: "Quarantined",
        color: CHART_COLORS.red,
    },
};
