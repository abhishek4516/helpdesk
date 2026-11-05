import { useEffect, useMemo, useRef, useState } from "react";
import type { LoggedInUser } from "../../types/auth";
import type { Ticket } from "../../services/ticketService";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../services/notificationService";
import type { NotificationItem } from "../../services/notificationService";

interface TopbarProps {
  user: LoggedInUser;
  title: string;
  tickets: Ticket[];
  loadingTickets: boolean;
  ticketError: string;
  onSelectTicket: (ticket: Ticket) => void;
}

type Theme = "light" | "dark";

const iconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

function SearchIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...iconProps}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.5 13.5 3.5 3.5" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" {...iconProps}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5" {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5" {...iconProps}>
      <path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" {...iconProps}>
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" {...iconProps}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" {...iconProps}>
      <path d="m4 10 4 4 8-8" />
    </svg>
  );
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatTime(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const iconButton =
  "flex size-9 shrink-0 items-center justify-center rounded-lg text-(--color-text-secondary) transition hover:bg-(--color-accent-soft) hover:text-(--color-text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)";

export default function Topbar({
  user,
  title,
  tickets,
  loadingTickets,
  ticketError,
  onSelectTicket,
}: TopbarProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem("helpdesk-theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notificationActionLoading, setNotificationActionLoading] =
    useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");

    try {
      localStorage.setItem("helpdesk-theme", theme);
    } catch {
      // Theme still works if local storage is unavailable.
    }
  }, [theme]);

  // User initials and role
  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?";

  const roleName = user.role.replaceAll("_", " ");

  // Ticket search
  const results = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return [];

    return tickets
      .filter((ticket) =>
        [
          ticket.ticketCode,
          ticket.title,
          ticket.description,
          ticket.departmentName,
          ticket.requesterName,
        ].some((value) => value?.toLowerCase().includes(query)),
      )
      .slice(0, 8);
  }, [tickets, search]);

  // Load notifications
  async function loadNotifications(showLoader = false) {
    if (showLoader) setNotificationLoading(true);

    try {
      const data = await getNotifications();

      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setNotificationError("");
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to load notifications.",
      );
    } finally {
      if (showLoader) setNotificationLoading(false);
    }
  }

  // Initial load and automatic refresh every 30 seconds
  useEffect(() => {
    void loadNotifications(true);

    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  // Outside click and keyboard handling
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }

      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(target)
      ) {
        setNotificationOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
        setNotificationOpen(false);
        setMobileSearch(false);
        inputRef.current?.blur();
      }

      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(
          (event.target as HTMLElement)?.tagName ?? "",
        )
      ) {
        event.preventDefault();
        setMobileSearch(true);
        inputRef.current?.focus();
        setSearchOpen(true);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function openMobileSidebar() {
    window.dispatchEvent(new Event("helpdesk:open-mobile-sidebar"));
  }

  function selectTicket(ticket: Ticket) {
    onSelectTicket(ticket);
    setSearch("");
    setSearchOpen(false);
    setMobileSearch(false);
    inputRef.current?.blur();
  }

  function openMobileSearch() {
    setMobileSearch(true);
    setSearchOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function closeMobileSearch() {
    setMobileSearch(false);
    setSearchOpen(false);
    setSearch("");
  }

  // Mark one notification as read
  async function handleNotificationClick(
    notification: NotificationItem,
  ) {
    try {
      if (!notification.is_read) {
        await markNotificationRead(notification.id);

        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, is_read: true }
              : item,
          ),
        );

        setUnreadCount((current) => Math.max(0, current - 1));
      }

      // Open the related ticket if it exists in the loaded ticket list.
      if (notification.ticket_id !== null) {
        const ticket = tickets.find(
          (item) => item.id === notification.ticket_id,
        );

        if (ticket) {
          onSelectTicket(ticket);
          setNotificationOpen(false);
        }
      }
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to update notification.",
      );
    }
  }

  // Mark all notifications as read
  async function handleMarkAllRead() {
    if (unreadCount === 0 || notificationActionLoading) return;

    setNotificationActionLoading(true);

    try {
      await markAllNotificationsRead();

      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true })),
      );

      setUnreadCount(0);
      setNotificationError("");
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to update notifications.",
      );
    } finally {
      setNotificationActionLoading(false);
    }
  }

  return (
    <header
      className="sticky top-0 z-30 w-full border-b"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
        color: "var(--color-text)",
      }}
    >
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
        {/* Mobile menu */}
        <button
          type="button"
          onClick={openMobileSidebar}
          aria-label="Open navigation menu"
          title="Open navigation menu"
          className={`${iconButton} md:hidden ${mobileSearch ? "hidden" : ""}`}
        >
          <MenuIcon />
        </button>

        {/* Page title */}
        <h1
          className={`min-w-0 truncate text-[15px] font-semibold tracking-tight sm:text-base ${
            mobileSearch ? "hidden sm:block" : "block"
          }`}
        >
          {title}
        </h1>

        {/* Ticket search */}
        <div
          ref={searchRef}
          className={`relative ml-auto ${
            mobileSearch ? "flex-1" : "hidden"
          } sm:block sm:w-full sm:max-w-xs lg:max-w-sm`}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (results.length > 0) selectTicket(results[0]);
            }}
          >
            <div
              className="flex h-9 items-center gap-2 rounded-lg px-3 transition focus-within:ring-2 focus-within:ring-(--color-accent)/30"
              style={{ backgroundColor: "var(--color-bg)" }}
            >
              <span className="text-(--color-text-secondary)">
                <SearchIcon />
              </span>

              <input
                ref={inputRef}
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search tickets"
                aria-label="Search tickets"
                aria-expanded={searchOpen && Boolean(search.trim())}
                className="min-w-0 flex-1 bg-transparent text-base text-(--color-text) outline-none placeholder:text-(--color-text-secondary) sm:text-sm [&::-webkit-search-cancel-button]:hidden"
              />

              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSearchOpen(true);
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="text-(--color-text-secondary) hover:text-(--color-text)"
                >
                  <CloseIcon />
                </button>
              ) : (
                <kbd
                  className="hidden rounded border px-1.5 text-[10px] leading-5 text-(--color-text-secondary) lg:inline-block"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  /
                </kbd>
              )}
            </div>
          </form>

          {searchOpen && search.trim() && (
            <div
              className="fixed inset-x-3 top-15 z-50 overflow-hidden rounded-xl border shadow-lg sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:left-0 sm:mt-2"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
              }}
            >
              {loadingTickets ? (
                <div className="flex items-center gap-3 px-4 py-4 text-sm text-(--color-text-secondary)">
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Loading tickets…
                </div>
              ) : ticketError ? (
                <p
                  role="alert"
                  className="px-4 py-4 text-sm text-(--color-danger-text)"
                >
                  {ticketError}
                </p>
              ) : results.length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <p className="text-sm font-medium">No tickets found</p>
                  <p className="mt-1 text-xs text-(--color-text-secondary)">
                    Try another ID, title or keyword.
                  </p>
                </div>
              ) : (
                <ul className="max-h-[min(24rem,60vh)] overflow-y-auto py-1">
                  {results.map((ticket) => (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        onClick={() => selectTicket(ticket)}
                        className="block w-full px-4 py-2.5 text-left transition hover:bg-(--color-accent-soft) focus-visible:bg-(--color-accent-soft) focus-visible:outline-none"
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium">
                            {ticket.title}
                          </span>
                          <span className="shrink-0 text-xs capitalize text-(--color-text-secondary)">
                            {formatStatus(ticket.status)}
                          </span>
                        </span>

                        <span className="mt-0.5 block truncate text-xs text-(--color-text-secondary)">
                          <span className="font-medium text-(--color-accent)">
                            {ticket.ticketCode}
                          </span>
                          {` · ${ticket.departmentName || "Unassigned"}`}
                          {ticket.requesterName
                            ? ` · ${ticket.requesterName}`
                            : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Mobile search toggle */}
        {mobileSearch ? (
          <button
            type="button"
            onClick={closeMobileSearch}
            aria-label="Close search"
            className={`${iconButton} sm:hidden`}
          >
            <CloseIcon />
          </button>
        ) : (
          <button
            type="button"
            onClick={openMobileSearch}
            aria-label="Search tickets"
            className={`${iconButton} ml-auto sm:hidden`}
          >
            <SearchIcon className="size-4.5" />
          </button>
        )}

        {/* Right-side actions */}
        <div
          className={`items-center gap-1 ${
            mobileSearch ? "hidden sm:flex" : "flex"
          }`}
        >
          {/* Notifications */}
          <div ref={notificationRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setNotificationOpen((current) => !current);
                setProfileOpen(false);

                if (!notificationOpen) {
                  void loadNotifications(true);
                }
              }}
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              aria-expanded={notificationOpen}
              aria-haspopup="true"
              title="Notifications"
              className={`${iconButton} relative`}
            >
              <BellIcon />

              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-(--color-surface) bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {notificationOpen && (
              <div
                className="fixed inset-x-3 top-15 z-50 overflow-hidden rounded-xl border shadow-xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-[min(24rem,calc(100vw-2rem))]"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                }}
              >
                {/* Dropdown header */}
                <div
                  className="flex items-center justify-between border-b px-4 py-3"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div>
                    <h2 className="text-sm font-semibold">Notifications</h2>
                    <p className="mt-0.5 text-xs text-(--color-text-secondary)">
                      {unreadCount === 0
                        ? "You're all caught up"
                        : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleMarkAllRead()}
                    disabled={
                      unreadCount === 0 || notificationActionLoading
                    }
                    className="rounded-md px-2 py-1 text-xs font-medium text-(--color-accent) transition hover:bg-(--color-accent-soft) disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {notificationActionLoading
                      ? "Updating…"
                      : "Mark all read"}
                  </button>
                </div>

                {/* Error */}
                {notificationError && (
                  <div
                    role="alert"
                    className="border-b px-4 py-2 text-xs text-red-500"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    {notificationError}
                  </div>
                )}

                {/* Notification list */}
                <div className="max-h-[min(26rem,65vh)] overflow-y-auto">
                  {notificationLoading ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-(--color-text-secondary)">
                      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Loading notifications…
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-(--color-accent-soft) text-(--color-text-secondary)">
                        <BellIcon />
                      </span>
                      <p className="mt-3 text-sm font-medium">
                        No notifications yet
                      </p>
                      <p className="mt-1 text-xs text-(--color-text-secondary)">
                        Updates about your tickets will appear here.
                      </p>
                    </div>
                  ) : (
                    <ul>
                      {notifications.map((notification) => {
                        const isRead = Boolean(notification.is_read);

                        return (
                          <li key={notification.id}>
                            <button
                              type="button"
                              onClick={() =>
                                void handleNotificationClick(notification)
                              }
                              className="flex w-full gap-3 border-b px-4 py-3 text-left transition last:border-b-0 hover:bg-(--color-accent-soft)"
                              style={{
                                borderColor: "var(--color-border)",
                                backgroundColor: isRead
                                  ? "transparent"
                                  : "var(--color-accent-soft)",
                              }}
                            >
                              <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-(--color-bg) text-(--color-accent)">
                                {isRead ? (
                                  <CheckIcon />
                                ) : (
                                  <BellIcon />
                                )}
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="flex items-start justify-between gap-2">
                                  <span className="text-sm font-semibold">
                                    {notification.title}
                                  </span>

                                  {!isRead && (
                                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-(--color-accent)" />
                                  )}
                                </span>

                                <span className="mt-1 block text-xs leading-relaxed text-(--color-text-secondary)">
                                  {notification.message}
                                </span>

                                <span className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-(--color-text-secondary)">
                                  {notification.ticket_code && (
                                    <span className="font-semibold text-(--color-accent)">
                                      {notification.ticket_code}
                                    </span>
                                  )}
                                  <span>
                                    {formatTime(notification.created_at)}
                                  </span>
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Footer */}
                <div
                  className="border-t px-4 py-2.5"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <button
                    type="button"
                    onClick={() => void loadNotifications(true)}
                    className="w-full rounded-md py-1 text-xs font-medium text-(--color-text-secondary) transition hover:bg-(--color-accent-soft) hover:text-(--color-text)"
                  >
                    Refresh notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() =>
              setTheme((current) =>
                current === "light" ? "dark" : "light",
              )
            }
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            className={iconButton}
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>

          {/* Profile dropdown */}
          <div ref={profileRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((current) => !current);
                setNotificationOpen(false);
              }}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              aria-label="Open profile menu"
              className="flex items-center gap-2 rounded-full p-0.5 transition hover:bg-(--color-accent-soft) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) sm:pr-3"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-(--color-accent) text-xs font-semibold text-white">
                {initials}
              </span>

              <span className="hidden max-w-28 truncate text-sm font-medium lg:block">
                {user.name}
              </span>
            </button>

            {profileOpen && (
              <div
                role="menu"
                className="absolute top-full right-0 z-50 mt-2 w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border shadow-lg"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                }}
              >
                <div className="px-4 py-3">
                  <p className="truncate text-sm font-semibold">
                    {user.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs capitalize text-(--color-text-secondary)">
                    {roleName}
                  </p>
                </div>

                <dl
                  className="space-y-2 border-t px-4 py-3 text-xs"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="flex justify-between gap-4">
                    <dt className="text-(--color-text-secondary)">
                      Employee ID
                    </dt>
                    <dd className="truncate font-medium">
                      {user.employeeId}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-(--color-text-secondary)">
                      Department
                    </dt>
                    <dd className="truncate font-medium">
                      {user.departmentName || "Not assigned"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}