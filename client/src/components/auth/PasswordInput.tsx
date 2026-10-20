
import { useState } from 'react'

interface PasswordInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
  maxLength?: number
}

export default function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder = 'Enter your password',
  autoComplete = 'current-password',
  required = true,
  maxLength = 128,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-slate-700"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          name={id}
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-20 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />

        <button
          type="button"
          onClick={() => setShowPassword((previous) => !previous)}
          className="absolute inset-y-0 right-3 text-sm font-semibold text-blue-600 hover:text-blue-800"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  )
}
