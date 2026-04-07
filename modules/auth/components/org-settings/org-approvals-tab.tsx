"use client";

import { Check, Clock, Loader2, X, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PermissionWrapper } from "@/modules/auth/components/permission-wrapper";
import type { ApprovalRecord, ApprovalStatus } from "@/modules/auth/api/org-api";
import type { AppRole } from "./use-org-settings";

interface OrgApprovalsTabProps {
  currentUserRole: AppRole | undefined;
  approvals: ApprovalRecord[];
  isLoading: boolean;
  statusFilter: ApprovalStatus | "";
  onStatusFilterChange: (value: ApprovalStatus | "") => void;
  onApprove: (approvalId: string) => Promise<void>;
  onReject: (approvalId: string) => Promise<void>;
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  switch (status) {
    case "PENDING":
      return (
        <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    case "APPROVED":
      return (
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10">
          <Check className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="outline" className="border-red-500/40 text-red-600 bg-red-500/10">
          <X className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(iso: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function actionLabel(action: string) {
  switch (action) {
    case "reprocess":
      return "Reprocess";
    default:
      return action;
  }
}

export function OrgApprovalsTab({
  currentUserRole,
  approvals,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  onApprove,
  onReject,
}: OrgApprovalsTabProps) {
  return (
    <PermissionWrapper
      requiredRole={["Super Admin"]}
      userRole={currentUserRole}
      fallback="hide"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Approval Requests
          </CardTitle>
          <Select
            value={statusFilter || "ALL"}
            onValueChange={(v) =>
              onStatusFilterChange(v === "ALL" ? "" : (v as ApprovalStatus))
            }
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading approvals...
            </div>
          ) : approvals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No approval requests found.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Requester</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Resource</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Requested</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.map((a) => (
                    <TableRow key={a.approval_id}>
                      <TableCell className="text-xs font-medium">
                        {a.requester_email}
                      </TableCell>
                      <TableCell className="text-xs">
                        {actionLabel(a.action_type)}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={a.resource_name || a.resource_id}>
                        {a.resource_name || a.resource_id}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(a.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {a.status === "PENDING" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => onApprove(a.approval_id)}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs border-red-500/40 text-red-600 hover:bg-red-500/10"
                              onClick={() => onReject(a.approval_id)}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {a.decided_at ? formatDate(a.decided_at) : "-"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </PermissionWrapper>
  );
}
