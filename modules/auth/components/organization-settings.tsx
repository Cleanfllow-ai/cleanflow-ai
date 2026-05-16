"use client";

// Invites are re-enabled with a copy-URL fallback so admins can share the
// link manually even when SES isn't yet configured for the customer's domain.
const INVITES_ENABLED = true;

import { Building2, Cable, ClipboardCheck, Cog, Copy, Loader2, Mail, Plus, RefreshCw, Shield, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrgSettings, type AppRole } from "./org-settings/use-org-settings";
import { OrgGeneralTab } from "./org-settings/org-general-tab";
import { OrgMembersTab } from "./org-settings/org-members-tab";
import { OrgPermissionsTab } from "./org-settings/org-permissions-tab";
import { OrgServicesTab } from "./org-settings/org-services-tab";
import { OrgApprovalsTab } from "./org-settings/org-approvals-tab";
import { ConnectorsHub } from "@/modules/connectors/components/connectors-hub";

export function OrganizationSettings() {
  const hookData = useOrgSettings();

  return (
    <Tabs value={hookData.activeTab} onValueChange={hookData.setActiveTab} className="space-y-6">
      {/* Invite Dialog — hidden while INVITES_ENABLED=false (SES unverified) */}
      <Dialog
        open={INVITES_ENABLED && hookData.isInviteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            // Closing the dialog clears the share-link panel so the next
            // invite starts on the form view again.
            hookData.setLastInviteResult(null);
            hookData.setInviteEmail("");
          }
          hookData.setIsInviteDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-xl border border-border bg-card">
          {hookData.lastInviteResult ? (
            // ── Post-invite share-link view ─────────────────────────────────
            // Shown after a successful invite POST. The link is ALWAYS displayed
            // (even when email delivery succeeded) so admins can share it
            // out-of-band as well — and is the ONLY channel when SES isn't
            // configured for the customer domain.
            <div className="p-8 space-y-5">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                  <Mail className="w-7 h-7 text-primary" />
                </div>
                <DialogHeader className="space-y-2">
                  <DialogTitle className="font-sans text-xl font-bold tracking-tight text-foreground">
                    Invite created for {hookData.lastInviteResult.email}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-sm leading-relaxed max-w-[360px]">
                    {hookData.lastInviteResult.email_sent
                      ? "We've tried to send an email with this link. If it doesn't arrive within a few minutes, share it manually:"
                      : "Email delivery is not available right now. Copy the link below and share it with the invitee manually:"}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
                  Invitation link
                </Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={hookData.lastInviteResult.invite_link}
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-10 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(hookData.lastInviteResult!.invite_link);
                      } catch {
                        // Older browsers without clipboard API — fall back to selecting the input.
                      }
                    }}
                    className="h-10 px-3 shrink-0"
                  >
                    <Copy className="w-4 h-4 mr-1.5" />
                    Copy
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  This link grants <strong>{hookData.lastInviteResult.role}</strong> access. Share it only with the intended recipient.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    hookData.setLastInviteResult(null);
                    hookData.setInviteEmail("");
                  }}
                >
                  Invite another
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    hookData.setLastInviteResult(null);
                    hookData.setInviteEmail("");
                    hookData.setIsInviteDialogOpen(false);
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            // ── Initial invite form view ────────────────────────────────────
            <>
              <div className="p-8 pb-4 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                  <UserPlus className="w-7 h-7 text-primary" />
                </div>
                <DialogHeader className="space-y-2">
                  <DialogTitle className="font-sans text-xl font-bold tracking-tight text-foreground">
                    Add Team Member
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-sm leading-relaxed max-w-[360px]">
                    Enter the email and choose a role. You'll get a copy-able invitation link in the next step — share it directly if email delivery fails.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="px-8 pb-8 pt-4 space-y-5">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email" className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" />
                      Email Address
                    </Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={hookData.inviteEmail}
                      onChange={(e) => hookData.setInviteEmail(e.target.value)}
                      disabled={hookData.isSendingInvite}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-role" className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Access Level
                    </Label>
                    <Select
                      value={hookData.inviteRole}
                      onValueChange={(value) => hookData.setInviteRole(value as AppRole)}
                      disabled={hookData.isSendingInvite}
                    >
                      <SelectTrigger id="invite-role" className="h-10">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {hookData.allowedInviteRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            <span className="font-medium">{role}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={hookData.handleSubmitInvite}
                  disabled={hookData.isSendingInvite || !hookData.inviteEmail.includes("@")}
                  className="w-full h-10 font-semibold"
                >
                  {hookData.isSendingInvite ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding Member...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add Member
                    </div>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Header with Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-1 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-sans text-xl font-bold tracking-tight text-foreground">
              Organization
            </h1>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium mt-0.5"
              
            >
              Settings & team management
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-8"
          onClick={hookData.handleRefreshAdminTab}
          disabled={hookData.isRefreshingOrg}
        >
          {hookData.isRefreshingOrg ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span className="text-xs">Refresh</span>
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="overflow-x-auto">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1 gap-0.5">
          <TabsTrigger
            value="organization"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Organization</span>
            <span className="sm:hidden">Org</span>
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Users className="w-3.5 h-3.5" />
            Members
          </TabsTrigger>
          <TabsTrigger
            value="permissions"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Permissions</span>
            <span className="sm:hidden">Perms</span>
          </TabsTrigger>
          <TabsTrigger
            value="services"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Cog className="w-3.5 h-3.5" />
            Services
          </TabsTrigger>
          <TabsTrigger
            value="connectors"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Cable className="w-3.5 h-3.5" />
            Connectors
          </TabsTrigger>
          {hookData.currentUserRole === "Super Admin" && (
            <TabsTrigger
              value="approvals"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Approvals
              {hookData.pendingApprovalCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-destructive rounded-full">
                  {hookData.pendingApprovalCount}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>
      </div>

      {/* Tab Content */}
      <TabsContent value="organization" className="space-y-6">
        <OrgGeneralTab
          currentUserRole={hookData.currentUserRole}
          canManageSettingsPermission={hookData.canManageSettingsPermission}
          canManageOrganization={hookData.canManageOrganization}
          logoDataUrl={hookData.logoDataUrl}
          logoInputRef={hookData.logoInputRef}
          orgSettings={hookData.orgSettings}
          isSavingOrg={hookData.isSavingOrg}
          handleLogoUploadClick={hookData.handleLogoUploadClick}
          handleLogoSelected={hookData.handleLogoSelected}
          handleOrgChange={hookData.handleOrgChange}
          handleSaveOrg={hookData.handleSaveOrg}
        />
      </TabsContent>

      <TabsContent value="members" className="space-y-6">
        <OrgMembersTab
          currentUserRole={hookData.currentUserRole}
          currentUserId={hookData.currentUserId}
          canViewMembersPermission={hookData.canViewMembersPermission}
          canManageMembersPermission={hookData.canManageMembersPermission}
          canInviteMembers={hookData.canInviteMembers}
          canChangeAllRoles={hookData.canChangeAllRoles}
          canManageDataStewards={hookData.canManageDataStewards}
          allMembers={hookData.allMembers}
          isLoadingOrg={hookData.isLoadingOrg}
          revokingInviteId={hookData.revokingInviteId}
          inviteHelpText={hookData.inviteHelpText}
          handleInviteMember={hookData.handleInviteMember}
          handleRevokeInvite={hookData.handleRevokeInvite}
          confirmRevokeInvite={hookData.confirmRevokeInvite}
          pendingRevokeInvite={hookData.pendingRevokeInvite}
          setPendingRevokeInvite={hookData.setPendingRevokeInvite}
          updateMemberRole={hookData.updateMemberRole}
          removeMember={hookData.removeMember}
          confirmRemoveMember={hookData.confirmRemoveMember}
          pendingRemoveMember={hookData.pendingRemoveMember}
          setPendingRemoveMember={hookData.setPendingRemoveMember}
        />
      </TabsContent>

      <TabsContent value="permissions" className="space-y-6">
        <OrgPermissionsTab
          currentUserRole={hookData.currentUserRole}
          canChangeAllRoles={hookData.canChangeAllRoles}
          canManageDataStewards={hookData.canManageDataStewards}
          permissions={hookData.permissions}
          isSavingPermissions={hookData.isSavingPermissions}
          togglePermission={hookData.togglePermission}
          handleSavePermissions={hookData.handleSavePermissions}
          isLoadingPermissions={hookData.isLoadingPermissions}
          permissionsLoadError={hookData.permissionsLoadError}
        />
      </TabsContent>

      <TabsContent value="services" className="space-y-6">
        <OrgServicesTab
          currentUserRole={hookData.currentUserRole}
          canManageSettingsPermission={hookData.canManageSettingsPermission}
          servicesSettings={hookData.servicesSettings}
          isSavingServices={hookData.isSavingServices}
          settingsPresets={hookData.settingsPresets}
          isLoadingPresets={hookData.isLoadingPresets}
          isSavingPreset={hookData.isSavingPreset}
          isPresetDialogOpen={hookData.isPresetDialogOpen}
          presetDialogMode={hookData.presetDialogMode}
          presetFormName={hookData.presetFormName}
          presetFormConfig={hookData.presetFormConfig}
          presetFormDefault={hookData.presetFormDefault}
          presetToDelete={hookData.presetToDelete}
          isDeletePresetOpen={hookData.isDeletePresetOpen}
          handleServicesChange={hookData.handleServicesChange}
          handleSaveServices={hookData.handleSaveServices}
          openCreatePresetDialog={hookData.openCreatePresetDialog}
          openEditPresetDialog={hookData.openEditPresetDialog}
          handleSavePreset={hookData.handleSavePreset}
          handleDeletePreset={hookData.handleDeletePreset}
          handleSetDefaultPreset={hookData.handleSetDefaultPreset}
          setIsPresetDialogOpen={hookData.setIsPresetDialogOpen}
          setPresetFormName={hookData.setPresetFormName}
          setPresetFormConfig={hookData.setPresetFormConfig}
          setPresetFormDefault={hookData.setPresetFormDefault}
          setPresetToDelete={hookData.setPresetToDelete}
          setIsDeletePresetOpen={hookData.setIsDeletePresetOpen}
        />
      </TabsContent>

      <TabsContent value="connectors" className="space-y-6">
        <ConnectorsHub />
      </TabsContent>

      {hookData.currentUserRole === "Super Admin" && (
        <TabsContent value="approvals" className="space-y-6">
          <OrgApprovalsTab
            currentUserRole={hookData.currentUserRole}
            approvals={hookData.approvals}
            isLoading={hookData.isLoadingApprovals}
            statusFilter={hookData.approvalStatusFilter}
            onStatusFilterChange={hookData.setApprovalStatusFilter}
            onApprove={hookData.handleApproveRequest}
            onReject={hookData.handleRejectRequest}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
