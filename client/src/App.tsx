
import { useEffect, useState } from 'react'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import { getCurrentUser, logout } from './services/authService'
import type { LoggedInUser } from './types/auth'

function App() {
  const [user, setUser] = useState<LoggedInUser | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let active = true

    async function checkSession() {
      try {
        const currentUser = await getCurrentUser()

        if (active) {
          setUser(currentUser)
        }
      } catch {
        if (active) {
          setUser(null)
        }
      } finally {
        if (active) {
          setCheckingSession(false)
        }
      }
    }

    void checkSession()

    return () => {
      active = false
    }
  }, [])

  async function handleLogout() {
    try {
      await logout()
    } finally {
      setUser(null)
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm font-medium text-slate-500">
          Checking your session...
        </p>
      </main>
    )
  }

  if (user) {
    return <DashboardPage user={user} onLogout={handleLogout} />
  }

  return <LoginPage onLoginSuccess={setUser} />
}

export default App
