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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (mode === 'login') {
        await login(username, password)
      } else {
        await register(username, password)
      }
      navigate('/', { replace: true })
    } catch {
      // error is handled by the store
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded border-2 border-rule bg-paper p-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-syne text-2xl font-800 tracking-tight text-ink">
            AQUABYTES
          </h1>
          <p className="font-condensed mt-1 text-xs uppercase tracking-widest text-dim">
            Solapur Municipal Corporation
          </p>
        </div>

        {/* Divider */}
        <div className="my-6 border-t-2 border-rule" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-condensed block text-[11px] uppercase tracking-wider text-dim">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full border-2 border-rule bg-paper px-3 py-2 font-condensed text-sm text-ink outline-none focus:border-ink"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="font-condensed block text-[11px] uppercase tracking-wider text-dim">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border-2 border-rule bg-paper px-3 py-2 font-condensed text-sm text-ink outline-none focus:border-ink"
              autoComplete="current-password"
              required
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="border-2 border-signal bg-paper px-3 py-2 font-condensed text-sm text-signal">
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={disabled}
            className="w-full bg-ink py-3 font-condensed text-sm font-700 uppercase tracking-wider text-paper hover:bg-rule disabled:cursor-not-allowed disabled:opacity-60"
          >
            {disabled
              ? mode === 'login'
                ? 'Signing in...'
                : 'Creating account...'
              : mode === 'login'
                ? 'Login'
                : 'Register'}
          </button>
        </form>

        {/* Toggle mode */}
        <div className="mt-4 text-center font-condensed text-xs text-dim">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="font-700 text-ink underline underline-offset-2"
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="font-700 text-ink underline underline-offset-2"
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
