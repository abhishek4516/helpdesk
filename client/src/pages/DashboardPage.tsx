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
  assignedEmployeeName?: string | null;
  requesterUserId?: number;
  requesterDepartmentName?: string | null;
};

interface TicketComment {
  id: number;
  comment: string;
  createdAt: string;
  userId: number;
  userName: string;
  userRole: string;
}

interface TicketResolution {
  id: number;
  resolutionComment: string;
  status: string;
  createdAt: string;
  submittedByName: string;
}


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

const toneStyles: Record<Tone, { bg: string; text: string; soft: string }> = {
  indigo: { bg: "bg-indigo-600", text: "text-indigo-600", soft: "bg-indigo-500/10 text-indigo-500" },
  sky: { bg: "bg-sky-500", text: "text-sky-600", soft: "bg-sky-500/10 text-sky-500" },
  amber: { bg: "bg-amber-500", text: "text-amber-600", soft: "bg-amber-500/10 text-amber-500" },
  emerald: { bg: "bg-emerald-500", text: "text-emerald-600", soft: "bg-emerald-500/10 text-emerald-500" },
  slate: { bg: "bg-slate-500", text: "text-slate-600", soft: "bg-slate-500/10 text-slate-500" },
};


const kanbanColumns: { title: string; tone: Tone; statuses: string[] }[] = [
  {
    title: "New",
    tone: "indigo",
    statuses: ["open"],
  },
  {
    title: "Open",
    tone: "sky",
    statuses: [
      "assigned",
      "in_progress",
      "reopened",
      "forwarding_requested",
      "transfer_pending",
      "approved",
      "rejected",
    ],
  },
  {
    title: "Resolved",
    tone: "amber",
    statuses: [
      "pending_approval",
      "resolution_submitted",
      "resolution_pending",
      "resolved",
    ],
  },
  {
    title: "Closed",
    tone: "emerald",
    statuses: ["closed"],
  },
];

const statusOptions = [
  { value: "all", label: "All tickets" },
  { value: "new", label: "New" },
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
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

const primaryButton = `inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-(--color-accent) px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

const secondaryButton = `inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-(--color-border) bg-(--color-surface) px-5 text-sm font-medium text-(--color-text) transition hover:bg-(--color-accent-soft) disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

const linkButton = `rounded text-sm font-medium text-(--color-accent) transition hover:opacity-80 ${focusRing}`;

// text-base on mobile prevents iOS zoom-on-focus
const fieldClass =
  "h-10 w-full rounded-xl border border-(--color-border) bg-(--color-surface) px-3 text-base text-(--color-text) outline-none transition placeholder:text-(--color-text-secondary) focus:border-(--color-accent) disabled:opacity-60 sm:text-sm";

const cardClass =
  "rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-[0_2px_12px_rgba(15,23,42,0.06)]";

const chipClass =
  "flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--color-accent-soft) text-(--color-accent)";

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

  const rawDescription = record.description ?? record.details ?? record.message;

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
    description: description == null ? "" : String(description).trim(),
    actor: actor == null ? "" : String(actor).trim(),
    dateLabel,
  };
}

/* -------------------------------------------------------------------------- */
/* Small presentational components                                            */
/* -------------------------------------------------------------------------- */

const iconPaths = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  ticket: <><path d="M3 9a2 2 0 0 0 0 6v2a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-2a2 2 0 0 1 0-6V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1Z" /><path d="M14 6v12" strokeDasharray="2 3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  trend: <path d="m4 17 5-5 4 4 7-8M15 8h5v5" />,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></>,
  building: <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 10h5a1 1 0 0 1 1 1v10M3 21h18M8 8h2M8 12h2M8 16h2" />,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  back: <path d="M19 12H5m6-6-6 6 6 6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  transfer: <path d="M7 7h13l-4-4M17 17H4l4 4" />,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  text: <path d="M4 6h16M4 12h16M4 18h10" />,
};

