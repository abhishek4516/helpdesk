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

type Priority = 'Low' | 'Medium' | 'High' | 'Critical'

const priorities: { value: Priority; dot: string }[] = [
  { value: 'Low', dot: 'bg-emerald-500' },
  { value: 'Medium', dot: 'bg-sky-500' },
  { value: 'High', dot: 'bg-amber-500' },
  { value: 'Critical', dot: 'bg-rose-500' },
]

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)'

// text-base on mobile prevents iOS zoom-on-focus
const fieldClass =
  'w-full rounded-xl border border-(--color-border) bg-(--color-bg) px-3.5 text-base text-(--color-text) placeholder:text-(--color-text-secondary) outline-none transition focus:border-(--color-accent) focus:ring-2 focus:ring-(--color-accent)/15 disabled:opacity-60 sm:text-sm'

const labelClass = 'mb-1.5 block text-sm font-medium text-(--color-text)'

function Required() {
  return <span className="text-(--color-danger-text)"> *</span>
}

export default function CreateTicketForm({
  onSuccess,
  onCancel,
}: CreateTicketFormProps) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [priority, setPriority] = useState<Priority>('Medium')
  const [loadingDepartments, setLoadingDepartments] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDepartments() {
      try {
        const data = await getDepartments()
        setDepartments(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load departments.')
      } finally {
        setLoadingDepartments(false)
      }
    }

    void loadDepartments()
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (title.trim().length < 5) {
      setError('Title must contain at least 5 characters.')
      return
    }

    if (description.trim().length < 10) {
      setError('Description must contain at least 10 characters.')
      return
    }

    if (!departmentId) {
      setError('Please select a department.')
      return
    }

    setSubmitting(true)

    try {
      await createTicket({
        title: title.trim(),
        description: description.trim(),
        departmentId: Number(departmentId),
        priority,
      })

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create ticket.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className={`inline-flex items-center gap-2 rounded text-sm font-medium text-(--color-accent) transition hover:opacity-80 disabled:opacity-50 ${focusRing}`}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5m6-6-6 6 6 6" />
        </svg>
        Back to tickets
      </button>

      <section className="relative overflow-hidden rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-violet-500 via-indigo-500 to-sky-500" />

        <div className="flex items-center gap-3 border-b border-(--color-border) px-5 pt-6 pb-5 sm:px-7">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--color-accent-soft) text-(--color-accent)">
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-(--color-text) sm:text-xl">
              Create a ticket
            </h2>
            <p className="mt-0.5 text-sm text-(--color-text-secondary)">
              Fill in the details below to raise a support request.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-7">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="ticket-title" className={labelClass}>
                Title
                <Required />
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
                disabled={submitting}
                className={`${fieldClass} h-11`}
              />
            </div>

            <div>
              <label htmlFor="ticket-department" className={labelClass}>
                Department
                <Required />
              </label>
              <select
                id="ticket-department"
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
                required
                disabled={loadingDepartments || departments.length === 0 || submitting}
                className={`${fieldClass} h-11`}
              >
                <option value="">
                  {loadingDepartments
                    ? 'Loading departments...'
                    : departments.length === 0
                      ? 'No departments available'
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

          <fieldset disabled={submitting}>
            <legend className={labelClass}>
              Priority
              <Required />
            </legend>
            <div
              role="radiogroup"
              aria-label="Priority"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {priorities.map((item) => {
                const active = priority === item.value

                return (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPriority(item.value)}
                    className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition disabled:opacity-60 ${focusRing} ${
                      active
                        ? 'border-(--color-accent) bg-(--color-accent-soft) text-(--color-accent-text)'
                        : 'border-(--color-border) text-(--color-text-secondary) hover:bg-(--color-accent-soft) hover:text-(--color-text)'
                    }`}
                  >
                    <span className={`size-2 rounded-full ${item.dot}`} />
                    {item.value}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label
                htmlFor="ticket-description"
                className="text-sm font-medium text-(--color-text)"
              >
                Description
                <Required />
              </label>
              <span className="text-xs tabular-nums text-(--color-text-secondary)">
                {description.length}/10000
              </span>
            </div>
            <textarea
              id="ticket-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe your issue..."
              minLength={10}
              maxLength={10000}
              rows={6}
              // required
              disabled={submitting}
              className={`${fieldClass} min-h-36 resize-y py-3`}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-(--color-danger-text)/30 bg-(--color-danger-bg) px-4 py-3 text-sm text-(--color-danger-text)"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-(--color-border) pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className={`inline-flex h-10 items-center justify-center rounded-xl border border-(--color-border) px-5 text-sm font-medium text-(--color-text) transition hover:bg-(--color-accent-soft) disabled:opacity-50 ${focusRing}`}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || loadingDepartments || departments.length === 0}
              className={`inline-flex h-10 items-center justify-center rounded-xl bg-(--color-accent) px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-(--color-accent-hover) disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
            >
              {submitting ? 'Creating ticket...' : 'Submit ticket'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}