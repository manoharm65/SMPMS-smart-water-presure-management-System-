import { Link } from 'react-router-dom'

type NavCard = {
  to: string
  title: string
  subtitle: string
  tone: 'accent' | 'info' | 'warning' | 'critical'
}

const cards: NavCard[] = [
  {
    to: '/map',
    title: 'Map',
    subtitle: 'Pipeline network and assets',
    tone: 'info',
  },
  {
    to: '/overview',
    title: 'Overview',
    subtitle: 'KPIs and zone summary',
    tone: 'accent',
  },
  {
    to: '/alerts',
    title: 'Alerts',
    subtitle: 'Operator actions and events',
    tone: 'warning',
  },
  {
    to: '/analytics',
    title: 'Analytics',
    subtitle: 'Trends and insights',
    tone: 'critical',
  },
]

function toneClasses(tone: NavCard['tone']) {
  switch (tone) {
    case 'info':
      return {
        ring: 'hover:shadow-[0_0_30px_rgba(74,159,245,0.60)] hover:shadow-2xl',
        glow: 'group-hover:opacity-100',
        bg: 'from-blue-900/40 via-info/35 to-bg',
        dot: 'bg-info',
        glowBg: 'bg-info/50',
        border: 'border-info/60 hover:border-info/100',
      }
    case 'warning':
      return {
        ring: 'hover:shadow-[0_0_30px_rgba(245,166,35,0.60)] hover:shadow-2xl',
        glow: 'group-hover:opacity-100',
        bg: 'from-yellow-900/35 via-warning/40 to-bg',
        dot: 'bg-warning',
        glowBg: 'bg-warning/50',
        border: 'border-warning/60 hover:border-warning/100',
      }
    case 'critical':
      return {
        ring: 'hover:shadow-[0_0_30px_rgba(240,77,77,0.60)] hover:shadow-2xl',
        glow: 'group-hover:opacity-100',
        bg: 'from-red-900/40 via-critical/35 to-bg',
        dot: 'bg-critical',
        glowBg: 'bg-critical/50',
        border: 'border-critical/60 hover:border-critical/100',
      }
    case 'accent':
    default:
      return {
        ring: 'hover:shadow-[0_0_30px_rgba(0,200,150,0.60)] hover:shadow-2xl',
        glow: 'group-hover:opacity-100',
        bg: 'from-teal-900/40 via-accent/35 to-bg',
        dot: 'bg-accent',
        glowBg: 'bg-accent/50',
        border: 'border-accent/60 hover:border-accent/100',
      }
  }
}

export default function Home() {
  return (
    <div className="h-full w-full p-3 md:p-5 bg-gradient-to-br from-slate-900 via-blue-900/30 to-slate-900">
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(0,200,150,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(74,159,245,0.1) 0%, transparent 50%)'}} />
      <div className="mx-auto flex h-full max-w-6xl flex-col relative z-10">
        <div className="rounded border border-border bg-panel px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-text-faint">System</div>
          <div className="mt-1 text-base font-semibold text-text">Solapur Water Management System Dashboard</div>
          <div className="mt-1 text-sm text-text-muted">
            Real-time pipeline monitoring, alerts, and analytics for Solapur Municipal Department.
          </div>
        </div>

        <div className="mt-3 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {cards.map((c) => {
            const t = toneClasses(c.tone)
            return (
              <Link
                key={c.to}
                to={c.to}
                className={
                  [
                    'group relative overflow-hidden rounded-2xl lg:rounded-3xl border transition-all duration-300',
                    'hover:scale-[1.08] hover:-translate-y-1',
                    t.ring,
                    t.border,
                  ].join(' ')
                }
              >
                <div className={['pointer-events-none absolute inset-0', 'bg-gradient-to-br', t.bg].join(' ')} />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-text-faint to-transparent opacity-50" />
                <div className="pointer-events-none absolute -inset-1 rounded-2xl lg:rounded-3xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300" style={{background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)'}} />

                <div className="relative flex h-full flex-col p-6 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-widest text-text-faint/80 font-medium">Module</div>
                    <div className={['h-5 w-5 rounded-full', t.dot, 'shadow-[0_0_16px_currentColor] animate-pulse'].join(' ')} />
                  </div>

                  <div className="mt-4 text-3xl lg:text-4xl font-bold text-text">{c.title}</div>
                  <div className="mt-2 text-base text-text-muted/90 leading-relaxed">{c.subtitle}</div>

                  <div className="mt-auto pt-6">
                    <div className={['inline-block rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl border-2', t.dot, t.border].join(' ')}>
                      <div className="flex items-center gap-2 text-text">
                        Open
                        <span className="font-mono">→</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={
                      [
                        'pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100',
                        t.glow,
                        t.glowBg,
                      ].join(' ')
                    }
                  />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