function Icon({
  name,
  className = "size-5",
}: {
  name: keyof typeof iconPaths;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

function SearchIcon() {
  return <Icon name="search" className="size-4" />;
}

function PlusIcon() {
  return <Icon name="plus" className="size-4" />;
}

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const label = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      title={name || "Unknown"}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${large ? "size-9 text-xs" : "size-7 text-[11px]"} ${avatarColor(name)}`}
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
    background = "var(--color-accent-soft)";
    color = "var(--color-accent-text)";
    break;

  case "assigned":
  case "in_progress":
  case "forwarding_requested":
  case "transfer_pending":
    background = "var(--color-warning-bg)";
    color = "var(--color-warning-text)";
    break;

  case "pending_approval":
  case "resolution_submitted":
  case "resolution_pending":
  case "resolved":
    background = "var(--color-warning-bg)";
    color = "var(--color-warning-text)";
    break;

  case "closed":
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

function ColumnHeader({
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
        <h2 className="truncate text-2xl font-semibold tracking-tight text-(--color-text)">
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
      className="rounded-lg border border-(--color-border) px-4 py-2.5 text-sm"
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
    <div className="px-4 py-12 text-center">
      <h3 className="text-sm font-medium text-(--color-text)">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-(--color-text-secondary)">
        {message}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof iconPaths;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-(--color-border) px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className={chipClass}>
            <Icon name={icon} className="size-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-(--color-text)">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-(--color-text-secondary)">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action}
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
      className="flex w-full min-w-0 items-center gap-3 border-b border-(--color-border) px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-(--color-accent-soft) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--color-accent)"
    >
      <Avatar name={ticket.requesterName || ""} large />

      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold text-(--color-text)"
          title={ticket.title}
        >
          {ticket.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-(--color-text-secondary)">
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
      <span className="hidden text-(--color-text-secondary) sm:block">
        <Icon name="chevron" className="size-4" />
      </span>
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
    <div className="w-full overflow-x-auto pb-4">
  <div className="grid w-full min-w-[900px] grid-cols-4 items-start gap-4">
        {kanbanColumns.map((column) => {
          const columnTickets = tickets.filter((ticket) =>
            column.statuses.includes(ticket.status),
          );

          return (
            <section
              key={column.title}
              aria-label={`${column.title} tickets`}
              className="min-w-0 space-y-3"
            >
              <ColumnHeader
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
    <ol className="relative space-y-3 border-l border-(--color-border) pl-4">
      {events.map((event, index) => {
        const item = readLifecycleEvent(event, index);

        return (
          <li key={item.key} className="relative">
            <span
              className="absolute top-1.5 -left-6.25 size-2 rounded-full bg-(--color-accent)"
              aria-hidden="true"
            />
            <p className="text-[13px] font-semibold capitalize text-(--color-text)">
              {item.heading}
            </p>
            <p className="mt-0.5 text-xs text-(--color-text-secondary)">
              {item.dateLabel}
              {item.actor ? `, by ${item.actor}` : ""}
            </p>
            {item.description && (
              <p className="mt-1 whitespace-pre-wrap wrap-break-word text-xs leading-5 text-(--color-text-secondary)">
                {item.description}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function DetailRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: keyof typeof iconPaths;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-(--color-bg) text-(--color-accent)">
        <Icon name={icon} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-(--color-text-secondary)">{label}</dt>
        <dd className="mt-0.5 text-sm font-semibold wrap-break-word text-(--color-text)">
          {children}
        </dd>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function DashboardPage({ user, onLogout }: DashboardPageProps) {
  const [activePage, setActivePage] = useState("overview");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [transferTicketId, setTransferTicketId] = useState<number | null>(null);
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
const [ticketComments, setTicketComments] = useState<TicketComment[]>([]);
const [pendingResolution, setPendingResolution] =
  useState<TicketResolution | null>(null);

const [commentDraft, setCommentDraft] = useState("");
const [resolutionDraft, setResolutionDraft] = useState("");
const [reviewDraft, setReviewDraft] = useState("");

const [loadingWorkflow, setLoadingWorkflow] = useState(false);
const [savingWorkflow, setSavingWorkflow] = useState(false);
const [workflowError, setWorkflowError] = useState("");
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
async function loadTicketWorkflow(ticketId: number) {
  setLoadingWorkflow(true);
  setWorkflowError("");

  try {
    const [commentsResponse, resolutionResponse] = await Promise.all([
      fetch(`http://localhost:5000/api/tickets/${ticketId}/comments`, {
        credentials: "include",
      }),
      fetch(`http://localhost:5000/api/tickets/${ticketId}/resolution`, {
        credentials: "include",
      }),
    ]);

    const commentsData = await commentsResponse.json();
    const resolutionData = await resolutionResponse.json();

    if (!commentsResponse.ok || !commentsData.success) {
      throw new Error(commentsData.message || "Unable to load comments.");
    }

    if (!resolutionResponse.ok || !resolutionData.success) {
      throw new Error(
        resolutionData.message || "Unable to load resolution.",
      );
    }

    setTicketComments(commentsData.comments || []);
    setPendingResolution(resolutionData.resolution || null);
  } catch (error) {
    setWorkflowError(
      error instanceof Error ? error.message : "Unable to load ticket activity.",
    );
  } finally {
    setLoadingWorkflow(false);
  }
}
  const loadAssignableEmployees = useCallback(async () => {
    if (user.role !== "master" && user.role !== "department_head") return;

    setLoadingEmployees(true);
    setAssignmentError("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/employees/assignable",
        {
          credentials: "include",
        },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load employees.");
      }

      const rawEmployees = Array.isArray(data.employees) ? data.employees : [];

      const normalizedEmployees: AssignableEmployee[] = rawEmployees.map(
        (raw: Record<string, unknown>) => ({
          id: Number(raw.id),
          employeeId: String(raw.employeeId ?? raw.employee_id ?? ""),
          fullName: String(raw.fullName ?? raw.full_name ?? raw.name ?? ""),
          role: String(raw.role ?? "employee") as AssignableEmployee["role"],
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
        error instanceof Error ? error.message : "Unable to load employees.",
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

    const newStatuses = ["open"];

    const openStatuses = [
      "assigned",
      "in_progress",
      "reopened",
      "forwarding_requested",
      "transfer_pending",
      "approved",
      "rejected",
    ];

    const completedStatuses = [
      "pending_approval",
      "resolution_submitted",
      "resolution_pending",
      "resolved",
      "closed",
    ];

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "new" && newStatuses.includes(ticket.status)) ||
      (statusFilter === "open" && openStatuses.includes(ticket.status)) ||
      (statusFilter === "completed" &&
        completedStatuses.includes(ticket.status));

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


  const openCount = tickets.filter((ticket) => ticket.status === "open").length;

  const inProgressCount = tickets.filter((ticket) =>
    ["assigned", "in_progress", "forwarding_requested"].includes(ticket.status),
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
    setWorkflowError("");
    setTicketComments([]);
    setPendingResolution(null);

    const assignedId = (ticket as TicketWithAssignment).assignedEmployeeId;

    setAssignmentEmployeeId(assignedId ? String(assignedId) : "");
    setSelectedTicket(ticket);
    void loadTicketLifecycle(ticket.id);
    void loadTicketWorkflow(ticket.id);
setCommentDraft("");
setResolutionDraft("");
setReviewDraft("");
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
      setAssignmentError("Choose an employee before assigning this ticket.");
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
async function handleWorkflowAction(
  endpoint: string,
  method: "POST" | "PATCH",
  body: Record<string, unknown>,
  successText: string,
) {
  if (!selectedTicket) return;

  setSavingWorkflow(true);
  setWorkflowError("");
  setSuccessMessage("");

  try {
    const response = await fetch(
      `http://localhost:5000/api/tickets/${selectedTicket.id}${endpoint}`,
      {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to update this ticket.");
    }

    setSuccessMessage(successText);

    if (endpoint === "/comments") {
      setCommentDraft("");
    }

    if (endpoint === "/resolution") {
      setResolutionDraft("");
      setSelectedTicket((current) =>
        current ? { ...current, status: "resolution_pending" } : current,
      );
    }

    if (endpoint.includes("/review")) {
      const nextStatus = body.decision === "approved" ? "closed" : "open";

      setSelectedTicket((current) =>
        current
          ? {
              ...current,
              status: nextStatus,
              assignedEmployeeId:
                body.decision === "rejected"
                  ? null
                  : (current as TicketWithAssignment).assignedEmployeeId,
            }
          : current,
      );

      setReviewDraft("");
    }

    await Promise.all([
      loadTicketWorkflow(selectedTicket.id),
      loadTicketLifecycle(selectedTicket.id),
      loadTickets(),
    ]);
  } catch (error) {
    setWorkflowError(
      error instanceof Error ? error.message : "Unable to update this ticket.",
    );
  } finally {
    setSavingWorkflow(false);
  }
}
  /* ------------------------------- Renderers ------------------------------- */

  function renderTicketList(items: Ticket[]) {
    if (loadingTickets) {
      return (
        <div
          className={`flex items-center justify-center gap-3 px-4 py-12 text-sm text-(--color-text-secondary) ${cardClass}`}
        >
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading tickets…
        </div>
      );
    }

    if (ticketError) {
      return (
        <div className={`space-y-3 p-5 ${cardClass}`}>
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

    const assignedName = (ticket as TicketWithAssignment).assignedEmployeeName;

    const assignedLabel = assignedName
      ? assignedName
      : assignedEmployee
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
    const workflowTicket = ticket as TicketWithAssignment;
    const isAssignedEmployee =
      user.role === "employee" && assignedId === user.id;
    const isRequester = workflowTicket.requesterUserId === user.id;
    const canComment = ![
      "closed",
      "transfer_pending",
      "resolution_pending",
    ].includes(ticket.status);
    const canSubmitResolution =
      isAssignedEmployee &&
      ["assigned", "in_progress"].includes(ticket.status);
    const canReviewResolution =
      isRequester &&
      ticket.status === "resolution_pending" &&
      pendingResolution?.status === "pending";
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSelectedTicket(null)}
          className={`${linkButton} inline-flex items-center gap-2`}
        >
          <Icon name="back" className="size-4" />
          Back to tickets
        </button>

        {successMessage && <Notice tone="success">{successMessage}</Notice>}

        {/* Ticket header */}
        <section className={`relative overflow-hidden ${cardClass}`}>
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-violet-500 via-indigo-500 to-sky-500" />

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-(--color-accent-soft) px-2.5 py-1 font-semibold text-(--color-accent-text)">
                  {ticket.ticketCode}
                </span>
                <span className="text-(--color-text-secondary)">
                  Created {formatDate(ticket.createdAt)}
                </span>
              </div>

              <h2 className="mt-2 text-lg font-bold tracking-tight wrap-break-word text-(--color-text) sm:text-2xl">
                {ticket.title}
              </h2>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={ticket.status} />
                <span className="inline-flex items-center gap-2 rounded-full border border-(--color-border) px-3 py-1 text-xs font-medium text-(--color-text-secondary)">
                  <span className="size-1.5 rounded-full bg-(--color-accent)" />
                  {ticket.departmentName || "Unassigned department"}
                </span>
              </div>
            </div>

            {canAssign ? (
              <div className="w-full max-w-md rounded-xl border border-(--color-accent)/30 bg-(--color-accent-soft)/40 p-3 sm:w-auto sm:min-w-[340px]">
                <label
                  htmlFor="assign-employee"
                  className="mb-2 block text-xs font-semibold text-(--color-text)"
                >
                  Assign ticket
                </label>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    id="assign-employee"
                    value={assignmentEmployeeId}
                    onChange={(event) => {
                      setAssignmentEmployeeId(event.target.value);
                      setAssignmentError("");
                    }}
                    disabled={loadingEmployees || savingAssignment}
                    className={`${fieldClass} min-w-0 flex-1`}
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

                  <button
                    type="button"
                    onClick={() => void handleAssignTicket()}
                    disabled={
                      !assignmentEmployeeId ||
                      savingAssignment ||
                      loadingEmployees
                    }
                    className={`${primaryButton} shrink-0`}
                  >
                    {savingAssignment ? "Assigning…" : "Assign"}
                  </button>
                </div>

                {assignmentError && (
                  <p
                    role="alert"
                    className="mt-2 text-xs text-(--color-danger-text)"
                  >
                    {assignmentError}
                  </p>
                )}

                {!loadingEmployees && assignableEmployees.length === 0 && (
                  <p className="mt-2 text-xs text-(--color-text-secondary)">
                    No active employees are available.
                  </p>
                )}
              </div>
            ) : (
              <span className="hidden size-11 items-center justify-center rounded-xl bg-(--color-accent-soft) text-(--color-accent) sm:flex">
                <Icon name="ticket" className="size-7" />
              </span>
            )}
          </div>
        </section>

        <div className="grid items-start gap-3 xl:h-[calc(100vh-220px)] xl:min-h-0 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)_280px] xl:overflow-hidden">
          {/* Main content */}
          <div className="contents">
            <section className={`min-w-0 ${cardClass} xl:min-h-0 xl:overflow-y-auto`}>
              <CardHeader
                icon="activity"
                title="Activity timeline"
                subtitle="Complete history of this ticket"
                action={
                  <button
                    type="button"
                    onClick={() => void loadTicketLifecycle(ticket.id)}
                    disabled={loadingLifecycle}
                    className={`${linkButton} shrink-0 disabled:opacity-50`}
                  >
                    {loadingLifecycle ? "Refreshing…" : "Refresh"}
                  </button>
                }
              />

              <div className="p-3 sm:p-4">
                {loadingLifecycle ? (
                  <div className="flex items-center gap-3 py-8 text-sm text-(--color-text-secondary)">
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Loading activity…
                  </div>
                ) : lifecycleError ? (
                  <div role="alert" className="space-y-3 py-2">
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
            <section className={`min-w-0 ${cardClass} xl:min-h-0 xl:overflow-y-auto`}>
              <CardHeader
                icon="text"
                title="Comments & resolution"
                subtitle="Discuss the work and confirm the outcome"
                action={
                  <button
                    type="button"
                    onClick={() => void loadTicketWorkflow(ticket.id)}
                    disabled={loadingWorkflow}
                    className={`${linkButton} shrink-0 disabled:opacity-50`}
                  >
                    {loadingWorkflow ? "Refreshing…" : "Refresh"}
                  </button>
                }
              />

              <div className="space-y-3 p-3 sm:p-4">
                {workflowError && <Notice tone="error">{workflowError}</Notice>}

                {loadingWorkflow ? (
                  <div className="flex items-center gap-3 py-5 text-sm text-(--color-text-secondary)">
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Loading comments and resolution…
                  </div>
                ) : ticketComments.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-(--color-border) px-4 py-6 text-center text-sm text-(--color-text-secondary)">
                    No comments yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ticketComments.map((comment) => (
                      <article key={comment.id} className="rounded-xl bg-(--color-surface-secondary) p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Avatar name={comment.userName || "User"} />
                            <span className="text-sm font-semibold text-(--color-text)">
                              {comment.userName || "User"}
                            </span>
                            <span className="text-xs capitalize text-(--color-text-secondary)">
                              {String(comment.userRole || "").replaceAll("_", " ")}
                            </span>
                          </div>
                          <time className="text-xs text-(--color-text-secondary)">
                            {new Date(comment.createdAt).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-(--color-text-secondary)">
                          {comment.comment}
                        </p>
                      </article>
                    ))}
                  </div>
                )}

                {canComment && (
                  <form
                    className="space-y-2 border-t border-(--color-border) pt-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (commentDraft.trim()) {
                        void handleWorkflowAction(
                          "/comments",
                          "POST",
                          { comment: commentDraft.trim() },
                          "Comment added.",
                        );
                      }
                    }}
                  >
                    <label htmlFor="ticket-comment" className="block text-sm font-semibold text-(--color-text)">
                      Add a comment
                    </label>
                    <textarea
                      id="ticket-comment"
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      rows={2}
                      maxLength={10000}
                      placeholder="Write a work update or comment…"
                      disabled={savingWorkflow}
                      className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) p-3 text-sm text-(--color-text) outline-none focus:border-(--color-accent) disabled:opacity-60"
                    />
                    <div className="flex justify-end">
                      <button type="submit" disabled={!commentDraft.trim() || savingWorkflow} className={primaryButton}>
                        {savingWorkflow ? "Sending…" : "Add comment"}
                      </button>
                    </div>
                  </form>
                )}

                {pendingResolution && (
                  <div className="space-y-3 rounded-xl border border-(--color-border) p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-(--color-text)">Submitted resolution</h4>
                      <StatusBadge status={pendingResolution.status} />
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-(--color-text-secondary)">
                      {pendingResolution.resolutionComment}
                    </p>
                    <p className="text-xs text-(--color-text-secondary)">
                      Submitted by {pendingResolution.submittedByName || "Assigned employee"} · {new Date(pendingResolution.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                )}

                {canSubmitResolution && (
                  <form
                    className="space-y-3 border-t border-(--color-border) pt-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (resolutionDraft.trim().length >= 5) {
                        void handleWorkflowAction(
                          "/resolution",
                          "POST",
                          { resolutionComment: resolutionDraft.trim() },
                          "Resolution submitted to the requester.",
                        );
                      }
                    }}
                  >
                    <label htmlFor="ticket-resolution" className="block text-sm font-semibold text-(--color-text)">
                      Submit resolution
                    </label>
                    <textarea
                      id="ticket-resolution"
                      value={resolutionDraft}
                      onChange={(event) => setResolutionDraft(event.target.value)}
                      rows={2}
                      minLength={5}
                      maxLength={10000}
                      placeholder="Describe the work completed and how the issue was resolved…"
                      disabled={savingWorkflow}
                      className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) p-3 text-sm text-(--color-text) outline-none focus:border-(--color-accent) disabled:opacity-60"
                    />
                    <div className="flex justify-end">
                      <button type="submit" disabled={resolutionDraft.trim().length < 5 || savingWorkflow} className={primaryButton}>
                        {savingWorkflow ? "Submitting…" : "Submit for approval"}
                      </button>
                    </div>
                  </form>
                )}

                {canReviewResolution && pendingResolution && (
                  <div className="space-y-3 border-t border-(--color-border) pt-5">
                    <div>
                      <h4 className="text-sm font-semibold text-(--color-text)">Review resolution</h4>
                      <p className="mt-1 text-xs text-(--color-text-secondary)">
                        Approve to close the ticket, or reject to return it to the department head for reassignment.
                      </p>
                    </div>
                    <label htmlFor="resolution-review" className="block text-xs font-medium text-(--color-text-secondary)">
                      Review note (optional)
                    </label>
                    <textarea
                      id="resolution-review"
                      value={reviewDraft}
                      onChange={(event) => setReviewDraft(event.target.value)}
                      rows={2}
                      maxLength={10000}
                      placeholder="Add a note for the employee or department head…"
                      disabled={savingWorkflow}
                      className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) p-3 text-sm text-(--color-text) outline-none focus:border-(--color-accent) disabled:opacity-60"
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        disabled={savingWorkflow}
                        onClick={() => void handleWorkflowAction(
                          `/resolution/${pendingResolution.id}/review`,
                          "PATCH",
                          { decision: "rejected", reviewComment: reviewDraft.trim() || null },
                          "Resolution rejected. Ticket returned to the department head.",
                        )}
                        className={secondaryButton}
                      >
                        {savingWorkflow ? "Saving…" : "Reject resolution"}
                      </button>
                      <button
                        type="button"
                        disabled={savingWorkflow}
                        onClick={() => void handleWorkflowAction(
                          `/resolution/${pendingResolution.id}/review`,
                          "PATCH",
                          { decision: "approved", reviewComment: reviewDraft.trim() || null },
                          "Resolution approved. Ticket closed.",
                        )}
                        className={primaryButton}
                      >
                        {savingWorkflow ? "Saving…" : "Approve & close"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>


          </div>

          {/* Sidebar */}
          <aside className="min-w-0 space-y-3 xl:min-h-0 xl:overflow-y-auto">
            <section className={`overflow-hidden ${cardClass}`}>
              <CardHeader title="Ticket details" subtitle="Request information" />
              <dl className="divide-y divide-(--color-border) px-4">
                <DetailRow label="Department" icon="building">
                  {ticket.departmentName || "Unassigned"}
                </DetailRow>
                <DetailRow label="Requester" icon="user">
                  {ticket.requesterName ||
                    (user.role === "employee" ? user.name : "Not available")}
                </DetailRow>
                <DetailRow label="Requester department" icon="building">
                  {(ticket as TicketWithAssignment).requesterDepartmentName ||
                    "Not available"}
                </DetailRow>
                <DetailRow label="Created" icon="calendar">
                  {formatDate(ticket.createdAt)}
                </DetailRow>
                <DetailRow label="Assigned to" icon="arrow">
                  {assignedLabel}
                </DetailRow>
              </dl>
              <div className="flex items-center justify-between gap-3 border-t border-(--color-border) px-4 py-3">
                <span className="text-xs text-(--color-text-secondary)">
                  Current status
                </span>
                <StatusBadge status={ticket.status} />
              </div>
            </section>

                        <details className={`${cardClass} group overflow-hidden`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={chipClass}><Icon name="text" className="size-4" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-(--color-text)">Description</span>
                    <span className="mt-0.5 block text-xs text-(--color-text-secondary)">Details provided with this support request</span>
                  </span>
                </div>
                <Icon name="chevron" className="size-4 shrink-0 rotate-90 text-(--color-text-secondary) transition-transform group-open:-rotate-90" />
              </summary>
              <div className="border-t border-(--color-border) px-4 py-3">
                <p className="whitespace-pre-wrap wrap-break-word text-xs leading-5 text-(--color-text-secondary)">
                  {ticket.description || "No description provided."}
                </p>
              </div>
            </details>

            {canTransfer && (
              <section className={`overflow-hidden ${cardClass}`}>
                <div className="space-y-3 p-4">
                  <div className="flex items-center gap-3">
                    <span className={chipClass}>
                      <Icon name="transfer" className="size-[18px]" />
                    </span>
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
                    onClick={() => {
                      setTransferTicketId(ticket.id);
                      setActivePage("transfers");
                    }}
                    className={`${primaryButton} w-full`}
                  >
                    Transfer ticket
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
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <label className="relative block min-w-0 flex-1 sm:w-60 sm:flex-none">
                <span className="sr-only">Search tickets</span>
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--color-text-secondary)">
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Filter tickets"
                  className="h-10 w-full rounded-xl border border-(--color-border) bg-(--color-surface) pr-3 pl-9 text-base text-(--color-text) outline-none transition placeholder:text-(--color-text-secondary) focus:border-(--color-accent) sm:text-sm"
                />
              </label>

              <button
                type="button"
                onClick={startCreateTicket}
                className={`${primaryButton} shrink-0`}
              >
                <PlusIcon />
                <span className="hidden sm:inline">New ticket</span>
                <span className="sr-only sm:hidden">New ticket</span>
              </button>
            </div>
          }
        />

        {successMessage && <Notice tone="success">{successMessage}</Notice>}

        {/* Tabs and controls */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-(--color-border)">
          <div role="tablist" aria-label="Ticket view" className="flex gap-5">
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
                  className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium transition ${focusRing} ${
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

          <div className="flex flex-wrap items-center gap-2 pb-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              className="h-9 rounded-xl border border-(--color-border) bg-(--color-surface) px-2.5 text-base text-(--color-text) outline-none focus:border-(--color-accent) sm:text-xs"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value as SortOrder)
              }
              aria-label="Sort tickets"
              className="h-9 rounded-xl border border-(--color-border) bg-(--color-surface) px-2.5 text-base text-(--color-text) outline-none focus:border-(--color-accent) sm:text-xs"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>

            <button
              type="button"
              onClick={() => void loadTickets()}
              disabled={loadingTickets}
              className={`${linkButton} px-1 text-xs disabled:opacity-50`}
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
    const ticketLabel =
      user.role === "master"
        ? "All tickets"
        : user.role === "department_head"
          ? "Department tickets"
          : "My tickets";

    const statusGroups = [
      { label: "New", statuses: ["open"], color: "bg-indigo-500", stroke: "stroke-indigo-500" },
      {
        label: "In progress",
        statuses: ["assigned", "in_progress", "forwarding_requested"],
        color: "bg-amber-500",
        stroke: "stroke-amber-500",
      },
      {
        label: "Awaiting response",
        statuses: ["resolution_submitted", "resolution_pending", "transfer_pending"],
        color: "bg-sky-500",
        stroke: "stroke-sky-500",
      },
      {
        label: "Completed",
        statuses: ["resolved", "closed"],
        color: "bg-emerald-500",
        stroke: "stroke-emerald-500",
      },
    ];

    const groupCounts = statusGroups.map((group) => ({
      ...group,
      count: tickets.filter((ticket) => group.statuses.includes(ticket.status))
        .length,
    }));

    const total = tickets.length;

    // Donut segments
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    let consumed = 0;
    const segments = groupCounts.map((group) => {
      const length = total ? (group.count / total) * circumference : 0;
      const segment = { ...group, length, offset: consumed };
      consumed += length;
      return segment;
    });

    const recentTickets = [...tickets]
      .sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();

        return (
          (Number.isNaN(dateB) ? 0 : dateB) - (Number.isNaN(dateA) ? 0 : dateA)
        );
      })
      .slice(0, 5);

    const stats: {
      label: string;
      value: number;
      description: string;
      icon: keyof typeof iconPaths;
      tone: Tone;
      showShare: boolean;
    }[] = [
      {
        label: ticketLabel,
        value: total,
        description: "Total support requests",
        icon: "ticket",
        tone: "indigo",
        showShare: false,
      },
      {
        label: "New",
        value: openCount,
        description: "Waiting for assignment",
        icon: "clock",
        tone: "sky",
        showShare: true,
      },
      {
        label: "In progress",
        value: inProgressCount,
        description: "Currently being handled",
        icon: "trend",
        tone: "amber",
        showShare: true,
      },
      {
        label: "Resolved",
        value: resolvedCount,
        description: "Marked as resolved",
        icon: "check",
        tone: "emerald",
        showShare: true,
      },
    ];

    const welcomeMessage =
      user.role === "employee"
        ? "Here's an overview of your support requests."
        : user.role === "department_head"
          ? "Here's what's happening in your department."
          : "Here's what's happening across your helpdesk.";

    return (
      <div className="space-y-6">
        {/* Welcome */}
        <section
          className={`relative overflow-hidden bg-linear-to-br from-(--color-accent-soft) to-(--color-surface) p-5 sm:p-6 ${cardClass}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight wrap-break-word text-(--color-text) sm:text-2xl">
                Welcome back, {user.name}
              </h2>
              <p className="mt-1 text-sm text-(--color-text-secondary)">
                {welcomeMessage}
              </p>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() => void loadTickets()}
                disabled={loadingTickets}
                className={`${secondaryButton} flex-1 sm:flex-none`}
              >
                {loadingTickets ? "Refreshing…" : "Refresh"}
              </button>
              <button
                type="button"
                onClick={startCreateTicket}
                className={`${primaryButton} flex-1 sm:flex-none`}
              >
                <PlusIcon />
                New ticket
              </button>
            </div>
          </div>
        </section>

        {ticketError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--color-border) px-4 py-3"
          >
            <p className="text-sm text-(--color-danger-text)">{ticketError}</p>
            <button
              type="button"
              onClick={() => void loadTickets()}
              className={linkButton}
            >
              Try again
            </button>
          </div>
        )}

        {/* Stats */}
        <section
          aria-label="Ticket statistics"
          className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4"
        >
          {stats.map((stat) => {
            const tone = toneStyles[stat.tone];
            const share =
              total > 0 ? Math.round((stat.value / total) * 100) : 0;

            return (
              <div
                key={stat.label}
                className={`p-5 transition hover:-translate-y-0.5 hover:shadow-md ${cardClass}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-(--color-text-secondary)">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-(--color-text)">
                      {loadingTickets ? "—" : stat.value}
                    </p>
                  </div>
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone.soft}`}
                  >
                    <Icon name={stat.icon} />
                  </span>
                </div>

                <p className="mt-3 text-xs text-(--color-text-secondary)">
                  {stat.description}
                  {stat.showShare && total > 0 && !loadingTickets
                    ? ` · ${share}%`
                    : ""}
                </p>

                {stat.showShare && (
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-(--color-surface-secondary)">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${tone.bg}`}
                      style={{ width: loadingTickets ? "0%" : `${share}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
          {/* Recent tickets */}
          <section
            aria-labelledby="recent-tickets-heading"
            className={`min-w-0 overflow-hidden ${cardClass}`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-(--color-border) px-5 py-4">
              <div className="flex items-center gap-3">
                <span className={chipClass}>
                  <Icon name="list" className="size-[18px]" />
                </span>
                <div>
                  <h3
                    id="recent-tickets-heading"
                    className="text-sm font-semibold text-(--color-text)"
                  >
                    Recent tickets
                  </h3>
                  <p className="mt-0.5 text-xs text-(--color-text-secondary)">
                    The latest support requests
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openTickets}
                className={`${linkButton} inline-flex shrink-0 items-center gap-1`}
              >
                View all
                <Icon name="arrow" className="size-4" />
              </button>
            </div>

            {loadingTickets ? (
              <div className="space-y-4 p-5" aria-label="Loading tickets">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="flex animate-pulse items-center gap-3"
                  >
                    <div className="size-9 rounded-full bg-(--color-surface-secondary)" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3 w-2/3 rounded bg-(--color-surface-secondary)" />
                      <div className="h-2.5 w-1/2 rounded bg-(--color-surface-secondary)" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentTickets.length === 0 ? (
              <EmptyState
                title="No tickets yet"
                message="Once a support request is created, it will appear here."
                action={
                  <button
                    type="button"
                    onClick={startCreateTicket}
                    className={primaryButton}
                  >
                    <PlusIcon />
                    Create a ticket
                  </button>
                }
              />
            ) : (
              <div>
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

          {/* Status breakdown */}
          <section
            aria-labelledby="ticket-status-heading"
            className={`overflow-hidden ${cardClass}`}
          >
            <div className="border-b border-(--color-border) px-5 py-4">
              <h3
                id="ticket-status-heading"
                className="text-sm font-semibold text-(--color-text)"
              >
                Ticket status
              </h3>
              <p className="mt-0.5 text-xs text-(--color-text-secondary)">
                Distribution of current requests
              </p>
            </div>

            <div className="space-y-6 p-5">
              <div
                className="relative mx-auto size-36"
                role="img"
                aria-label="Ticket status distribution"
              >
                <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    strokeWidth="10"
                    style={{ stroke: "var(--color-surface-secondary)" }}
                  />
                  {!loadingTickets &&
                    segments
                      .filter((segment) => segment.length > 0)
                      .map((segment) => (
                        <circle
                          key={segment.label}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="none"
                          strokeWidth="10"
                          className={segment.stroke}
                          strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                          strokeDashoffset={-segment.offset}
                        />
                      ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums text-(--color-text)">
                    {loadingTickets ? "—" : total}
                  </span>
                  <span className="text-xs text-(--color-text-secondary)">
                    Total
                  </span>
                </div>
              </div>

              <ul className="space-y-3">
                {groupCounts.map((group) => (
                  <li
                    key={group.label}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2.5 text-(--color-text)">
                      <span
                        className={`size-2.5 shrink-0 rounded-full ${group.color}`}
                      />
                      <span className="truncate">{group.label}</span>
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="text-xs tabular-nums text-(--color-text-secondary)">
                        {!loadingTickets && total > 0
                          ? `${Math.round((group.count / total) * 100)}%`
                          : ""}
                      </span>
                      <span className="w-6 text-right font-semibold tabular-nums text-(--color-text)">
                        {loadingTickets ? "—" : group.count}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        {/* Quick actions */}
        <section aria-label="Quick actions" className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "Create a ticket",
              description: "Raise a new support request",
              icon: "plus" as const,
              onClick: startCreateTicket,
            },
            {
              title: "Browse tickets",
              description: "Search and track support requests",
              icon: "list" as const,
              onClick: openTickets,
            },
          ].map((action) => (
            <button
              key={action.title}
              type="button"
              onClick={action.onClick}
              className={`flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${cardClass} ${focusRing}`}
            >
              <span className={`${chipClass} size-11`}>
                <Icon name={action.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-(--color-text)">
                  {action.title}
                </span>
                <span className="mt-0.5 block text-xs text-(--color-text-secondary)">
                  {action.description}
                </span>
              </span>
              <span className="text-(--color-text-secondary)">
                <Icon name="arrow" className="size-4" />
              </span>
            </button>
          ))}
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
        return <TicketTransfersPage
  user={user}
  initialTicketId={transferTicketId}
/>;

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
        <Topbar
          user={user}
          title={pageTitles[activePage] ?? "Overview"}
          tickets={tickets}
          loadingTickets={loadingTickets}
          ticketError={ticketError}
          onSelectTicket={openTicketDetails}
        />

        <main className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}