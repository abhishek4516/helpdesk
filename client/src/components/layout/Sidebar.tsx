
import { useEffect, useState } from 'react'
import type { UserRole } from '../../types/auth'

interface SidebarProps {
  role: UserRole
  activePage: string
  onNavigate: (page: string) => void
  onLogout: () => void
}


const navigationByRole: Record<
  UserRole,
  { label: string; id: string; icon: string }[]
> = {
  master: [
    { label: 'Overview', id: 'overview', icon: 'grid' },
    { label: 'All Tickets', id: 'tickets', icon: 'ticket' },
    { label: 'Ticket Transfers', id: 'transfers', icon: 'forward' },
    { label: 'Employees', id: 'employees', icon: 'users' },
    { label: 'Departments', id: 'departments', icon: 'building' },
  ],
  department_head: [
    { label: 'Overview', id: 'overview', icon: 'grid' },
    { label: 'Department Tickets', id: 'tickets', icon: 'ticket' },
    { label: 'Ticket Transfers', id: 'transfers', icon: 'forward' },
  ],
  employee: [
    { label: 'Overview', id: 'overview', icon: 'grid' },
    { label: 'My Tickets', id: 'tickets', icon: 'ticket' },
    { label: 'Ticket Transfers', id: 'transfers', icon: 'forward' },
  ],
}

