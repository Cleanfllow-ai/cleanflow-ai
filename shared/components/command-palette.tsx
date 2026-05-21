"use client"

// Global Cmd+K command palette.
// Mounted once from app/layout.tsx (inside ThemeProvider + AuthProvider).
// Self-disables on unauthenticated pages so /auth/login etc. never show it.

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
    Cable,
    Compass,
    FileText,
    LayoutDashboard,
    Moon,
    Plus,
    RefreshCw,
    Settings,
    Shield,
    Sun,
    Users,
    Workflow,
} from "lucide-react"

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command"
import { useAuth } from "@/modules/auth"

// Paths that should NEVER show the palette even when mounted.
// Mirrors the auth-guard exemption list — keeps Cmd+K off pre-login.
const PALETTE_EXEMPT_PATHS = ["/auth", "/create-organization"]

export function CommandPalette() {
    const [open, setOpen] = useState(false)
    const router = useRouter()
    const pathname = usePathname() ?? ""
    const { setTheme, resolvedTheme } = useTheme()
    const { isAuthenticated } = useAuth()

    const exempt = PALETTE_EXEMPT_PATHS.some((p) => pathname.startsWith(p))
    const enabled = isAuthenticated && !exempt

    // Cmd+K (mac) / Ctrl+K (windows/linux) global toggle.
    useEffect(() => {
        if (!enabled) return

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "k" && event.key !== "K") return
            if (!(event.metaKey || event.ctrlKey)) return
            // Don't intercept if user is editing inside a form field that
            // already binds Cmd+K (rare, but be defensive).
            const target = event.target as HTMLElement | null
            const tag = target?.tagName?.toLowerCase()
            if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
                // Still allow Cmd+K from inputs — it's a global shortcut and
                // overrides browser address-bar focus on most setups. Continue.
            }
            event.preventDefault()
            setOpen((prev) => !prev)
        }

        document.addEventListener("keydown", onKeyDown)
        return () => document.removeEventListener("keydown", onKeyDown)
    }, [enabled])

    // Reset open state if the user logs out mid-session.
    useEffect(() => {
        if (!enabled && open) setOpen(false)
    }, [enabled, open])

    const run = useCallback((action: () => void) => {
        setOpen(false)
        // Defer the navigation/action a tick so the dialog has time to unmount
        // and avoid focus-trap fighting with the destination route.
        setTimeout(action, 0)
    }, [])

    if (!enabled) return null

    const isDark = resolvedTheme === "dark"

    return (
        <CommandDialog
            open={open}
            onOpenChange={setOpen}
            title="Command Palette"
            description="Jump to a page or run a quick action."
        >
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                <CommandGroup heading="Navigation">
                    <CommandItem
                        onSelect={() => run(() => router.push("/dashboard"))}
                        value="go-dashboard dashboard home"
                    >
                        <LayoutDashboard />
                        <span>Go to Dashboard</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => run(() => router.push("/files"))}
                        value="go-data-catalog files catalog uploads"
                    >
                        <FileText />
                        <span>Go to Data Catalog</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => run(() => router.push("/jobs"))}
                        value="go-jobs scheduled-jobs"
                    >
                        <Workflow />
                        <span>Go to Jobs</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => run(() => router.push("/admin/unified-bridge"))}
                        value="go-unified-bridge mcp bridge"
                    >
                        <Compass />
                        <span>Go to Unified Bridge</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => run(() => router.push("/admin/connectors"))}
                        value="go-connectors integrations"
                    >
                        <Cable />
                        <span>Go to Connectors</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => run(() => router.push("/admin?tab=organization"))}
                        value="go-admin-organization org settings"
                    >
                        <Settings />
                        <span>Go to Admin · Organization</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => run(() => router.push("/admin?tab=members"))}
                        value="go-admin-members team users"
                    >
                        <Users />
                        <span>Go to Admin · Members</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => run(() => router.push("/admin?tab=permissions"))}
                        value="go-admin-permissions roles rbac"
                    >
                        <Shield />
                        <span>Go to Admin · Permissions</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Actions">
                    <CommandItem
                        onSelect={() => run(() => router.push("/files?action=import"))}
                        value="new-import upload file"
                    >
                        <Plus />
                        <span>New Import</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => run(() => router.refresh())}
                        value="refresh reload current"
                    >
                        <RefreshCw />
                        <span>Refresh Current Page</span>
                        <CommandShortcut>R</CommandShortcut>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Appearance">
                    <CommandItem
                        onSelect={() =>
                            run(() => setTheme(isDark ? "light" : "dark"))
                        }
                        value="toggle-theme dark-mode light-mode"
                    >
                        {isDark ? <Sun /> : <Moon />}
                        <span>
                            Toggle {isDark ? "Light" : "Dark"} Mode
                        </span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    )
}
