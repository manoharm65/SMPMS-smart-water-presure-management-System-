import { useDashboardStore } from '../../store/dashboardStore'

export default function Topbar() {
  const connection = useDashboardStore((s) => s.connection)

  return (
    <header className="relative flex h-12 items-center justify-between border-b border-border bg-panel px-3">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-40" />
      <div className="flex items-baseline gap-3">
        <div className="text-sm font-semibold tracking-wide text-text">
          AquaBytes
        </div>
        <div className="text-[11px] uppercase tracking-wider text-text-muted">
          SCADA IoT Pressure Monitoring
        </div>
      </div>

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
      </div>
    </header>
  )
}
