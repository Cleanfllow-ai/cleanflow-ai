"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/modules/auth";
import {
    orgAPI,
    type ApprovalRecord,
    type ApprovalStatus,
    type OrgInvite,
    type OrgMembership,
    type OrgRole,
} from "@/modules/auth/api/org-api";
import { isApiError } from "@/modules/shared/api-error";
import {
    fileManagementAPI,
    type SettingsPreset,
} from "@/modules/files";

// ─── Types ────────────────────────────────────────────────────────
export type AppRole = OrgRole;

// ─── Constants ────────────────────────────────────────────────────
export const VALID_ROLES = ["Super Admin", "Admin", "Data Steward", "Member"];

export const ERP_OPTIONS = [
    { value: "quickbooks", label: "QUICKBOOKS ONLINE" },
    { value: "zoho-books", label: "ZOHO BOOKS" },
    { value: "oracle", label: "ORACLE FUSION" },
    { value: "sap", label: "SAP" },
    { value: "dynamics", label: "MICROSOFT DYNAMICS" },
    { value: "netsuite", label: "NETSUITE" },
    { value: "workday", label: "WORKDAY" },
    { value: "infor-m3", label: "INFOR M3" },
    { value: "infor-ln", label: "INFOR LN" },
    { value: "epicor", label: "EPICOR KINETIC" },
    { value: "qad", label: "QAD" },
    { value: "ifs", label: "IFS CLOUD" },
    { value: "sage", label: "SAGE INTACCT" },
    { value: "custom", label: "CUSTOM" },
];

export const DEFAULT_PRESET_TEMPLATE = {
    version: "1.0.0",
    weights: {
        fatal: "3",
        high: "2",
        medium: "1"
    },
    severity: {
        missing_required: "high",
        duplicate_primary_key: "fatal",
        invalid_email: "medium"
    },
    policy: {
        future_date_horizon_days: "365",
        max_free_text_length: "2000",
        round_scale_numeric: "4",
        tolerance_amount: "0.01"
    },
    required_columns: ["id"],
    primary_key_columns: ["id"],
    enums: {
        status: {
            allowed: ["Active", "Inactive", "Pending"],
            synonyms: {
                "A": "Active",
                "I": "Inactive"
            }
        }
    },
    rules: {
        missing_required: {
            description: "Required fields cannot be null or empty",
            columns: ["id", "name"],
            action: "quarantine"
        },
        leading_trailing_whitespace: {
            description: "Remove leading and trailing whitespace",
            action: "trim"
        }
    }
};

const INITIAL_ORG_SETTINGS = {
    name: "",
    email: "",
    phone: "",
    address: "",
    industry: "",
    gst: "",
    pan: "",
    contact_person: "",
    subscriptionPlan: "standard",
};

const INITIAL_SERVICES_SETTINGS = {
    defaultInputErp: "quickbooks",
    defaultExportErp: "quickbooks",
    customInputErpName: "",
    customExportErpName: "",
    dataTransformEnabled: true,
    dataQualityEnabled: true,
    cleanDataShieldEnabled: false,
    preferredFormat: "csv",
};

// Keep presets logic and wiring in place, but hide this UI block for now.
export const SHOW_GLOBAL_SETTINGS_PRESETS = false;

const INITIAL_MEMBERS: Array<{
    id: string;
    name: string;
    email: string;
    role: AppRole;
    status: string;
    avatar: string;
    joinedAt?: string;
    lastLogin?: string;
}> = [];

export const INITIAL_PERMISSIONS = [
    {
        id: "files",
        name: "File Management",
        description: "Upload, download, and manage files",
        superadmin: true,
        admin: true,
        dataSteward: true,
    },
    {
        id: "transform",
        name: "Data Transformation",
        description: "Run and configure data transformations",
        superadmin: true,
        admin: true,
        dataSteward: true,
    },
    {
        id: "export",
        name: "Export Data",
        description: "Export transformed data to various formats",
        superadmin: true,
        admin: true,
        dataSteward: true,
    },
    {
        id: "members_view",
        name: "View Members",
        description: "View team members and pending invitations",
        superadmin: true,
        admin: true,
        dataSteward: true,
    },
    {
        id: "members_manage",
        name: "Manage Members",
        description: "Invite, remove, and manage team members",
        superadmin: true,
        admin: true,
        dataSteward: false,
    },
    {
        id: "billing",
        name: "Billing & Subscription",
        description: "View and manage billing information",
        superadmin: true,
        admin: false,
        dataSteward: false,
    },
    {
        id: "settings",
        name: "Organization Settings",
        description: "Modify organization details and preferences",
        superadmin: true,
        admin: true,
        dataSteward: false,
    },
];

export type PermissionRow = (typeof INITIAL_PERMISSIONS)[number];

// ─── Utility helpers ──────────────────────────────────────────────
export const formatStatus = (status?: string) => {
    const value = (status || "").toUpperCase();
    if (value === "ACTIVE") return "Active";
    if (value === "PENDING") return "Pending";
    if (value === "INACTIVE") return "Inactive";
    return status || "Unknown";
};

export const formatDateTime = (value?: string) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
};

export const deriveNameFromEmail = (email?: string, userId?: string) => {
    if (email && email.includes("@")) {
        return email.split("@")[0];
    }
    if (userId) {
        return userId.slice(0, 8);
    }
    return "Member";
};

const mergePermissionsFromServer = (
    permissionsByRole: Record<string, Record<string, boolean>> | undefined,
): PermissionRow[] => {
    const superAdminPerms = permissionsByRole?.["Super Admin"] || {};
    const adminPerms = permissionsByRole?.["Admin"] || {};
    const dataStewardPerms = permissionsByRole?.["Data Steward"] || {};

    return INITIAL_PERMISSIONS.map((row) => ({
        ...row,
        superadmin:
            typeof superAdminPerms[row.id] === "boolean"
                ? superAdminPerms[row.id]
                : row.superadmin,
        admin:
            typeof adminPerms[row.id] === "boolean" ? adminPerms[row.id] : row.admin,
        dataSteward:
            typeof dataStewardPerms[row.id] === "boolean"
                ? dataStewardPerms[row.id]
                : row.dataSteward,
    }));
};

