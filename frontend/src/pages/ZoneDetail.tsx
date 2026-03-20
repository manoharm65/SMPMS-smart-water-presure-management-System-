import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const ANOMALY_LOG = [
  {
    confidence: 94,
    severity: 'crit',
    message: 'Sustained overpressure detected in central zone',
    model: 'Isolation Forest + LSTM',
    time: '14:32',
  },
  {
    confidence: 87,
    severity: 'warn',
    message: 'Diurnal pattern anomaly — demand surge',
    model: 'Isolation Forest',
    time: '11:18',
  },
  {
    confidence: 78,
    severity: 'warn',
    message: 'Pressure drop event — possible leak',
    model: 'LSTM',
    time: '06:45',
  },
  {
    confidence: 91,
    severity: 'crit',
    message: ' Valve control deviation from schedule',
    model: 'Isolation Forest + LSTM',
    time: '02:22',
  },
]

const severityColors: Record<string, string> = {
  crit: '#E8001D',
  warn: '#CC5500',
  low: '#004DB3',
}

export default function ZoneDetail() {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstanceRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy()
    }

    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const generateData = (base: number, variance: number) =>
      days.map(() => base + (Math.random() - 0.5) * variance)

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Pressure (BAR)',
            data: generateData(5.8, 1.2),
            borderColor: '#E8001D',
            backgroundColor: 'rgba(232, 0, 29, 0.15)',
            borderWidth: 2.5,
            tension: 0.2,
            pointRadius: 3,
            pointBackgroundColor: '#E8001D',
            fill: true,
          },
          {
            label: 'Threshold',
            data: generateData(5.5, 0.1),
            borderColor: '#6B6B6B',
            borderWidth: 1,
            borderDash: [5, 5],
            tension: 0,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { family: 'Space Mono', size: 10 },
              color: '#6B6B6B',
              boxWidth: 12,
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
              font: { family: 'Space Mono', size: 10 },
              color: '#6B6B6B',
            },
          },
          y: {
            grid: { color: '#E5E5E5', lineWidth: 0.5 },
            ticks: {
              font: { family: 'Space Mono', size: 10 },
              color: '#6B6B6B',
              callback: (value) => `${value} BAR`,
            },
            min: 0,
            max: 10,
          },
        },
      },
    })

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
        chartInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="bg-paper min-h-screen">
      {/* Top Section - Giant Pressure Display */}
      <div className="min-h-[200px] border-b-2 border-rule grid grid-cols-1 lg:grid-cols-2">
        {/* Left - Live Pressure */}
        <div className="bg-ink p-6 flex flex-col justify-between">
          <div>
            <div className="font-condensed text-[10px] uppercase tracking-widest text-dim">
              DMA-05 · CENTRAL · LIVE PRESSURE
            </div>
          </div>
          <div className="my-4">
            <span
              className="font-syne font-extrabold text-[88px] leading-none"
              style={{ color: '#E8001D' }}
            >
              6.20
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="font-condensed text-[14px] text-muted">
              BAR · MAX THRESHOLD 5.5
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-signal animate-blink" />
              <span className="font-condensed text-[11px] uppercase tracking-wider text-signal">
                OVERPRESSURE — CRITICAL
              </span>
            </div>
          </div>
        </div>

        {/* Right - 6-Stat Grid */}
        <div className="p-6 grid grid-cols-2 gap-4">
          <div>
            <div className="font-condensed text-[9px] uppercase tracking-wider text-dim">
              MIN TODAY
            </div>
            <div className="font-mono text-[28px] text-low">5.42 BAR</div>
          </div>
          <div>
            <div className="font-condensed text-[9px] uppercase tracking-wider text-dim">
              MAX TODAY
            </div>
            <div className="font-mono text-[28px] text-signal">6.35 BAR</div>
          </div>
          <div>
            <div className="font-condensed text-[9px] uppercase tracking-wider text-dim">
              7D AVERAGE
            </div>
            <div className="font-mono text-[28px] text-warn">5.52 BAR</div>
          </div>
          <div>
            <div className="font-condensed text-[9px] uppercase tracking-wider text-dim">
              VALVE OPEN
            </div>
            <div className="font-mono text-[28px] text-warn">18%</div>
          </div>
          <div>
            <div className="font-condensed text-[9px] uppercase tracking-wider text-dim">
              AI CONFIDENCE
            </div>
            <div className="font-mono text-[28px] text-pass">99%</div>
          </div>
          <div>
            <div className="font-condensed text-[9px] uppercase tracking-wider text-dim">
              LAST READING
            </div>
            <div className="font-mono text-[28px] text-ink">14:32</div>
          </div>
        </div>
      </div>

      {/* Middle Section - Valve Control + AI Log */}
      <div className="border-b-2 border-rule grid grid-cols-1 lg:grid-cols-5">
        {/* Left - Valve Control (40%) */}
        <div className="lg:col-span-2 p-5 border-r border-rule">
          <h2 className="font-syne font-bold text-[18px] text-ink mb-4">
            VALVE CONTROL
          </h2>

          <div className="mb-4">
            <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
              Current Position
            </div>
            <div className="font-mono text-[36px] text-warn">18%</div>
          </div>

          {/* Progress Bar */}
          <div className="h-1 border border-rule mb-4">
            <div className="h-full bg-warn" style={{ width: '18%' }} />
          </div>

          {/* Preset Buttons */}
          <div className="flex gap-2 mb-4">
            {[18, 35, 50, 75].map((val) => (
              <button
                key={val}
                className={`px-3 py-1 font-condensed text-[12px] border transition-colors ${
                  val === 18
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-paper text-ink border-rule hover:bg-ink hover:text-paper'
                }`}
              >
                {val}%
              </button>
            ))}
          </div>

          {/* Range Slider */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max="100"
              defaultValue="18"
              className="w-full h-1 appearance-none cursor-pointer slider-red"
              style={{
                background: 'linear-gradient(to right, #E8001D 18%, #1A1A1A 18%)',
              }}
            />
          </div>

          {/* AI Recommendation */}
          <div className="flex items-center justify-between mb-4 p-2 border border-rule">
            <span className="font-condensed text-[10px] uppercase tracking-wider text-dim">
              AI Recommendation
            </span>
            <span className="font-mono text-[16px] text-pass">35%</span>
          </div>

          {/* Apply Override */}
          <button className="w-full py-3 bg-ink text-paper font-condensed text-[12px] uppercase tracking-wider mb-2">
            Apply Override
          </button>

          {/* Revert to Auto */}
          <button className="w-full py-3 border border-rule text-ink font-condensed text-[12px] uppercase tracking-wider hover:bg-ink hover:text-paper transition-colors">
            Revert to Auto Mode
          </button>
        </div>

        {/* Right - AI Anomaly Log (60%) */}
        <div className="lg:col-span-3 p-5">
          <h2 className="font-syne font-bold text-[18px] text-ink mb-4">
            AI ANOMALY LOG — ISOLATION FOREST + LSTM
          </h2>

          <div className="space-y-2">
            {ANOMALY_LOG.map((entry, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 p-3 border border-rule hover:bg-ink hover:text-paper transition-colors duration-150 cursor-pointer"
              >
                <div
                  className="font-mono text-[22px] font-bold leading-none pt-1"
                  style={{ color: severityColors[entry.severity] }}
                >
                  {entry.confidence}%
                </div>
                <div className="flex-1">
                  <div className="font-condensed text-[12px]">
                    {entry.message}
                  </div>
                  <div className="font-condensed text-[10px] text-dim mt-1">
                    {entry.model} · {entry.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom - 7-Day Chart */}
      <div className="p-5">
        <h2 className="font-syne font-bold text-[18px] text-ink mb-4">
          7-DAY PRESSURE HISTORY — DMA-05 CENTRAL
        </h2>
        <div className="h-[250px]">
          <canvas ref={chartRef} />
        </div>
      </div>
    </div>
  )
}
