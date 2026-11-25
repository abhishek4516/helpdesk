import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import type { LoggedInUser } from '../types/auth'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Department {
  id: number
  name: string
  departmentCode: string
}

type TransferStatus = 'pending' | 'approved' | 'rejected'

interface TransferRequest {
  id: number
  ticketId: number
  ticketCode: string
  title: string
  requestedByUserId: number
  requestedByName: string
  fromDepartmentId: number
  fromDepartmentName: string
  toDepartmentId: number
  toDepartmentName: string
  destinationHeadUserId: number | null
  reason: string
  status: TransferStatus
  reviewedByUserId: number | null
  reviewedByName: string | null
  reviewComment: string | null
  createdAt: string
  reviewedAt: string | null
}

interface TicketTransfersPageProps {
  user: LoggedInUser
  initialTicketId?: number | null
}

type StatusFilter = 'all' | TransferStatus

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const API_URL: string =
  (import.meta.env?.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:5000/api/tickets'

const MIN_REASON = 5
const MAX_REASON = 2000
const MAX_COMMENT = 1000

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]'

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

function parseTicketId(value: number | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** Fetch JSON, tolerate non-JSON bodies, and throw a readable error. */
async function api<T extends { success?: boolean; message?: string }>(
  url: string,
  fallbackError: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { credentials: 'include', ...init })
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.')
  }

  let data: T | null = null
  try {
    data = (await response.json()) as T
  } catch {
    data = null
  }

  if (!response.ok || !data || !data.success) {
    throw new Error(data?.message || fallbackError)
  }
  return data
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<
  TransferStatus,
  { background: string; text: string; label: string }
> = {
  pending: {
    background: 'var(--color-warning-bg)',
    text: 'var(--color-warning-text)',
    label: 'Pending',
  },
  approved: {
    background: 'var(--color-success-bg)',
    text: 'var(--color-success-text)',
    label: 'Approved',
  },
  rejected: {
    background: 'var(--color-danger-bg)',
    text: 'var(--color-danger-text)',
    label: 'Rejected',
  },
}

function StatusIcon({ status }: { status: TransferStatus }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (status === 'approved')
    return (
      <svg {...common}>
        <path d="M3 8.5l3.2 3L13 4.5" />
      </svg>
    )
  if (status === 'rejected')
    return (
      <svg {...common}>
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    )
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.2 1.4" />
    </svg>
  )
}

function StatusBadge({ status }: { status: TransferStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: s.background, color: s.text }}
    >
      <StatusIcon status={status} />
      {s.label}
    </span>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: 'success' | 'danger' | 'warning'
  children: React.ReactNode
  onDismiss?: () => void
}) {
  const bg = `var(--color-${tone}-bg)`
  const fg = `var(--color-${tone}-text)`
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
      style={{ backgroundColor: bg, borderColor: 'var(--color-border)', color: fg }}
    >
      <div className="min-w-0 break-words">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className={`-m-1 shrink-0 rounded p-1 ${FOCUS_RING}`}
          style={{ color: fg }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </div>
  )
}

