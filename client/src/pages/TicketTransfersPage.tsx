
import { useCallback, useEffect, useState } from 'react'
import type { LoggedInUser } from '../types/auth'

interface Department {
  id: number
  name: string
  departmentCode: string
}

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
  status: 'pending' | 'approved' | 'rejected'
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

const API_URL = 'http://localhost:5000/api/tickets'

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

function StatusBadge({ status }: { status: TransferRequest['status'] }) {
  const colors = {
    pending: {
      background: 'var(--color-warning-bg)',
      text: 'var(--color-warning-text)',
    },
    approved: {
      background: 'var(--color-success-bg)',
      text: 'var(--color-success-text)',
    },
    rejected: {
      background: 'var(--color-danger-bg)',
      text: 'var(--color-danger-text)',
    },
  }[status]

  return (
    <span
      className="inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      {status}
    </span>
  )
}

export default function TicketTransfersPage({
  user,
  initialTicketId = null,
}: TicketTransfersPageProps) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [requests, setRequests] = useState<TransferRequest[]>([])
 const [ticketId, setTicketId] = useState(
  initialTicketId != null ? String(initialTicketId) : '',
)
  const [toDepartmentId, setToDepartmentId] = useState('')
  const [reason, setReason] = useState('')
  const [reviewComments, setReviewComments] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canReview = user.role === 'master' || user.role === 'department_head'

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [departmentResponse, requestResponse] = await Promise.all([
        fetch(`${API_URL}/departments`, { credentials: 'include' }),
        fetch(`${API_URL}/transfer-requests`, { credentials: 'include' }),
      ])

      const departmentData = await departmentResponse.json()
      const requestData = await requestResponse.json()

      if (!departmentResponse.ok || !departmentData.success) {
        throw new Error(departmentData.message || 'Unable to load departments.')
      }

      if (!requestResponse.ok || !requestData.success) {
        throw new Error(requestData.message || 'Unable to load transfer requests.')
      }

      setDepartments(departmentData.departments ?? [])
      setRequests(requestData.requests ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load transfer information.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!ticketId.trim() || !toDepartmentId || reason.trim().length < 5) {
      setError('Enter a ticket ID, destination department, and a reason of at least 5 characters.')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(ticketId.trim())}/transfer-requests`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toDepartmentId: Number(toDepartmentId),
            reason: reason.trim(),
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to submit the transfer request.')
      }

      setMessage(data.message || 'Transfer request submitted.')
      setTicketId('')
      setToDepartmentId('')
      setReason('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit the request.')
    } finally {
      setSubmitting(false)
    }
  }

  async function reviewRequest(
    requestId: number,
    decision: 'approved' | 'rejected',
  ) {
    setError('')
    setMessage('')
    setReviewingId(requestId)

    try {
      const response = await fetch(
        `${API_URL}/transfer-requests/${requestId}/review`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            reviewComment: reviewComments[requestId]?.trim() || null,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to review the transfer request.')
      }

      setMessage(data.message || `Transfer request ${decision}.`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to review the request.')
    } finally {
      setReviewingId(null)
    }
  }

  const visibleRequests = requests.filter((request) =>
    user.role === 'master' ||
    (user.role === 'department_head' && request.destinationHeadUserId === user.id) ||
    request.requestedByUserId === user.id,
  )

  return (
    <div className="space-y-6">
      <header>
        <h2
          className="text-2xl font-semibold tracking-tight"
          style={{ color: 'var(--color-text)' }}
        >
          Ticket transfers
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Request a department transfer or review pending requests.
        </p>
      </header>

      {message && (
        <div
          role="status"
          className="rounded-lg border p-3 text-sm"
          style={{
            backgroundColor: 'var(--color-success-bg)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-success-text)',
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border p-3 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-danger-text)',
          }}
        >
          {error}
        </div>
      )}

      {user.role === 'employee' && <section
        className="rounded-xl border p-5 sm:p-6"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          Request a transfer
        </h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Enter the ticket's database ID and explain why another department should handle it.
        </p>

        <form onSubmit={submitRequest} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Ticket database ID
              <input
                type="number"
                min="1"
                required
                value={ticketId}
                onChange={(event) => setTicketId(event.target.value)}
                placeholder="e.g. 12"
                className="mt-1.5 w-full rounded-lg border px-3 py-2.5 font-normal outline-none"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
            </label>

            <label className="block text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Destination department
              <select
                required
                value={toDepartmentId}
                onChange={(event) => setToDepartmentId(event.target.value)}
                className="mt-1.5 w-full rounded-lg border px-3 py-2.5 font-normal outline-none"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
              >
                <option value="">Select a department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Reason for transfer
            <textarea
              required
              minLength={5}
              maxLength={2000}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this ticket needs another department..."
              className="mt-1.5 w-full rounded-lg border px-3 py-2.5 font-normal outline-none"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {submitting ? 'Submitting...' : 'Submit transfer request'}
          </button>
        </form>
      </section>}

      <section
        className="rounded-xl border p-5 sm:p-6"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {canReview ? 'Transfer requests' : 'My transfer requests'}
          </h3>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Loading transfer requests...
          </p>
        ) : visibleRequests.length === 0 ? (
          <p className="py-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No transfer requests found.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {visibleRequests.map((request) => (
              <article
                key={request.id}
                className="rounded-lg border p-4"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
                      {request.ticketCode} · Ticket ID {request.ticketId}
                    </p>
                    <h4 className="mt-1 font-semibold" style={{ color: 'var(--color-text)' }}>
                      {request.title}
                    </h4>
                  </div>
                  <StatusBadge status={request.status} />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    <strong style={{ color: 'var(--color-text)' }}>Requested by:</strong>{' '}
                    {request.requestedByName}
                  </p>
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    <strong style={{ color: 'var(--color-text)' }}>Submitted:</strong>{' '}
                    {formatDate(request.createdAt)}
                  </p>
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    <strong style={{ color: 'var(--color-text)' }}>From:</strong>{' '}
                    {request.fromDepartmentName}
                  </p>
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    <strong style={{ color: 'var(--color-text)' }}>To:</strong>{' '}
                    {request.toDepartmentName}
                  </p>
                </div>

                <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                    Transfer reason
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm" style={{ color: 'var(--color-text)' }}>
                    {request.reason}
                  </p>
                </div>

                {request.reviewComment && (
                  <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <strong style={{ color: 'var(--color-text)' }}>Review comment:</strong>{' '}
                    {request.reviewComment}
                  </p>
                )}

                {(user.role === 'master' || (user.role === 'department_head' && request.destinationHeadUserId === user.id)) && request.status === 'pending' && (
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      Review comment (optional)
                      <textarea
                        rows={2}
                        value={reviewComments[request.id] ?? ''}
                        onChange={(event) =>
                          setReviewComments((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))
                        }
                        placeholder="Add a note for the requester..."
                        className="mt-1.5 w-full rounded-lg border px-3 py-2 font-normal outline-none"
                        style={{
                          backgroundColor: 'var(--color-bg)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text)',
                        }}
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void reviewRequest(request.id, 'approved')}
                        disabled={reviewingId !== null}
                        className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-accent)' }}
                      >
                        {reviewingId === request.id ? 'Processing...' : 'Approve transfer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void reviewRequest(request.id, 'rejected')}
                        disabled={reviewingId !== null}
                        className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                        style={{
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-danger-text)',
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {request.reviewedByName && (
                  <p className="mt-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Reviewed by {request.reviewedByName} · {formatDate(request.reviewedAt)}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
