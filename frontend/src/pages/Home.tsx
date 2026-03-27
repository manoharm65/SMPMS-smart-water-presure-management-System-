import { Link } from 'react-router-dom'

type CardTone = 'info' | 'pass' | 'warn' | 'signal'

const cards = [
  { to: '/map', title: 'Map', subtitle: 'Pipeline network and assets', tone: 'info' as CardTone },
  { to: '/overview', title: 'Overview', subtitle: 'KPIs and zone summary', tone: 'pass' as CardTone },
  { to: '/alerts', title: 'Alerts', subtitle: 'Operator actions and events', tone: 'warn' as CardTone },
  { to: '/analytics', title: 'Analytics', subtitle: 'Trends and insights', tone: 'signal' as CardTone },
]

const toneColors: Record<CardTone, { border: string; bar: string; text: string }> = {
  info: { border: '#004DB3', bar: '#004DB3', text: '#004DB3' },
  pass: { border: '#007A3D', bar: '#007A3D', text: '#007A3D' },
  warn: { border: '#CC5500', bar: '#CC5500', text: '#CC5500' },
  signal: { border: '#E8001D', bar: '#E8001D', text: '#E8001D' },
}

export default function Home() {
  return (
    <div className="bg-paper min-h-screen p-5">
      {/* Masthead */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-dim font-condensed">
          System
        </div>
        <h1 className="font-syne font-semibold text-[16px] text-ink mt-1">
          Solapur Water Management System Dashboard
        </h1>
        <p className="text-[14px] text-muted mt-1">
          Real-time pipeline monitoring, alerts, and analytics for Solapur Municipal Department.
        </p>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {cards.map((card) => {
          const tone = toneColors[card.tone]
          return (
            <Link
              key={card.to}
              to={card.to}
              className="group relative rounded-lg border-2 bg-white/60 overflow-hidden hover:scale-[1.02] hover:shadow-lg transition-all duration-200"
              style={{ borderColor: tone.border }}
            >
              {/* Left accent bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: tone.bar }}
              />

              <div className="p-5 pl-6">
                <h2
                  className="font-syne font-bold text-[28px] text-ink leading-none"
                  style={{ color: tone.text }}
                >
                  {card.title}
                </h2>
                <p className="font-condensed text-[14px] text-muted mt-1">
                  {card.subtitle}
                </p>

                <div className="mt-6">
                  <button
                    className="px-4 py-2 text-[12px] font-condensed uppercase tracking-wider border-2 transition-all duration-200 group-hover:shadow-md"
                    style={{ borderColor: tone.border, color: tone.text }}
                  >
                    Open <span className="font-mono ml-1">→</span>
                  </button>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
