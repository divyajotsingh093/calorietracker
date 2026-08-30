import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const base = (p: P) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

export const IconFlame = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3c.5 3 2.5 4 4 6a6.5 6.5 0 1 1-11 4.5C5 10 8.5 9.5 9.5 6c1.6 1 2 2.5 2 3.5 1-1 .5-4.5.5-6.5Z" />
  </svg>
)
export const IconCalendar = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
)
export const IconBook = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" />
    <path d="M4 19a2 2 0 0 0 2 2h13" />
  </svg>
)
export const IconCart = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2 3h2.2l2.3 12.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.55L21 8H6" />
  </svg>
)
export const IconCamera = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
)
export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="m4 12.5 5 5L20 6.5" />
  </svg>
)
export const IconX = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const IconChevronLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 5-7 7 7 7" />
  </svg>
)
export const IconChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
)
export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.5l3.5 2" />
  </svg>
)
export const IconLink = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 13.5a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.66-5.66l-1.3 1.3" />
    <path d="M14 10.5a4 4 0 0 0-5.7-.3L5.7 12.8a4 4 0 0 0 5.66 5.66l1.3-1.3" />
  </svg>
)
export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="12" height="12" rx="2.5" />
    <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </svg>
)
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
)
export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.87-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 10 4.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 21 10.9h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" />
  </svg>
)
export const IconSparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5 13.6 9 19 10.5 13.6 12 12 17.5 10.4 12 5 10.5 10.4 9 12 3.5Z" />
    <path d="M18.5 16.5 19.2 19l2.3.7-2.3.8-.7 2.3-.8-2.3-2.2-.8 2.2-.7.8-2.5Z" />
  </svg>
)
export const IconRepeat = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 10V8a3 3 0 0 1 3-3h11m0 0-3-3m3 3-3 3" />
    <path d="M20 14v2a3 3 0 0 1-3 3H6m0 0 3 3m-3-3 3-3" />
  </svg>
)
export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
)
export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17" />
  </svg>
)
export const IconEdit = (p: P) => (
  <svg {...base(p)}>
    <path d="M15.5 4.5 19.5 8.5 8 20H4v-4L15.5 4.5Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
)
export const IconPrint = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 9V3h10v6" />
    <rect x="4" y="9" width="16" height="8" rx="2" />
    <path d="M7 14h10v7H7z" />
  </svg>
)
