"use client"
import { BarChart3, CalendarClock, ChevronLeft, ChevronRight, FileText, HelpCircle, LogOut, Menu, Moon, Settings, Sun, X } from "lucide-react"
import { memo, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import { cn } from "@/shared/lib/utils"
import { useAuth } from "@/modules/auth"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useAppSelector } from "@/shared/store/store"
import { selectFiles } from "@/modules/files/store/filesSlice"
const ChatDrawer = dynamic(
	() => import("@/modules/chat/components/chat-drawer").then((mod) => ({ default: mod.ChatDrawer })),
	{ ssr: false }
)
const mainNav = [
	{ name: "Dashboard", href: "/dashboard", icon: BarChart3 },
	{ name: "Data Catalog", href: "/files", icon: FileText },
	{ name: "Jobs", href: "/jobs", icon: CalendarClock },
]
const settingsNav = [
	{ name: "Admin", href: "/admin", icon: Settings },
]
function AppSidebarComponent() {
	const [collapsed, setCollapsed] = useState(false)
	const [isMobile, setIsMobile] = useState(false)
	const [mobileOpen, setMobileOpen] = useState(false)
	const [chatOpen, setChatOpen] = useState(false)
	const pathname = usePathname()
	const router = useRouter()
	const { logout, isAuthenticated, user } = useAuth()
	const { theme, setTheme } = useTheme()
	// ─── UX Improvement: Live attention badges ──────────────────────────
	const files = useAppSelector(selectFiles)
	const attentionCount = useMemo(() => {
		const visible = files.filter((f) => !f.parent_upload_id)
		return visible.filter((f) =>
			["DQ_FAILED", "UPLOAD_FAILED", "FAILED", "REJECTED"].includes(f.status) ||
			(f.status === "DQ_FIXED" && (f.rows_quarantined || 0) > 0)
		).length
	}, [files])
	// Note: Jobs badge removed — jobs data isn't in Redux store,
	// and using file processing status was misleading (showed green dot
	// when files were processing, not when scheduled jobs were active).
	// ────────────────────────────────────────────────────────────────────
	useEffect(() => {
		[...mainNav, ...settingsNav].forEach((item) => router.prefetch(item.href))
	}, [router])
	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 1024)
			if (window.innerWidth < 1024) setCollapsed(false)
		}
		checkMobile()
		window.addEventListener('resize', checkMobile)
		return () => window.removeEventListener('resize', checkMobile)
	}, [])
	useEffect(() => { setMobileOpen(false) }, [pathname])
	const handleLogout = () => {
		logout()
		window.location.href = '/auth/login'
	}
	const renderNavItem = (item: typeof mainNav[0], badge?: React.ReactNode) => {
		const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href))
		return (
			<Link key={item.name} href={item.href}>
				<div
					className={cn(
						"group flex items-center gap-2.5 px-3 py-[7px] rounded-lg transition-colors",
						isActive
							? "bg-primary/8 text-primary font-semibold"
							: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
						collapsed && "justify-center px-2",
					)}
				>
					<item.icon className={cn(
						"w-[18px] h-[18px] flex-shrink-0",
						isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground/70"
					)} />
					{!collapsed && (
						<>
							<span className="text-[13px] leading-none flex-1">{item.name}</span>
							{badge}
						</>
					)}
				</div>
			</Link>
		)
	}
	return (
		<div className="relative">
			{/* Mobile Menu Button */}
			{isMobile && (
				<Button
					variant="outline"
					size="sm"
					onClick={() => setMobileOpen(true)}
					className="fixed top-3 right-3 z-50 lg:hidden"
				>
					<Menu className="w-5 h-5" />
				</Button>
			)}
			{/* Mobile Overlay */}
			{isMobile && mobileOpen && (
				<div
					className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
					onClick={() => setMobileOpen(false)}
				/>
			)}
			{/* Sidebar */}
			<aside
				className={cn(
					"flex flex-col h-screen bg-sidebar border-r border-sidebar-border text-sidebar-foreground overflow-hidden",
					isMobile ? [
						"fixed left-0 top-0 z-50 w-60 transition-transform duration-200 ease-in-out shadow-lg",
						mobileOpen ? "translate-x-0" : "-translate-x-full"
					] : [
						"relative transition-[width] duration-200 ease-in-out",
						collapsed ? "w-[52px]" : "w-56"
					]
				)}
			>
				{isMobile && (
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setMobileOpen(false)}
						className="absolute top-3 right-2 lg:hidden h-7 w-7"
					>
						<X className="w-4 h-4" />
					</Button>
				)}
				{/* Logo */}
				<div className="flex items-center gap-2.5 px-3 py-3 border-b border-sidebar-border">
					<div className="relative w-7 h-7 flex-shrink-0">
						<Image
							src="/images/infiniqon-logo-light.png"
							alt="CleanFlowAI"
							width={28}
							height={28}
							className="rounded-md object-contain"
						/>
					</div>
					{!collapsed && (
						<div className="flex-1 min-w-0">
							<div className="text-sm font-semibold text-foreground tracking-tight leading-none">
								CleanFlowAI
							</div>
							<div className="text-[10px] text-muted-foreground leading-none mt-0.5">
								Data Quality Platform
							</div>
						</div>
					)}
				</div>
				{/* Main Navigation */}
				<nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
					{!collapsed && (
						<p className="px-3 pt-1 pb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">
							Main
						</p>
					)}
					{renderNavItem(mainNav[0])}
					{/* Data Catalog — with attention badge */}
					{renderNavItem(
						mainNav[1],
						attentionCount > 0 ? (
							<span className="ml-auto text-[10px] font-bold bg-destructive text-destructive-foreground px-1.5 min-w-[18px] text-center rounded-full leading-[18px]">
								{attentionCount}
							</span>
						) : undefined
					)}
					{renderNavItem(mainNav[2])}
					{/* Settings section */}
					{!collapsed && (
						<p className="px-3 pt-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">
							Settings
						</p>
					)}
					{collapsed && <div className="h-3" />}
					{settingsNav.map((item) => renderNavItem(item))}
				</nav>
				{/* Bottom */}
				<div className="px-2 py-2 border-t border-sidebar-border space-y-0.5">
					{!collapsed ? (
						<>
							{isAuthenticated && (
								<div className="flex items-center gap-2 px-3 py-1.5 mb-1">
									<div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary uppercase">
										{(user?.name || user?.email || "U").charAt(0)}
									</div>
									<div className="flex-1 min-w-0">
										<div className="text-[12px] font-medium truncate leading-tight text-foreground">
											{user?.name || 'User'}
										</div>
										<div className="text-[10px] text-muted-foreground truncate leading-tight">
											{user?.email}
										</div>
									</div>
								</div>
							)}
							<button
								onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
								className="flex items-center gap-2.5 px-3 py-[6px] text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg w-full transition-colors"
							>
								{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
								<span className="text-[12px]">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
							</button>
							<button
								onClick={() => setChatOpen(true)}
								className="flex items-center gap-2.5 px-3 py-[6px] text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg w-full transition-colors"
							>
								<HelpCircle className="w-4 h-4" />
								<span className="text-[12px]">Help & Support</span>
							</button>
							{isAuthenticated && (
								<button
									onClick={handleLogout}
									className="flex items-center gap-2.5 px-3 py-[6px] text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg w-full transition-colors"
								>
									<LogOut className="w-4 h-4" />
									<span className="text-[12px]">Logout</span>
								</button>
							)}
						</>
					) : (
						<div className="flex flex-col items-center space-y-1">
							{isAuthenticated && (
								<div
									className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary uppercase cursor-default"
									title={user?.name || user?.email || "User"}
								>
									{(user?.name || user?.email || "U").charAt(0)}
								</div>
							)}
							<button
								onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
								className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
								title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
							>
								{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
							</button>
							{isAuthenticated && (
								<button
									onClick={handleLogout}
									className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors"
									title="Logout"
								>
									<LogOut className="w-4 h-4" />
								</button>
							)}
						</div>
					)}
					{/* Collapse toggle */}
					{!isMobile && (
						<button
							onClick={() => setCollapsed(!collapsed)}
							className="flex items-center justify-center w-full py-1.5 mt-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
						>
							{collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
						</button>
					)}
				</div>
			</aside>
			<ChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} />
		</div>
	)
}
export const AppSidebar = memo(AppSidebarComponent)
