import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import type { LeakAnalysis, LeakMetric } from '../../../services/api'

Chart.register(...registerables)

interface LeakChartProps {
  data: LeakAnalysis | null
  loading?: boolean
}

const statusColors: Record<string, string> = {
  none: '#007A3D',
  minor: '#CC5500',
  moderate: '#E8001D',
  severe: '#990014',
}

export default function LeakChart({ data, loading = false }: LeakChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !data?.history) return

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const labels = data.history.map((h: LeakMetric) => {
      const date = new Date(h.timestamp)
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    })

    const zoneGroups = [...new Set(data.history.map((h: LeakMetric) => h.zone_id))] as string[]
    const datasets = zoneGroups.map((zoneId: string, idx: number) => {
      const zoneData = data.history.filter((h: LeakMetric) => h.zone_id === zoneId)
      const colors = ['#E8001D', '#004DB3', '#CC5500', '#007A3D']
      return {
        label: zoneId.toUpperCase(),
        data: zoneData.map((h: LeakMetric) => h.probability * 100),
        borderColor: colors[idx % colors.length],
        backgroundColor: `${colors[idx % colors.length]}20`,
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 2,
        pointBackgroundColor: colors[idx % colors.length],
      }
    })

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { family: 'Space Mono', size: 10 },
              color: '#6B6B6B',
              boxWidth: 12,
              padding: 8,
            },
          },
          tooltip: {
            backgroundColor: '#0A0A0A',
            titleFont: { family: 'Space Mono', size: 11 },
            bodyFont: { family: 'Space Mono', size: 10 },
            callbacks: {
              label: (context) => `${context.dataset.label}: ${(context.parsed.y ?? 0).toFixed(1)}%`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: '#E5E5E5', lineWidth: 0.5 },
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
              callback: (value) => `${value}%`,
            },
            min: 0,
            max: 100,
            title: {
              display: true,
              text: 'Leak Probability',
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
        <span className="font-condensed text-[12px] text-dim">Loading leak analysis...</span>
      </div>
    )
  }

  return (
    <div className="h-full">
      <canvas ref={canvasRef} />
    </div>
  )
}

export function LeakSummaryCards({ data }: { data: LeakAnalysis | null }) {
  if (!data) return null

  return (
    <div className="grid grid-cols-4 gap-4 mb-4">
      <div className="border border-rule p-3 rounded">
        <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
          Total Leaks
        </div>
        <div className="font-mono text-[28px] text-ink">{data.total_leaks}</div>
      </div>
      <div className="border border-rule p-3 rounded">
        <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
          Active Alerts
        </div>
        <div className="font-mono text-[28px]" style={{ color: statusColors[data.history[data.history.length - 1]?.status as string] || '#E8001D' }}>
          {data.active_alerts}
        </div>
      </div>
      <div className="border border-rule p-3 rounded">
        <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
          Detection Rate
        </div>
        <div className="font-mono text-[28px] text-pass">
          {(data.detection_rate * 100).toFixed(0)}%
        </div>
      </div>
      <div className="border border-rule p-3 rounded">
        <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
          False Positive
        </div>
        <div className="font-mono text-[28px] text-warn">
          {(data.false_positive_rate * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  )
}