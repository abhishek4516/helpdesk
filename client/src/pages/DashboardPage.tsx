import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import CreateTicketForm from "../components/tickets/CreateTicketForm";
import { getTickets, type Ticket } from "../services/ticketService";
import {
  getTicketLifecycle,
  type TicketLifecycleEvent,
} from "../services/ticketLifecycleService";
import type { LoggedInUser } from "../types/auth";
import DepartmentsPage from "./DepartmentsPage";
import EmployeesPage from "./EmployeesPage";
import TicketTransfersPage from "./TicketTransfersPage";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface DashboardPageProps {
  user: LoggedInUser;
  onLogout: () => void;
}

interface AssignableEmployee {
  id: number;
  employeeId: string;
  fullName: string;
  role: "master" | "department_head" | "employee";
  departmentId: number | null;
  isActive: boolean;
}

type TicketWithAssignment = Ticket & {
  assignedEmployeeId?: number | null;
};

type Tone = "indigo" | "sky" | "amber" | "emerald" | "slate";
type SortOrder = "newest" | "oldest";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const pageTitles: Record<string, string> = {
  overview: "Overview",
  tickets: "Tickets",
  transfers: "Ticket Transfers",
  employees: "Employees",
  departments: "Departments",
};

const toneStyles: Record<Tone, { bg: string; text: string }> = {
  indigo: { bg: "bg-indigo-600", text: "text-indigo-600" },
  sky: { bg: "bg-sky-500", text: "text-sky-600" },
  amber: { bg: "bg-amber-500", text: "text-amber-600" },
  emerald: { bg: "bg-emerald-500", text: "text-emerald-600" },
  slate: { bg: "bg-slate-500", text: "text-slate-600" },
};

const kanbanColumns: { title: string; tone: Tone; statuses: string[] }[] = [
  { title: "New", tone: "indigo", statuses: ["open"] },
  {
    title: "Open",
    tone: "sky",
    statuses: ["assigned", "in_progress", "reopened"],
  },
  { title: "Resolved", tone: "emerald", statuses: ["resolved"] },
];
const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "reopened", label: "Reopened" },
  { value: "forwarding_requested", label: "Forwarding requested" },
  { value: "resolution_submitted", label: "Resolution submitted" },
  { value: "resolution_pending", label: "Resolution pending" },
  { value: "transfer_pending", label: "Transfer pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const avatarColors = [
  "bg-indigo-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-violet-500",
];

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)";

const primaryButton = `inline-flex items-center justify-center gap-1.5 rounded-full bg-(--color-accent) px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

const secondaryButton = `inline-flex items-center justify-center rounded-full border border-(--color-border) px-5 py-2 text-sm font-medium text-(--color-text) transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

const linkButton = `rounded text-sm font-medium text-(--color-accent) transition hover:opacity-80 ${focusRing}`;

const fieldClass =
  "w-full rounded-xl border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm text-(--color-text) outline-none transition placeholder:text-(--color-text-secondary) focus:border-(--color-accent) disabled:opacity-60";

const cardClass =
  "rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-[0_2px_12px_rgba(15,23,42,0.06)]";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDate(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date unavailable";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function avatarColor(name: string) {
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return avatarColors[sum % avatarColors.length];
}

function readLifecycleEvent(event: TicketLifecycleEvent, index: number) {
  const record = event as unknown as Record<string, unknown>;

  const rawType = String(
    record.eventType ??
      record.event_type ??
      record.type ??
      record.action ??
      "activity",
  );

  const heading = String(
    record.title ??
      record.eventTitle ??
      record.event_title ??
      rawType.replaceAll("_", " "),
  );

  const isAssignment = /assign/i.test(`${rawType} ${heading}`);

  const assignedEmployeeName =
    record.toEmployeeName ??
    record.to_employee_name ??
    record.assignedEmployeeName ??
    record.assigned_employee_name;

  const rawDescription =
    record.description ?? record.details ?? record.message;

  const description = isAssignment
    ? `Assigned to ${
        assignedEmployeeName
          ? String(assignedEmployeeName)
          : "Employee name unavailable"
      }`
    : rawDescription;

  const actor =
    record.actorName ??
    record.actor_name ??
    record.performedBy ??
    record.performed_by ??
    record.userName ??
    record.user_name;

  const timestamp =
    record.createdAt ??
    record.created_at ??
    record.eventAt ??
    record.event_at ??
    record.timestamp;

  const parsedTimestamp = timestamp ? new Date(String(timestamp)) : null;

  const dateLabel =
    parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
      ? parsedTimestamp.toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "Time unavailable";

  return {
    key: String(
      record.id ?? record.eventId ?? record.event_id ?? `${rawType}-${index}`,
    ),
    heading,
    description:
      description == null ? "" : String(description).trim(),
    actor: actor == null ? "" : String(actor).trim(),
    dateLabel,
  };
}

