import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import type { MpcMetrics, ModelMetric } from '../../../services/api'

Chart.register(...registerables)

interface MPCChartProps {
  data: MpcMetrics | null
  loading?: boolean
}

export default function MPCChart({ data, loading = false }: MPCChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !data?.history) return

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const labels = data.history.map((h: ModelMetric) => {
      const date = new Date(h.timestamp)
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    })

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'MSE',
            data: data.history.map((h: ModelMetric) => h.mse),
            borderColor: '#E8001D',
            backgroundColor: 'rgba(232, 0, 29, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            yAxisID: 'y',
          },
          {
            label: 'MAE',
            data: data.history.map((h: ModelMetric) => h.mae),
            borderColor: '#004DB3',
            backgroundColor: 'rgba(0, 77, 179, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            yAxisID: 'y',
          },
          {
            label: 'R² Score',
            data: data.history.map((h: ModelMetric) => h.r2_score),
            borderColor: '#007A3D',
            backgroundColor: 'rgba(0, 122, 61, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            yAxisID: 'y1',
          },
        ],
      },
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
            type: 'linear',
            position: 'left',
            grid: { color: '#E5E5E5', lineWidth: 0.5 },
            ticks: {
              font: { family: 'Space Mono', size: 9 },
              color: '#6B6B6B',
            },
            title: {
              display: true,
              text: 'Error (MSE/MAE)',
              font: { family: 'Space Mono', size: 10 },
              color: '#6B6B6B',
            },
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { display: false },
            ticks: {
              font: { family: 'Space Mono', size: 9 },
              color: '#007A3D',
              callback: (value) => Number(value).toFixed(2),
            },
            title: {
              display: true,
              text: 'R² Score',
              font: { family: 'Space Mono', size: 10 },
              color: '#007A3D',
            },
            min: 0,
            max: 1,
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
        <span className="font-condensed text-[12px] text-dim">Loading MPC metrics...</span>
      </div>
    )
  }

  return (
    <div className="h-full">
      <canvas ref={canvasRef} />
    </div>
  )
}