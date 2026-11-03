import { useCallback, useEffect, useState } from 'react'
import type { Ticket } from '../../services/ticketService'
import type { LoggedInUser } from '../../types/auth'

const API = 'http://localhost:5000/api'
type Comment = { id: number; comment: string; createdAt: string; userId: number; userName: string; userRole: string }
type Resolution = { id: number; resolutionComment: string; status: string; createdAt: string; submittedByName: string }

interface Props {
  ticket: Ticket
  user: LoggedInUser
  onUpdated: () => void
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  })
  const data = await response.json()
  if (!response.ok || !data.success) throw new Error(data.message || 'Request failed.')
  return data as T
}

function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function TicketWorkflowPanel({ ticket, user, onUpdated }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [resolution, setResolution] = useState<Resolution | null>(null)
  const [comment, setComment] = useState('')
  const [resolutionText, setResolutionText] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [priority, setPriority] = useState(ticket.priority ?? 'Medium')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const [commentData, resolutionData] = await Promise.all([
        request<{ comments: Comment[] }>(`/tickets/${ticket.id}/comments`),
        request<{ resolution: Resolution | null }>(`/tickets/${ticket.id}/resolution`),
      ])
      setComments(commentData.comments ?? [])
      setResolution(resolutionData.resolution ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ticket discussion.')
    }
  }, [ticket.id])

  useEffect(() => { void load() }, [load])

  const isRequester = user.id === ticket.requesterUserId
  const isAssignedEmployee = user.role === 'employee' && ticket.assignedEmployeeId === user.id
  const canManagePriority = user.role === 'master' || user.role === 'department_head'
  const locked = ['closed', 'transfer_pending', 'resolution_pending'].includes(ticket.status.toLowerCase())

  async function runAction(path: string, method: string, body?: Record<string, unknown>, success?: string) {
    setBusy(true); setError(''); setNotice('')
    try {
      await request(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
      setNotice(success || 'Updated successfully.')
      await load()
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete this action.')
    } finally { setBusy(false) }
  }

  async function addComment() {
    if (!comment.trim()) return
    await runAction(`/tickets/${ticket.id}/comments`, 'POST', { comment: comment.trim() }, 'Comment added.')
    setComment('')
  }

  async function submitResolution() {
    if (resolutionText.trim().length < 5) { setError('Please enter at least 5 characters describing the resolution.'); return }
    await runAction(`/tickets/${ticket.id}/resolution`, 'POST', { resolutionComment: resolutionText.trim() }, 'Resolution submitted to the requester.')
    setResolutionText('')
  }

  async function reviewResolution(decision: 'approved' | 'rejected') {
    if (!resolution) return
    if (decision === 'rejected' && reviewComment.trim().length < 3) { setError('Please explain why the resolution is being rejected.'); return }
    await runAction(`/tickets/${ticket.id}/resolution/${resolution.id}/review`, 'PATCH', { decision, reviewComment: reviewComment.trim() }, decision === 'approved' ? 'Resolution approved. Ticket closed.' : 'Resolution rejected and returned to the department head.')
    setReviewComment('')
  }

  return (
    <section className="space-y-5 border-t pt-5" style={{ borderColor: 'var(--color-border)' }}>
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Work updates & resolution</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Discuss the ticket, submit completed work, and review the proposed resolution.</p>
      </div>

      {error && <p role="alert" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-danger-text)' }}>{error}</p>}
      {notice && <p role="status" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-success-text)' }}>{notice}</p>}

      {canManagePriority && ticket.status !== 'closed' && ticket.status !== 'transfer_pending' && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }} htmlFor="ticket-priority">Priority</label>
          <select id="ticket-priority" value={priority} onChange={e => setPriority(e.target.value as typeof priority)} className="rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
            {['Low', 'Medium', 'High', 'Critical'].map(value => <option key={value}>{value}</option>)}
          </select>
          <button type="button" disabled={busy || priority === ticket.priority} onClick={() => void runAction(`/tickets/${ticket.id}/priority`, 'PATCH', { priority }, 'Priority updated.')} className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--color-accent)' }}>Save priority</button>
        </div>
      )}

      {resolution && (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
          <div className="flex flex-wrap justify-between gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Resolution submitted by {resolution.submittedByName}</p>
            <span className="text-xs capitalize" style={{ color: 'var(--color-text-secondary)' }}>{resolution.status} · {displayDate(resolution.createdAt)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>{resolution.resolutionComment}</p>
          {isRequester && resolution.status === 'pending' && ticket.status === 'resolution_pending' && (
            <div className="space-y-3 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
              <label className="block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }} htmlFor="resolution-review-comment">Review comment (required when rejecting)</label>
              <textarea id="resolution-review-comment" value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={2} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} placeholder="Add feedback if the work is not complete..." />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void reviewResolution('approved')} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--color-success-text)' }}>Approve & close</button>
                <button type="button" disabled={busy} onClick={() => void reviewResolution('rejected')} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Reject resolution</button>
              </div>
            </div>
          )}
        </div>
      )}

      {isAssignedEmployee && ['assigned', 'in_progress'].includes(ticket.status) && (
        <div className="space-y-2">
          <label htmlFor="resolution-text" className="block text-sm font-medium" style={{ color: 'var(--color-text)' }}>Submit resolution</label>
          <textarea id="resolution-text" value={resolutionText} onChange={e => setResolutionText(e.target.value)} rows={3} className="w-full rounded-lg border px-3 py-2.5 text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} placeholder="Describe the work completed and the outcome..." />
          <button type="button" disabled={busy || resolutionText.trim().length < 5} onClick={() => void submitResolution()} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--color-accent)' }}>Submit for requester approval</button>
        </div>
      )}

      {isRequester && ticket.status === 'closed' && (
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
          <p className="mb-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>If the issue has returned, you can reopen this ticket within 7 days of closure.</p>
          <button type="button" disabled={busy} onClick={() => void runAction(`/tickets/${ticket.id}/reopen`, 'POST', undefined, 'Ticket reopened and returned to the department head.')} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>Reopen ticket</button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Comments & work updates</h4>
          <button type="button" onClick={() => void load()} className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>Refresh</button>
        </div>
        {comments.length === 0 ? <p className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>No comments yet.</p> : (
          <div className="space-y-2">{comments.map(item => (
            <article key={item.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
              <div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{item.userName} <span className="font-normal capitalize" style={{ color: 'var(--color-text-secondary)' }}>· {item.userRole.replaceAll('_', ' ')}</span></p><time className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{displayDate(item.createdAt)}</time></div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>{item.comment}</p>
            </article>
          ))}</div>
        )}
        {!locked && (
          <div className="space-y-2">
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} maxLength={10000} className="w-full rounded-lg border px-3 py-2.5 text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} placeholder="Add a comment or work update..." />
            <button type="button" disabled={busy || !comment.trim()} onClick={() => void addComment()} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--color-accent)' }}>Add comment</button>
          </div>
        )}
      </div>
    </section>
  )
}
