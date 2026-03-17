function Swatch({
  color,
  label,
  detail,
}: {
  color: string
  label: string
  detail: string
}) {
  return (
    <div className="rounded border border-border bg-panel p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-text-faint">
            {label}
          </div>
          <div className="mt-1 font-mono text-sm text-text-muted">{detail}</div>
        </div>
        <div
          className="h-7 w-10 rounded border border-border"
          style={{
            background: color,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 18px ${color}33`,
          }}
        />
      </div>
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded border border-border bg-panel px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-text-faint">
        {subtitle}
      </div>
      <div className="mt-1 text-sm font-semibold text-text">{title}</div>
    </div>
  )
}

export default function About() {
  return (
    <div className="h-full overflow-auto p-3">
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div className="rounded border border-border bg-panel p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-text-faint">
                About
              </div>
              <div className="mt-1 text-sm font-semibold text-text">
                AquaBytes SCADA Workflow
              </div>
            </div>
            <div className="rounded border border-border bg-bg px-2 py-1 font-mono text-xs text-text-faint">
              Municipal Water Control Center
            </div>
          </div>

          <div className="mt-3 text-sm text-text-muted">
            AquaBytes combines municipal GIS (DMA zones, pipelines, valves) with
            real-time IoT telemetry and AI anomaly scoring to help operators
            detect low pressure, high pressure, and potential leaks.
          </div>

          <div className="mt-3 rounded border border-border bg-bg p-3">
            <div className="text-[11px] uppercase tracking-wider text-text-faint">
              Data Sources
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <div className="rounded border border-border bg-panel p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-text-muted">Map Layers</div>
                  <div className="font-mono text-xs text-info">GeoJSON</div>
                </div>
                <div className="mt-1 text-xs text-text-faint">
                  Zones / pipelines / valves (Solapur municipal exports)
                </div>
              </div>

              <div className="rounded border border-border bg-panel p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-text-muted">Telemetry</div>
                  <div className="font-mono text-xs text-accent">WebSocket</div>
                </div>
                <div className="mt-1 text-xs text-text-faint">
                  Pressure, valve position, flow rate, anomaly score per DMA
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <SectionTitle
            subtitle="Legend"
            title="Pressure Status Colors"
          />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Swatch
              color="#00c896"
              label="Normal"
              detail="3.0–5.99 bar"
            />
            <Swatch color="#4a9ff5" label="Low" detail="< 3.0 bar" />
            <Swatch
              color="#f5a623"
              label="Warning"
              detail="6.0–6.99 bar"
            />
            <Swatch
              color="#f04d4d"
              label="Critical"
              detail="≥ 7.0 bar"
            />
          </div>

          <div className="rounded border border-border bg-panel p-3">
            <div className="text-[11px] uppercase tracking-wider text-text-faint">
              Leak / Anomaly Indicator
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="text-sm text-text-muted">
                A pulsing marker appears when AI anomaly confidence is high
                (currently threshold: <span className="font-mono">0.85</span>). Use
                this to quickly spot possible leak locations.
              </div>
              <div className="mt-1">
                <div className="leak-indicator" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
        <SectionTitle subtitle="Pages" title="Map (Live Operations)" />
        <div className="rounded border border-border bg-panel p-3 lg:col-span-2">
          <div className="text-sm text-text-muted">
            - Loads DMA zones/pipelines/valves from municipal GeoJSON
            <br />- Streams real-time telemetry over WebSocket
            <br />- Colors pipelines by pressure status
            <br />- Click valves to open the inspector (pressure / flow / valve position / anomaly)
            <br />- Click a zone to open its Zone Detail
          </div>
        </div>

        <SectionTitle subtitle="Pages" title="Overview (Shift Summary)" />
        <div className="rounded border border-border bg-panel p-3 lg:col-span-2">
          <div className="text-sm text-text-muted">
            - KPI snapshot across all zones
            <br />- Zone status table
            <br />- 24h trend charts (historical API when available)
          </div>
        </div>

        <SectionTitle subtitle="Pages" title="Alerts (Operator Actions)" />
        <div className="rounded border border-border bg-panel p-3 lg:col-span-2">
          <div className="text-sm text-text-muted">
            - Lists critical/warning/resolved alerts
            <br />- Actions: acknowledge, dispatch, resolve
            <br />- Designed to integrate with an alerts API (or generated from anomaly thresholds)
          </div>
        </div>

        <SectionTitle subtitle="Pages" title="Analytics (Engineering)" />
        <div className="rounded border border-border bg-panel p-3 lg:col-span-2">
          <div className="text-sm text-text-muted">
            - Heatmaps / scatter plots / leak probability trends
            <br />- Uses historical datasets; can overlay current telemetry
          </div>
        </div>
      </div>

      <div className="mt-2 rounded border border-border bg-panel p-3">
        <div className="text-[11px] uppercase tracking-wider text-text-faint">
          Operator Notes
        </div>
        <div className="mt-2 text-sm text-text-muted">
          For accurate mapping, ensure municipal GeoJSON coordinates are WGS84
          (<span className="font-mono">[lng, lat]</span>) and that each feature contains a
          join key like <span className="font-mono">zoneId</span> matching telemetry.
        </div>
      </div>
    </div>
  )
}
