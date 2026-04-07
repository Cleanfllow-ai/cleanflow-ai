"use client";

import { Building2, Cable, Cog, Loader2, Mail, Plus, RefreshCw, Shield, ShieldCheck, UserPlus, Users } from "lucide-react";
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
import { ConnectorsHub } from "@/modules/connectors/components/connectors-hub";

export function OrganizationSettings() {
  const hookData = useOrgSettings();

  return (
    <Tabs value={hookData.activeTab} onValueChange={hookData.setActiveTab} className="space-y-6">
      {/* Invite Dialog */}
      <Dialog open={hookData.isInviteDialogOpen} onOpenChange={hookData.setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="p-8 pb-4 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
              <UserPlus className="w-7 h-7 text-primary" />
            </div>
            <DialogHeader className="space-y-2">
              <DialogTitle className="font-sans text-xl font-bold tracking-tight text-foreground">
                Add Team Member
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm leading-relaxed max-w-[320px]">
                Enter the email address and select their role within the organization.
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
          updateMemberRole={hookData.updateMemberRole}
          removeMember={hookData.removeMember}
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
    </Tabs>
  );
}
