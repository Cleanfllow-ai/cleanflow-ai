"use client"
import { BarChart3, CalendarClock, ChevronLeft, ChevronRight, Compass, FileText, HelpCircle, LogOut, Menu, Moon, Settings, Sparkles, Sun, X } from "lucide-react"
import { memo, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import { cn } from "@/shared/lib/utils"
// W4-2 polish: friendlier "Demo User 01" rendering for battle-test demo
// accounts in the sidebar avatar (real Cognito display names unchanged).
import { formatUserDisplayName, isDemoUserEmail } from "@/shared/lib/user-display"
import { useAuth } from "@/modules/auth"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useAppSelector } from "@/shared/store/store"
import { selectFiles } from "@/modules/files/store/filesSlice"
import { WelcomeTour } from "@/modules/onboarding"
import { useWelcomeTour } from "@/modules/onboarding/hooks/use-welcome-tour"
const ChatDrawer = dynamic(
	() => import("@/modules/chat/components/chat-drawer").then((mod) => ({ default: mod.ChatDrawer })),
	{ ssr: false }
)
// TODO: re-enable after augmentation audit completes (track: a575f372010d13bca)
const AUGMENTATION_ENABLED = false
const mainNav = [
	{ name: "Dashboard", href: "/dashboard", icon: BarChart3, tourId: "nav-dashboard" },
	{ name: "Data Catalog", href: "/files", icon: FileText, tourId: "nav-data-catalog" },
	...(AUGMENTATION_ENABLED ? [{ name: "Augmentation", href: "/augmentation", icon: Sparkles, tourId: "nav-augmentation" }] : []),
	{ name: "Jobs", href: "/jobs", icon: CalendarClock, tourId: "nav-jobs" },
]
const settingsNav = [
	{ name: "Admin", href: "/admin", icon: Settings, tourId: "nav-admin" },
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
	const {
		isOpen: tourOpen,
		currentStep: tourStep,
		setCurrentStep: setTourStep,
		openTour,
		completeTour,
		closeTour,
	} = useWelcomeTour(pathname === "/dashboard")
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
	// W4-2: friendly display + subline derived once per render.
	const friendlyDisplayName = formatUserDisplayName(user?.email, user?.name)
	const isDemoUser = isDemoUserEmail(user?.email)
	const sidebarSubline = isDemoUser ? 'Demo account' : (user?.email || '')
	const avatarInitial = (friendlyDisplayName || 'U').charAt(0)
	const renderNavItem = (item: typeof mainNav[0], badge?: React.ReactNode) => {
		const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href))
		return (
			<Link key={item.name} href={item.href}>
				<div
					data-tour={item.tourId}
					className={cn(
						"group flex items-center gap-2.5 px-3 py-[8px] rounded-lg transition-colors",
						isActive
							? "bg-sidebar-accent text-sidebar-primary font-semibold"
							: "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
						collapsed && "justify-center px-2",
					)}
				>
					<item.icon className={cn(
						"w-[18px] h-[18px] flex-shrink-0",
						isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
					)} />
					{!collapsed && (
						<>
							<span className="text-[13px] font-medium leading-none flex-1">{item.name}</span>
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
					aria-label="Open navigation menu"
					aria-expanded={mobileOpen}
					className="fixed top-3 right-3 z-50 lg:hidden"
				>
					<Menu className="w-5 h-5" aria-hidden="true" />
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
						aria-label="Close navigation menu"
						className="absolute top-3 right-2 lg:hidden h-7 w-7"
					>
						<X className="w-4 h-4" aria-hidden="true" />
					</Button>
				)}
				{/* Logo */}
				<div data-tour="logo" className="flex items-center gap-2.5 px-3 py-3 border-b border-sidebar-border">
					<div className="relative w-8 h-8 flex-shrink-0">
						<Image
							src="/images/rightrev-logo.png"
							alt="RightRev"
							width={32}
							height={32}
							className="rounded-md object-contain"
						/>
					</div>
					{!collapsed && (
						<div className="flex-1 min-w-0">
							<div className="text-[14px] font-semibold text-sidebar-foreground tracking-tight leading-none">
								RightRev
							</div>
							<div className="text-[10px] font-medium text-sidebar-foreground/60 leading-none mt-0.5">
								Data Quality Platform
							</div>
						</div>
					)}
				</div>
				{/* Main Navigation */}
				<nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
					{!collapsed && (
						<p className="px-3 pt-1 pb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/40">
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
					{mainNav.slice(2).map((item) => renderNavItem(item))}
					{/* Settings section */}
					{!collapsed && (
						<p className="px-3 pt-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/40">
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
										{avatarInitial}
									</div>
									<div className="flex-1 min-w-0">
										<div
											className="text-[12px] font-medium truncate leading-tight text-sidebar-foreground"
											data-testid="sidebar-user-name"
										>
											{friendlyDisplayName}
										</div>
										<div
											className="text-[10px] text-sidebar-foreground/60 truncate leading-tight"
											data-testid="sidebar-user-subline"
										>
											{sidebarSubline}
										</div>
									</div>
								</div>
							)}
							<button
								onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
								aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
								className="flex items-center gap-2.5 px-3 py-[6px] text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg w-full transition-colors"
							>
								{theme === 'dark' ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
								<span className="text-[12px] font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
							</button>
							<button
								onClick={openTour}
								aria-label="Take the product tour"
								className="flex items-center gap-2.5 px-3 py-[6px] text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg w-full transition-colors"
							>
								<Compass className="w-4 h-4" aria-hidden="true" />
								<span className="text-[12px] font-medium">Take the tour</span>
							</button>
							<button
								data-tour="help-support"
								onClick={() => setChatOpen(true)}
								aria-label="Open help and support"
								className="flex items-center gap-2.5 px-3 py-[6px] text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg w-full transition-colors"
							>
								<HelpCircle className="w-4 h-4" aria-hidden="true" />
								<span className="text-[12px] font-medium">Help & Support</span>
							</button>
							{isAuthenticated && (
								<button
									onClick={handleLogout}
									aria-label="Log out"
									className="flex items-center gap-2.5 px-3 py-[6px] text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-lg w-full transition-colors"
								>
									<LogOut className="w-4 h-4" aria-hidden="true" />
									<span className="text-[12px] font-medium">Logout</span>
								</button>
							)}
						</>
					) : (
						<div className="flex flex-col items-center space-y-1">
							{isAuthenticated && (
								<div
									className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary uppercase cursor-default"
									title={friendlyDisplayName}
									data-testid="sidebar-user-avatar-collapsed"
								>
									{avatarInitial}
								</div>
							)}
							<button
								onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
								className="p-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
								title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
							>
								{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
							</button>
							{isAuthenticated && (
								<button
									onClick={handleLogout}
									className="p-1.5 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
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
							aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
							aria-expanded={!collapsed}
							className="flex items-center justify-center w-full py-1.5 mt-0.5 text-sidebar-foreground/30 hover:text-sidebar-foreground/60 transition-colors"
						>
							{collapsed ? <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />}
						</button>
					)}
				</div>
			</aside>
			<ChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} />
			<WelcomeTour
				isOpen={tourOpen}
				currentStep={tourStep}
				setCurrentStep={setTourStep}
				onComplete={completeTour}
				onSkip={closeTour}
			/>
		</div>
	)
}
export const AppSidebar = memo(AppSidebarComponent)
