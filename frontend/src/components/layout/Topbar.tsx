import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useDashboardStore } from '../../store/dashboardStore'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/map', label: 'Map' },
  { to: '/overview', label: 'Overview' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/about', label: 'About' },
]

export default function Topbar() {
  const connection = useDashboardStore((s) => s.connection)
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  return (
    <header className="relative flex h-12 items-center justify-between border-b border-border bg-bg px-3">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-55" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-info to-transparent opacity-35" />

      <div className="flex items-baseline gap-3">
        <div className="text-sm font-semibold tracking-wide text-text">AquaBytes</div>
        <div className="hidden text-[11px] uppercase tracking-wider text-text-muted sm:block">
          Solapur Water Network
        </div>
      </div>

      {/* Sidebar replacement: compact nav "box" */}
      <nav className="mx-3 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded border border-border bg-panel/80 px-2 py-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              [
                'shrink-0 rounded px-2 py-1 text-xs font-semibold tracking-wide transition-colors',
                isActive
                  ? 'bg-bg text-text shadow-[0_0_0_1px_rgba(0,200,150,0.12)]'
                  : 'text-text-muted hover:bg-bg hover:text-text',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-3 text-xs">
        <div
          className={
            'flex items-center gap-2 rounded border px-2 py-1 ' +
            (connection.status === 'connected'
              ? 'border-[rgba(0,200,150,0.35)] bg-[rgba(0,200,150,0.08)]'
              : connection.status === 'connecting'
                ? 'border-[rgba(245,166,35,0.35)] bg-[rgba(245,166,35,0.08)]'
                : 'border-[rgba(240,77,77,0.35)] bg-[rgba(240,77,77,0.08)]')
          }
        >
          <span
            className={
              'h-2 w-2 rounded-full shadow-[0_0_12px_rgba(0,0,0,0.35)] ' +
              (connection.status === 'connected'
                ? 'bg-accent shadow-[0_0_12px_rgba(0,200,150,0.40)]'
                : connection.status === 'connecting'
                  ? 'bg-warning shadow-[0_0_12px_rgba(245,166,35,0.35)]'
                  : 'bg-critical shadow-[0_0_12px_rgba(240,77,77,0.35)]')
            }
          />
          <span className="font-mono text-[12px] tracking-wide text-text">
            {connection.status === 'connected'
              ? 'LIVE'
              : connection.status === 'connecting'
                ? 'CONNECTING'
                : 'OFFLINE'}
          </span>
        </div>

        <div className="hidden font-mono text-text-faint sm:block">
          {connection.lastMessageAt
            ? new Date(connection.lastMessageAt).toLocaleTimeString()
            : '--:--:--'}
        </div>

        {!token ? (
          <button
            className="rounded border border-border bg-panel px-2 py-1 text-xs font-semibold text-text hover:bg-bg"
            onClick={() => navigate('/login')}
          >
            Login
          </button>
        ) : (
          <button
            className="rounded border border-border bg-panel px-2 py-1 text-xs font-semibold text-text hover:bg-bg"
            onClick={() => {
              logout()
              navigate('/', { replace: true })
            }}
            title={user?.username ?? 'Signed in'}
          >
            Logout
          </button>
        )}
      </div>
    </header>
  )
}
