import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import type { IwedsData } from '../../../services/api'

Chart.register(...registerables)

interface IWEDSChartProps {
  data: IwedsData | null
  loading?: boolean
}

const severityColors: Record<string, string> = {
  low: '#007A3D',
  medium: '#CC5500',
  high: '#E8001D',
  critical: '#990014',
}

export default function IWEDSChart({ data, loading = false }: IWEDSChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !data?.anomaly_history) return

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const labels = data.anomaly_history.map((h: IwedsData['anomaly_history'][number]) => {
      const date = new Date(h.timestamp)
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    })

    const severityMap: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }
    const severityData = data.anomaly_history.map(
      (h: IwedsData['anomaly_history'][number]) => severityMap[h.severity] || 0
    )

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Anomaly Severity',
            data: severityData,
            backgroundColor: data.anomaly_history.map(
              (h: IwedsData['anomaly_history'][number]) => severityColors[h.severity] || '#6B6B6B'
            ),
            borderWidth: 0,
            borderRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: '#0A0A0A',
            titleFont: { family: 'Space Mono', size: 11 },
            bodyFont: { family: 'Space Mono', size: 10 },
            callbacks: {
              label: (context) => {
                const idx = context.dataIndex
                const item = data.anomaly_history[idx]
                return [
                  `Severity: ${item.severity.toUpperCase()}`,
                  `Type: ${item.type}`,
                  `Node: ${item.node}`,
                ]
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: 'Space Mono', size: 9 },
              color: '#6B6B6B',
              maxTicksLimit: 8,
            },
          },
          y: {
            grid: { color: '#E5E5E5', lineWidth: 0.5 },
            ticks: {
              font: { family: 'Space Mono', size: 9 },
              color: '#6B6B6B',
              callback: (value) => {
                const labels: Record<number, string> = { 0: 'None', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' }
                return labels[value as number] || ''
              },
            },
            min: 0,
            max: 4,
            title: {
              display: true,
              text: 'Severity Level',
              font: { family: 'Space Mono', size: 10 },
              color: '#6B6B6B',
            },
          },
        },
      },
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [data])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="font-condensed text-[12px] text-dim">Loading IWEDS state...</span>
      </div>
    )
  }

  return (
    <div className="h-full">
      <canvas ref={canvasRef} />
    </div>
  )
}

export function IWEDSSummaryCards({ data }: { data: IwedsData | null }) {
  if (!data?.current_state) return null

  const state = data.current_state
  const statusColors: Record<string, string> = {
    active: '#007A3D',
    idle: '#6B6B6B',
    error: '#E8001D',
  }

  return (
    <div className="grid grid-cols-4 gap-4 mb-4">
      <div className="border border-rule p-3 rounded">
        <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
          Status
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusColors[state.status] }}
          />
          <span className="font-mono text-[20px] text-ink uppercase">{state.status}</span>
        </div>
      </div>
      <div className="border border-rule p-3 rounded">
        <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
          Anomalies
        </div>
        <div className="font-mono text-[28px] text-ink">{state.anomalies_detected}</div>
      </div>
      <div className="border border-rule p-3 rounded">
        <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
          Confidence
        </div>
        <div className="font-mono text-[28px] text-pass">
          {(state.anomaly_confidence * 100).toFixed(0)}%
        </div>
      </div>
      <div className="border border-rule p-3 rounded">
        <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
          Last Cycle
        </div>
        <div className="font-mono text-[14px] text-ink">
          {state.last_cycle
            ? new Date(state.last_cycle).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '-'}
        </div>
      </div>
    </div>
  )
}

export function IWEDSRecommendations({ data }: { data: IwedsData | null }) {
  if (!data?.current_state?.recommended_actions?.length) return null

  return (
    <div className="mt-4 p-4 border border-rule rounded bg-paper">
      <h4 className="font-condensed text-[12px] uppercase tracking-wider text-dim mb-3">
        Recommended Actions
      </h4>
      <ul className="space-y-2">
        {data.current_state.recommended_actions.map((action: string, idx: number) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 mt-2 rounded-full bg-signal" />
            <span className="font-mono text-[12px] text-ink">{action}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}