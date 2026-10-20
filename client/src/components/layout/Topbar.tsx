
import { useEffect, useState } from 'react'
import type { LoggedInUser } from '../../types/auth'

interface TopbarProps {
  user: LoggedInUser
  title: string
}

type Theme = 'light' | 'dark'

export default function Topbar({ user, title }: TopbarProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem('helpdesk-theme') === 'dark'
        ? 'dark'
        : 'light'
    } catch {
      return 'light'
    }
  })

  const [search, setSearch] = useState('')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')

    try {
      localStorage.setItem('helpdesk-theme', theme)
    } catch {
      // The selected theme still works if storage is unavailable.
    }
  }, [theme])

  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'

  const roleName = user.role.replace(/_/g, ' ')

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!search.trim()) return

    // Search can be connected to ticket filtering later.
    console.log('Helpdesk search:', search.trim())
  }

  function openMobileSidebar() {
    window.dispatchEvent(new Event('helpdesk:open-mobile-sidebar'))
  }

  return (
    <header
      className="sticky top-0 z-30 w-full border-b transition-colors duration-200"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text)',
      }}
    >
      {/* Main top bar */}
      <div className="flex min-h-[76px] items-center gap-3 px-3 py-3 sm:gap-4 sm:px-6 lg:px-8">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={openMobileSidebar}
          aria-label="Open navigation menu"
          title="Open navigation menu"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border transition hover:opacity-75 md:hidden"
          style={{
            backgroundColor: 'var(--color-surface-secondary)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="size-5"
            aria-hidden="true"
          >
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Brand */}
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'var(--color-accent-soft)',
              color: 'var(--color-accent-text)',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="size-6"
              aria-hidden="true"
            >
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

          <div className="min-w-0">
            <p
              className="truncate text-sm font-bold tracking-tight sm:text-base"
              style={{ color: 'var(--color-text)' }}
            >
              Helpdesk
            </p>
            <p
              className="hidden text-xs sm:block"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Employee Support Portal
            </p>
          </div>
        </div>

        {/* Search */}
        <form
          onSubmit={handleSearch}
          role="search"
          className="mx-auto hidden w-full max-w-md md:block"
        >
          <div
            className="flex h-10 items-center gap-2.5 rounded-xl border px-3 transition-colors"
            style={{
              backgroundColor: 'var(--color-surface-secondary)',
              borderColor: 'var(--color-border)',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="size-[18px] shrink-0"
              style={{ color: 'var(--color-text-secondary)' }}
              aria-hidden="true"
            >
              <circle
                cx="10.8"
                cy="10.8"
                r="6.8"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="m16 16 4 4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tickets, IDs..."
              aria-label="Search helpdesk"
              className="w-full min-w-0 border-0 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text)' }}
            />
          </div>
        </form>

        {/* Actions */}
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Theme toggle */}
          <button
            type="button"
            onClick={() =>
              setTheme((current) =>
                current === 'light' ? 'dark' : 'light',
              )
            }
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            className="flex size-10 items-center justify-center rounded-xl border transition hover:opacity-75"
            style={{
              backgroundColor: 'var(--color-surface-secondary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            {theme === 'light' ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-5"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="3.8"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path
                  d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-5"
                aria-hidden="true"
              >
                <path
                  d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>

          {/* Notifications */}
          <button
            type="button"
            aria-label="Notifications"
            title="Notifications"
            className="relative flex size-10 items-center justify-center rounded-xl border transition hover:opacity-75"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="size-5"
              aria-hidden="true"
            >
              <path
                d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 21h4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div
            className="hidden h-9 w-px sm:block"
            style={{ backgroundColor: 'var(--color-border)' }}
          />

          {/* User profile */}
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
              style={{
                backgroundColor: 'var(--color-accent-soft)',
                color: 'var(--color-accent-text)',
              }}
              aria-label={`Profile for ${user.name}`}
            >
              {initials}
            </div>

            <div className="hidden min-w-0 sm:block">
              <p
                className="max-w-36 truncate text-sm font-semibold"
                style={{ color: 'var(--color-text)' }}
              >
                {user.name}
              </p>
              <p
                className="max-w-36 truncate text-xs capitalize"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {roleName}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div
        className="flex min-h-10 items-center gap-2 border-t px-3 sm:px-6 lg:px-8"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-4 shrink-0"
          style={{ color: 'var(--color-accent)' }}
          aria-hidden="true"
        >
          <rect
            x="3.5"
            y="3.5"
            width="7"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect
            x="13.5"
            y="3.5"
            width="7"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect
            x="3.5"
            y="13.5"
            width="7"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect
            x="13.5"
            y="13.5"
            width="7"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>

        <span
          className="truncate text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Employee Helpdesk
        </span>

        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-3.5 shrink-0"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-hidden="true"
        >
          <path
            d="m9 18 6-6-6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <span
          className="truncate text-xs font-semibold"
          style={{ color: 'var(--color-text)' }}
        >
          {title}
        </span>
      </div>
    </header>
  )
}
