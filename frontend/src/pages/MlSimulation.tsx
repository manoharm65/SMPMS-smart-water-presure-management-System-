import { useEffect, useMemo, useState } from 'react'
import {
  getMlSimulationScenarios,
  simulateMlCondition,
  type MlSimulationInput,
  type MlSimulationResponse,
  type MlSimulationResult,
  type MlSimulationScenario,
} from '../services/api'

const SCENARIO_LABELS: Record<Exclude<MlSimulationScenario, 'all'>, string> = {
  normal: 'Normal Operation',
  sudden_drop_no_action_supply_off: 'Sudden Drop (Supply Off)',
  high_flow_low_pressure: 'High Flow + Low Pressure',
  erratic_pressure_sensor_issue: 'Erratic Pressure Sensor',
  valve_fault_signature: 'Valve Fault Signature',
  construction_damage_signature: 'Construction Damage Signature',
  old_pipe_degradation_signature: 'Old Pipe Degradation',
}

type UiControls = {
  pressure: number
  flowRate: number
  supplyOn: boolean
  valvePosition: number
  previousValvePosition: number
  pressureLag2: number
  hydraulicGradeAngleDeg: number
  unexplainedDrop: number
  pipeAgeYears: number
  constructionActivity: boolean
  erraticSensorReadings: boolean
}

const defaultControls: UiControls = {
  pressure: 3.5,
  flowRate: 30,
  supplyOn: true,
  valvePosition: 55,
  previousValvePosition: 58,
  pressureLag2: 3.9,
  hydraulicGradeAngleDeg: 2,
  unexplainedDrop: 0.8,
  pipeAgeYears: 12,
  constructionActivity: false,
  erraticSensorReadings: false,
}

function formatEventName(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function toRiskLabel(result: MlSimulationResult): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (result.anomaly_flag === 1 && result.anomaly_score >= result.anomaly_threshold * 1.15) return 'HIGH'
  if (result.anomaly_flag === 1 || result.predicted_possible_problem !== 'normal') return 'MEDIUM'
  return 'LOW'
}

function inferScenarioFromControls(c: UiControls): Exclude<MlSimulationScenario, 'all'> {
  if (c.erraticSensorReadings) return 'erratic_pressure_sensor_issue'
  if (!c.supplyOn && c.pressure <= 2.6 && c.unexplainedDrop >= 1.2) return 'sudden_drop_no_action_supply_off'
  if (c.flowRate >= 45 && c.pressure <= 3.1) return 'high_flow_low_pressure'
  if (c.valvePosition <= 10 && c.pressure <= 3) return 'valve_fault_signature'
  if (c.constructionActivity && c.unexplainedDrop >= 0.8) return 'construction_damage_signature'
  if (c.pipeAgeYears >= 20 && c.pressure <= 3.8) return 'old_pipe_degradation_signature'
  return 'normal'
}

type WorkingRule = { id: string; condition: string; outcome: string; active: boolean }

