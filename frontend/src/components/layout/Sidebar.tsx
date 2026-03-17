import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/map', label: 'Map' },
  { to: '/overview', label: 'Overview' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/about', label: 'About' },
]

export default function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r border-border bg-panel">
      <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-text-faint">
        Control Center
      </div>
      <nav className="flex flex-col gap-1 px-2 pb-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'relative rounded px-2 py-2 text-sm',
                'border border-transparent transition-colors',
                isActive
                  ? 'bg-bg text-text border-border shadow-[0_0_0_1px_rgba(0,200,150,0.10)]'
                  : 'text-text-muted hover:bg-bg hover:text-text',
              ].join(' ')
            }
            end={item.to === '/'}
          >
            {({ isActive }) => (
              <>
                <span
                  className={
                    'absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded ' +
                    (isActive
                      ? 'bg-accent shadow-[0_0_14px_rgba(0,200,150,0.35)]'
                      : 'bg-transparent')
                  }
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-border px-3 py-2">
        <div className="text-[11px] uppercase tracking-wider text-text-faint">
          System
        </div>
        <div className="mt-1 text-xs text-text-muted">
          Pipeline pressure / valves / DMA zones
        </div>
      </div>
    </aside>
  )
}
