import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import CreateTicketForm from "../components/tickets/CreateTicketForm";
import { getTickets, type Ticket } from "../services/ticketService";
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
};

const pageTitles: Record<string, string> = {
  overview: "Overview",
  tickets: "Tickets",
  transfers: "Ticket Transfers",
  employees: "Employees",
  departments: "Departments",
};

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "forwarding_requested", label: "Forwarding requested" },
  { value: "resolution_submitted", label: "Resolution submitted" },
  { value: "resolved", label: "Resolved" },
];

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

function StatusBadge({ status }: { status: string }) {
  let background = "var(--color-surface-secondary)";
  let color = "var(--color-text-secondary)";

  switch (status) {
    case "open":
      background = "var(--color-accent-soft)";
      color = "var(--color-accent-text)";
      break;
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
      className="inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium capitalize"
      style={{ backgroundColor: background, color }}
    >
      <span
        className="mr-1.5 size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {formatStatus(status)}
    </span>
  );
}

function TicketCard({
  ticket,
  showRequester,
  onClick,
}: {
  ticket: Ticket;
  showRequester: boolean;
  onClick: () => void;
}) {
  return (
    <article
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View ticket ${ticket.ticketCode}`}
      className="min-w-0 cursor-pointer rounded-xl border p-4 transition-colors hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-(--color-accent) sm:p-5"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="truncate text-xs font-semibold tracking-wide"
            style={{ color: "var(--color-accent)" }}
          >
            {ticket.ticketCode}
          </p>

          <h3
            className="mt-1.5 break-words text-base font-semibold"
            style={{ color: "var(--color-text)" }}
          >
            {ticket.title}
          </h3>
        </div>

        <StatusBadge status={ticket.status} />
      </div>

      <p
        className="mt-3 line-clamp-2 break-words text-sm leading-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {ticket.description}
      </p>

      <div
        className="mt-4 grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="min-w-0">
          <p
            className="text-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Department
          </p>
          <p
            className="mt-1 truncate text-sm font-medium"
            style={{ color: "var(--color-text)" }}
          >
            {ticket.departmentName || "Unassigned"}
          </p>
        </div>

        <div className="min-w-0">
          <p
            className="text-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {showRequester ? "Requester" : "Created"}
          </p>
          <p
            className="mt-1 truncate text-sm font-medium"
            style={{ color: "var(--color-text)" }}
          >
            {showRequester
              ? ticket.requesterName || "Not available"
              : formatDate(ticket.createdAt)}
          </p>
        </div>

        {showRequester && (
          <div className="sm:col-span-2">
            <p
              className="text-xs"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Created
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text)" }}>
              {formatDate(ticket.createdAt)}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

export default function DashboardPage({ user, onLogout }: DashboardPageProps) {
  const [activePage, setActivePage] = useState("overview");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignableEmployees, setAssignableEmployees] = useState<
    AssignableEmployee[]
  >([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [assignmentEmployeeId, setAssignmentEmployeeId] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");

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

  const loadAssignableEmployees = useCallback(async () => {
    if (user.role !== "master") return;

    setLoadingEmployees(true);
    setAssignmentError("");

    try {
      const response = await fetch("http://localhost:5000/api/employees", {
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load employees.");
      }

      // The employee API may expose camelCase or database-style snake_case
      // fields. Normalize them before filtering so valid employees aren't hidden.
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
    if (user.role === "master") {
      void loadAssignableEmployees();
    }
  }, [loadTickets, loadAssignableEmployees, user.role]);

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return tickets.filter((ticket) => {
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
  }, [tickets, searchQuery, statusFilter]);

  const openCount = tickets.filter((ticket) => ticket.status === "open").length;

  const inProgressCount = tickets.filter((ticket) =>
    ["assigned", "in_progress", "forwarding_requested"].includes(ticket.status),
  ).length;

  const resolvedCount = tickets.filter(
    (ticket) => ticket.status === "resolved",
  ).length;

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
    setActivePage("tickets");
  }

  function handleTicketCreated() {
    setShowCreateForm(false);
    setSuccessMessage("Ticket created successfully!");
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
          body: JSON.stringify({ employeeId: Number(assignmentEmployeeId) }),
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

  function renderTicketCards(items: Ticket[]) {
    if (loadingTickets) {
      return (
        <div
          className="rounded-xl border px-4 py-12 text-center"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          <div className="mx-auto mb-3 size-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <p className="text-sm">Loading tickets...</p>
        </div>
      );
    }

    if (ticketError) {
      return (
        <div
          className="rounded-xl border p-6"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <p
            role="alert"
            className="text-sm"
            style={{ color: "var(--color-danger-text)" }}
          >
            {ticketError}
          </p>

          <button
            type="button"
            onClick={() => void loadTickets()}
            className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    if (items.length === 0) {
      const hasFilters = Boolean(searchQuery.trim()) || statusFilter !== "all";

      return (
        <div
          className="rounded-xl border px-4 py-12 text-center"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div
            className="mx-auto flex size-12 items-center justify-center rounded-xl text-xl"
            style={{
              backgroundColor: "var(--color-accent-soft)",
              color: "var(--color-accent-text)",
            }}
          >
            {hasFilters ? "⌕" : "＋"}
          </div>

          <h3
            className="mt-4 font-semibold"
            style={{ color: "var(--color-text)" }}
          >
            {hasFilters ? "No matching tickets" : "No tickets yet"}
          </h3>

          <p
            className="mx-auto mt-2 max-w-sm text-sm leading-6"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {hasFilters
              ? "Try another search term or change the status filter."
              : "Your support requests will appear here when they are created."}
          </p>

          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold"
              style={{
                backgroundColor: "var(--color-accent-soft)",
                color: "var(--color-accent-text)",
              }}
            >
              Clear filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="mt-4 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--color-accent)" }}
            >
              Create your first ticket
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        {items.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            showRequester={user.role !== "employee"}
            onClick={() => openTicketDetails(ticket)}
          />
        ))}
      </div>
    );
  }

  function renderContent() {
    switch (activePage) {
      case "tickets":
        return (
          <div className="space-y-5">
            {selectedTicket ? (
              <section
                className="space-y-5 rounded-xl border p-5 sm:p-7"
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(null)}
                      className="mb-4 text-sm font-semibold transition hover:opacity-75"
                      style={{ color: "var(--color-accent)" }}
                    >
                      ← Back to tickets
                    </button>
                    <p
                      className="text-xs font-semibold tracking-wide"
                      style={{ color: "var(--color-accent)" }}
                    >
                      {selectedTicket.ticketCode}
                    </p>
                    <h2
                      className="mt-2 wrap-break-word text-2xl font-semibold tracking-tight"
                      style={{ color: "var(--color-text)" }}
                    >
                      {selectedTicket.title}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
  {(user.role === 'master' ||
    (user.role === 'employee' &&
      (selectedTicket as TicketWithAssignment).assignedEmployeeId ===
        user.id)) && (
    <button
      type="button"
      onClick={() => setActivePage('transfers')}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
    >
      Transfer Ticket
    </button>
  )}

  <StatusBadge status={selectedTicket.status} />
</div>
                </div>

                <div
                  className="border-t pt-5"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: "var(--color-text)" }}
                  >
                    Description
                  </h3>
                  <p
                    className="mt-2 whitespace-pre-wrap break-words text-sm leading-7"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {selectedTicket.description || "No description provided."}
                  </p>
                </div>

                <div
                  className="grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-2 lg:grid-cols-3"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  {[
                    {
                      label: "Department",
                      value: selectedTicket.departmentName || "Unassigned",
                    },
                    {
                      label: "Requester",
                      value:
                        selectedTicket.requesterName ||
                        (user.role === "employee"
                          ? user.name
                          : "Not available"),
                    },
                    {
                      label: "Created",
                      value: formatDate(selectedTicket.createdAt),
                    },
                    {
                      label: "Status",
                      value: formatStatus(selectedTicket.status),
                    },
                  ].map((item) => (
                    <div key={item.label} className="min-w-0">
                      <p
                        className="text-xs"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {item.label}
                      </p>
                      <p
                        className="mt-1 break-words text-sm font-medium capitalize"
                        style={{ color: "var(--color-text)" }}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                {user.role === "master" && (
                  <section
                    className="space-y-4 border-t pt-5"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <div>
                      <h3
                        className="text-sm font-semibold"
                        style={{ color: "var(--color-text)" }}
                      >
                        Ticket assignment
                      </h3>
                      <p
                        className="mt-1 text-sm"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        Assign this ticket to any active employee, regardless of
                        department.
                      </p>
                    </div>

                    <div
                      className="rounded-lg border p-3"
                      style={{
                        borderColor: "var(--color-border)",
                        backgroundColor: "var(--color-bg)",
                      }}
                    >
                      <p
                        className="text-xs"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        Currently assigned to
                      </p>
                      <p
                        className="mt-1 text-sm font-medium"
                        style={{ color: "var(--color-text)" }}
                      >
                        {(() => {
                          const assignedId = (
                            selectedTicket as TicketWithAssignment
                          ).assignedEmployeeId;
                          const assignedEmployee = assignableEmployees.find(
                            (employee) => employee.id === assignedId,
                          );
                          return assignedEmployee
                            ? `${assignedEmployee.fullName} (${assignedEmployee.employeeId})`
                            : assignedId
                              ? `Employee database ID ${assignedId}`
                              : "Not assigned";
                        })()}
                      </p>
                    </div>

                    {assignmentError && (
                      <p
                        role="alert"
                        className="text-sm"
                        style={{ color: "var(--color-danger-text)" }}
                      >
                        {assignmentError}
                      </p>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <select
                        value={assignmentEmployeeId}
                        onChange={(event) => {
                          setAssignmentEmployeeId(event.target.value);
                          setAssignmentError("");
                        }}
                        disabled={loadingEmployees || savingAssignment}
                        aria-label="Choose employee to assign ticket"
                        className="min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] disabled:opacity-60"
                        style={{
                          backgroundColor: "var(--color-bg)",
                          borderColor: "var(--color-border)",
                          color: "var(--color-text)",
                        }}
                      >
                        <option value="">
                          {loadingEmployees
                            ? "Loading employees..."
                            : "Select an employee"}
                        </option>
                        {assignableEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.fullName} ({employee.employeeId}) —{" "}
                            {employee.role.replaceAll("_", " ")}
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
                        className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ backgroundColor: "var(--color-accent)" }}
                      >
                        {savingAssignment ? "Assigning..." : "Assign ticket"}
                      </button>
                    </div>

                    {!loadingEmployees && assignableEmployees.length === 0 && (
                      <p
                        className="text-sm"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        No active employees are available to assign.
                      </p>
                    )}
                  </section>
                )}
              </section>
            ) : showCreateForm ? (
              <CreateTicketForm
                onSuccess={handleTicketCreated}
                onCancel={() => setShowCreateForm(false)}
              />
            ) : (
              <>
                <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2
                      className="text-2xl font-semibold tracking-tight"
                      style={{ color: "var(--color-text)" }}
                    >
                      {user.role === "employee"
                        ? "My tickets"
                        : user.role === "department_head"
                          ? "Department tickets"
                          : "All tickets"}
                    </h2>
                    <p
                      className="mt-1 text-sm"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      Search, filter, and track support requests.
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void loadTickets()}
                      disabled={loadingTickets}
                      className="rounded-lg border px-4 py-2.5 text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
                      style={{
                        borderColor: "var(--color-border)",
                        color: "var(--color-text)",
                      }}
                    >
                      ↻ Refresh
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSuccessMessage("");
                        setShowCreateForm(true);
                      }}
                      className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ backgroundColor: "var(--color-accent)" }}
                    >
                      + Create ticket
                    </button>
                  </div>
                </section>

                {successMessage && (
                  <div
                    role="status"
                    className="rounded-lg border px-4 py-3 text-sm"
                    style={{
                      backgroundColor: "var(--color-success-bg)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-success-text)",
                    }}
                  >
                    {successMessage}
                  </div>
                )}

                <section
                  className="rounded-xl border p-4 sm:p-5"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_210px]">
                    <div className="relative min-w-0">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="absolute left-3 top-1/2 size-4 -translate-y-1/2"
                        style={{ color: "var(--color-text-secondary)" }}
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
                          d="m16 16 4.2 4.2"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>

                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search tickets, IDs, departments..."
                        aria-label="Search tickets"
                        className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
                        style={{
                          backgroundColor: "var(--color-bg)",
                          borderColor: "var(--color-border)",
                          color: "var(--color-text)",
                        }}
                      />
                    </div>

                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      aria-label="Filter tickets by status"
                      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
                      style={{
                        backgroundColor: "var(--color-bg)",
                        borderColor: "var(--color-border)",
                        color: "var(--color-text)",
                      }}
                    >
                      <option value="all">All statuses</option>
                      {statusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <p
                      className="text-sm"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      Showing{" "}
                      <span
                        className="font-semibold"
                        style={{ color: "var(--color-text)" }}
                      >
                        {filteredTickets.length}
                      </span>{" "}
                      of {tickets.length}{" "}
                      {tickets.length === 1 ? "ticket" : "tickets"}
                    </p>

                    {(searchQuery || statusFilter !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setStatusFilter("all");
                        }}
                        className="text-sm font-medium"
                        style={{ color: "var(--color-accent)" }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </section>

                {renderTicketCards(filteredTickets)}
              </>
            )}
          </div>
        );

      case "employees":
        return user.role === "master" ? (
          <EmployeesPage />
        ) : (
          <section
            role="alert"
            className="rounded-xl border p-6 sm:p-8"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            You do not have permission to access employee management.
          </section>
        );
     case 'transfers':
  return (
    <TicketTransfersPage
      user={user}
      initialTicketId={selectedTicket?.id ?? null}
    />
  ) ;
      case "departments":
        return <DepartmentsPage />;

      default:
        return (
          <div className="space-y-5">
            <section>
              <h2
                className="text-2xl font-semibold tracking-tight"
                style={{ color: "var(--color-text)" }}
              >
                Hello, {user.name.split(" ")[0]}!
              </h2>
              <p
                className="mt-1.5 text-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Here's an overview of your support activity.
              </p>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total tickets",
                  value: tickets.length,
                  detail: "Visible to your account",
                },
                {
                  label: "Open",
                  value: openCount,
                  detail: "Awaiting action",
                },
                {
                  label: "In progress",
                  value: inProgressCount,
                  detail: "Being worked on",
                },
                {
                  label: "Resolved",
                  value: resolvedCount,
                  detail: "Marked resolved",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border p-4 sm:p-5"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {stat.label}
                  </p>
                  <p
                    className="mt-2 text-3xl font-semibold tracking-tight"
                    style={{ color: "var(--color-text)" }}
                  >
                    {loadingTickets ? "—" : stat.value}
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {stat.detail}
                  </p>
                </div>
              ))}
            </section>

            <section
              className="flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
              }}
            >
              <div>
                <h3
                  className="text-lg font-semibold"
                  style={{ color: "var(--color-text)" }}
                >
                  Need help with something?
                </h3>
                <p
                  className="mt-1 text-sm leading-6"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Create a support request or view your existing tickets.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessMessage("");
                    setActivePage("tickets");
                    setShowCreateForm(true);
                  }}
                  className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: "var(--color-accent)" }}
                >
                  + Create ticket
                </button>

                <button
                  type="button"
                  onClick={openTickets}
                  className="rounded-lg border px-5 py-2.5 text-sm font-semibold transition hover:opacity-80"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  View tickets
                </button>
              </div>
            </section>

            <section
              className="rounded-xl border p-4 sm:p-5"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3
                  className="font-semibold"
                  style={{ color: "var(--color-text)" }}
                >
                  Recent tickets
                </h3>

                <button
                  type="button"
                  onClick={openTickets}
                  className="text-sm font-medium"
                  style={{ color: "var(--color-accent)" }}
                >
                  View all
                </button>
              </div>

              {loadingTickets ? (
                <p
                  className="py-4 text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Loading recent tickets...
                </p>
              ) : ticketError ? (
                <div className="py-3">
                  <p
                    role="alert"
                    className="text-sm"
                    style={{ color: "var(--color-danger-text)" }}
                  >
                    {ticketError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadTickets()}
                    className="mt-3 text-sm font-semibold"
                    style={{ color: "var(--color-accent)" }}
                  >
                    Try again
                  </button>
                </div>
              ) : tickets.length === 0 ? (
                <p
                  className="py-4 text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  No tickets yet. Your support requests will appear here.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {tickets.slice(0, 4).map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => openTicketDetails(ticket)}
                      className="min-w-0 rounded-xl border p-4 text-left transition hover:opacity-80"
                      style={{
                        backgroundColor: "var(--color-bg)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className="text-xs font-semibold"
                            style={{ color: "var(--color-accent)" }}
                          >
                            {ticket.ticketCode}
                          </p>
                          <p
                            className="mt-1 truncate text-sm font-semibold"
                            style={{ color: "var(--color-text)" }}
                          >
                            {ticket.title}
                          </p>
                          <p
                            className="mt-1 text-xs"
                            style={{ color: "var(--color-text-secondary)" }}
                          >
                            {ticket.departmentName} ·{" "}
                            {formatDate(ticket.createdAt)}
                          </p>
                        </div>
                        <StatusBadge status={ticket.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        );
    }
  }

  return (
    <div
      className="min-h-screen md:flex"
      style={{
        backgroundColor: "var(--color-bg)",
        color: "var(--color-text)",
      }}
    >
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
        <Topbar user={user} title={pageTitles[activePage] ?? "Overview"} />

        <main className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6 xl:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
