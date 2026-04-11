import fs from 'fs';

// 1. Update api.ts
let apiTs = fs.readFileSync('src/services/api.ts', 'utf8');

if (!apiTs.includes('export interface MpcStatus')) {
  apiTs = apiTs.replace(
    'export interface MlSimulationResponse {',
    `export interface MpcStatus {
  enabled: boolean;
  running: boolean;
  interval_ms: number;
  active_nodes: number;
  total_nodes: number;
  last_cycle: any;
}

export interface MlSimulationResponse {`
  );
}

if (!apiTs.includes('getMpcStatus')) {
  apiTs = apiTs.replace(
    '// Polling Hook',
    `export async function getMpcStatus(cfg?: ApiConfig): Promise<MpcStatus> {
  return apiGet<MpcStatus>('/api/v1/mpc/status', cfg)
}

export async function runMpcNow(cfg?: ApiConfig): Promise<any> {
  return apiPost<any>('/api/v1/mpc/run', {}, cfg)
}

// Polling Hook`
  );
}
fs.writeFileSync('src/services/api.ts', apiTs);


// 2. Update Overview.tsx
let overviewTsx = fs.readFileSync('src/pages/Overview.tsx', 'utf8');

if (!overviewTsx.includes('getMpcStatus')) {
  overviewTsx = overviewTsx.replace(
    `import { getZones, getKPI, getPressureHistory, usePolling, type Zone, type KPI, type PressureHistory } from '../services/api'`,
    `import { getZones, getKPI, getPressureHistory, usePolling, getMpcStatus, runMpcNow, type Zone, type KPI, type PressureHistory, type MpcStatus } from '../services/api'`
  );
}

if (!overviewTsx.includes('mpcStatus')) {
  overviewTsx = overviewTsx.replace(
    `const [pressureHistory, setPressureHistory] = useState<PressureHistory | null>(null)`,
    `const [pressureHistory, setPressureHistory] = useState<PressureHistory | null>(null)\n  const [mpcStatus, setMpcStatus] = useState<MpcStatus | null>(null)`
  );
}

if (!overviewTsx.includes('fetchMpc')) {
  overviewTsx = overviewTsx.replace(
    `const fetchKpi = useCallback(async () => {
    try {
      const data = await getKPI()
      setKpi(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch KPI')
    }
  }, [])`,
    `const fetchKpi = useCallback(async () => {
    try {
      const data = await getKPI()
      setKpi(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch KPI')
    }
  }, [])

  const fetchMpc = useCallback(async () => {
    try {
      const data = await getMpcStatus()
      setMpcStatus(data)
    } catch (err) {
      console.error('Failed to fetch MPC', err)
    }
  }, [])`
  );
}

if (overviewTsx.includes('fetchZones(), fetchKpi()') && !overviewTsx.includes('fetchMpc()')) {
  overviewTsx = overviewTsx.replace(
    `await Promise.all([fetchZones(), fetchKpi()])`,
    `await Promise.all([fetchZones(), fetchKpi(), fetchMpc()])`
  ).replace(
    `[fetchZones, fetchKpi, fetchPressureHistory, selectedDma]`,
    `[fetchZones, fetchKpi, fetchMpc, fetchPressureHistory, selectedDma]`
  );
}

if (!overviewTsx.includes('MPC {mpcStatus.enabled')) {
  overviewTsx = overviewTsx.replace(
    `<span className="w-2 h-2 rounded-full bg-pass animate-blink" />
              <span className="font-condensed text-[10px] uppercase tracking-wider text-ink">
                Live Feed
              </span>
            </div>`,
    `<span className="w-2 h-2 rounded-full bg-pass animate-blink" />
              <span className="font-condensed text-[10px] uppercase tracking-wider text-ink">
                Live Feed
              </span>
            </div>
            {mpcStatus && (
              <div className="flex items-center gap-2 px-3 py-1 border border-rule rounded-full bg-paper">
                <span className={\`w-2 h-2 rounded-full \${mpcStatus.enabled ? 'bg-pass' : 'bg-[#E8001D]'}\`} />
                <span className="font-condensed text-[10px] uppercase tracking-wider text-ink">
                  MPC {mpcStatus.enabled ? 'Active' : 'Offline'}
                </span>
                {mpcStatus.last_cycle?.cost !== undefined && mpcStatus.last_cycle?.cost !== null && (
                   <span className="font-condensed text-[10px] text-dim border-l pl-2 border-rule">Cost: {mpcStatus.last_cycle.cost.toFixed(3)}</span>
                )}
              </div>
            )}`
  );
}

fs.writeFileSync('src/pages/Overview.tsx', overviewTsx);


// 3. Update ZoneDetail.tsx
let zoneTsx = fs.readFileSync('src/pages/ZoneDetail.tsx', 'utf8');

