"use client";

// Invites re-enabled with a copy-URL fallback (admin can share the link
// manually when SES email delivery is unavailable).
const INVITES_ENABLED = true;

import { useState } from "react";
import { Loader2, MoreHorizontal, Search, UserCog, UserMinus, UserPlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/shared/lib/utils";
import { PermissionWrapper } from "@/modules/auth/components/permission-wrapper";
import { getRoleBadgeVariant, getStatusBadgeVariant, VALID_ROLES, type AppRole } from "./use-org-settings";

interface OrgMembersTabProps {
  currentUserRole: AppRole | undefined;
  currentUserId: string | null;
  canViewMembersPermission: boolean;
  canManageMembersPermission: boolean;
  canInviteMembers: boolean;
  canChangeAllRoles: boolean;
  canManageDataStewards: boolean;
  allMembers: Array<{
    id: string;
    isInvite: boolean;
    displayId: string;
    displayName: string;
    displayEmail: string;
    displayStatus: string;
    displayRole: AppRole;
    displayJoined: string;
    displayLastLogin: string;
    displayAvatar: string;
  }>;
  isLoadingOrg: boolean;
  revokingInviteId: string | null;
  inviteHelpText: string;
  handleInviteMember: () => void;
  handleRevokeInvite: (inviteId: string, email: string) => void;
  confirmRevokeInvite: () => Promise<void>;
  pendingRevokeInvite: { inviteId: string; email: string } | null;
  setPendingRevokeInvite: (val: { inviteId: string; email: string } | null) => void;
  updateMemberRole: (memberId: string, newRole: AppRole) => Promise<void>;
  removeMember: (memberId: string) => void;
  confirmRemoveMember: () => Promise<void>;
  pendingRemoveMember: { memberId: string; name: string; email: string } | null;
  setPendingRemoveMember: (val: { memberId: string; name: string; email: string } | null) => void;
}

export function OrgMembersTab({
  currentUserRole,
  currentUserId,
  canViewMembersPermission,
  canManageMembersPermission,
  canInviteMembers,
  canChangeAllRoles,
  canManageDataStewards,
  allMembers,
  isLoadingOrg,
  revokingInviteId,
  inviteHelpText,
  handleInviteMember,
  handleRevokeInvite,
  confirmRevokeInvite,
  pendingRevokeInvite,
  setPendingRevokeInvite,
  updateMemberRole,
  removeMember,
  confirmRemoveMember,
  pendingRemoveMember,
  setPendingRemoveMember,
}: OrgMembersTabProps) {
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    memberId: string
    memberName: string
    currentRole: string
    newRole: AppRole
  } | null>(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")

  const handleRoleChangeRequest = (memberId: string, memberName: string, currentRole: string, newRole: AppRole) => {
    setPendingRoleChange({ memberId, memberName, currentRole, newRole })
  }

  const handleRoleChangeConfirm = async () => {
    if (!pendingRoleChange) return
    await updateMemberRole(pendingRoleChange.memberId, pendingRoleChange.newRole)
    setPendingRoleChange(null)
  }

  return (
    <PermissionWrapper
      permission={canViewMembersPermission}
      permissionKey="members_view"
      requiredRole={["Super Admin", "Admin", "Data Steward"]}
      userRole={currentUserRole}
      message="You do not have permission to view members."
    >
      <PermissionWrapper
        permission={canManageMembersPermission}
        permissionKey="members_manage"
        requiredRole={["Super Admin", "Admin", "Data Steward"]}
        userRole={currentUserRole}
        message="You do not have permission to manage members."
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Members & Roles
              </CardTitle>
            </div>
            {INVITES_ENABLED && (
              <Button
                className="flex items-center gap-2"
                onClick={handleInviteMember}
                disabled={!canInviteMembers}
                title={inviteHelpText}
              >
                <UserPlus className="w-4 h-4" />
                Add Member
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {/* Search + Role filter */}
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <Input
                  data-testid="members-search"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter} data-testid="role-filter-select">
                <SelectTrigger className="w-[160px] h-8 text-sm" data-testid="role-filter-trigger">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="Super Admin">Super Admin</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Data Steward">Data Steward</SelectItem>
                  <SelectItem value="Member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-center">Role</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Joined</TableHead>
                  <TableHead className="text-center">Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingOrg && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Loading members...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoadingOrg && allMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No team members or pending invites.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoadingOrg &&
                  allMembers
                  .filter((person) => {
                    const q = search.toLowerCase()
                    const matchesSearch =
                      !search ||
                      person.displayName.toLowerCase().includes(q) ||
                      person.displayEmail.toLowerCase().includes(q)
                    const matchesRole =
                      roleFilter === "all" || person.displayRole === roleFilter
                    return matchesSearch && matchesRole
                  })
                  .map((person) => {
                    const isSelf = Boolean(
                      currentUserId && person.displayId === currentUserId,
                    );
                    const isInvite = person.isInvite;

                    return (
                      <TableRow key={person.displayId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9 border border-border/50">
                              {person.displayAvatar ? (
                                <AvatarImage src={person.displayAvatar} />
                              ) : null}
                              <AvatarFallback className={`${isInvite ? 'bg-indigo-100 text-indigo-600 font-bold' : 'bg-primary/10 text-primary'} text-xs`}>
                                {person.displayName
                                  .split(" ")
                                  .map((n) => n?.[0])
                                  .filter(Boolean)
                                  .join("")
                                  .toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium flex items-center gap-2 text-sm sm:text-base">
                                {person.displayName}
                                {isSelf && (
                                  <Badge variant="outline" className="text-[10px] h-4">
                                    You
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-none">
                                {person.displayEmail}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            <Badge variant={getRoleBadgeVariant(person.displayRole)} className="text-[10px] h-5 min-w-[100px] justify-center">
                              {person.displayRole}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            <Badge
                              variant={isInvite ? "secondary" : getStatusBadgeVariant(person.displayStatus)}
                              className={cn(
                                "text-[10px] h-5 px-3 min-w-[80px] justify-center",
                                person.displayStatus === "Active" && "bg-emerald-100 text-emerald-800 border-emerald-100",
                                isInvite && "bg-indigo-100 text-indigo-800 border-indigo-100"
                              )}
                            >
                              {person.displayStatus}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs text-center">
                          {person.displayJoined}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs text-center">
                          {person.displayLastLogin}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Member actions"
                                className="h-8 w-8"
                                disabled={isSelf || !canManageMembersPermission}
                                title={
                                  isSelf
                                    ? "You cannot change your own role here."
                                    : !canManageMembersPermission
                                      ? "You do not have permission to manage members."
                                      : undefined
                                }
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[180px]">
                              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground font-bold px-2 py-1.5">Actions</DropdownMenuLabel>

                              {isInvite ? (
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600 focus:bg-red-100 gap-2 cursor-pointer"
                                  onClick={() => handleRevokeInvite(person.displayId, person.displayEmail)}
                                >
                                  {revokingInviteId === person.displayId ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <X className="w-3.5 h-3.5" />
                                  )}
                                  Revoke Invite
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  {canChangeAllRoles ? (
                                    <>
                                      {person.displayRole === "Super Admin" ? (
                                        <DropdownMenuItem disabled className="text-xs italic">
                                          Super Admin is fixed
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuSub>
                                          <DropdownMenuSubTrigger className="gap-2">
                                            <UserCog className="w-3.5 h-3.5" />
                                            Change Role
                                          </DropdownMenuSubTrigger>
                                          <DropdownMenuPortal>
                                            <DropdownMenuSubContent className="w-[140px]">
                                              {VALID_ROLES.filter((r: string) => r !== person.displayRole).map((role: string) => (
                                                <DropdownMenuItem
                                                  key={role}
                                                  className="cursor-pointer"
                                                  onClick={() => handleRoleChangeRequest(person.displayId, person.displayName, person.displayRole, role as AppRole)}
                                                >
                                                  {role}
                                                </DropdownMenuItem>
                                              ))}
                                            </DropdownMenuSubContent>
                                          </DropdownMenuPortal>
                                        </DropdownMenuSub>
                                      )}
                                    </>
                                  ) : (
                                    canManageDataStewards && person.displayRole === "Data Steward" && (
                                      <DropdownMenuItem disabled className="text-xs italic">
                                        Admin cannot demote
                                      </DropdownMenuItem>
                                    )
                                  )}

                                  {currentUserRole === "Super Admin" && person.displayRole !== "Super Admin" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-red-600 focus:text-red-600 focus:bg-red-100 gap-2 cursor-pointer"
                                        onClick={() => removeMember(person.displayId)}
                                      >
                                        <UserMinus className="w-3.5 h-3.5" />
                                        Remove Member
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PermissionWrapper>

      {/* Role change confirmation */}
      <AlertDialog
        open={!!pendingRoleChange}
        onOpenChange={(open) => !open && setPendingRoleChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Role</AlertDialogTitle>
            <AlertDialogDescription>
              Change <strong>{pendingRoleChange?.memberName}</strong> from{" "}
              <strong>{pendingRoleChange?.currentRole}</strong> to{" "}
              <strong>{pendingRoleChange?.newRole}</strong>?
              {pendingRoleChange?.newRole === "Data Steward" && (
                <span className="block mt-2 text-amber-600">
                  They will lose access to member management and organization settings.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoleChangeConfirm}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke invite confirmation */}
      <AlertDialog
        open={!!pendingRevokeInvite}
        onOpenChange={(open) => !open && setPendingRevokeInvite(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Revoke the invitation for <strong>{pendingRevokeInvite?.email}</strong>? They will no longer be able to use this invite link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevokeInvite}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove member confirmation */}
      <AlertDialog
        open={!!pendingRemoveMember}
        onOpenChange={(open) => !open && setPendingRemoveMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{pendingRemoveMember?.name}</strong> ({pendingRemoveMember?.email}) from the organization? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionWrapper>
  );
}