function NavIcon({ name }: { name: string }) {
  const common = {
    className: 'size-5 shrink-0',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (name) {
    case 'grid':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      )

    case 'ticket':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 7.5A2.5 2.5 0 0 0 4 12.5v4A1.5 1.5 0 0 0 5.5 18h13a1.5 1.5 0 0 0 1.5-1.5v-4a2.5 2.5 0 0 1 0-5v-1A1.5 1.5 0 0 0 18.5 5h-13A1.5 1.5 0 0 0 4 6.5z" />
          <path d="M14 8v1m0 3v1m0 3v.5" />
        </svg>
      )

    case 'users':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )

    case 'building':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M9 21v-4h6v4M8 7h1m6 0h1M8 11h1m6 0h1" />
        </svg>
      )

    case 'forward':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M14 5l7 7-7 7" />
          <path d="M21 12H9a6 6 0 0 0-6 6" />
        </svg>
      )

    case 'logout':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M10 17l5-5-5-5M15 12H3" />
          <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
        </svg>
      )

    default:
      return null
  }
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-5"
      aria-hidden="true"
    >
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`size-4 transition-transform duration-200 ${
        collapsed ? 'rotate-180' : ''
      }`}
      aria-hidden="true"
    >
      <path
        d="m14 6-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Sidebar({
  role,
  activePage,
  onNavigate,
  onLogout,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const navigation = navigationByRole[role]

  // Open the drawer when the Topbar hamburger is pressed.
  useEffect(() => {
    const openMobileMenu = () => setMobileOpen(true)

    window.addEventListener('helpdesk:open-mobile-sidebar', openMobileMenu)

    return () => {
      window.removeEventListener(
        'helpdesk:open-mobile-sidebar',
        openMobileMenu,
      )
    }
  }, [])

  // Prevent the page behind the drawer from scrolling.
  useEffect(() => {
    if (!mobileOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen])

  // Close the drawer with Escape.
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  // If the screen becomes desktop-sized, close the mobile drawer.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  function navigateTo(page: string) {
    onNavigate(page)
    setMobileOpen(false)
  }

  function logout() {
    setMobileOpen(false)
    onLogout()
  }

  return (
    <>
      {/* Mobile backdrop: overlays the page and takes up no layout space. */}
      <div
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 md:hidden ${
          mobileOpen
            ? 'visible opacity-100'
            : 'invisible pointer-events-none opacity-0'
        }`}
      />

      {/* Sidebar drawer */}
      <aside
        id="helpdesk-sidebar"
        aria-label="Sidebar navigation"
        aria-hidden={undefined}
        className={[
          // IMPORTANT: do not add "relative" here.
          // Mobile uses fixed positioning so the sidebar never pushes
          // dashboard content down.
          'fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh shrink-0 flex-col overflow-visible border-r',
          'w-[min(18rem,85vw)]',
          'transition-[transform,width] duration-200 ease-in-out',
          // Desktop becomes a normal sticky sidebar.
          'md:sticky md:top-0 md:z-20 md:h-screen md:max-h-screen md:shadow-none',
          // Mobile drawer visibility.
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          // Desktop collapsed / expanded widths.
          collapsed ? 'md:w-19' : 'md:w-60',
        ].join(' ')}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)',
          boxShadow: mobileOpen ? 'var(--color-shadow)' : undefined,
        }}
      >
        {/* Brand header */}
        <div
          className={[
            'flex min-h-19 shrink-0 items-center border-b px-4',
            'justify-between gap-3',
            collapsed ? 'md:justify-center md:px-2' : '',
          ].join(' ')}
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div
            className={[
              'flex min-w-0 items-center gap-3',
              collapsed ? 'md:justify-center' : '',
            ].join(' ')}
          >
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: 'var(--color-accent-soft)',
                color: 'var(--color-accent-text)',
              }}
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none" className="size-6">
                <path
                  d="M12 3.5 20 7.5V12.5C20 17 16.6 20 12 21C7.4 20 4 17 4 12.5V7.5L12 3.5Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <path
                  d="m8.5 12 2.3 2.3 4.8-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className={collapsed ? 'md:hidden' : 'min-w-0'}>
              <p className="truncate text-sm font-bold tracking-tight">
                Helpdesk
              </p>
              <p
                className="truncate text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Employee support
              </p>
            </div>
          </div>

          {/* Close button: mobile only */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl transition hover:opacity-75 md:hidden"
            style={{
              backgroundColor: 'var(--color-surface-secondary)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Navigation links */}
        <nav
          aria-label="Main navigation"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-6"
        >
          <p
            className={[
              'px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em]',
              collapsed ? 'md:hidden' : '',
            ].join(' ')}
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Workspace
          </p>

          {navigation.map((item) => {
            const isActive = activePage === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                aria-current={isActive ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
                className={[
                  'relative flex min-h-11 w-full shrink-0 items-center rounded-xl text-left text-sm font-medium transition-colors',
                  collapsed ? 'md:justify-center md:px-0' : 'gap-3 px-3',
                ].join(' ')}
                style={{
                  backgroundColor: isActive
                    ? 'var(--color-accent-soft)'
                    : 'transparent',
                  color: isActive
                    ? 'var(--color-accent-text)'
                    : 'var(--color-text-secondary)',
                }}
                onMouseEnter={(event) => {
                  if (!isActive) {
                    event.currentTarget.style.backgroundColor =
                      'var(--color-surface-secondary)'
                    event.currentTarget.style.color = 'var(--color-text)'
                  }
                }}
                onMouseLeave={(event) => {
                  if (!isActive) {
                    event.currentTarget.style.backgroundColor = 'transparent'
                    event.currentTarget.style.color =
                      'var(--color-text-secondary)'
                  }
                }}
              >
                {isActive && (
                  <span
                    className="absolute bottom-2 left-0 top-2 w-0.75 rounded-r-full"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  />
                )}

                <NavIcon name={item.icon} />

                <span className={collapsed ? 'md:hidden' : ''}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Logout pinned to the bottom */}
        <div
          className="shrink-0 border-t p-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            type="button"
            onClick={logout}
            title={collapsed ? 'Log out' : undefined}
            className={[
              'flex min-h-11 w-full items-center rounded-xl text-left text-sm font-medium transition-colors',
              collapsed ? 'md:justify-center md:px-0' : 'gap-3 px-3',
            ].join(' ')}
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor =
                'var(--color-danger-bg)'
              event.currentTarget.style.color = 'var(--color-danger-text)'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = 'transparent'
              event.currentTarget.style.color =
                'var(--color-text-secondary)'
            }}
          >
            <NavIcon name="logout" />
            <span className={collapsed ? 'md:hidden' : ''}>Log out</span>
          </button>
        </div>

        {/* Desktop collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-1/2 z-30 hidden size-7 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition hover:scale-105 md:flex"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </aside>
    </>
  )
}
