
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { LoggedInUser } from '../../types/auth'

interface TopbarProps {
  user: LoggedInUser
  departmentName?: string
  title: string
}

type Theme = 'light' | 'dark'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)'

const iconButton = `flex size-10 shrink-0 items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface) text-(--color-text-secondary) transition hover:bg-white/[0.04] hover:text-(--color-text) ${focusRing}`

export default function Topbar({
  user,
  title,
  departmentName,
}: TopbarProps) {
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
  const nextTheme = theme === 'light' ? 'dark' : 'light'

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!search.trim()) return

    console.log('Helpdesk search:', search.trim())
  }

  function openMobileSidebar() {
    window.dispatchEvent(new Event('helpdesk:open-mobile-sidebar'))
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b border-(--color-border) bg-(--color-surface) text-(--color-text) transition-colors duration-200">
      <div className="flex h-16 items-center gap-3 px-3 sm:gap-4 sm:px-6 xl:px-8">

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={openMobileSidebar}
          aria-label="Open navigation menu"
          title="Open navigation menu"
          className={`${iconButton} md:hidden`}
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

      
        <div className="flex min-w-0 shrink items-center gap-3">
          {/* <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--color-accent) text-white"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-5">
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
          </div> */}
<h1> / </h1>
          {/* <p className="hidden text-base font-bold tracking-tight sm:block">
            Helpdesk
          </p> */}

          <span
            className="hidden h-5 w-px bg-(--color-border) sm:block"
            aria-hidden="true"
          />

          <h1 className="truncate text-sm font-semibold text-(--color-text-secondary) sm:text-base">
            {title}
          </h1>
        </div>

        {/* Search */}
        <form
          onSubmit={handleSearch}
          role="search"
          className="mx-auto hidden w-full max-w-md lg:block"
        >
          <label className="relative block">
            <span className="sr-only">Search helpdesk</span>

            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-(--color-text-secondary)">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-4"
                aria-hidden="true"
              >
                <circle
                  cx="10.8"
                  cy="10.8"
                  r="6.8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="m16 16 4 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tickets or IDs"
              className="h-10 w-full rounded-full border border-(--color-border) bg-(--color-bg) pr-4 pl-10 text-sm text-(--color-text) outline-none transition placeholder:text-(--color-text-secondary) focus:border-(--color-accent)"
            />
          </label>
        </form>

        {/* Actions */}
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            aria-label={`Switch to ${nextTheme} theme`}
            title={`Switch to ${nextTheme} theme`}
            className={iconButton}
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
            className={iconButton}
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

          {/* User profile */}
          <div className="flex min-w-0 items-center gap-3 sm:pl-1">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--color-accent-soft) text-sm font-semibold text-(--color-accent-text)"
              role="img"
              aria-label={`Profile for ${user.name}`}
            >
              {initials}
            </div>

            <div className="hidden min-w-0 md:block">
              <p className="max-w-40 truncate text-sm font-semibold text-(--color-text)">
                {user.name}
              </p>

              <p className="max-w-40 truncate text-xs capitalize text-(--color-text-secondary)">
                {roleName}
              </p>

              <p className="max-w-40 truncate text-xs text-(--color-text-secondary)">
                {departmentName || 'Department not assigned'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