export const getRoleBadgeVariant = (role: string) => {
    switch (role) {
        case "Super Admin":
            return "destructive";
        case "Admin":
            return "secondary";
        case "Data Steward":
            return "outline";
        case "Member":
            return "outline";
        default:
            return "outline";
    }
};

export const getStatusBadgeVariant = (status: string) => {
    switch ((status || "").toLowerCase()) {
        case "Active":
        case "active":
            return "default";
        case "Pending":
        case "pending":
            return "secondary";
        case "Inactive":
        case "inactive":
            return "outline";
        default:
            return "outline";
    }
};

// ─── Hook ─────────────────────────────────────────────────────────
export function useOrgSettings() {
    const [activeTab, setActiveTab] = useState("organization");
    const { toast } = useToast();
    const { logout, userRole: authUserRole, refreshPermissions } = useAuth();
    const currentUserRole = (authUserRole as AppRole) || "Data Steward";
    const [canViewMembersPermission, setCanViewMembersPermission] = useState(false);
    const [canManageMembersPermission, setCanManageMembersPermission] = useState(false);
    const [canManageSettingsPermission, setCanManageSettingsPermission] = useState(false);

    // Organization settings state
    const [orgSettings, setOrgSettings] = useState(INITIAL_ORG_SETTINGS);
    const [isSavingOrg, setIsSavingOrg] = useState(false);

    // Members state
    const [members, setMembers] = useState(INITIAL_MEMBERS);

    // Permissions state
    const [permissions, setPermissions] = useState(INITIAL_PERMISSIONS);
    const [isSavingPermissions, setIsSavingPermissions] = useState(false);

    // Services settings state
    const [servicesSettings, setServicesSettings] = useState(INITIAL_SERVICES_SETTINGS);
    const [isSavingServices, setIsSavingServices] = useState(false);
    const [settingsPresets, setSettingsPresets] = useState<SettingsPreset[]>([]);
    const [isLoadingPresets, setIsLoadingPresets] = useState(false);
    const [isSavingPreset, setIsSavingPreset] = useState(false);
    const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);
    const [presetDialogMode, setPresetDialogMode] = useState<"create" | "edit">("create");
    const [presetFormName, setPresetFormName] = useState("");
    const [presetFormConfig, setPresetFormConfig] = useState("{\n\n}");
    const [presetFormDefault, setPresetFormDefault] = useState(false);
    const [presetEditing, setPresetEditing] = useState<SettingsPreset | null>(null);
    const [presetToDelete, setPresetToDelete] = useState<SettingsPreset | null>(null);
    const [isDeletePresetOpen, setIsDeletePresetOpen] = useState(false);

    // Org context
    const [orgId, setOrgId] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [invites, setInvites] = useState<OrgInvite[]>([]);
    // Track invite-list load errors so the FE can render an inline retry
    // banner instead of a silent empty list. (loadInvites() used to swallow
    // failures entirely, making 403/500 indistinguishable from "no invites".)
    const [invitesLoadError, setInvitesLoadError] = useState<string | null>(null);
    const [membersLoadError, setMembersLoadError] = useState<string | null>(null);
    const [permissionsLoadError, setPermissionsLoadError] = useState<string | null>(null);
    // Separate loading state for the role-permissions matrix so the UI can
    // render a spinner while the GET /org/permissions call is in flight,
    // instead of locking the matrix to INITIAL_PERMISSIONS until reloadOrgData
    // resolves (which made the matrix appear "stuck" for Super Admin/Admin
    // users on tab switch).
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
    const [isLoadingOrg, setIsLoadingOrg] = useState(true);
    const [isRefreshingOrg, setIsRefreshingOrg] = useState(false);
    const [logoDataUrl, setLogoDataUrl] = useState<string>("");
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<AppRole>("Data Steward");
    const [isSendingInvite, setIsSendingInvite] = useState(false);
    const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

    // After a successful invite POST, we surface the shareable link inside the
    // same dialog so admins can copy/paste it even if SES email delivery
    // failed (or isn't configured yet). lastInviteResult is cleared when the
    // dialog closes or another invite is started.
    const [lastInviteResult, setLastInviteResult] = useState<{
        email: string;
        role: AppRole;
        invite_link: string;
        email_sent: boolean;
    } | null>(null);

    // AlertDialog state for destructive RBAC flows (replaces native confirm())
    const [pendingRevokeInvite, setPendingRevokeInvite] = useState<{ inviteId: string; email: string } | null>(null);
    const [pendingRemoveMember, setPendingRemoveMember] = useState<{ memberId: string; name: string; email: string } | null>(null);

    const logoInputRef = useRef<HTMLInputElement | null>(null);
    const presetFileInputRef = useRef<HTMLInputElement | null>(null);

    // Approvals state
    const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
    const [isLoadingApprovals, setIsLoadingApprovals] = useState(false);
    const [approvalsLoadError, setApprovalsLoadError] = useState<string | null>(null);
    const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
    const [approvalStatusFilter, setApprovalStatusFilter] = useState<ApprovalStatus | "">("PENDING");

    // Monotonic request token guarding reloadOrgData against parallel races.
    // useEffect on activeTab plus mutation-triggered reloads (e.g. after
    // updateMemberRole + invite send) could fire 2-3 concurrent getMe()
    // calls; the slowest one used to win and clobber fresh state. We now
    // discard any reload whose token is stale.
    const reloadTokenRef = useRef(0);

    // ─── Data helpers ───────────────────────────────────────────────
    const mapMemberToRow = (member: OrgMembership) => {
        const email = member.email || "";
        return {
            id: member.user_id,
            name: deriveNameFromEmail(email, member.user_id),
            email,
            role: member.role,
            status: formatStatus(member.status),
            avatar: "",
            joinedAt: formatDateTime(member.created_at),
            lastLogin: formatDateTime(member.updated_at),
        };
    };

    const loadMembers = async () => {
        try {
            const response = await orgAPI.listMembers();
            const items = (response.members || []).map(mapMemberToRow);
            setMembers(items);
            setMembersLoadError(null);
        } catch (err) {
            // Mirror loadInvites: surface via inline banner state, not toast.
            // Mutation paths still emit their own failure toasts.
            const message = (err as Error)?.message || "Could not load members.";
            console.error("Failed to load members", err);
            setMembersLoadError(message);
            throw err;
        }
    };

    const loadInvites = async () => {
        try {
            const response = await orgAPI.listInvites();
            setInvites(response.invites || []);
            setInvitesLoadError(null);
        } catch (err) {
            const message = (err as Error)?.message || "Could not load invites.";
            console.error("Failed to load invites", err);
            setInvitesLoadError(message);
            // Don't toast here — loadInvites is called on initial mount and
            // on every refresh; surfacing a banner via state is enough.
            // Mutation-failure toasts live in invite/revoke/send paths.
        }
    };

    const loadPermissions = async () => {
        setIsLoadingPermissions(true);
        try {
            const response = await orgAPI.listPermissions();
            setPermissions(mergePermissionsFromServer(response.permissions_by_role));
            setPermissionsLoadError(null);
        } catch (err) {
            const message = (err as Error)?.message || "Could not load role permissions.";
            console.error("Failed to load permissions", err);
            setPermissionsLoadError(message);
            throw err;
        } finally {
            setIsLoadingPermissions(false);
        }
    };

    const reloadOrgData = async () => {
        const myToken = ++reloadTokenRef.current;
        const isStale = () => reloadTokenRef.current !== myToken;
        try {
            const me = await orgAPI.getMe();
            // If another reload was kicked off while ours was in flight,
            // discard this result — committing it would clobber fresher state
            // (the second mutation's post-reload). Without this guard, fast
            // tab clicks + a role change racing would leave the UI showing
            // the pre-mutation snapshot.
            if (isStale()) return me;

            const nextOrgId = me.organization?.org_id || null;
            const nextUserId = me.membership?.user_id || null;
            const nextCanViewMembers =
                me?.role_permissions?.members_view === true ||
                me?.role_permissions?.members === true;
            const nextCanManageMembers =
                me?.role_permissions?.members_manage === true ||
                me?.role_permissions?.members === true;
            const nextCanManageSettings = me?.role_permissions?.settings === true;

            setOrgId(nextOrgId);
            setCurrentUserId(nextUserId);
            setCanViewMembersPermission(nextCanViewMembers);
            setCanManageMembersPermission(nextCanManageMembers);
            setCanManageSettingsPermission(nextCanManageSettings);
            setPermissions(mergePermissionsFromServer(me?.permissions_by_role));
            setMembersLoadError(null);

            setOrgSettings((prev) => ({
                ...prev,
                name: me.organization?.name || prev.name,
                email: me.organization?.email || prev.email,
                phone: me.organization?.phone || prev.phone,
                address: me.organization?.address || prev.address,
                industry: me.organization?.industry || prev.industry,
                gst: me.organization?.gst || prev.gst,
                pan: me.organization?.pan || prev.pan,
                contact_person: me.organization?.contact_person || prev.contact_person,
                subscriptionPlan:
                    me.organization?.subscription_plan || prev.subscriptionPlan,
            }));
            setLogoDataUrl(
                me.organization?.logo_url || me.organization?.logo_data_url || "",
            );

            await Promise.all([
                nextCanViewMembers
                    ? loadMembers().catch((e) => {
                        // loadMembers already records its own error state;
                        // swallow here so the other parallel fetches still
                        // resolve and the user sees partial data instead of
                        // an aborted reload.
                        console.warn("Could not load members:", e?.message);
                    })
                    : Promise.resolve().then(() => {
                        setMembers([]);
                        setInvites([]);
                    }),
                nextCanViewMembers
                    ? loadInvites().catch((e) => console.warn("Could not load invites:", e?.message))
                    : Promise.resolve(),
                nextCanManageSettings
                    ? loadPermissions().catch((e) => console.warn("Could not load permissions:", e?.message))
                    : Promise.resolve(),
            ]);
            // Re-check staleness after the parallel batch — a fresh reload
            // could have started while we were waiting on loadMembers/Invites.
            if (isStale()) return me;
            return me;
        } catch (err: any) {
            const message = err?.message || "";
            if (message.includes("Organization membership required")) {
                window.location.href = "/create-organization";
                return;
            }
            console.error("Failed to reload data", err);
            throw err;
        }
    };

    // ─── Presets ────────────────────────────────────────────────────
    const loadSettingsPresets = async () => {
        setIsLoadingPresets(true);
        try {
            const response = await fileManagementAPI.getSettingsPresets();
            setSettingsPresets(response.presets || []);
        } catch (err) {
            console.error("Failed to load presets", err);
            toast({
                title: "Failed to load presets",
                description: "Could not load global settings presets.",
                variant: "destructive",
            });
        } finally {
            setIsLoadingPresets(false);
        }
    };

    const openCreatePresetDialog = () => {
        setPresetDialogMode("create");
        setPresetFormName("");
        setPresetFormConfig(JSON.stringify(DEFAULT_PRESET_TEMPLATE, null, 2));
        setPresetFormDefault(false);
        setPresetEditing(null);
        setIsPresetDialogOpen(true);
    };

    const handlePresetFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const fileName = file.name.toLowerCase();

                if (fileName.endsWith('.json')) {
                    const parsed = JSON.parse(content);
                    setPresetFormConfig(JSON.stringify(parsed, null, 2));
                    toast({ title: "File loaded", description: "JSON file loaded successfully." });
                } else if (fileName.endsWith('.csv')) {
                    const lines = content.trim().split('\n');
                    if (lines.length < 2) {
                        throw new Error("CSV must have header row and at least one data row");
                    }
                    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                    const rows = lines.slice(1).map(line => {
                        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                        const obj: Record<string, string> = {};
                        headers.forEach((header, index) => {
                            obj[header] = values[index] || '';
                        });
                        return obj;
                    });
                    const presetConfig = { ...DEFAULT_PRESET_TEMPLATE, imported_data: rows };
                    setPresetFormConfig(JSON.stringify(presetConfig, null, 2));
                    toast({ title: "CSV converted", description: `Converted ${rows.length} rows to JSON format.` });
                } else {
                    throw new Error("Please upload a .json or .csv file");
                }
            } catch (err: any) {
                console.error("File upload error:", err);
                // Only surface the message for known user-friendly validation errors thrown above.
                const isValidationMsg = typeof err?.message === "string" && err.message.startsWith("Please upload");
                toast({
                    title: "Invalid file",
                    description: isValidationMsg ? err.message : "Could not parse the uploaded file.",
                    variant: "destructive",
                });
            }
        };
        reader.onerror = () => {
            toast({ title: "File read error", description: "Could not read the file.", variant: "destructive" });
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const openEditPresetDialog = (preset: SettingsPreset) => {
        setPresetDialogMode("edit");
        setPresetFormName(preset.preset_name || "");
        setPresetFormConfig(JSON.stringify(preset.config || {}, null, 2));
        setPresetFormDefault(Boolean(preset.is_default));
        setPresetEditing(preset);
        setIsPresetDialogOpen(true);
    };

    const handleSavePreset = async () => {
        if (!presetFormName.trim()) {
            toast({ title: "Preset name required", description: "Please enter a preset name.", variant: "destructive" });
            return;
        }

        let parsedConfig: any = {};
        try {
            parsedConfig = presetFormConfig.trim() ? JSON.parse(presetFormConfig) : {};
        } catch (err) {
            toast({ title: "Invalid JSON", description: "Please provide valid JSON for the preset config.", variant: "destructive" });
            return;
        }

        setIsSavingPreset(true);
        try {
            if (presetDialogMode === "create") {
                await fileManagementAPI.createSettingsPreset({
                    preset_name: presetFormName.trim(),
                    config: parsedConfig,
                    is_default: presetFormDefault,
                });
            } else if (presetEditing) {
                await fileManagementAPI.updateSettingsPreset(presetEditing.preset_id, {
                    preset_name: presetFormName.trim(),
                    config: parsedConfig,
                    is_default: presetFormDefault,
                });
            }
            await loadSettingsPresets();
            setIsPresetDialogOpen(false);
            toast({
                title: "Preset saved",
                description: presetDialogMode === "create" ? "Preset created successfully." : "Preset updated successfully.",
            });
        } catch (err) {
            console.error("Failed to save preset", err);
            toast({ title: "Save failed", description: "Invalid Format.", variant: "destructive" });
        } finally {
            setIsSavingPreset(false);
        }
    };

    const handleDeletePreset = async () => {
        if (!presetToDelete) return;
        setIsSavingPreset(true);
        try {
            await fileManagementAPI.deleteSettingsPreset(presetToDelete.preset_id);
            await loadSettingsPresets();
            toast({ title: "Preset deleted", description: "Preset removed successfully." });
            setIsDeletePresetOpen(false);
            setPresetToDelete(null);
        } catch (err) {
            console.error("Failed to delete preset", err);
            toast({ title: "Delete failed", description: "Could not delete the preset.", variant: "destructive" });
        } finally {
            setIsSavingPreset(false);
        }
    };

    const handleSetDefaultPreset = async (preset: SettingsPreset) => {
        setIsSavingPreset(true);
        try {
            await fileManagementAPI.updateSettingsPreset(preset.preset_id, { is_default: true });
            await loadSettingsPresets();
            toast({ title: "Default updated", description: `"${preset.preset_name}" is now the default preset.` });
        } catch (err) {
            console.error("Failed to set default preset", err);
            toast({ title: "Update failed", description: "Could not set default preset.", variant: "destructive" });
        } finally {
            setIsSavingPreset(false);
        }
    };

    // ─── Effects ────────────────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;
        const loadOrgData = async () => {
            setIsLoadingOrg(true);
            // Retry with backoff — after org registration, the DynamoDB GSI
            // (eventually consistent) may not reflect the new membership yet.
            const MAX_RETRIES = 3;
            const RETRY_DELAYS = [1500, 3000, 5000];
            let lastError: any = null;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                if (!isMounted) return;
                try {
                    await reloadOrgData();
                    if (!isMounted) return;
                    lastError = null;
                    break;
                } catch (err: any) {
                    lastError = err;
                    const message = err?.message || "";
                    const missingMembership = message.includes("Organization membership required");
                    // Only retry transient membership-not-found errors
                    if (missingMembership && attempt < MAX_RETRIES) {
                        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
                        continue;
                    }
                    break;
                }
            }

            if (lastError && isMounted) {
                console.error("Failed to load org context", lastError);
                const message = lastError?.message || "Could not load organization data.";
                const missingMembership = message.includes("Organization membership required");
                toast({
                    title: "Organization not ready",
                    description: missingMembership
                        ? "You are not in an organization yet. Register your organization first."
                        : message,
                });
                if (missingMembership) {
                    window.location.href = "/create-organization";
                }
            }
            if (isMounted) setIsLoadingOrg(false);
        };

        loadOrgData();
        return () => { isMounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (activeTab === "services") {
            loadSettingsPresets();
        }
    }, [activeTab]);

    useEffect(() => {
        if (!orgId) return;
        // Only refetch on tabs that surface mutable lists — tab clicks on
        // "organization" / "services" / "connectors" don't need a fresh
        // getMe + members + invites round-trip and were causing unnecessary
        // load + flicker + race-prone overlapping fetches. The mutation
        // handlers already call reloadOrgData() after every write, so the
        // data on these tabs cannot go stale from in-app activity.
        const refetchTabs = new Set(["members", "permissions", "approvals"]);
        if (!refetchTabs.has(activeTab)) return;
        reloadOrgData().catch((err) =>
            console.warn("Could not refresh org data on tab switch:", err?.message || err),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // ─── Computed values ────────────────────────────────────────────
    const allowedInviteRoles: AppRole[] = useMemo(() => {
        if (!canManageMembersPermission) return [];
        if (currentUserRole === "Super Admin") return ["Super Admin", "Admin", "Data Steward"];
        if (currentUserRole === "Admin") return ["Admin", "Data Steward"];
        if (currentUserRole === "Data Steward") return ["Data Steward"];
        // "Member" and any unknown roles cannot invite
        return [];
    }, [currentUserRole, canManageMembersPermission]);

    const allMembers = useMemo(() => {
        const activeMembers = members.map((m) => ({
            ...m,
            isInvite: false,
            displayId: m.id,
            displayName: m.name,
            displayEmail: m.email,
            displayStatus: m.status,
            displayRole: m.role,
            displayJoined: m.joinedAt || "-",
            displayLastLogin: m.lastLogin || "-",
            displayAvatar: m.avatar,
        }));

        const activeEmails = new Set(members.map((m) => (m.email || "").toLowerCase()));
        const uniqueInvitesMap = new Map<string, OrgInvite>();
        invites.forEach(inv => {
            const email = (inv.email || "").toLowerCase();
            if (!activeEmails.has(email)) {
                const existing = uniqueInvitesMap.get(email);
                if (!existing || (inv.created_at || "") > (existing.created_at || "")) {
                    uniqueInvitesMap.set(email, inv);
                }
            }
        });

        const pendingInvites = Array.from(uniqueInvitesMap.values()).map((i) => ({
            id: i.invite_id,
            isInvite: true,
            displayId: i.invite_id,
            displayName: i.email.split("@")[0],
            displayEmail: i.email,
            displayStatus: "Pending",
            displayRole: i.role,
            displayJoined: formatDateTime(i.created_at),
            displayLastLogin: "-",
            displayAvatar: "",
        }));

        return [...activeMembers, ...pendingInvites].sort((a, b) => {
            if (a.displayStatus === "Active" && b.displayStatus !== "Active") return -1;
            if (a.displayStatus !== "Active" && b.displayStatus === "Active") return 1;
            return a.displayName.localeCompare(b.displayName);
        });
    }, [members, invites]);

    const canManageOrganization = canManageSettingsPermission;
    const canInviteMembers = allowedInviteRoles.length > 0;
    const canChangeAllRoles = currentUserRole === "Super Admin";
    const canManageDataStewards = currentUserRole === "Admin";

    const inviteHelpText = useMemo(() => {
        if (!canManageMembersPermission) return "You do not have permission to manage invitations.";
        if (currentUserRole === "Super Admin") return "You can invite anyone to any role.";
        if (currentUserRole === "Admin") return "You can invite Admins and Data Stewards.";
        if (currentUserRole === "Data Steward") return "You can invite other Data Stewards.";
        return "Only Super Admins and Admins can manage team invitations.";
    }, [currentUserRole, canManageMembersPermission]);

    // ─── Handlers ───────────────────────────────────────────────────
    const handleRevokeInvite = (inviteId: string, email: string) => {
        if (!canManageMembersPermission) {
            toast({ title: "Not allowed", description: "You do not have permission to manage invitations.", variant: "destructive" });
            return;
        }
        setPendingRevokeInvite({ inviteId, email });
    };

    const confirmRevokeInvite = async () => {
        if (!pendingRevokeInvite) return;
        const { inviteId, email } = pendingRevokeInvite;
        setPendingRevokeInvite(null);
        setRevokingInviteId(inviteId);
        try {
            await orgAPI.revokeInvite(inviteId);
            await loadInvites();
            toast({ title: "Invite revoked", description: `Invitation for ${email} has been cancelled.` });
        } catch (err: any) {
            console.error("Failed to revoke invite", err);
            if (isApiError(err) && err.code === "PermissionDeniedError") {
                toast({
                    title: "Your role doesn't have permission.",
                    description: "Ask a Super Admin or Admin to revoke this invite.",
                    variant: "destructive",
                });
                return;
            }
            if (isApiError(err) && err.code === "InviteNotFoundError") {
                // The invite was already revoked or accepted in another
                // session — refresh the list so the row disappears and
                // tell the user the action was effectively a no-op.
                await loadInvites();
                toast({
                    title: "Invite no longer exists.",
                    description: "It was already revoked or accepted.",
                });
                return;
            }
            toast({
                title: "Failed to revoke",
                description: "Could not revoke the invite. Please try again.",
                variant: "destructive",
            });
        } finally {
            setRevokingInviteId(null);
        }
    };

    const handleOrgChange = (field: string, value: string) => {
        setOrgSettings((prev) => ({ ...prev, [field]: value }));
    };

    const handleSaveOrg = async () => {
        if (!canManageOrganization) {
            toast({ title: "Not allowed", description: "You do not have permission to update organization settings." });
            return;
        }
        const name = orgSettings.name.trim();
        const email = orgSettings.email.trim();
        const phone = orgSettings.phone.trim();
        const address = orgSettings.address.trim();

        if (!name || !email || !phone || !address) {
            toast({
                title: "Organization details required",
                description: "Enter organization name, email, contact number, and address before registering.",
            });
            return;
        }

        setIsSavingOrg(true);
        try {
            await orgAPI.registerOrg({
                name, email, phone, address,
                industry: orgSettings.industry,
                gst: orgSettings.gst,
                pan: orgSettings.pan,
                contact_person: orgSettings.contact_person,
                subscriptionPlan: orgSettings.subscriptionPlan,
            });
            await reloadOrgData();
            toast({
                title: orgId ? "Organization updated" : "Organization registered",
                description: orgId
                    ? "Your organization details were updated successfully."
                    : "Your organization details were saved and you are the Super Admin.",
            });
        } catch (err: any) {
            console.error("Failed to save org", err);
            if (isApiError(err) && err.code === "PermissionDeniedError") {
                toast({
                    title: "Your role doesn't have permission.",
                    description: "Only Super Admins or Admins can update organization details.",
                    variant: "destructive",
                });
                return;
            }
            if (isApiError(err) && err.code === "OrgValidationError") {
                toast({
                    title: "Invalid organization details",
                    description: "Please check the details and try again.",
                    variant: "destructive",
                });
                return;
            }
            toast({
                title: "Failed to save",
                description: "Could not save organization details. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSavingOrg(false);
        }
    };

    const togglePermission = (
        permissionId: string,
        role: "superadmin" | "admin" | "dataSteward",
    ) => {
        const isAllowed = canChangeAllRoles || (canManageDataStewards && role === "dataSteward");
        if (!isAllowed) {
            toast({
                title: "Not allowed",
                description: "Only the Super Admin can change Admin permissions. Admins can change Data Steward permissions.",
            });
            return;
        }
        setPermissions((prev) =>
            prev.map((p) => (p.id === permissionId ? { ...p, [role]: !p[role] } : p)),
        );
    };

    const handleSavePermissions = async () => {
        if (!canChangeAllRoles && !canManageDataStewards) {
            toast({ title: "Not allowed", description: "Only Super Admins and Admins can save permission changes." });
            return;
        }
        setIsSavingPermissions(true);
        try {
            const buildRolePermissions = (key: "admin" | "dataSteward") =>
                Object.fromEntries(permissions.map((p) => [p.id, Boolean(p[key])]));

            if (canChangeAllRoles) {
                await orgAPI.updateRolePermissions("Admin", buildRolePermissions("admin"));
            }
            await orgAPI.updateRolePermissions("Data Steward", buildRolePermissions("dataSteward"));

            await reloadOrgData();
            await refreshPermissions();
            window.localStorage.setItem("cleanflowai.permissionsUpdatedAt", String(Date.now()));
            toast({ title: "Permissions saved", description: "Role permissions have been updated successfully." });
        } catch (err: any) {
            console.error("Failed to save permissions", err);
            if (isApiError(err) && err.code === "PermissionDeniedError") {
                toast({
                    title: "Your role doesn't have permission.",
                    description: "Only Super Admins (Admin perms) or Admins (Data Steward perms) can save here.",
                    variant: "destructive",
                });
                return;
            }
            toast({
                title: "Failed to save permissions",
                description: "Could not update role permissions. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSavingPermissions(false);
        }
    };

    const updateMemberRole = async (memberId: string, newRole: AppRole) => {
        if (!canManageMembersPermission) {
            toast({ title: "Not allowed", description: "You do not have permission to update member roles.", variant: "destructive" });
            return;
        }
        if (currentUserId && memberId === currentUserId) {
            toast({ title: "Not allowed", description: "You cannot change your own role here." });
            return;
        }

        const targetMember = members.find((m) => m.id === memberId);
        if (!targetMember) return;

        const targetRole = targetMember.role;

        if (!canChangeAllRoles) {
            const canAdminManageThisMember = canManageDataStewards && targetRole === "Data Steward";
            if (!canAdminManageThisMember) {
                toast({ title: "Not allowed", description: "Admins can only manage Data Stewards." });
                return;
            }
            if (newRole !== "Data Steward") {
                toast({ title: "Not allowed", description: "Only the Super Admin can assign Admin or Super Admin roles." });
                return;
            }
        }

        try {
            await orgAPI.updateMemberRole(memberId, newRole);
            await reloadOrgData();
            toast({ title: "Role updated", description: "Member role has been updated successfully." });
        } catch (err: any) {
            console.error("Failed to update role", err);
            if (isApiError(err) && (err.code === "OrgLastAdminError" || err.action === "cancel")) {
                toast({
                    id: "org-ORG_LAST_ADMIN",
                    title: "You can't demote the last admin.",
                    description: "Promote another member to Super Admin first.",
                    variant: "destructive",
                });
                return;
            }
            if (isApiError(err) && err.code === "PermissionDeniedError") {
                toast({
                    title: "Your role doesn't have permission.",
                    description: "Only Super Admins can change Admin or Super Admin roles.",
                    variant: "destructive",
                });
                return;
            }
            toast({
                title: "Failed to update role",
                description: "Could not update the member role. Please try again.",
                variant: "destructive",
            });
        }
    };

    const removeMember = (memberId: string) => {
        if (!canManageMembersPermission) {
            toast({ title: "Not allowed", description: "You do not have permission to remove members.", variant: "destructive" });
            return;
        }
        const targetMember = members.find((m) => m.id === memberId);
        if (!targetMember) return;

        if (currentUserRole !== "Super Admin") {
            toast({ title: "Not allowed", description: "Only Super Admins can remove members.", variant: "destructive" });
            return;
        }

        setPendingRemoveMember({ memberId, name: targetMember.name, email: targetMember.email });
    };

    const confirmRemoveMember = async () => {
        if (!pendingRemoveMember) return;
        const { memberId, name } = pendingRemoveMember;
        setPendingRemoveMember(null);
        try {
            await orgAPI.removeMember(memberId);
            toast({ title: "Member removed", description: `${name} has been removed from the organization.` });
            // Full reload — a remove can clear pending invites whose email
            // matches the now-departed member's, and it can shift the
            // last-admin guard state (e.g. demoting becomes impossible).
            await reloadOrgData();
        } catch (err: any) {
            console.error("Failed to remove member", err);
            // ORG_LAST_ADMIN: surface a clear, non-generic message so the admin
            // knows they must promote someone before removing themselves.
            if (isApiError(err) && (err.code === "OrgLastAdminError" || err.action === "cancel")) {
                toast({
                    id: "org-ORG_LAST_ADMIN",
                    title: "You can't remove the last admin.",
                    description: "Promote another member first.",
                    variant: "destructive",
                });
                return;
            }
            // PermissionDenied: surface role-specific copy instead of the
            // raw BE message, so a Member who somehow reached this codepath
            // sees actionable text.
            if (isApiError(err) && err.code === "PermissionDeniedError") {
                toast({
                    title: "Your role doesn't have permission.",
                    description: "Ask a Super Admin to remove this member.",
                    variant: "destructive",
                });
                return;
            }
            toast({ title: "Remove failed", description: "Could not remove the member. Please try again.", variant: "destructive" });
        }
    };

    const handleInviteMember = () => {
        if (!canInviteMembers) {
            toast({ title: "Not allowed", description: inviteHelpText });
            return;
        }
        setInviteEmail("");
        setInviteRole(allowedInviteRoles[allowedInviteRoles.length - 1]);
        setIsInviteDialogOpen(true);
    };

    const getInviteFrontendBaseUrl = (): string | undefined => {
        const candidates = [
            process.env.NEXT_PUBLIC_FRONTEND_BASE_URL,
            process.env.NEXT_PUBLIC_APP_ORIGIN,
            process.env.BASE_URL,
            typeof window !== "undefined" ? window.location.origin : undefined,
        ].filter(Boolean) as string[];

        for (const raw of candidates) {
            try {
                const parsed = new URL(raw);
                if (parsed.protocol === "http:" || parsed.protocol === "https:") {
                    return parsed.origin;
                }
            } catch {
                // Ignore invalid URL values and keep trying fallbacks.
            }
        }
        return undefined;
    };

    const handleSubmitInvite = async () => {
        const email = inviteEmail.trim().toLowerCase();
        if (!email) {
            toast({ title: "Email required", description: "Enter a valid email address to send the invite." });
            return;
        }
        // Defensive client-side format check — the dialog's Add button is
        // disabled on `!email.includes("@")` but a paste of e.g. "foo@" or
        // "@bar" used to slip through and surface a 422 from the BE. The
        // regex is intentionally permissive (RFC 5322 in full is impractical
        // and the BE re-validates) — we only catch the obviously-malformed.
        const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!EMAIL_RE.test(email)) {
            toast({
                title: "Invalid email",
                description: "Enter a valid email address (e.g. name@example.com).",
                variant: "destructive",
            });
            return;
        }
        if (!allowedInviteRoles.includes(inviteRole)) {
            toast({ title: "Invalid role", description: `Allowed roles: ${allowedInviteRoles.join(", ")}` });
            return;
        }

        setIsSendingInvite(true);
        try {
            const inviteFrontendBaseUrl = getInviteFrontendBaseUrl();
            const resp: any = await orgAPI.createInvite(email, inviteRole, inviteFrontendBaseUrl);
            // Refresh members AND invites — the BE auto-claims an invite if
            // the email already maps to an existing user, so a "create
            // invite" can materialize a member row instead of a pending
            // invite row. Reloading both keeps the member tab honest.
            await Promise.all([loadInvites(), loadMembers()]);
            const inviteLink: string = resp?.invite_link || "";
            const emailSent: boolean = !!resp?.email_sent;
            if (inviteLink) {
                // Surface the shareable link in the dialog (the rendering side
                // checks lastInviteResult). The toast still confirms the action
                // happened but is no longer the only feedback channel.
                setLastInviteResult({
                    email,
                    role: inviteRole,
                    invite_link: inviteLink,
                    email_sent: emailSent,
                });
                toast({
                    title: emailSent ? "Invitation sent" : "Invite created (share link below)",
                    description: emailSent
                        ? `An email is on the way to ${email}.`
                        : "Email delivery isn't available right now — copy the link from the dialog and share it manually.",
                });
            } else {
                toast({ title: "Invitation sent", description: `An invitation has been sent to ${email} as ${inviteRole}.` });
                setIsInviteDialogOpen(false);
            }
        } catch (err: any) {
            console.error("Failed to send invite", err);
            if (isApiError(err) && (err.code === "InviteEmailTakenError" || (err.action === "signin" && err.code?.startsWith("Invite")))) {
                toast({
                    id: "org-INVITE_EMAIL_TAKEN",
                    title: "This email is already registered.",
                    description: "Sign in to switch orgs.",
                    variant: "destructive",
                });
            } else if (isApiError(err) && err.code === "DuplicateInviteError") {
                toast({
                    title: "Invite already exists.",
                    description: `An open invite for ${email} is already pending.`,
                    variant: "destructive",
                });
            } else if (isApiError(err) && err.code === "PermissionDeniedError") {
                toast({
                    title: "Your role doesn't have permission.",
                    description: "Ask a Super Admin or Admin to send this invite.",
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Failed to invite",
                    description: "Could not send the invitation. Please try again.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsSendingInvite(false);
        }
    };

    const handleLogoUploadClick = () => {
        if (!canManageOrganization) {
            toast({ title: "Not allowed", description: "You do not have permission to update the organization logo." });
            return;
        }
        logoInputRef.current?.click();
    };

    const handleLogoSelected = (file?: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            const result = String(reader.result || "");
            if (!result.startsWith("data:image/")) {
                toast({ title: "Invalid file", description: "Please choose an image file." });
                return;
            }
            try {
                const response = await orgAPI.uploadLogo(result);
                setLogoDataUrl(response?.logo_url || result);
                toast({ title: "Logo updated", description: "Your organization logo was saved." });
            } catch (err: any) {
                console.error("Logo upload error:", err);
                toast({ title: "Logo upload failed", description: "Could not upload the logo. Please try again." });
            } finally {
                if (logoInputRef.current) {
                    logoInputRef.current.value = "";
                }
            }
        };
        reader.onerror = () => {
            toast({ title: "Logo upload failed", description: "Could not read the selected file." });
        };
        reader.readAsDataURL(file);
    };

    const handleServicesChange = (field: string, value: string | boolean) => {
        setServicesSettings((prev) => ({ ...prev, [field]: value }));
    };

    const handleSaveServices = async () => {
        toast({
            title: "Services settings saved",
            description: "Service settings have been updated successfully.",
        });
    };

    const handleRefreshAdminTab = async () => {
        setIsRefreshingOrg(true);
        try {
            await reloadOrgData();
            if (activeTab === "services") {
                await loadSettingsPresets();
            }
            await refreshPermissions();
            toast({ title: "Refreshed", description: "Admin data has been refreshed." });
        } catch (err: any) {
            console.error("Refresh admin data error:", err);
            toast({ title: "Refresh failed", description: "Could not refresh. Please try again.", variant: "destructive" });
        } finally {
            setIsRefreshingOrg(false);
        }
    };

    // ─── Approvals ────────────────────────────────────────────────────

    const loadApprovals = async () => {
        setIsLoadingApprovals(true);
        try {
            const params: { status?: string; action_type?: string } = {};
            if (approvalStatusFilter) params.status = approvalStatusFilter;
            const data = await orgAPI.listApprovals(params);
            setApprovals(data.approvals || []);
            setApprovalsLoadError(null);
        } catch (err: any) {
            // Surface via inline state — the Approvals tab can render a
            // retry banner instead of an empty list that looks identical
            // to the "no pending approvals" empty state.
            const message = (err as Error)?.message || "Could not load approvals.";
            console.error("Failed to load approvals", err);
            setApprovalsLoadError(message);
        } finally {
            setIsLoadingApprovals(false);
        }
    };

    const loadPendingCount = async () => {
        try {
            const data = await orgAPI.getPendingCount();
            setPendingApprovalCount(data.pending_count || 0);
        } catch {
            // Silently ignore — badge is non-critical
        }
    };

    // Fetch pending count on mount for badge (Super Admin only)
    useEffect(() => {
        if (currentUserRole === "Super Admin") {
            loadPendingCount();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserRole]);

    // Load approvals when tab becomes active or filter changes
    useEffect(() => {
        if (activeTab === "approvals") {
            loadApprovals();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, approvalStatusFilter]);

    const handleApproveRequest = async (approvalId: string) => {
        try {
            await orgAPI.approveRequest(approvalId);
            toast({ title: "Approved", description: "The request has been approved." });
            await loadApprovals();
            await loadPendingCount();
        } catch (err: any) {
            console.error("Approve request error:", err);
            toast({ title: "Approval failed", description: "Could not approve the request. Please try again.", variant: "destructive" });
        }
    };

    const handleRejectRequest = async (approvalId: string) => {
        try {
            await orgAPI.rejectRequest(approvalId);
            toast({ title: "Rejected", description: "The request has been rejected." });
            await loadApprovals();
            await loadPendingCount();
        } catch (err: any) {
            console.error("Reject request error:", err);
            toast({ title: "Rejection failed", description: "Could not reject the request. Please try again.", variant: "destructive" });
        }
    };

    return {
        // Tab
        activeTab,
        setActiveTab,
        // Auth context
        currentUserRole,
        logout,
        // Org settings
        orgSettings,
        isSavingOrg,
        handleOrgChange,
        handleSaveOrg,
        orgId,
        logoDataUrl,
        logoInputRef,
        handleLogoUploadClick,
        handleLogoSelected,
        // Members
        members,
        allMembers,
        currentUserId,
        isLoadingOrg,
        isRefreshingOrg,
        canViewMembersPermission,
        canManageMembersPermission,
        canManageSettingsPermission,
        canManageOrganization,
        canInviteMembers,
        canChangeAllRoles,
        canManageDataStewards,
        allowedInviteRoles,
        inviteHelpText,
        handleInviteMember,
        handleRevokeInvite,
        confirmRevokeInvite,
        pendingRevokeInvite,
        setPendingRevokeInvite,
        revokingInviteId,
        updateMemberRole,
        removeMember,
        confirmRemoveMember,
        pendingRemoveMember,
        setPendingRemoveMember,
        // Invite dialog
        lastInviteResult,
        setLastInviteResult,
        isInviteDialogOpen,
        setIsInviteDialogOpen,
        inviteEmail,
        setInviteEmail,
        inviteRole,
        setInviteRole,
        isSendingInvite,
        handleSubmitInvite,
        // Permissions
        permissions,
        isSavingPermissions,
        togglePermission,
        handleSavePermissions,
        // Services
        servicesSettings,
        isSavingServices,
        handleServicesChange,
        handleSaveServices,
        // Presets
        settingsPresets,
        isLoadingPresets,
        isSavingPreset,
        isPresetDialogOpen,
        setIsPresetDialogOpen,
        presetDialogMode,
        presetFormName,
        setPresetFormName,
        presetFormConfig,
        setPresetFormConfig,
        presetFormDefault,
        setPresetFormDefault,
        presetEditing,
        presetToDelete,
        setPresetToDelete,
        isDeletePresetOpen,
        setIsDeletePresetOpen,
        presetFileInputRef,
        openCreatePresetDialog,
        openEditPresetDialog,
        handleSavePreset,
        handleDeletePreset,
        handleSetDefaultPreset,
        handlePresetFileUpload,
        // Refresh
        handleRefreshAdminTab,
        // Approvals
        approvals,
        isLoadingApprovals,
        pendingApprovalCount,
        approvalStatusFilter,
        setApprovalStatusFilter,
        handleApproveRequest,
        handleRejectRequest,
        // Load-error surface for FE inline banners. Mutation-failure toasts
        // are still emitted by their respective handlers.
        invitesLoadError,
        membersLoadError,
        permissionsLoadError,
        approvalsLoadError,
        isLoadingPermissions,
    };
}