function DepartmentPath({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span
        className="rounded-md border px-2.5 py-1 font-medium"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
      >
        <span className="sr-only">From </span>
        {from}
      </span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="var(--color-text-secondary)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="to"
        role="img"
      >
        <path d="M2.5 8h11M9.5 4l4 4-4 4" />
      </svg>
      <span
        className="rounded-md border px-2.5 py-1 font-medium"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
      >
        {to}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TicketTransfersPage({
  user,
  initialTicketId = null,
}: TicketTransfersPageProps) {
  const ticketId = parseTicketId(initialTicketId)

  const [departments, setDepartments] = useState<Department[]>([])
  const [requests, setRequests] = useState<TransferRequest[]>([])
  const [toDepartmentId, setToDepartmentId] = useState('')
  const [reason, setReason] = useState('')
  const [reviewComments, setReviewComments] = useState<Record<number, string>>({})
  const [reviewErrors, setReviewErrors] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const latestLoad = useRef(0)
  const isEmployee = user.role === 'employee'

  /* ---------- permissions ---------- */

  const canReviewRequest = useCallback(
    (request: TransferRequest) =>
      user.role === 'master' ||
      (user.role === 'department_head' && request.destinationHeadUserId === user.id),
    [user.id, user.role],
  )
  const isReviewer = user.role === 'master' || user.role === 'department_head'

  /* ---------- data loading ---------- */

  const loadData = useCallback(async (mode: 'initial' | 'refresh' = 'refresh') => {
    const loadId = ++latestLoad.current
    if (mode === 'initial') setLoading(true)
    else setRefreshing(true)
    setError('')

    try {
      const [departmentData, requestData] = await Promise.all([
        api<{ success: boolean; message?: string; departments?: Department[] }>(
          `${API_URL}/departments`,
          'Unable to load departments.',
        ),
        api<{ success: boolean; message?: string; requests?: TransferRequest[] }>(
          `${API_URL}/transfer-requests`,
          'Unable to load transfer requests.',
        ),
      ])

      if (loadId !== latestLoad.current) return // a newer load superseded this one
      setDepartments(departmentData.departments ?? [])
      setRequests(requestData.requests ?? [])
    } catch (err) {
      if (loadId !== latestLoad.current) return
      setError(err instanceof Error ? err.message : 'Unable to load transfer information.')
    } finally {
      if (loadId === latestLoad.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData('initial')
    const ref = latestLoad
    return () => {
      ref.current += 1 // ignore in-flight responses after unmount
    }
  }, [loadData])

  // Success messages fade out on their own.
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 6000)
    return () => window.clearTimeout(timer)
  }, [message])

  /* ---------- derived data ---------- */

  const visibleRequests = useMemo(
    () =>
      requests
        .filter(
          (r) =>
            user.role === 'master' ||
            (user.role === 'department_head' && r.destinationHeadUserId === user.id) ||
            r.requestedByUserId === user.id,
        )
        .sort((a, b) => {
          // pending first, then newest first
          if (a.status === 'pending' && b.status !== 'pending') return -1
          if (b.status === 'pending' && a.status !== 'pending') return 1
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }),
    [requests, user.id, user.role],
  )

  const counts = useMemo(() => {
    const base = { all: visibleRequests.length, pending: 0, approved: 0, rejected: 0 }
    for (const r of visibleRequests) base[r.status] += 1
    return base
  }, [visibleRequests])

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase()
    return visibleRequests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!q) return true
      return (
        r.ticketCode.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.requestedByName.toLowerCase().includes(q) ||
        r.fromDepartmentName.toLowerCase().includes(q) ||
        r.toDepartmentName.toLowerCase().includes(q) ||
        String(r.ticketId) === q
      )
    })
  }, [visibleRequests, statusFilter, search])

  const pendingForTicket = useMemo(
    () =>
      ticketId == null
        ? undefined
        : requests.find((r) => r.ticketId === ticketId && r.status === 'pending'),
    [requests, ticketId],
  )

  const reasonLength = reason.trim().length
  const canSubmit =
    ticketId != null &&
    !!toDepartmentId &&
    reasonLength >= MIN_REASON &&
    !submitting &&
    !pendingForTicket

  /* ---------- actions ---------- */

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError('')
    setMessage('')

    if (ticketId == null || !toDepartmentId || reasonLength < MIN_REASON) {
      setError(
        `Select a destination department and enter a reason of at least ${MIN_REASON} characters.`,
      )
      return
    }
    if (pendingForTicket) {
      setError('This ticket already has a pending transfer request.')
      return
    }

    setSubmitting(true)
    try {
      const data = await api<{ success: boolean; message?: string }>(
        `${API_URL}/${encodeURIComponent(String(ticketId))}/transfer-requests`,
        'Unable to submit the transfer request.',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toDepartmentId: Number(toDepartmentId),
            reason: reason.trim(),
          }),
        },
      )
      setMessage(data.message || 'Transfer request submitted.')
      setToDepartmentId('')
      setReason('')
      await loadData('refresh')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit the request.')
    } finally {
      setSubmitting(false)
    }
  }

  async function reviewRequest(requestId: number, decision: 'approved' | 'rejected') {
    if (reviewingId !== null) return
    const comment = reviewComments[requestId]?.trim() ?? ''

    setError('')
    setMessage('')
    setReviewErrors((current) => ({ ...current, [requestId]: '' }))

    if (decision === 'rejected' && comment.length < 3) {
      setReviewErrors((current) => ({
        ...current,
        [requestId]: 'Add a short comment explaining why this request is rejected.',
      }))
      return
    }

    setReviewingId(requestId)
    try {
      const data = await api<{ success: boolean; message?: string }>(
        `${API_URL}/transfer-requests/${requestId}/review`,
        'Unable to review the transfer request.',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision, reviewComment: comment || null }),
        },
      )
      setMessage(data.message || `Transfer request ${decision}.`)
      setReviewComments((current) => {
        const next = { ...current }
        delete next[requestId]
        return next
      })
      await loadData('refresh')
    } catch (err) {
      setReviewErrors((current) => ({
        ...current,
        [requestId]: err instanceof Error ? err.message : 'Unable to review the request.',
      }))
    } finally {
      setReviewingId(null)
    }
  }

  /* ---------- render ---------- */

  const inputStyle = {
    backgroundColor: 'var(--color-bg)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text)',
  } as const

  const cardStyle = {
    backgroundColor: 'var(--color-surface)',
    borderColor: 'var(--color-border)',
  } as const

  const mutedText = { color: 'var(--color-text-secondary)' } as const

  return (
    <div className="space-y-6">
      <header>
        <h2
          className="text-2xl font-semibold tracking-tight"
          style={{ color: 'var(--color-text)' }}
        >
          Ticket transfers
        </h2>
        <p className="mt-1 text-sm" style={mutedText}>
          {isEmployee
            ? 'Ask another department to take over a ticket and track your requests.'
            : 'Review requests to move tickets into your department.'}
        </p>
      </header>

      <div className="space-y-3" aria-live="polite">
        {message && (
          <Banner tone="success" onDismiss={() => setMessage('')}>
            {message}
          </Banner>
        )}
        {error && (
          <Banner tone="danger" onDismiss={() => setError('')}>
            {error}
          </Banner>
        )}
      </div>

      {/* ---------------- Request form (employees) ---------------- */}
      {isEmployee && (
        <section className="rounded-xl border p-5 sm:p-6" style={cardStyle}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            Request a transfer
          </h3>

          {ticketId == null ? (
            <p className="mt-1 max-w-prose text-sm" style={mutedText}>
              To request a transfer, open a ticket and choose Request transfer.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm" style={mutedText}>
                Moving ticket #{ticketId} to another department.
              </p>

              {pendingForTicket && (
                <div className="mt-4">
                  <Banner tone="warning">
                    Ticket #{ticketId} already has a pending request to{' '}
                    <strong>{pendingForTicket.toDepartmentName}</strong>, submitted on{' '}
                    {formatDate(pendingForTicket.createdAt)}. You can send another request after
                    it has been reviewed.
                  </Banner>
                </div>
              )}

              <form onSubmit={submitRequest} className="mt-5 space-y-4" noValidate>
                <fieldset disabled={submitting || !!pendingForTicket} className="space-y-4 disabled:opacity-60">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div
                      className="rounded-lg border px-3 py-2.5 text-sm"
                      style={inputStyle}
                    >
                      <span className="block text-xs" style={mutedText}>
                        Ticket
                      </span>
                      <span className="mt-1 block font-semibold">#{ticketId}</span>
                    </div>

                    <div>
                      <label
                        htmlFor="transfer-department"
                        className="block text-sm font-medium"
                        style={{ color: 'var(--color-text)' }}
                      >
                        Destination department
                      </label>
                      <select
                        id="transfer-department"
                        required
                        value={toDepartmentId}
                        onChange={(event) => setToDepartmentId(event.target.value)}
                        className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none ${FOCUS_RING}`}
                        style={inputStyle}
                      >
                        <option value="">
                          {loading ? 'Loading departments…' : 'Select a department'}
                        </option>
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="transfer-reason"
                      className="block text-sm font-medium"
                      style={{ color: 'var(--color-text)' }}
                    >
                      Reason for transfer
                    </label>
                    <textarea
                      id="transfer-reason"
                      required
                      minLength={MIN_REASON}
                      maxLength={MAX_REASON}
                      rows={4}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Explain why this ticket needs another department…"
                      aria-describedby="transfer-reason-hint"
                      className={`mt-1.5 w-full resize-y rounded-lg border px-3 py-2.5 text-sm outline-none ${FOCUS_RING}`}
                      style={inputStyle}
                    />
                    <p
                      id="transfer-reason-hint"
                      className="mt-1 flex justify-between gap-3 text-xs"
                      style={mutedText}
                    >
                      <span>
                        {reasonLength > 0 && reasonLength < MIN_REASON
                          ? `Add at least ${MIN_REASON - reasonLength} more character${MIN_REASON - reasonLength === 1 ? '' : 's'}.`
                          : `At least ${MIN_REASON} characters.`}
                      </span>
                      <span>
                        {reason.length}/{MAX_REASON}
                      </span>
                    </p>
                  </div>
                </fieldset>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  {submitting && <Spinner />}
                  {submitting ? 'Submitting…' : 'Submit transfer request'}
                </button>
              </form>
            </>
          )}
        </section>
      )}

      {/* ---------------- Request list ---------------- */}
      <section className="rounded-xl border p-5 sm:p-6" style={cardStyle} aria-busy={loading || refreshing}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              {isReviewer ? 'Transfer requests' : 'My transfer requests'}
            </h3>
            {isReviewer && counts.pending > 0 && (
              <p className="mt-0.5 text-sm" style={mutedText}>
                {counts.pending} waiting for review
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void loadData('refresh')}
            disabled={loading || refreshing}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50 ${FOCUS_RING}`}
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            {(loading || refreshing) && <Spinner />}
            {loading || refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Filters */}
        {!loading && visibleRequests.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const active = statusFilter === f.value
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setStatusFilter(f.value)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${FOCUS_RING}`}
                    style={
                      active
                        ? {
                            backgroundColor: 'var(--color-accent)',
                            borderColor: 'var(--color-accent)',
                            color: '#fff',
                          }
                        : { borderColor: 'var(--color-border)', color: 'var(--color-text)' }
                    }
                  >
                    {f.label} <span className={active ? 'opacity-90' : 'opacity-70'}>{counts[f.value]}</span>
                  </button>
                )
              })}
            </div>

            <div className="sm:w-64">
              <label htmlFor="transfer-search" className="sr-only">
                Search transfer requests
              </label>
              <input
                id="transfer-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ticket, person, department"
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${FOCUS_RING}`}
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* States */}
        {loading ? (
          <div className="mt-4 space-y-3" role="status" aria-label="Loading transfer requests">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg motion-reduce:animate-none"
                style={{ backgroundColor: 'var(--color-bg)' }}
              />
            ))}
          </div>
        ) : visibleRequests.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              No transfer requests yet
            </p>
            <p className="mt-1 text-sm" style={mutedText}>
              {isEmployee
                ? 'Requests you submit from a ticket will show up here.'
                : 'Requests sent to your department will show up here.'}
            </p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              No matching requests
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all')
                setSearch('')
              }}
              className={`mt-2 rounded text-sm font-medium underline underline-offset-2 ${FOCUS_RING}`}
              style={{ color: 'var(--color-accent)' }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {filteredRequests.map((request) => {
              const reviewable = canReviewRequest(request) && request.status === 'pending'
              const isBusy = reviewingId === request.id
              const commentId = `review-comment-${request.id}`
              const rowError = reviewErrors[request.id]

              return (
                <li key={request.id}>
                  <article
                    className="rounded-lg border p-4"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
                          {request.ticketCode}
                          <span className="ml-2 font-normal" style={mutedText}>
                            Ticket ID {request.ticketId}
                          </span>
                        </p>
                        <h4
                          className="mt-1 break-words font-semibold"
                          style={{ color: 'var(--color-text)' }}
                        >
                          {request.title}
                        </h4>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>

                    <div className="mt-3">
                      <DepartmentPath
                        from={request.fromDepartmentName}
                        to={request.toDepartmentName}
                      />
                    </div>

                    <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                      <div className="flex gap-1.5">
                        <dt className="font-medium" style={{ color: 'var(--color-text)' }}>
                          Requested by:
                        </dt>
                        <dd style={mutedText}>{request.requestedByName}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="font-medium" style={{ color: 'var(--color-text)' }}>
                          Submitted:
                        </dt>
                        <dd style={mutedText}>
                          <time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time>
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <p className="text-xs font-semibold" style={mutedText}>
                        Transfer reason
                      </p>
                      <p
                        className="mt-1 whitespace-pre-wrap break-words text-sm"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {request.reason}
                      </p>
                    </div>

                    {request.reviewComment && (
                      <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg)' }}>
                        <p className="text-xs font-semibold" style={mutedText}>
                          Review comment
                        </p>
                        <p
                          className="mt-1 whitespace-pre-wrap break-words text-sm"
                          style={{ color: 'var(--color-text)' }}
                        >
                          {request.reviewComment}
                        </p>
                      </div>
                    )}

                    {reviewable && (
                      <div className="mt-4 space-y-3">
                        <div>
                          <label
                            htmlFor={commentId}
                            className="block text-sm font-medium"
                            style={{ color: 'var(--color-text)' }}
                          >
                            Review comment
                            <span className="ml-1 font-normal" style={mutedText}>
                              (required to reject)
                            </span>
                          </label>
                          <textarea
                            id={commentId}
                            rows={2}
                            maxLength={MAX_COMMENT}
                            value={reviewComments[request.id] ?? ''}
                            disabled={isBusy}
                            onChange={(event) => {
                              const value = event.target.value
                              setReviewComments((current) => ({ ...current, [request.id]: value }))
                              if (rowError)
                                setReviewErrors((current) => ({ ...current, [request.id]: '' }))
                            }}
                            placeholder="Add a note for the requester…"
                            aria-invalid={rowError ? true : undefined}
                            aria-describedby={rowError ? `${commentId}-error` : undefined}
                            className={`mt-1.5 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none disabled:opacity-60 ${FOCUS_RING}`}
                            style={{
                              ...inputStyle,
                              borderColor: rowError
                                ? 'var(--color-danger-text)'
                                : 'var(--color-border)',
                            }}
                          />
                          {rowError && (
                            <p
                              id={`${commentId}-error`}
                              role="alert"
                              className="mt-1 text-sm"
                              style={{ color: 'var(--color-danger-text)' }}
                            >
                              {rowError}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void reviewRequest(request.id, 'approved')}
                            disabled={reviewingId !== null}
                            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                            style={{ backgroundColor: 'var(--color-accent)' }}
                          >
                            {isBusy && <Spinner />}
                            {isBusy ? 'Processing…' : 'Approve transfer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void reviewRequest(request.id, 'rejected')}
                            disabled={reviewingId !== null}
                            className={`rounded-lg border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                            style={{
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-danger-text)',
                            }}
                          >
                            Reject transfer
                          </button>
                        </div>
                      </div>
                    )}

                    {request.reviewedByName && (
                      <p className="mt-3 text-xs" style={mutedText}>
                        Reviewed by {request.reviewedByName} on{' '}
                        <time dateTime={request.reviewedAt ?? undefined}>
                          {formatDate(request.reviewedAt)}
                        </time>
                      </p>
                    )}
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}