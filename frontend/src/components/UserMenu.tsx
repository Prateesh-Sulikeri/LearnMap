import { useNavigate } from 'react-router-dom'
import { LogOut, Moon, Sun, UserRound } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { resolveAssetUrl } from '@/utils/url'
import { getStreakRank } from '@/utils/streakRank'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface UserMenuProps {
  /** Sidebar expanded: avatar + name + streak rank. Collapsed/mobile: avatar only. */
  variant: 'sidebar' | 'sidebar-collapsed' | 'mobile'
  currentStreak?: number
}

// The one place a signed-in user reaches their profile, the theme toggle,
// and logout — previously three separate places (a "Profile" nav tab, a
// direct-navigate avatar link, and a standalone logout button) that all did
// some version of the same job. Consolidated per direct feedback: the
// avatar is now a single menu trigger, reused across the desktop sidebar
// (expanded and collapsed) and the mobile bottom bar.
export function UserMenu({ variant, currentStreak = 0 }: UserMenuProps) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  if (!user) return null

  const rank = getStreakRank(currentStreak)
  const RankIcon = rank.icon

  const avatar = user.avatar_url ? (
    <img src={resolveAssetUrl(user.avatar_url)} alt="" className="size-6 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[0.6rem] font-semibold text-primary-foreground">
      {user.display_name.charAt(0).toUpperCase()}
    </span>
  )

  const triggerClassName = cn(
    'flex items-center gap-2 rounded-lg transition-colors duration-150 hover:bg-accent hover:text-foreground',
    variant === 'sidebar' && 'w-full px-1 py-1.5 text-left text-xs text-muted-foreground',
    variant === 'sidebar-collapsed' && 'w-full justify-center py-1.5 text-muted-foreground',
    variant === 'mobile' &&
      'min-h-11 min-w-11 flex-col justify-center gap-0.5 px-3 text-xs font-medium text-muted-foreground',
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className={triggerClassName} aria-label="Account menu" />}>
        {avatar}
        {variant === 'sidebar' && (
          <span className="min-w-0">
            <span className="block truncate text-foreground">{user.display_name}</span>
            <span className={cn('flex items-center gap-1 text-[0.65rem] font-medium', rank.color)}>
              <RankIcon className="size-3 shrink-0" />
              {rank.name}
            </span>
          </span>
        )}
        {variant === 'mobile' && 'Account'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2 px-1.5 py-1.5 font-normal text-foreground">
            {avatar}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{user.display_name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/profile')} className="flex items-center gap-3">
          <UserRound className="size-4" />
          My Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })}
          className="flex items-center gap-3"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void logout()} className="flex items-center gap-3">
          <LogOut className="size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
