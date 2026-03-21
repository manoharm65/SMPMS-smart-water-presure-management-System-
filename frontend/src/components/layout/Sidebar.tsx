import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'HOME' },
  { to: '/map', label: 'MAP VIEW' },
  { to: '/overview', label: 'OVERVIEW' },
  { to: '/alerts', label: 'ALERTS' },
  { to: '/analytics', label: 'ANALYTICS' },
]

export default function Sidebar() {
  return (
    <aside className="flex w-12 flex-col border-r-2 border-rule bg-ink h-full">
      {/* Logo mark at top */}
      <div className="flex justify-center pt-3 pb-4">
        <div className="h-8 w-8 border-2 border-paper flex items-center justify-center">
          <div className="h-2 w-2 bg-signal" />
        </div>
      </div>

      {/* Vertical navigation in the middle */}
      <nav className="flex flex-col items-center gap-6 flex-1 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `vert-text text-paper font-condensed text-[9px] tracking-[0.15em] no-underline transition-colors ${
                isActive
                  ? 'bg-paper text-ink nav-active px-1 py-2'
                  : 'hover:text-muted'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User initials at bottom */}
      <div className="flex justify-center pb-4 pt-4 border-t-2 border-rule">
        <span className="font-mono text-paper text-[12px]">MB</span>
      </div>
    </aside>
  )
}