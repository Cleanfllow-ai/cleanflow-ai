"use client";

import { Building2, Cog, Loader2, Mail, Plus, RefreshCw, Shield, ShieldCheck, UserPlus, Users } from "lucide-react";
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

export function OrganizationSettings() {
  const hookData = useOrgSettings();

  return (
    <Tabs value={hookData.activeTab} onValueChange={hookData.setActiveTab} className="space-y-6">
      {/* Invite Dialog */}
      <Dialog open={hookData.isInviteDialogOpen} onOpenChange={hookData.setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
          <div className="p-8 pb-4 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
              <UserPlus className="w-8 h-8 text-primary" />
            </div>
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">Add Team Member</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm leading-relaxed max-w-[320px]">
                Enter the email address of the person you'd like to add and select their role within the organization.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-8 pb-8 pt-4 space-y-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="invite-email" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Email Address
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={hookData.inviteEmail}
                  onChange={(e) => hookData.setInviteEmail(e.target.value)}
                  disabled={hookData.isSendingInvite}
                  className="h-11 rounded-xl focus-visible:ring-primary/20 transition-all border-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                  Access Level
                </Label>
                <Select
                  value={hookData.inviteRole}
                  onValueChange={(value) => hookData.setInviteRole(value as AppRole)}
                  disabled={hookData.isSendingInvite}
                >
                  <SelectTrigger id="invite-role" className="h-11 rounded-xl focus:ring-primary/20">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {hookData.allowedInviteRoles.map((role) => (
                      <SelectItem key={role} value={role} className="rounded-lg">
                        <span className="font-medium">{role}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={hookData.handleSubmitInvite}
                disabled={hookData.isSendingInvite || !hookData.inviteEmail.includes("@")}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-sm transition-all active:scale-95 group"
              >
                {hookData.isSendingInvite ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding Member...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    Add Member
                    <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 text-primary-foreground/80" />
                  </div>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Centered Tabs Header */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pt-2 pb-4">
        <div />
        <div className="overflow-x-auto justify-self-center">
          <TabsList className="inline-flex h-10 sm:h-12 items-center justify-center rounded-xl bg-muted p-1 sm:p-1.5 gap-1">
            <TabsTrigger
              value="organization"
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-lg px-3 sm:px-6 py-2 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Organization</span>
              <span className="sm:hidden">Org</span>
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-lg px-3 sm:px-6 py-2 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Users className="w-4 h-4" />
              <span>Members</span>
            </TabsTrigger>
            <TabsTrigger
              value="permissions"
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-lg px-3 sm:px-6 py-2 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Permissions</span>
              <span className="sm:hidden">Perms</span>
            </TabsTrigger>
            <TabsTrigger
              value="services"
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-lg px-3 sm:px-6 py-2 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Cog className="w-4 h-4" />
              <span>Services</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="justify-self-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={hookData.handleRefreshAdminTab}
            disabled={hookData.isRefreshingOrg}
            aria-label="Refresh admin data"
          >
            {hookData.isRefreshingOrg ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Organization Settings Tab */}
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

      {/* Members Tab */}
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

      {/* Permissions Tab */}
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

      {/* Services Tab */}
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
    </Tabs>
  );
}