if (!zoneTsx.includes('getMpcStatus')) {
  zoneTsx = zoneTsx.replace(
    `  usePolling,
} from '../services/api'
import type { ZoneDetail, Anomaly, PressureHistory, MlRuntimeStatus } from '../services/api'`,
    `  usePolling,
  getMpcStatus,
  runMpcNow,
} from '../services/api'
import type { ZoneDetail, Anomaly, PressureHistory, MlRuntimeStatus, MpcStatus } from '../services/api'`
  );
}

if (!zoneTsx.includes('mpcStatus')) {
  zoneTsx = zoneTsx.replace(
    `const [mlStatus, setMlStatus] = useState<MlRuntimeStatus | null>(null)`,
    `const [mlStatus, setMlStatus] = useState<MlRuntimeStatus | null>(null)\n  const [mpcStatus, setMpcStatus] = useState<MpcStatus | null>(null)\n  const [mpcRunning, setMpcRunning] = useState(false)`
  );
}

if (!zoneTsx.includes('fetchMpcStatus')) {
  zoneTsx = zoneTsx.replace(
    `  // Fetch ML runtime status`,
    `  const fetchMpcStatus = async () => {
    try {
      const data = await getMpcStatus()
      setMpcStatus(data)
    } catch (err) {
      console.error('Failed to load MPC status:', err)
    }
  }

  // Fetch ML runtime status`
  );
  
  zoneTsx = zoneTsx.replace(
    `    fetchMlStatus()
  }, [zoneId])`,
    `    fetchMlStatus()
    fetchMpcStatus()
  }, [zoneId])`
  );

  zoneTsx = zoneTsx.replace(
    `  usePolling(fetchMlStatus, 30000, true)`,
    `  usePolling(fetchMlStatus, 30000, true)\n  usePolling(fetchMpcStatus, 30000, true)`
  );
}

if (!zoneTsx.includes('handleRunMpcNow')) {
  zoneTsx = zoneTsx.replace(
    `  const handleRunMlNow = async () => {`,
    `  const handleRunMpcNow = async () => {
    setMpcRunning(true)
    try {
      await runMpcNow()
      await fetchMpcStatus()
    } catch (err) {
      console.error('Failed to run MPC now:', err)
    } finally {
      setMpcRunning(false)
    }
  }

  const handleRunMlNow = async () => {`
  );
}

if (!zoneTsx.includes('MPC Recommendation')) {
  zoneTsx = zoneTsx.replace(
    `          {/* AI Recommendation */}
          <div className="flex items-center justify-between mb-4 p-2 border border-rule">
            <span className="font-condensed text-[10px] uppercase tracking-wider text-dim">
              AI Recommendation
            </span>
            <span className="font-mono text-[16px] text-pass">{zoneData?.ai_recommendation ?? '--'}%</span>
          </div>`,
    `          {/* AI Recommendation */}
          <div className="flex items-center justify-between mb-4 p-2 border border-rule">
            <span className="font-condensed text-[10px] uppercase tracking-wider text-dim">
              AI Recommendation
            </span>
            <span className="font-mono text-[16px] text-pass">{zoneData?.ai_recommendation ?? '--'}%</span>
          </div>

          {/* MPC Recommendation */}
          <div className="flex items-center justify-between mb-4 p-2 border border-rule bg-paper">
            <div className="flex flex-col">
              <span className="font-condensed text-[10px] uppercase tracking-wider text-dim">
                MPC Target (Optimal)
              </span>
              <button onClick={handleRunMpcNow} disabled={mpcRunning} className="text-[9px] underline mt-1 text-dim text-left hover:text-ink">
                {mpcRunning ? 'Optimizing...' : 'Optimize Now'}
              </button>
            </div>
            {mpcStatus?.last_cycle?.commands?.find((c: any) => c.id === zoneId) ? (
              <div className="text-right">
                <span className="font-mono text-[16px] text-ink">{mpcStatus.last_cycle.commands.find((c: any) => c.id === zoneId).valve_target_pct}%</span>
                <span className={\`font-mono text-[10px] ml-2 \${mpcStatus.last_cycle.commands.find((c: any) => c.id === zoneId).delta_pct > 0 ? 'text-[#007A3D]' : mpcStatus.last_cycle.commands.find((c: any) => c.id === zoneId).delta_pct < 0 ? 'text-[#E8001D]' : 'text-dim'}\`}>
                  ({mpcStatus.last_cycle.commands.find((c: any) => c.id === zoneId).delta_pct > 0 ? '+' : ''}{mpcStatus.last_cycle.commands.find((c: any) => c.id === zoneId).delta_pct}%)
                </span>
              </div>
            ) : (
              <span className="font-mono text-[16px] text-dim">--</span>
            )}
          </div>`
  );
}

fs.writeFileSync('src/pages/ZoneDetail.tsx', zoneTsx);

console.log("Done");
