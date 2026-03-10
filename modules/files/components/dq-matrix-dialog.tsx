"use client";

import { Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface DqMatrixDialogProps {
    open: boolean;
    onOpenChange: (val: boolean) => void;
    limit: number | string;
    start: string;
    end: string;
    setLimit: (val: any) => void;
    setStart: (val: any) => void;
    setEnd: (val: any) => void;
    totals: { totalResults?: number; totalRows?: number } | null;
    loadingTotals: boolean;
    onDownload: () => void;
    downloading: boolean;
}

export function DqMatrixDialog({
    open,
    onOpenChange,
    limit,
    start,
    end,
    setLimit,
    setStart,
    setEnd,
    totals,
    loadingTotals,
    onDownload,
    downloading,
}: DqMatrixDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Download DQ Matrix</DialogTitle>
                    <DialogDescription>Choose a range or limit to download cell-level issues.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Limit</Label>
                            <Input
                                type="number"
                                min={1}
                                value={limit}
                                onChange={(e) => setLimit(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Start (offset)</Label>
                            <Input
                                type="number"
                                min={0}
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>End (optional)</Label>
                            <Input
                                type="number"
                                min={0}
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {loadingTotals ? "Loading totals..." : (
                            totals ? (
                                <>
                                    <div>Total issue rows: {totals.totalResults ?? "unknown"}</div>
                                    <div>Total rows processed: {totals.totalRows ?? "unknown"}</div>
                                </>
                            ) : "Totals not available"
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={onDownload} disabled={downloading}>
                            {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Download
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
