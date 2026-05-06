"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, Download, Loader2, Mail, MapPin, Phone, ShieldCheck, Trash2, UserX, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PermissionWrapper } from "@/modules/auth/components/permission-wrapper";
import { orgAPI } from "@/modules/auth/api/org-api";
import { useAuth } from "@/modules/auth/hooks/use-auth";
import type { AppRole } from "./use-org-settings";
import { TimezonePreferenceCard } from "./timezone-preference-card";

interface OrgGeneralTabProps {
  currentUserRole: AppRole | undefined;
  canManageSettingsPermission: boolean;
  canManageOrganization: boolean;
  logoDataUrl: string;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
  orgSettings: {
    name: string;
    email: string;
    phone: string;
    address: string;
    industry: string;
    gst: string;
    pan: string;
    contact_person: string;
    subscriptionPlan: string;
  };
  isSavingOrg: boolean;
  handleLogoUploadClick: () => void;
  handleLogoSelected: (file?: File) => void;
  handleOrgChange: (field: string, value: string) => void;
  handleSaveOrg: () => Promise<void>;
}

export function OrgGeneralTab({
  currentUserRole,
  canManageSettingsPermission,
  canManageOrganization,
  logoDataUrl,
  logoInputRef,
  orgSettings,
  isSavingOrg,
  handleLogoUploadClick,
  handleLogoSelected,
  handleOrgChange,
  handleSaveOrg,
}: OrgGeneralTabProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isSuperAdmin = currentUserRole === "Super Admin";
  const expectedConfirm = orgSettings.name?.trim() || "";
  const canConfirmDelete =
    expectedConfirm.length > 0 && confirmName.trim() === expectedConfirm;

  // ── DSAR (Phase 5) handlers ─────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [accountConfirmOpen, setAccountConfirmOpen] = useState(false);

  const handleExportMyData = async () => {
    setIsExporting(true);
    try {
      const data = await orgAPI.exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cleanflowai-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Your data export has been downloaded.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      toast.error(`Export failed: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteMyAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const result = await orgAPI.deleteMyAccount();
      if (result.status === "BLOCKED") {
        toast.error(
          `Account deletion blocked: you are the sole superadmin of ${result.blocking_orgs?.length ?? 0} organization(s). Transfer ownership or delete the org first.`,
        );
        setIsDeletingAccount(false);
        return;
      }
      toast.success(
        `Your account has been deleted. ${result.memberships_removed ?? 0} memberships removed.`,
      );
      try {
        logout();
      } catch {
        /* ignore */
      }
      router.replace("/auth/login");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast.error(`Account deletion failed: ${msg}`);
      setIsDeletingAccount(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!canConfirmDelete) return;
    setIsDeleting(true);
    try {
      const result = await orgAPI.deleteOrganization();
      toast.success(
        `Organization "${expectedConfirm}" deleted. ${result.members_deleted} members and ${result.invites_deleted} invites removed.`,
      );
      // Sign the user out and send to login. Their access has just been revoked.
      try {
        logout();
      } catch {
        // logout failures shouldn't block the redirect
      }
      router.replace("/auth/login");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast.error(`Failed to delete organization: ${message}`);
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* User-level timezone preference (UI only, stored in localStorage).
          Rendered outside PermissionWrapper so every signed-in user can
          set their own display timezone regardless of org-settings RBAC. */}
      <TimezonePreferenceCard />
      <PermissionWrapper
      permission={canManageSettingsPermission}
      permissionKey="settings"
      userRole={currentUserRole}
      message="You do not have permission to manage organization profile."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Organization Details
          </CardTitle>
          <CardDescription>
            Manage your organization's information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Section */}
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-muted-foreground/30 overflow-hidden">
              {logoDataUrl ? (
                <img
                  src={logoDataUrl}
                  alt="Organization logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Organization Logo</h4>
              <p className="text-sm text-muted-foreground">
                Upload a logo for your organization
              </p>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoSelected(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogoUploadClick}
                disabled={!canManageOrganization}
              >
                Upload Logo
              </Button>
            </div>
          </div>

          <Separator />

          {/* Organization Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="Infiniqon"
                value={orgSettings.name}
                onChange={(e) => handleOrgChange("name", e.target.value)}
                disabled={!canManageOrganization}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="org-email"
                  className="pl-10"
                  placeholder="contact@infiniqon.com"
                  value={orgSettings.email}
                  onChange={(e) => handleOrgChange("email", e.target.value)}
                  disabled={!canManageOrganization}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-phone">Contact Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="org-phone"
                  className="pl-10"
                  placeholder="+91 63 4567 8900"
                  value={orgSettings.phone}
                  onChange={(e) => handleOrgChange("phone", e.target.value)}
                  disabled={!canManageOrganization}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="org-address"
                  className="pl-10"
                  placeholder="Ekkaduthangal, Chennai, Tamil Nadu"
                  value={orgSettings.address}
                  onChange={(e) => handleOrgChange("address", e.target.value)}
                  disabled={!canManageOrganization}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Subscription Plan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select
                value={orgSettings.subscriptionPlan}
                onValueChange={(value) =>
                  handleOrgChange("subscriptionPlan", value)
                }
                disabled={!canManageOrganization}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button
              onClick={handleSaveOrg}
              disabled={isSavingOrg || !canManageOrganization}
            >
              {isSavingOrg && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {isSavingOrg ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Privacy & Data (DSAR — Phase 5) ─────────────────────────── */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Your Data &amp; Privacy
          </CardTitle>
          <CardDescription>
            Export or delete your personal data. Required by GDPR Art.
            15-22 and India&apos;s DPDPA. Files you uploaded for the
            organization remain with the organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Export my data</h4>
              <p className="text-sm text-muted-foreground">
                Downloads a JSON of your account, memberships, invites,
                and permissions.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMyData}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isExporting ? "Exporting..." : "Export"}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Delete my account</h4>
              <p className="text-sm text-muted-foreground">
                Removes your access to all organizations and disables
                your login. Audit logs are retained per legal basis.
                Blocked if you&apos;re the sole superadmin of any org.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setAccountConfirmOpen(true)}
            >
              <UserX className="w-4 h-4 mr-2" />
              Delete account
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={accountConfirmOpen}
        onOpenChange={(open) => {
          // Prevent dismissing the dialog while the DELETE is in flight —
          // the request keeps running but the user loses the confirmation UI.
          if (isDeletingAccount) return;
          setAccountConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete your account
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke your access immediately. You can sign up
              again with the same email later, but your old memberships
              will not be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAccount}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteMyAccount();
              }}
              disabled={isDeletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <UserX className="w-4 h-4 mr-2" />
                  Delete my account
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Danger Zone — Super Admin only ──────────────────────────── */}
      {isSuperAdmin && (
        <Card className="mt-6 border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions that affect the entire organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Delete this organization</h4>
                <p className="text-sm text-muted-foreground">
                  Removes all members, invites, and role permissions. The
                  organization record is retained for audit. Files, jobs, and
                  connector data are queued for asynchronous cleanup.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setConfirmName("");
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete organization
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          // Prevent dismissing the dialog while the DELETE is in flight —
          // the request keeps running but the user loses the confirmation UI.
          if (isDeleting) return;
          setDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete organization
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                You're about to permanently delete{" "}
                <span className="font-semibold text-foreground">
                  {expectedConfirm || "this organization"}
                </span>
                . This will immediately revoke access for all members and
                invitees.
              </span>
              <span className="block text-destructive font-medium">
                This action cannot be undone from the UI.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-org-name" className="text-sm">
              To confirm, type the organization name:{" "}
              <span className="font-mono font-semibold">{expectedConfirm}</span>
            </Label>
            <Input
              id="confirm-org-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={expectedConfirm}
              autoComplete="off"
              disabled={isDeleting}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteOrganization();
              }}
              disabled={!canConfirmDelete || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Permanently delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionWrapper>
    </>
  );
}
