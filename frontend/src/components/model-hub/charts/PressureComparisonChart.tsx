import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import type { NodeTelemetry } from '../../../services/api'

Chart.register(...registerables)

interface PressureComparisonChartProps {
  valve1: NodeTelemetry | null
  valve2: NodeTelemetry | null
  loading?: boolean
}

export default function PressureComparisonChart({ valve1, valve2, loading = false }: PressureComparisonChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const labels = ['VALVE 1', 'VALVE 2']
    const pressureData = [
      valve1?.pressure ?? 0,
      valve2?.pressure ?? 0,
    ]

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Pressure (BAR)',
            data: pressureData,
            backgroundColor: ['#E8001D', '#004DB3'],
            borderWidth: 0,
            borderRadius: 4,
            barThickness: 80,
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
              label: (context) => `Pressure: ${(context.parsed.y ?? 0).toFixed(1)} BAR`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: 'Space Mono', size: 12, weight: 'bold' },
              color: '#6B6B6B',
            },
          },
          y: {
            grid: { color: '#E5E5E5', lineWidth: 0.5 },
            ticks: {
              font: { family: 'Space Mono', size: 9 },
              color: '#6B6B6B',
              callback: (value) => `${value} BAR`,
            },
            min: 0,
            max: 8,
            title: {
              display: true,
              text: 'Pressure (BAR)',
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
  }, [valve1, valve2])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="font-condensed text-[12px] text-dim">Loading pressure data...</span>
      </div>
    )
  }

  return (
    <div className="h-full">
      <canvas ref={canvasRef} />
    </div>
  )
}