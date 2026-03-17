import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const status = useAuthStore((s) => s.status)
  const error = useAuthStore((s) => s.error)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const disabled = useMemo(() => status === 'loading', [status])

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded border border-border bg-panel p-5">
        <div className="text-xs uppercase tracking-wider text-text-faint">AquaBytes</div>
        <div className="mt-1 text-lg font-semibold text-text">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </div>
        <div className="mt-1 text-sm text-text-muted">
          Login is optional. Create an account the first time.
        </div>

        <div className="mt-3 flex rounded border border-border bg-bg p-1">
          <button
            type="button"
            className={
              'flex-1 rounded px-2 py-1 text-xs font-semibold ' +
              (mode === 'login' ? 'bg-panel text-text' : 'text-text-muted hover:text-text')
            }
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={
              'flex-1 rounded px-2 py-1 text-xs font-semibold ' +
              (mode === 'register' ? 'bg-panel text-text' : 'text-text-muted hover:text-text')
            }
            onClick={() => setMode('register')}
          >
            Sign up
          </button>
        </div>

        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (mode === 'login') {
              await login(username, password)
            } else {
              await register(username, password)
            }
            navigate('/', { replace: true })
          }}
        >
          <div>
            <label className="text-[11px] uppercase tracking-wider text-text-faint">Username</label>
            <input
              className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="text"
              autoComplete="username"
              placeholder="admin@gmail.com"
              required
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-text-faint">Password</label>
            <input
              className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <div className="rounded border border-[rgba(240,77,77,0.35)] bg-[rgba(240,77,77,0.08)] px-3 py-2 text-sm text-critical">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={disabled}
            className="w-full rounded border border-[rgba(0,200,150,0.35)] bg-[rgba(0,200,150,0.10)] px-3 py-2 text-sm font-semibold text-accent hover:bg-[rgba(0,200,150,0.14)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {disabled
              ? mode === 'login'
                ? 'Signing in…'
                : 'Creating…'
              : mode === 'login'
                ? 'Login'
                : 'Create account'}
          </button>
        </form>

        <div className="mt-3 text-xs text-text-faint">
          API:{' '}
          <span className="font-mono">
            {mode === 'login' ? '/api/auth/login' : '/api/auth/register'}
          </span>
        </div>
      </div>
    </div>
  )
}
