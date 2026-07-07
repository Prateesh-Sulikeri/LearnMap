import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  CalendarClock,
  LayoutDashboard,
  ListTree,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/useAuth'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { ItemFormDialog } from '@/components/ItemFormDialog'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tree', label: 'Learning', icon: ListTree },
  { to: '/sessions', label: 'Sessions', icon: CalendarClock },
  { to: '/profile', label: 'Profile', icon: UserRound },
] as const

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tree': 'Learning',
  '/sessions': 'Study Sessions',
  '/profile': 'Profile',
  '/trash': 'Trash',
}

// The one layout every authenticated page renders inside. Per the design
// doc, every page needs a breadcrumb and a floating add button — both live
// here, not per-page, so they can't drift out of sync across pages. Search
// is page-local (only the Learning page has anything to search), not global
// chrome. Responsive: a left sidebar on tablet/desktop (collapsible to
// icon-only width for more content room) becomes a bottom tab bar on phone
// widths (mobile-first requirement, ADR-012).
export default function AppLayout() {
  const location = useLocation()
  const { logout, user } = useAuth()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed()

  const currentTitle = PAGE_TITLES[location.pathname] ?? 'LearnMap'

  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Sidebar nav — tablet/desktop (md and up), collapsible to icon-only */}
      <aside
        className={cn(
          'hidden md:flex md:shrink-0 md:flex-col md:border-r md:border-border md:bg-card md:p-3 md:transition-[width] md:duration-150',
          sidebarCollapsed ? 'md:w-16' : 'md:w-60',
        )}
      >
        <div className="mb-8 flex items-center justify-between px-1">
          {!sidebarCollapsed && (
            <Link to="/dashboard" className="font-heading text-xl font-semibold">
              LearnMap
            </Link>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                />
              }
            >
              {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </TooltipTrigger>
            <TooltipContent side="right">{sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</TooltipContent>
          </Tooltip>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const linkClassName = cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
              sidebarCollapsed && 'justify-center px-0',
              location.pathname === to
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )

            if (!sidebarCollapsed) {
              return (
                <Link key={to} to={to} className={linkClassName}>
                  <Icon className="size-5 shrink-0" />
                  {label}
                </Link>
              )
            }

            return (
              <Tooltip key={to}>
                <TooltipTrigger render={<Link to={to} className={linkClassName} />}>
                  <Icon className="size-5 shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        <div className="mt-auto space-y-2 px-1">
          {!sidebarCollapsed && (
            <p className="truncate text-xs text-muted-foreground">Welcome back {user?.display_name}!</p>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('w-full', sidebarCollapsed ? 'justify-center px-0' : 'justify-start px-0')}
                  onClick={() => void logout()}
                />
              }
            >
              <LogOut className="size-4" />
              {!sidebarCollapsed && 'Log out'}
            </TooltipTrigger>
            {sidebarCollapsed && <TooltipContent side="right">Log out</TooltipContent>}
          </Tooltip>
        </div>
      </aside>

      <div className="flex flex-1 flex-col pb-20 md:pb-0">
        {/* Top bar: breadcrumb — present on every page */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <span>LearnMap</span> <span className="mx-1">/</span>{' '}
            <span className="text-foreground">{currentTitle}</span>
          </nav>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav — phone only (below md) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t border-border bg-card py-1 md:hidden">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-xs font-medium transition-colors duration-150 ${
              location.pathname === to ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Floating add button — every page, per the design doc */}
      <Button
        size="icon"
        className="fixed right-4 bottom-20 z-20 size-14 rounded-full shadow-lg transition-transform duration-150 hover:scale-105 md:right-8 md:bottom-8"
        onClick={() => setQuickAddOpen(true)}
        aria-label="Add learning item"
      >
        <Plus className="size-6" />
      </Button>

      <ItemFormDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} mode="create" />
    </div>
  )
}
