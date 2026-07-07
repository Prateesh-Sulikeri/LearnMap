import { Globe } from 'lucide-react'
import { FaGithub, FaInstagram, FaLinkedin, FaXTwitter } from 'react-icons/fa6'
import { SiLeetcode } from 'react-icons/si'
import type { SocialPlatform } from '@/types/api'

export interface SocialPlatformMeta {
  key: SocialPlatform
  label: string
  icon: React.ComponentType<{ className?: string }>
  placeholder: string
}

// Single source of truth for platform metadata, shared by the Profile
// settings form and the public profile page — lucide-react dropped brand
// logos a while back (licensing), so these specific icons come from
// react-icons instead; Globe (a generic lucide icon) covers "portfolio"
// since that isn't a single branded platform.
export const SOCIAL_PLATFORMS: SocialPlatformMeta[] = [
  { key: 'linkedin', label: 'LinkedIn', icon: FaLinkedin, placeholder: 'https://linkedin.com/in/username' },
  { key: 'github', label: 'GitHub', icon: FaGithub, placeholder: 'https://github.com/username' },
  { key: 'instagram', label: 'Instagram', icon: FaInstagram, placeholder: 'https://instagram.com/username' },
  { key: 'x', label: 'X', icon: FaXTwitter, placeholder: 'https://x.com/username' },
  { key: 'leetcode', label: 'LeetCode', icon: SiLeetcode, placeholder: 'https://leetcode.com/username' },
  { key: 'portfolio', label: 'Portfolio', icon: Globe, placeholder: 'https://yoursite.com' },
]