/* -------------------------------------------------------------------------- */
/* Small presentational components                                            */
/* -------------------------------------------------------------------------- */

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.5 13.5 3.5 3.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function Avatar({ name }: { name: string }) {
  const label = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      title={name || "Unknown"}
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${avatarColor(name)}`}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  let background = "var(--color-surface-secondary)";
  let color = "var(--color-text-secondary)";

  switch (status) {
    case "open":
    case "assigned":
      background = "var(--color-accent-soft)";
      color = "var(--color-accent-text)";
      break;
    case "in_progress":
    case "forwarding_requested":
      background = "var(--color-warning-bg)";
      color = "var(--color-warning-text)";
      break;
    case "resolution_submitted":
    case "resolved":
      background = "var(--color-success-bg)";
      color = "var(--color-success-text)";
      break;
  }

  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize"
      style={{ backgroundColor: background, color }}
    >
      {formatStatus(status)}
    </span>
  );
}

function ColumnPill({
  title,
  count,
  tone,
  onAdd,
}: {
  title: string;
  count: number;
  tone: Tone;
  onAdd?: () => void;
}) {
  const styles = toneStyles[tone];

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-2 py-1.5 text-white ${styles.bg}`}
    >
      <span
        className={`flex size-6 items-center justify-center rounded-full bg-white text-xs font-semibold ${styles.text}`}
      >
        {count}
      </span>
      <h3 className="flex-1 text-sm font-semibold">{title}</h3>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Create a ticket"
          className="flex size-6 items-center justify-center rounded-full transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
        >
          <PlusIcon />
        </button>
      )}
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold tracking-tight text-(--color-text)">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: React.ReactNode;
}) {
  const isSuccess = tone === "success";

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      className="rounded-xl border border-(--color-border) px-4 py-3 text-sm"
      style={{
        backgroundColor: isSuccess ? "var(--color-success-bg)" : undefined,
        color: isSuccess
          ? "var(--color-success-text)"
          : "var(--color-danger-text)",
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-14 text-center">
      <h3 className="font-semibold text-(--color-text)">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-(--color-text-secondary)">
        {message}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function TicketRow({
  ticket,
  showRequester,
  onClick,
}: {
  ticket: Ticket;
  showRequester: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View ticket ${ticket.ticketCode}: ${ticket.title}`}
      className="flex w-full min-w-0 items-center gap-3 border-b border-(--color-border) px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-white/4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--color-accent)"
    >
      <Avatar name={ticket.requesterName || ""} />

      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold text-(--color-text)"
          title={ticket.title}
        >
          {ticket.title}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-(--color-text-secondary)">
          <span className="font-medium text-(--color-accent)">
            {ticket.ticketCode}
          </span>
          <span>{ticket.departmentName || "Unassigned"}</span>
          {showRequester && (
            <span>{ticket.requesterName || "Requester unavailable"}</span>
          )}
          <span>{formatDate(ticket.createdAt)}</span>
        </p>
      </div>

      <StatusBadge status={ticket.status} />
    </button>
  );
}

function KanbanBoard({
  tickets,
  showRequester,
  onOpen,
  onCreate,
}: {
  tickets: Ticket[];
  showRequester: boolean;
  onOpen: (ticket: Ticket) => void;
  onCreate: () => void;
}) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max items-start gap-5">
        {kanbanColumns.map((column) => {
          const columnTickets = tickets.filter((ticket) =>
            column.statuses.includes(ticket.status),
          );

          return (
            <section
              key={column.title}
              aria-label={`${column.title} tickets`}
              className="w-80 shrink-0 space-y-3"
            >
              <ColumnPill
                title={column.title}
                count={columnTickets.length}
                tone={column.tone}
                onAdd={column.title === "New" ? onCreate : undefined}
              />

              {columnTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => onOpen(ticket)}
                  className={`block w-full p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${cardClass} ${focusRing}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={ticket.status} />
                    <span className="shrink-0 text-[11px] text-(--color-text-secondary)">
                      {formatDate(ticket.createdAt)}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-(--color-text)">
                    {ticket.title}
                  </p>

                  {ticket.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-(--color-text-secondary)">
                      {ticket.description}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar name={ticket.requesterName || ""} />
                      {showRequester && (
                        <span className="truncate text-xs text-(--color-text-secondary)">
                          {ticket.requesterName || "Unavailable"}
                        </span>
                      )}
                    </div>
                    <span className="max-w-32 shrink-0 truncate text-xs text-(--color-text-secondary)">
                      {ticket.departmentName || "Unassigned"}
                    </span>
                  </div>
                </button>
              ))}

              {columnTickets.length === 0 && (
                <p className="rounded-2xl border border-dashed border-(--color-border) px-3 py-8 text-center text-xs text-(--color-text-secondary)">
                  No tickets
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({ events }: { events: TicketLifecycleEvent[] }) {
  return (
    <ol className="relative space-y-5 border-l border-(--color-border) pl-5">
      {events.map((event, index) => {
        const item = readLifecycleEvent(event, index);

        return (
          <li key={item.key} className="relative">
            <span
              className="absolute top-1.5 -left-6.25 size-2 rounded-full bg-(--color-accent)"
              aria-hidden="true"
            />
            <p className="text-sm font-medium capitalize text-(--color-text)">
              {item.heading}
            </p>
            <p className="mt-0.5 text-xs text-(--color-text-secondary)">
              {item.dateLabel}
              {item.actor ? `, by ${item.actor}` : ""}
            </p>
            {item.description && (
              <p className="mt-1.5 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-(--color-text-secondary)">
                {item.description}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// function DetailItem({ label, value }: { label: string; value: string }) {
//   return (
//     <div className="min-w-0">
//       <dt className="text-xs text-(--color-text-secondary)">{label}</dt>
//       <dd className="mt-0.5 break-words text-sm font-medium capitalize text-(--color-text)">
//         {value}
//       </dd>
//     </div>
//   );
// }

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function DashboardPage({
  user,
  onLogout,
}: DashboardPageProps) {
  const [activePage, setActivePage] = useState("overview");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [lifecycleEvents, setLifecycleEvents] = useState<
    TicketLifecycleEvent[]
  >([]);
  const [loadingLifecycle, setLoadingLifecycle] = useState(false);
  const [lifecycleError, setLifecycleError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [ticketView, setTicketView] = useState<"list" | "kanban">("kanban");

  const [assignableEmployees, setAssignableEmployees] = useState<
    AssignableEmployee[]
  >([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [assignmentEmployeeId, setAssignmentEmployeeId] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");

  const canManageAssignments =
    user.role === "master" || user.role === "department_head";

  /* ------------------------------ Data loading ----------------------------- */

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    setTicketError("");

    try {
      const data = await getTickets();
      setTickets(data);
    } catch (error) {
      setTicketError(
        error instanceof Error ? error.message : "Unable to load tickets.",
      );
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  const loadTicketLifecycle = useCallback(async (ticketId: number) => {
    setLoadingLifecycle(true);
    setLifecycleError("");
    setLifecycleEvents([]);

    try {
      const data = await getTicketLifecycle(ticketId);
      setLifecycleEvents(data.events);
    } catch (error) {
      setLifecycleError(
        error instanceof Error
          ? error.message
          : "Unable to load ticket lifecycle.",
      );
    } finally {
      setLoadingLifecycle(false);
    }
  }, []);

  const loadAssignableEmployees = useCallback(async () => {
    if (user.role !== "master" && user.role !== "department_head") return;

    setLoadingEmployees(true);
    setAssignmentError("");

    try {
      const response = await fetch("http://localhost:5000/api/employees/assignable", {
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load employees.");
      }

      const rawEmployees = Array.isArray(data.employees)
        ? data.employees
        : [];

      const normalizedEmployees: AssignableEmployee[] = rawEmployees.map(
        (raw: Record<string, unknown>) => ({
          id: Number(raw.id),
          employeeId: String(raw.employeeId ?? raw.employee_id ?? ""),
          fullName: String(
            raw.fullName ?? raw.full_name ?? raw.name ?? "",
          ),
          role: String(
            raw.role ?? "employee",
          ) as AssignableEmployee["role"],
          departmentId:
            raw.departmentId == null && raw.department_id == null
              ? null
              : Number(raw.departmentId ?? raw.department_id),
          isActive:
            raw.isActive === true ||
            raw.isActive === 1 ||
            raw.isActive === "1" ||
            raw.is_active === true ||
            raw.is_active === 1 ||
            raw.is_active === "1",
        }),
      );

      setAssignableEmployees(
        normalizedEmployees.filter(
          (employee) =>
            Number.isSafeInteger(employee.id) &&
            employee.id > 0 &&
            employee.isActive &&
            employee.role !== "master",
        ),
      );
    } catch (error) {
      setAssignmentError(
        error instanceof Error
          ? error.message
          : "Unable to load employees.",
      );
    } finally {
      setLoadingEmployees(false);
    }
  }, [user.role]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTickets();

    if (user.role === "master" || user.role === "department_head") {
      void loadAssignableEmployees();
    }
  }, [loadTickets, loadAssignableEmployees, user.role]);

  /* ------------------------------ Derived data ----------------------------- */

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const matches = tickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        [
          ticket.ticketCode,
          ticket.title,
          ticket.description,
          ticket.departmentName,
          ticket.requesterName,
        ].some((value) => value?.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "all" || ticket.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    const time = (ticket: Ticket) => {
      const value = new Date(ticket.createdAt).getTime();
      return Number.isNaN(value) ? 0 : value;
    };

    return [...matches].sort((a, b) =>
      sortOrder === "newest" ? time(b) - time(a) : time(a) - time(b),
    );
  }, [tickets, searchQuery, statusFilter, sortOrder]);

  const openCount = tickets.filter(
    (ticket) => ticket.status === "open",
  ).length;

  const inProgressCount = tickets.filter((ticket) =>
    ["assigned", "in_progress", "forwarding_requested"].includes(
      ticket.status,
    ),
  ).length;

  const resolvedCount = tickets.filter(
    (ticket) => ticket.status === "resolved",
  ).length;

  const hasFilters = Boolean(searchQuery.trim()) || statusFilter !== "all";
  const showRequester = user.role !== "employee";

  /* -------------------------------- Actions -------------------------------- */

  function startCreateTicket() {
    setSuccessMessage("");
    setSelectedTicket(null);
    setActivePage("tickets");
    setShowCreateForm(true);
  }

  function openTickets() {
    setShowCreateForm(false);
    setSelectedTicket(null);
    setSuccessMessage("");
    setActivePage("tickets");
  }

  function openTicketDetails(ticket: Ticket) {
    setShowCreateForm(false);
    setSuccessMessage("");
    setAssignmentError("");

    const assignedId = (ticket as TicketWithAssignment).assignedEmployeeId;

    setAssignmentEmployeeId(assignedId ? String(assignedId) : "");
    setSelectedTicket(ticket);
    void loadTicketLifecycle(ticket.id);
    setActivePage("tickets");
  }

  function handleTicketCreated() {
    setShowCreateForm(false);
    setSuccessMessage("Ticket created successfully.");
    setActivePage("tickets");
    void loadTickets();
  }

  async function handleAssignTicket() {
    if (!selectedTicket || !assignmentEmployeeId) {
      setAssignmentError(
        "Choose an employee before assigning this ticket.",
      );
      return;
    }

    setSavingAssignment(true);
    setAssignmentError("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `http://localhost:5000/api/tickets/${selectedTicket.id}/assign`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: Number(assignmentEmployeeId),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to assign this ticket.");
      }

      setSuccessMessage("Ticket assigned successfully.");
      await loadTickets();

      setSelectedTicket((current) => {
        if (!current) return current;

        return {
          ...current,
          assignedEmployeeId: Number(assignmentEmployeeId),
        } as Ticket;
      });
    } catch (error) {
      setAssignmentError(
        error instanceof Error
          ? error.message
          : "Unable to assign this ticket.",
      );
    } finally {
      setSavingAssignment(false);
    }
  }

  /* ------------------------------- Renderers ------------------------------- */

  function renderTicketList(items: Ticket[]) {
    if (loadingTickets) {
      return (
        <div
          className={`flex items-center justify-center gap-3 px-4 py-14 text-sm text-(--color-text-secondary) ${cardClass}`}
        >
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading tickets…
        </div>
      );
    }

    if (ticketError) {
      return (
        <div className={`space-y-3 p-6 ${cardClass}`}>
          <p role="alert" className="text-sm text-(--color-danger-text)">
            {ticketError}
          </p>
          <button
            type="button"
            onClick={() => void loadTickets()}
            className={secondaryButton}
          >
            Try again
          </button>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className={cardClass}>
          {hasFilters ? (
            <EmptyState
              title="No matching tickets"
              message="Try a different search or change the status filter."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                  className={secondaryButton}
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <EmptyState
              title="No tickets yet"
              message="Support requests will show up here once they are created."
              action={
                <button
                  type="button"
                  onClick={startCreateTicket}
                  className={primaryButton}
                >
                  Create a ticket
                </button>
              }
            />
          )}
        </div>
      );
    }

    if (ticketView === "kanban") {
      return (
        <KanbanBoard
          tickets={items}
          showRequester={showRequester}
          onOpen={openTicketDetails}
          onCreate={startCreateTicket}
        />
      );
    }

    return (
      <div className={`overflow-hidden ${cardClass}`}>
        {items.map((ticket) => (
          <TicketRow
            key={ticket.id}
            ticket={ticket}
            showRequester={showRequester}
            onClick={() => openTicketDetails(ticket)}
          />
        ))}
      </div>
    );
  }



function renderTicketDetail(ticket: Ticket) {
  const assignedId = (ticket as TicketWithAssignment).assignedEmployeeId;

  const assignedEmployee = assignableEmployees.find(
    (employee) => employee.id === assignedId,
  );

  const assignedLabel = assignedEmployee
    ? `${assignedEmployee.fullName} (${assignedEmployee.employeeId})`
    : assignedId
      ? assignedId === user.id
        ? "You"
        : `Employee #${assignedId}`
      : "Not assigned";

  const canTransfer =
    user.role === "master" ||
    (user.role === "employee" && assignedId === user.id);

  const canAssign =
    canManageAssignments && ticket.status === "open" && !assignedId;

  const detailRows = [
    {
      label: "Department",
      value: ticket.departmentName || "Unassigned",
      icon: "▦",
    },
    {
      label: "Requester",
      value:
        ticket.requesterName ||
        (user.role === "employee" ? user.name : "Not available"),
      icon: "◉",
    },
    {
      label: "Created",
      value: formatDate(ticket.createdAt),
      icon: "◷",
    },
    {
      label: "Assigned to",
      value: assignedLabel,
      icon: "↗",
    },
  ];

  return (
    <div className="space-y-6">

      {/* Back navigation */}
      <button
        type="button"
        onClick={() => setSelectedTicket(null)}
        className={`${linkButton} inline-flex items-center gap-2`}
      >
        <span aria-hidden="true">←</span>
        Back to tickets
      </button>

      {successMessage && <Notice tone="success">{successMessage}</Notice>}

      {/* Ticket header */}
      <section
        className={`relative overflow-hidden ${cardClass}`}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-violet-500 via-indigo-500 to-sky-500" />

        <div className="flex flex-wrap items-start justify-between gap-5 p-6 sm:p-7">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-(--color-accent-soft) px-2.5 py-1 font-semibold text-(--color-accent-text)">
                {ticket.ticketCode}
              </span>
              <span className="text-(--color-text-secondary)">/</span>
              <span className="text-(--color-text-secondary)">
                Created {formatDate(ticket.createdAt)}
              </span>
            </div>

            <h2 className="mt-4 wrap-break-word text-2xl font-bold tracking-tight text-(--color-text) sm:text-3xl">
              {ticket.title}
            </h2>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={ticket.status} />

              <span className="inline-flex items-center gap-2 rounded-full border border-(--color-border) px-3 py-1 text-xs font-medium text-(--color-text-secondary)">
                <span className="size-1.5 rounded-full bg-(--color-accent)" />
                {ticket.departmentName || "Unassigned department"}
              </span>
            </div>
          </div>

          <div className="hidden size-14 items-center justify-center rounded-2xl bg-(--color-accent-soft) text-2xl text-(--color-accent) sm:flex">
            ◈
          </div>
        </div>
      </section>

      {/* Main layout */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">

        {/* Main content */}
        <div className="min-w-0 space-y-5">

          {/* Description */}
          <section className={`${cardClass} overflow-hidden`}>
            <div className="flex items-center gap-3 border-b border-(--color-border) px-5 py-4">
              <div className="flex size-9 items-center justify-center rounded-xl bg-(--color-accent-soft) text-lg text-(--color-accent)">
                ≡
              </div>
              <div>
                <h3 className="text-sm font-semibold text-(--color-text)">
                  Description
                </h3>
                <p className="mt-0.5 text-xs text-(--color-text-secondary)">
                  Details provided with this support request
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <p className="whitespace-pre-wrap wrap-break-word text-sm leading-7 text-(--color-text-secondary)">
                {ticket.description || "No description provided."}
              </p>
            </div>
          </section>

          {/* Activity */}
          <section className={`${cardClass} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-border) px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-(--color-accent-soft) text-lg text-(--color-accent)">
                  ◷
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-(--color-text)">
                    Activity timeline
                  </h3>
                  <p className="mt-0.5 text-xs text-(--color-text-secondary)">
                    Complete history of this ticket
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void loadTicketLifecycle(ticket.id)}
                disabled={loadingLifecycle}
                className={`${linkButton} disabled:opacity-50`}
              >
                {loadingLifecycle ? "Refreshing…" : "↻ Refresh"}
              </button>
            </div>

            <div className="p-5 sm:p-6">
              {loadingLifecycle ? (
                <div className="flex items-center gap-3 py-8 text-sm text-(--color-text-secondary)">
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Loading activity…
                </div>
              ) : lifecycleError ? (
                <div role="alert" className="space-y-3 py-3">
                  <p className="text-sm text-(--color-danger-text)">
                    {lifecycleError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadTicketLifecycle(ticket.id)}
                    className={secondaryButton}
                  >
                    Try again
                  </button>
                </div>
              ) : lifecycleEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-(--color-border) px-4 py-10 text-center">
                  <p className="text-sm font-medium text-(--color-text)">
                    No activity yet
                  </p>
                  <p className="mt-1 text-xs text-(--color-text-secondary)">
                    Ticket updates will appear here.
                  </p>
                </div>
              ) : (
                <Timeline events={lifecycleEvents} />
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="min-w-0 space-y-5">

          {/* Details card */}
          <section className={`${cardClass} overflow-hidden`}>
            <div className="border-b border-(--color-border) px-5 py-4">
              <h3 className="text-sm font-semibold text-(--color-text)">
                Ticket details
              </h3>
              <p className="mt-0.5 text-xs text-(--color-text-secondary)">
                Request information
              </p>
            </div>

            <div className="divide-y divide-(--color-border) px-5">
              {detailRows.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 py-4"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--color-bg) text-sm text-(--color-accent)">
                    {item.icon}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-(--color-text-secondary)">
                      {item.label}
                    </p>
                    <p className="mt-1 wrap-break-word text-sm font-semibold text-(--color-text)">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-(--color-border) px-5 py-4">
              <p className="mb-2 text-xs text-(--color-text-secondary)">
                Current status
              </p>
              <StatusBadge status={ticket.status} />
            </div>
          </section>

         
          {canAssign && (
            <section className={`${cardClass} overflow-hidden`}>
              <div className="border-b border-(--color-border) px-5 py-4">
                <h3 className="text-sm font-semibold text-(--color-text)">
                  Assign ticket
                </h3>
                <p className="mt-0.5 text-xs text-(--color-text-secondary)">
                  Select an employee to handle this request.
                </p>
              </div>

              <div className="space-y-3 p-5">
                <label
                  htmlFor="assign-employee"
                  className="block text-xs font-medium text-(--color-text-secondary)"
                >
                  Employee
                </label>

                <select
                  id="assign-employee"
                  value={assignmentEmployeeId}
                  onChange={(event) => {
                    setAssignmentEmployeeId(event.target.value);
                    setAssignmentError("");
                  }}
                  disabled={loadingEmployees || savingAssignment}
                  className={fieldClass}
                >
                  <option value="">
                    {loadingEmployees
                      ? "Loading employees…"
                      : "Select an employee"}
                  </option>

                  {assignableEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName} ({employee.employeeId})
                    </option>
                  ))}
                </select>

                {assignmentError && (
                  <p role="alert" className="text-xs text-(--color-danger-text)">
                    {assignmentError}
                  </p>
                )}

                {!loadingEmployees && assignableEmployees.length === 0 && (
                  <p className="text-xs text-(--color-text-secondary)">
                    No active employees are available.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void handleAssignTicket()}
                  disabled={
                    !assignmentEmployeeId ||
                    savingAssignment ||
                    loadingEmployees
                  }
                  className={`${primaryButton} w-full`}
                >
                  {savingAssignment ? "Assigning…" : "Assign ticket"}
                </button>
              </div>
            </section>
          )}

          {/* Transfer action */}
          {canTransfer && (
            <section className={`${cardClass} overflow-hidden`}>
              <div className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-(--color-accent-soft) text-lg text-(--color-accent)">
                    ⇄
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-(--color-text)">
                      Ticket actions
                    </h3>
                    <p className="mt-0.5 text-xs text-(--color-text-secondary)">
                      Move this ticket to another department
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActivePage("transfers")}
                  className={`${primaryButton} w-full`}
                >
                  ⇄ Transfer ticket
                </button>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}


  function renderTicketsPage() {
    if (selectedTicket) {
      return renderTicketDetail(selectedTicket);
    }

    if (showCreateForm) {
      return (
        <CreateTicketForm
          onSuccess={handleTicketCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      );
    }

    const title =
      user.role === "employee"
        ? "My tickets"
        : user.role === "department_head"
          ? "Department tickets"
          : "All tickets";

    return (
      <div className="space-y-5">
        <PageHeader
          title={title}
          subtitle="Search, filter and track support requests."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative block">
                <span className="sr-only">Search tickets</span>
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-(--color-text-secondary)">
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search tickets"
                  className="w-48 rounded-full border border-(--color-border) bg-(--color-surface) py-2 pr-4 pl-9 text-sm text-(--color-text) outline-none transition placeholder:text-(--color-text-secondary) focus:border-(--color-accent) sm:w-60"
                />
              </label>

              <button
                type="button"
                onClick={startCreateTicket}
                className={primaryButton}
              >
                <PlusIcon />
                New ticket
              </button>
            </div>
          }
        />

        {successMessage && <Notice tone="success">{successMessage}</Notice>}

        {/* Tabs and controls */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-(--color-border)">
          <div role="tablist" aria-label="Ticket view" className="flex gap-6">
            {(
              [
                { id: "kanban", label: "Board" },
                { id: "list", label: "List" },
              ] as const
            ).map((tab) => {
              const active = ticketView === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTicketView(tab.id)}
                  className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition ${focusRing} ${
                    active
                      ? "border-(--color-accent) text-(--color-accent)"
                      : "border-transparent text-(--color-text-secondary) hover:text-(--color-text)"
                  }`}
                >
                  {tab.label}
                  {active && (
                    <span className="rounded-full border border-(--color-accent) px-2 py-px text-[11px] font-semibold">
                      {loadingTickets ? "…" : filteredTickets.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 pb-2.5">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              className="rounded-lg border border-(--color-border) bg-(--color-surface) px-2.5 py-1.5 text-xs text-(--color-text) outline-none focus:border-(--color-accent)"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-xs font-medium text-(--color-text)">
              Sort by
              <select
                value={sortOrder}
                onChange={(event) =>
                  setSortOrder(event.target.value as SortOrder)
                }
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-2.5 py-1.5 text-xs font-normal text-(--color-text) outline-none focus:border-(--color-accent)"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => void loadTickets()}
              disabled={loadingTickets}
              className={`${linkButton} text-xs disabled:opacity-50`}
            >
              Refresh
            </button>
          </div>
        </div>

        {renderTicketList(filteredTickets)}
      </div>
    );
  }

  function renderOverviewPage() {
    const stats: { label: string; value: number; tone: Tone }[] = [
      { label: "All tickets", value: tickets.length, tone: "indigo" },
      { label: "Open", value: openCount, tone: "sky" },
      { label: "In progress", value: inProgressCount, tone: "amber" },
      { label: "Resolved", value: resolvedCount, tone: "emerald" },
    ];

    const recentTickets = tickets.slice(0, 5);

    return (
      <div className="space-y-8">
        <PageHeader
          title={`Welcome back, ${user.name}`}
          subtitle="Here is where your support tickets stand."
          action={
            <button
              type="button"
              onClick={startCreateTicket}
              className={primaryButton}
            >
              <PlusIcon />
              New ticket
            </button>
          }
        />

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className={`p-4 sm:p-5 ${cardClass}`}>
              <dt>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white ${toneStyles[stat.tone].bg}`}
                >
                  {stat.label}
                </span>
              </dt>
              <dd className="mt-3 text-3xl font-semibold tracking-tight text-(--color-text)">
                {loadingTickets ? "—" : stat.value}
              </dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="recent-tickets-heading" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3
              id="recent-tickets-heading"
              className="text-sm font-semibold text-(--color-text)"
            >
              Recent tickets
            </h3>
            {tickets.length > 0 && (
              <button
                type="button"
                onClick={openTickets}
                className={linkButton}
              >
                View all
              </button>
            )}
          </div>

          {loadingTickets ? (
            <p className="py-6 text-sm text-(--color-text-secondary)">
              Loading recent tickets…
            </p>
          ) : ticketError ? (
            <div className="space-y-2 py-2">
              <p role="alert" className="text-sm text-(--color-danger-text)">
                {ticketError}
              </p>
              <button
                type="button"
                onClick={() => void loadTickets()}
                className={linkButton}
              >
                Try again
              </button>
            </div>
          ) : recentTickets.length === 0 ? (
            <div className={cardClass}>
              <EmptyState
                title="No tickets yet"
                message="Create your first ticket to get help from your team."
                action={
                  <button
                    type="button"
                    onClick={startCreateTicket}
                    className={primaryButton}
                  >
                    Create a ticket
                  </button>
                }
              />
            </div>
          ) : (
            <div className={`overflow-hidden ${cardClass}`}>
              {recentTickets.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  showRequester={showRequester}
                  onClick={() => openTicketDetails(ticket)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  function renderContent() {
    switch (activePage) {
      case "tickets":
        return renderTicketsPage();

      case "overview":
        return renderOverviewPage();

      case "transfers":
        return <TicketTransfersPage user={user} />;

      case "employees":
        return <EmployeesPage />;

      case "departments":
        return <DepartmentsPage />;

      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-(--color-bg) text-(--color-text) md:flex">
      <Sidebar
        role={user.role}
        activePage={activePage}
        onNavigate={(page) => {
          setActivePage(page);
          setShowCreateForm(false);
          setSelectedTicket(null);
          setSuccessMessage("");
        }}
        onLogout={onLogout}
      />

      <div className="min-w-0 flex-1">
        <Topbar user={user} title={pageTitles[activePage] ?? "Overview"}  />

        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 xl:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}