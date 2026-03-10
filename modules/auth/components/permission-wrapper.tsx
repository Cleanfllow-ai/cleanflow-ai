"use client";

import React from "react";
import { useAuth } from "@/modules/auth/providers/auth-provider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type AppRole = "Super Admin" | "Admin" | "Data Steward";

interface PermissionWrapperProps {
    children: React.ReactNode;
    requiredRole?: AppRole | AppRole[];
    userRole?: AppRole; // Optional prop to override localStorage
    permission?: boolean; // Direct permission check if roles aren't enough
    permissionKey?: string | string[]; // Dynamic permission key(s) (e.g. "files", ["members", "settings"])
    fallback?: "hide" | "disable"; // Default to 'disable' if not specified
    message?: string;
    className?: string;
    showLock?: boolean;
}

const ROLE_HIERARCHY: Record<AppRole, number> = {
    "Super Admin": 3,
    "Admin": 2,
    "Data Steward": 1,
};



export function PermissionWrapper({
    children,
    requiredRole,
    userRole: propUserRole,
    permission = true,
    permissionKey,
    fallback = "disable",
    message = "You don't have permission to use this feature.",
    className,
    showLock = true,
}: PermissionWrapperProps) {
    const { user, hasPermission: checkPermission, userRole: authUserRole, isLoading: isAuthLoading, permissionsLoaded } = useAuth();
    const isPermissionsLoading = !permissionsLoaded;

    const normalizedUserRole = React.useMemo(() => {
        const role = propUserRole || authUserRole || "Data Steward";
        // Case-insensitive lookup
        const entry = Object.entries(ROLE_HIERARCHY).find(
            ([k]) => k.toLowerCase() === role.toLowerCase()
        );
        return entry ? (entry[0] as AppRole) : (role as AppRole);
    }, [propUserRole, authUserRole]);

    const hasPermission = React.useMemo(() => {
        if (!permission) return false;

        // Check dynamic permission key(s) from backend
        if (permissionKey) {
            const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
            const hasKey = keys.some(key => checkPermission(key));
            if (!hasKey) return false;
        }

        if (!requiredRole) return true;

        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        const userRoleValue = ROLE_HIERARCHY[normalizedUserRole] || 0;

        // Check if user's role is in the list or higher than any of the required roles
        return roles.some(role => {
            const requiredRoleValue = ROLE_HIERARCHY[role] || 0;
            return userRoleValue >= requiredRoleValue;
        });
    }, [normalizedUserRole, requiredRole, permission, permissionKey, checkPermission]);

    // While loading permission context, show disabled state for deterministic UX.
    if (isAuthLoading || isPermissionsLoading) {
        if (fallback === "hide") return null;
        return (
            <div className={cn("relative group cursor-not-allowed select-none", className)}>
                <div className="grayscale opacity-70 pointer-events-none filter blur-[0.2px]">
                    {children}
                </div>
                {showLock && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-background/80 backdrop-blur-sm p-2 rounded-full shadow-lg border border-border">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (hasPermission) {
        return <>{children}</>;
    }

    if (fallback === "hide") {
        return null;
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn("relative group cursor-not-allowed select-none", className)}>
                        <div className="grayscale opacity-70 pointer-events-none filter blur-[0.2px]">
                            {children}
                        </div>
                        {showLock && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-background/80 backdrop-blur-sm p-2 rounded-full shadow-lg border border-border">
                                    <Lock className="w-4 h-4 text-muted-foreground" />
                                </div>
                            </div>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-destructive text-destructive-foreground border-none">
                    <p className="text-xs font-semibold">{message}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
