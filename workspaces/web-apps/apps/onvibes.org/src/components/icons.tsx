import type {ReactNode} from 'react'

// onvibes.org has no icon library; these mirror lucide's glyphs as inline SVG
// (the theme toggle does the same for sun/moon/monitor). One stroke weight for
// the set, recolored per state through currentColor.

interface IconProps {
  children: ReactNode
  size?: number
}

function Icon({children, size = 18}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function PlusIcon() {
  return (
    <Icon>
      <path d="M5 12h14M12 5v14" />
    </Icon>
  )
}

export function ArrowUpIcon() {
  return (
    <Icon>
      <path d="m5 12 7-7 7 7M12 19V5" />
    </Icon>
  )
}

export function PanelLeftIcon() {
  return (
    <Icon>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
    </Icon>
  )
}

export function CloseIcon() {
  return (
    <Icon>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  )
}

export function SparkIcon() {
  return (
    <Icon size={14}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M5.6 18.4l2.2-2.2M16.2 7.8l2.2-2.2" />
    </Icon>
  )
}