export default function MlSimulation() {
  const [controls, setControls] = useState<UiControls>(defaultControls)
  const [scenarioMode, setScenarioMode] = useState<'auto' | 'manual'>('auto')
  const [manualScenario, setManualScenario] = useState<Exclude<MlSimulationScenario, 'all'>>('normal')
  const [availableScenarios, setAvailableScenarios] = useState<Exclude<MlSimulationScenario, 'all'>[]>(Object.keys(SCENARIO_LABELS) as Exclude<MlSimulationScenario, 'all'>[])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<MlSimulationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastResponse, setLastResponse] = useState<MlSimulationResponse | null>(null)
  const [webMilestoneAlert, setWebMilestoneAlert] = useState<string | null>(null)

  const inferredScenario = useMemo(() => inferScenarioFromControls(controls), [controls])
  const selectedScenario = scenarioMode === 'auto' ? inferredScenario : manualScenario

  const workingRules = useMemo<WorkingRule[]>(() => {
    const currentRisk = result ? toRiskLabel(result) : 'LOW'
    return [
      { id: 'pressure-spike', condition: 'IF pressure is high (> 5.5 bar) OR pressure changes suddenly', outcome: 'THEN burst probability increases and model risk moves to MEDIUM/HIGH.', active: controls.pressure > 5.5 || controls.unexplainedDrop >= 1.4 },
      { id: 'high-flow-low-pressure', condition: 'IF flow is high while pressure is low', outcome: 'THEN hidden leak or active burst is likely.', active: controls.flowRate >= 45 && controls.pressure <= 3.1 },
      { id: 'supply-off-drop', condition: 'IF supply is OFF and pressure still drops without control action', outcome: 'THEN unexplained network loss is suspected.', active: !controls.supplyOn && controls.unexplainedDrop >= 1.2 },
      { id: 'construction-impact', condition: 'IF construction activity is ON with noticeable pressure drop', outcome: 'THEN construction damage signature is probable.', active: controls.constructionActivity && controls.unexplainedDrop >= 0.8 },
      { id: 'aging-pipe', condition: 'IF pipe age is high (>= 20 years) with weak pressure trend', outcome: 'THEN old pipe degradation risk rises.', active: controls.pipeAgeYears >= 20 && controls.pressure <= 3.8 },
      { id: 'sensor-noise', condition: 'IF erratic sensor readings are present', outcome: 'THEN sensor fault is more likely than physical leak.', active: controls.erraticSensorReadings },
      { id: 'risk-summary', condition: 'IF anomaly score crosses model threshold', outcome: `THEN immediate investigation is recommended. Current model risk: ${currentRisk}.`, active: Boolean(result && result.anomaly_flag === 1) },
    ]
  }, [controls, result])

  useEffect(() => {
    void getMlSimulationScenarios()
      .then((scenarios) => {
        const cleaned = scenarios.filter((s): s is Exclude<MlSimulationScenario, 'all'> => s !== 'all')
        if (cleaned.length > 0) {
          setAvailableScenarios(cleaned)
          if (!cleaned.includes(manualScenario)) setManualScenario(cleaned[0])
        }
      })
      .catch(() => undefined)
  }, [manualScenario])

  async function onPredict() {
    setRunning(true)
    setError(null)
    try {
      const input: MlSimulationInput = {
        pressure: controls.pressure,
        flowRate: controls.flowRate,
        valvePosition: controls.valvePosition,
        supplyOn: controls.supplyOn,
        constructionActivity: controls.constructionActivity,
        pipeAgeYears: controls.pipeAgeYears,
        previousValvePosition: controls.previousValvePosition,
        pressureLag2: controls.pressureLag2,
        hydraulicGradeAngleDeg: controls.hydraulicGradeAngleDeg,
      }
      const response = await simulateMlCondition(selectedScenario, input)
      setLastResponse(response)
      setResult(response.results[0] ?? null)
      setWebMilestoneAlert(response.milestone?.webAlertMessage ?? null)
      if (!response.results[0]) setError('Simulation completed but no prediction was returned by the model.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run prediction simulation')
      setResult(null)
      setLastResponse(null)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b-2 border-rule px-6 py-6 md:px-10">
        <h1 className="font-syne text-3xl font-black tracking-tight md:text-4xl">ML INCIDENT SIMULATION</h1>
        <p className="mt-2 max-w-3xl font-mono text-xs uppercase tracking-wide text-dim">Choose operating values, run prediction, and review possible incidents.</p>
      </header>
      <section className="grid grid-cols-1 gap-0 border-b-2 border-rule lg:grid-cols-12">
        <div className="border-b-2 border-rule p-6 lg:col-span-5 lg:border-b-0 lg:border-r-2">
          <h2 className="font-syne text-xl font-bold">Condition Builder</h2>
          <div className="mt-5 space-y-5">
            <label className="block"><span className="font-condensed text-xs uppercase text-dim">Pressure: {controls.pressure.toFixed(1)} bar</span><input type="range" min="0.8" max="6" step="0.1" value={controls.pressure} onChange={(e) => setControls((p) => ({ ...p, pressure: Number(e.target.value) }))} className="mt-2 w-full" /></label>
            <label className="block"><span className="font-condensed text-xs uppercase text-dim">Flow: {controls.flowRate} L/min</span><input type="range" min="5" max="80" value={controls.flowRate} onChange={(e) => setControls((p) => ({ ...p, flowRate: Number(e.target.value) }))} className="mt-2 w-full" /></label>
            <label className="block"><span className="font-condensed text-xs uppercase text-dim">Valve: {controls.valvePosition}%</span><input type="range" min="0" max="100" value={controls.valvePosition} onChange={(e) => setControls((p) => ({ ...p, valvePosition: Number(e.target.value) }))} className="mt-2 w-full" /></label>
            <label className="block"><span className="font-condensed text-xs uppercase text-dim">Previous Valve: {controls.previousValvePosition}%</span><input type="range" min="0" max="100" value={controls.previousValvePosition} onChange={(e) => setControls((p) => ({ ...p, previousValvePosition: Number(e.target.value) }))} className="mt-2 w-full" /></label>
            <label className="block"><span className="font-condensed text-xs uppercase text-dim">Pressure Lag-2: {controls.pressureLag2.toFixed(1)} bar</span><input type="range" min="0.8" max="6" step="0.1" value={controls.pressureLag2} onChange={(e) => setControls((p) => ({ ...p, pressureLag2: Number(e.target.value) }))} className="mt-2 w-full" /></label>
            <label className="block"><span className="font-condensed text-xs uppercase text-dim">Hydraulic Grade Angle: {controls.hydraulicGradeAngleDeg.toFixed(1)} deg</span><input type="range" min="-15" max="15" step="0.1" value={controls.hydraulicGradeAngleDeg} onChange={(e) => setControls((p) => ({ ...p, hydraulicGradeAngleDeg: Number(e.target.value) }))} className="mt-2 w-full" /></label>
            <label className="block"><span className="font-condensed text-xs uppercase text-dim">Unexplained Drop: {controls.unexplainedDrop.toFixed(1)} bar</span><input type="range" min="0" max="3" step="0.1" value={controls.unexplainedDrop} onChange={(e) => setControls((p) => ({ ...p, unexplainedDrop: Number(e.target.value) }))} className="mt-2 w-full" /></label>
            <label className="block"><span className="font-condensed text-xs uppercase text-dim">Pipe Age: {controls.pipeAgeYears} years</span><input type="range" min="1" max="40" value={controls.pipeAgeYears} onChange={(e) => setControls((p) => ({ ...p, pipeAgeYears: Number(e.target.value) }))} className="mt-2 w-full" /></label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setControls((p) => ({ ...p, supplyOn: !p.supplyOn }))} className="border-2 border-rule px-3 py-2 font-mono text-xs">Supply: {controls.supplyOn ? 'ON' : 'OFF'}</button>
              <button type="button" onClick={() => setControls((p) => ({ ...p, constructionActivity: !p.constructionActivity }))} className="border-2 border-rule px-3 py-2 font-mono text-xs">Construction: {controls.constructionActivity ? 'YES' : 'NO'}</button>
              <button type="button" onClick={() => setControls((p) => ({ ...p, erraticSensorReadings: !p.erraticSensorReadings }))} className="border-2 border-rule px-3 py-2 font-mono text-xs sm:col-span-2">Erratic Sensor: {controls.erraticSensorReadings ? 'YES' : 'NO'}</button>
            </div>
          </div>
        </div>
        <div className="p-6 lg:col-span-7">
          <h2 className="font-syne text-xl font-bold">Prediction Setup</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="border-2 border-rule p-4"><label className="font-condensed text-xs uppercase text-dim">Scenario Mode</label><select value={scenarioMode} onChange={(e) => setScenarioMode(e.target.value as 'auto' | 'manual')} className="mt-2 w-full border-2 border-rule bg-paper p-2"><option value="auto">Auto</option><option value="manual">Manual</option></select></div>
            <div className="border-2 border-rule p-4"><label className="font-condensed text-xs uppercase text-dim">Scenario</label><select disabled={scenarioMode === 'auto'} value={manualScenario} onChange={(e) => setManualScenario(e.target.value as Exclude<MlSimulationScenario, 'all'>)} className="mt-2 w-full border-2 border-rule bg-paper p-2">{availableScenarios.map((scenario) => <option key={scenario} value={scenario}>{SCENARIO_LABELS[scenario] ?? formatEventName(scenario)}</option>)}</select></div>
          </div>
          <div className="mt-4 border-2 border-rule bg-ink p-4 text-paper"><p className="font-condensed text-xs uppercase">Scenario that will run</p><p className="mt-2 font-syne text-2xl font-bold">{SCENARIO_LABELS[selectedScenario] ?? formatEventName(selectedScenario)}</p></div>
          <div className="mt-4 flex gap-3"><button type="button" onClick={onPredict} disabled={running} className="border-2 border-signal bg-signal px-5 py-3 font-syne text-sm font-bold uppercase text-paper disabled:opacity-50">{running ? 'Predicting...' : 'Predict Possible Issue'}</button><button type="button" onClick={() => { setControls(defaultControls); setResult(null); setLastResponse(null); setWebMilestoneAlert(null); setError(null); setScenarioMode('auto') }} className="border-2 border-rule px-5 py-3 font-mono text-xs uppercase">Reset</button></div>
          {error && <p className="mt-4 border-l-4 border-signal px-3 py-2 font-mono text-xs text-signal">{error}</p>}
          {webMilestoneAlert && <p className="mt-4 border-l-4 border-pass px-3 py-2 font-mono text-xs text-pass">{webMilestoneAlert}</p>}
          {result ? (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="border-2 border-rule p-4"><p className="font-condensed text-xs uppercase text-dim">Likely Problem Now</p><p className="mt-2 font-syne text-xl font-bold">{formatEventName(result.predicted_possible_problem)}</p></div>
              <div className="border-2 border-rule p-4"><p className="font-condensed text-xs uppercase text-dim">If Persistent</p><p className="mt-2 font-syne text-xl font-bold">{formatEventName(result.possible_problem_if_condition_persists)}</p></div>
              <div className="border-2 border-rule p-4"><p className="font-condensed text-xs uppercase text-dim">Risk Level</p><p className="mt-2 font-syne text-xl font-bold">{toRiskLabel(result)}</p></div>
              <div className="border-2 border-rule p-4 md:col-span-2"><p className="font-condensed text-xs uppercase text-dim">Model Message</p><p className="mt-2 font-mono text-xs uppercase leading-6">{result.ml_model_message}</p></div>
              <div className="border-2 border-rule p-4"><p className="font-condensed text-xs uppercase text-dim">Anomaly Score</p><p className="mt-2 font-mono text-xl font-bold">{result.anomaly_score.toFixed(3)}</p><p className="text-xs">Threshold: {result.anomaly_threshold.toFixed(3)}</p></div>
              <div className="border-2 border-rule p-4 md:col-span-3"><p className="font-condensed text-xs uppercase text-dim">Top 3 Probable Problems</p><p className="mt-2 font-mono text-xs uppercase">{result.top3_probable_problems || 'No ranked classes returned'}</p></div>
              <div className="border-2 border-rule p-4 md:col-span-3"><p className="font-condensed text-xs uppercase text-dim">Model Feature Inputs Used</p><p className="mt-2 font-mono text-xs uppercase">Prev valve: {result.prev_valve_position.toFixed(1)}% | Pressure lag-2: {result.pressure_lag_2.toFixed(1)} bar | Hydraulic grade angle: {result.hydraulic_grade_angle_deg.toFixed(1)} deg</p></div>
            </div>
          ) : <div className="mt-6 border-2 border-dashed border-rule p-5 font-mono text-xs uppercase text-dim">No prediction yet. Set values and click Predict.</div>}
          {lastResponse && <p className="mt-4 font-mono text-[11px] uppercase text-dim">Returned rows: {lastResponse.count} | Scenario: {formatEventName(lastResponse.scenario)}{lastResponse.milestone ? ` | Stored predictions: ${lastResponse.milestone.totalPredictions}` : ''}</p>}
        </div>
      </section>
      <section className="border-b-2 border-rule px-6 py-6 md:px-10"><h2 className="font-syne text-2xl font-bold">Working Data</h2><div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">{workingRules.map((rule) => <div key={rule.id} className={`border-2 p-4 ${rule.active ? 'border-signal bg-signal/10' : 'border-rule'}`}><p className="font-condensed text-[11px] uppercase">{rule.condition}</p><p className="mt-2 font-mono text-xs uppercase">{rule.outcome}</p><p className="mt-3 text-[10px] uppercase">{rule.active ? 'Matching Current Inputs' : 'Not Triggered'}</p></div>)}</div></section>
    </div>
  )
}
