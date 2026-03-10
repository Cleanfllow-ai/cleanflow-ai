"use client"

import { BarChart3, CalendarClock, ChevronLeft, ChevronRight, FileText, HelpCircle, LogOut, Menu, Moon, Settings, Sun, X } from "lucide-react"
import { memo, useEffect, useState } from "react"
import dynamic from "next/dynamic"

import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import { cn } from "@/shared/lib/utils"
import { useAuth } from "@/modules/auth"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"

// Lazy load ChatDrawer to reduce initial bundle (contains framer-motion + react-markdown)
const ChatDrawer = dynamic(
	() => import("@/modules/chat/components/chat-drawer").then((mod) => ({ default: mod.ChatDrawer })),
	{ ssr: false }
)

const navigation = [
	{
		name: "Dashboard",
		href: "/dashboard",
		icon: BarChart3,
		description: "Monitor performance, analytics, and system activity",
	},
	// {
	// 	name: "Transform Data",
	// 	href: "/data-tools",
	// 	icon: Zap,
	// 	description: "Upload and transform your files",
	// },
	{
		name: "Catalog Items",
		href: "/files",
		icon: FileText,
		description: "Manage file uploads, processing workflows, and exports",
	},
	{
		name: "Create Jobs",
		href: "/jobs",
		icon: CalendarClock,
		description: "Manage automated ERP sync schedules",
	},
	{
		name: "Admin",
		href: "/admin",
		icon: Settings,
		description: "Configure organization-level settings and permissions",
	},
]

function AppSidebarComponent() {
	const [collapsed, setCollapsed] = useState(false)
	const [isMobile, setIsMobile] = useState(false)
	const [mobileOpen, setMobileOpen] = useState(false)
	const [chatOpen, setChatOpen] = useState(false)
	const pathname = usePathname()
	const router = useRouter()
	const { logout, isAuthenticated, user, userRole } = useAuth()
	const { theme, setTheme } = useTheme()

	// Prefetch all navigation routes on mount to eliminate first-visit compile delay
	useEffect(() => {
		navigation.forEach((item) => {
			router.prefetch(item.href)
		})
	}, [router])

	const navContainer = {
		hidden: {},
		show: {
			transition: {
				staggerChildren: 0.06,
				delayChildren: 0.12,
			},
		},
	}

	const navItem = {
		hidden: { opacity: 0, y: 12 },
		show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
	}

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 1024)
			if (window.innerWidth < 1024) {
				setCollapsed(false)
			}
		}

		checkMobile()
		window.addEventListener('resize', checkMobile)
		return () => window.removeEventListener('resize', checkMobile)
	}, [])

	useEffect(() => {
		setMobileOpen(false)
	}, [pathname])

	const handleLogout = () => {
		logout()
		window.location.href = '/auth/login'
	}

	return (
		<div className="relative">
			{/* Mobile Menu Button */}
			{isMobile && (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setMobileOpen(true)}
					className="fixed top-4 right-4 z-50 lg:hidden bg-background border border-border"
				>
					<Menu className="w-5 h-5" />
				</Button>
			)}

			{/* Mobile Overlay */}
			{isMobile && mobileOpen && (
				<div
					className="fixed inset-0 bg-black/40 z-40 lg:hidden"
					onClick={() => setMobileOpen(false)}
				/>
			)}

			{/* Sidebar */}
			<aside
				className={cn(
					"flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-sm",
					isMobile ? [
						"fixed left-0 top-0 z-50 w-72",
						mobileOpen ? "translate-x-0" : "-translate-x-full"
					] : [
						"relative",
						collapsed ? "w-16" : "w-72"
					]
				)}
			>
				{isMobile && (
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setMobileOpen(false)}
						className="absolute top-3 right-3 lg:hidden"
					>
						<X className="w-4 h-4" />
					</Button>
				)}
				<div className="flex items-center justify-between p-4 border-b border-sidebar-border/60">
					{!collapsed && (
						<div className="flex items-center space-x-3">
							<div className="relative w-10 h-10">
								<Image
									src="/images/infiniqon-logo-light.png"
									alt="CleanFlowAI"
									width={40}
									height={40}
									className="rounded-lg object-contain"
								/>
							</div>
							<div>
								<span className="font-playfair font-bold text-xl">CleanFlowAI</span>
								{/* <p className="text-xs text-muted-foreground mt-0.5">Data Platform</p> */}
							</div>
						</div>
					)}
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setCollapsed(!collapsed)}
						className="text-muted-foreground hover:bg-muted"
					>
						{collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
					</Button>
				</div>

				<nav className="flex-1 p-3 space-y-1">
					{navigation.map((item) => {
						const isActive = pathname === item.href;

						return (
							<Link key={item.name} href={item.href}>
								<div
									className={cn(
										"flex items-center space-x-3 px-3 py-2 rounded-lg",
										isActive
											? "bg-accent/10 text-foreground border border-accent/30"
											: "text-muted-foreground hover:bg-muted",
										collapsed && "justify-center px-2",
									)}
								>
									<item.icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-accent" : "")} />
									{!collapsed && (
										<div className="flex-1">
											<div className="font-medium">{item.name}</div>
											<div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
										</div>
									)}
								</div>
							</Link>
						)
					})}
				</nav>

				<div className="p-4 border-t border-sidebar-border/60">
					{!collapsed && (
						<div className="space-y-3">
							{isAuthenticated && (
								<div className="px-4 py-2">
									<div className="text-sm font-medium truncate">
										{user?.name || 'User'}
									</div>
									<div className="text-xs text-muted-foreground truncate">
										{user?.email}
									</div>
								</div>
							)}
							<button
								onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
								className="flex items-center space-x-3 px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg w-full"
							>
								{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
								<span className="text-sm">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
							</button>
							<button
								onClick={() => setChatOpen(true)}
								className="flex items-center space-x-3 px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg w-full"
							>
								<HelpCircle className="w-4 h-4" />
								<span className="text-sm">Help & Support</span>
							</button>
							{isAuthenticated && (
								<Button
									onClick={handleLogout}
									variant="outline"
									className="w-full flex items-center space-x-3 px-4 py-2 text-destructive hover:bg-destructive/10 rounded-lg justify-start"
								>
									<LogOut className="w-4 h-4" />
									<span className="text-sm">Logout</span>
								</Button>
							)}
							<div className="text-xs text-muted-foreground text-center">
								<div>© CleanFlowAI</div>
							</div>
						</div>
					)}
					{collapsed && isAuthenticated && (
						<div className="flex flex-col items-center space-y-2">
							<Button
								onClick={handleLogout}
								variant="outline"
								size="sm"
								className="text-destructive hover:bg-destructive/10 p-2"
								title="Logout"
							>
								<LogOut className="w-4 h-4" />
							</Button>
						</div>
					)}
				</div>
			</aside>

			{/* Chat Drawer */}
			<ChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} />
		</div>
	)
}

// Memoize sidebar to prevent re-renders when parent state changes
export const AppSidebar = memo(AppSidebarComponent)
