import type { ReactNode } from 'react'

interface ModelTabProps {
  title: string
  description: string
  children: ReactNode
  actions?: ReactNode
  stats?: ReactNode
}

export default function ModelTab({
  title,
  description,
  children,
  actions,
  stats,
}: ModelTabProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-syne font-bold text-[18px] text-ink">{title}</h2>
          <p className="font-condensed text-[12px] text-dim mt-1">{description}</p>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {stats && <div className="mb-4">{stats}</div>}

      <div className="flex-1 min-h-0 border border-rule rounded bg-paper">
        {children}
      </div>
    </div>
  )
}