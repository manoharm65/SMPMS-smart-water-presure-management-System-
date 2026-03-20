import { useState, useEffect } from 'react'

interface TopbarProps {
  title?: string
  onAlerts?: () => void
}

function useClock() {
  const [time, setTime] = useState<Date>(new Date())

  useEffect(() => {
    // Update every second
    const interval = setInterval(() => {
      // Convert to IST (UTC+5:30)
      const now = new Date()
      const istOffset = 5.5 * 60 * 60 * 1000 // 5 hours 30 minutes in ms
      const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset)
      setTime(istTime)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return time
}

export default function Topbar({ title, onAlerts }: TopbarProps) {
  const clockTime = useClock()

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  return (
    <header className="flex h-11 items-center justify-between border-b-2 border-rule bg-paper px-4">
      {/* Left section - Brand */}
      <div className="flex items-baseline gap-3 border-r-2 border-rule pr-4">
        <span className="font-syne font-extrabold text-[13px] tracking-wide text-ink">
          AQUABYTES
        </span>
        <span className="font-condensed text-[11px] text-dim hidden sm:block">
          Solapur Municipal Corporation
        </span>
      </div>

      {/* Center section - Breadcrumb/Title */}
      <div className="flex-1 flex justify-center border-r-2 border-rule px-4">
        {title && (
          <span className="font-syne font-extrabold text-[10px] tracking-[0.12em] text-ink uppercase">
            {title}
          </span>
        )}
      </div>

      {/* Right section - Clock and Alerts */}
      <div className="flex items-center gap-4 pl-4">
        {/* Clock */}
        <div className="font-mono text-[11px] text-ink">
          {formatTime(clockTime)}
        </div>

        {/* Alert button */}
        <button
          type="button"
          onClick={onAlerts}
          className="flex items-center gap-2 font-condensed text-[10px] tracking-[0.1em] text-ink hover:text-signal transition-colors"
        >
          <span className="relative flex items-center justify-center">
            <span className="h-2 w-2 bg-signal rounded-full blink" />
          </span>
          <span className="hidden sm:inline">3 ACTIVE ALERTS</span>
        </button>
      </div>
    </header>
  )
}