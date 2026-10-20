
import { useEffect, useState } from 'react'
import {
  createTicket,
  getDepartments,
  type Department,
} from '../../services/ticketService'

interface CreateTicketFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export default function CreateTicketForm({
  onSuccess,
  onCancel,
}: CreateTicketFormProps) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [loadingDepartments, setLoadingDepartments] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDepartments() {
      try {
        const data = await getDepartments()
        setDepartments(data)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load departments.',
        )
      } finally {
        setLoadingDepartments(false)
      }
    }

    void loadDepartments()
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await createTicket({
        title: title.trim(),
        description: description.trim(),
        departmentId: Number(departmentId),
      })

      onSuccess()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to create ticket.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const fieldClass =
    'w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]/70 outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 disabled:cursor-not-allowed disabled:opacity-60'

  const labelClass =
    'mb-1.5 block text-sm font-medium text-[var(--color-text)]'

  return (
    <section className="w-full min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--color-shadow)] sm:p-6 lg:p-7">
      {/* Header */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
          Support request
        </p>

        <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--color-text)] sm:text-2xl">
          Create a ticket
        </h2>

        <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
          Describe your issue clearly so the appropriate department can help.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title and department side by side on larger screens */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="ticket-title" className={labelClass}>
              Ticket title
            </label>

            <input
              id="ticket-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Laptop is not starting"
              minLength={5}
              maxLength={200}
              required
              className={fieldClass}
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="ticket-department" className={labelClass}>
              Department
            </label>

            <select
              id="ticket-department"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              required
              disabled={loadingDepartments || departments.length === 0}
              className={fieldClass}
            >
              <option value="">
                {loadingDepartments
                  ? 'Loading departments...'
                  : departments.length === 0
                    ? 'No active departments available'
                    : 'Select a department'}
              </option>

              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label htmlFor="ticket-description" className="text-sm font-medium text-[var(--color-text)]">
              Describe your issue
            </label>

            <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
              {description.length}/10000
            </span>
          </div>

          <textarea
            id="ticket-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Explain what happened, what you were doing, and what help you need..."
            minLength={10}
            maxLength={10000}
            rows={4}
            required
            className={`${fieldClass} min-h-28 resize-y`}
          />
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-[var(--color-danger-text)]/30 bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-sm text-[var(--color-danger-text)]"
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2.5 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              submitting ||
              loadingDepartments ||
              departments.length === 0
            }
            className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Creating ticket...' : 'Submit ticket'}
          </button>
        </div>
      </form>
    </section>
  )
}
