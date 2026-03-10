"use client";

import { Check, Loader2, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PermissionWrapper } from "@/modules/auth/components/permission-wrapper";
import type { AppRole, PermissionRow } from "./use-org-settings";

interface OrgPermissionsTabProps {
  currentUserRole: AppRole | undefined;
  canChangeAllRoles: boolean;
  canManageDataStewards: boolean;
  permissions: PermissionRow[];
  isSavingPermissions: boolean;
  togglePermission: (permissionId: string, role: "superadmin" | "admin" | "dataSteward") => void;
  handleSavePermissions: () => Promise<void>;
}

export function OrgPermissionsTab({
  currentUserRole,
  canChangeAllRoles,
  canManageDataStewards,
  permissions,
  isSavingPermissions,
  togglePermission,
  handleSavePermissions,
}: OrgPermissionsTabProps) {
  return (
    <PermissionWrapper
      requiredRole={["Super Admin", "Admin"]}
      userRole={currentUserRole}
      message="Only Super Admins and Admins can modify role permissions."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Role Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Permission</TableHead>
                <TableHead className="text-center">Super Admin</TableHead>
                <TableHead className="text-center">Admin</TableHead>
                <TableHead className="text-center">Data Stewards</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{permission.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {permission.description}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <button
                        onClick={() =>
                          togglePermission(permission.id, "superadmin")
                        }
                        disabled
                        title="Super Admin permissions are fixed"
                        className="w-6 h-6 rounded-full flex items-center justify-center transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {permission.superadmin ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            <X className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <button
                        onClick={() =>
                          togglePermission(permission.id, "admin")
                        }
                        disabled={!canChangeAllRoles}
                        className="w-6 h-6 rounded-full flex items-center justify-center transition-opacity disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-80"
                      >
                        {permission.admin ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            <X className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <button
                        onClick={() =>
                          togglePermission(permission.id, "dataSteward")
                        }
                        disabled={
                          !canChangeAllRoles && !canManageDataStewards
                        }
                        className="w-6 h-6 rounded-full flex items-center justify-center transition-opacity disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-80"
                      >
                        {permission.dataSteward ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            <X className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator className="my-6" />
          <div className="flex justify-end">
            <Button
              onClick={handleSavePermissions}
              disabled={
                isSavingPermissions ||
                (!canChangeAllRoles && !canManageDataStewards)
              }
            >
              {isSavingPermissions && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {isSavingPermissions ? "Saving..." : "Save Permissions"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PermissionWrapper>
  );
}
