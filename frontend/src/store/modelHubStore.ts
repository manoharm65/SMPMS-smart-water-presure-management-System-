import { create } from 'zustand'
import {
  getModelStatus,
  getMpcMetrics,
  getLeakAnalysis,
  getIwedsData,
  runModelScenario,
  getNodeTelemetry,
  getSmartMeterData,
  toggleMotorizedFlow,
  type ModelStatus,
  type MpcMetrics,
  type LeakAnalysis,
  type IwedsData,
  type NodeTelemetry,
  type SmartMeterData,
  type MotorizedFlowResult,
} from '../services/api'
import type { Scenario } from '../config/scenarios'

export type ModelHubTab = 'mpc' | 'leak' | 'iweds'

export type MpcNodeData = Record<string, NodeTelemetry>

export type IwedsNodeData = {
  valve_1: NodeTelemetry | null
  expected_flow_rate: number
  smart_meter: SmartMeterData | null
  motorized_flow: MotorizedFlowResult | null
}

type ModelHubState = {
  activeTab: ModelHubTab
  modelStatus: ModelStatus | null
  mpcMetrics: MpcMetrics | null
  mpcNodeData: MpcNodeData
  leakAnalysis: LeakAnalysis | null
  iwedsData: IwedsData | null
  iwedsNodeData: IwedsNodeData
  selectedScenario: Scenario | null
  runningScenario: boolean
  loading: boolean
  error: string | null
  controlSimulationEnabled: boolean
  mpcSimulationValve1: number
  mpcSimulationValve2: number
  leakSimulationValve1: number
  leakSimulationValve2: number

  setActiveTab: (tab: ModelHubTab) => void
  fetchModelStatus: () => Promise<void>
  fetchMpcMetrics: () => Promise<void>
  fetchMpcNodeData: () => Promise<void>
  fetchIwedsNodeData: () => Promise<void>
  toggleMotorized: (enabled: boolean) => Promise<void>
  fetchLeakAnalysis: () => Promise<void>
  fetchIwedsData: () => Promise<void>
  startScenario: (scenario: Scenario) => Promise<void>
  refreshAll: () => Promise<void>
  setMpcSimulation: (valve1: number, valve2: number) => void
  runMpcSimulation: () => Promise<void>
  setLeakSimulation: (valve1: number, valve2: number) => void
  runLeakSimulation: () => Promise<void>
}

function calculateExpectedFlow(pressure: number): number {
  const pipeDiameterInch = 0.5
  const area = Math.PI * Math.pow(pipeDiameterInch / 12, 2) / 4
  const coefficient = 0.6
  const pressureBar = pressure
  return Math.round(area * coefficient * Math.sqrt(pressureBar) * 1000)
}

const MOCK_MPC_METRICS: MpcMetrics = {
  horizon: 24,
  optimization_time_ms: 45,
  constraints_satisfied: true,
  iterations: 12,
  objective_value: 0.0234,
  history: Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
    mse: 0.02 + Math.random() * 0.01,
    mae: 0.015 + Math.random() * 0.005,
    r2_score: 0.92 + Math.random() * 0.05,
    convergence: 0.95 + Math.random() * 0.04,
  })),
}

const MOCK_LEAK_ANALYSIS: LeakAnalysis = {
  total_leaks: 3,
  active_alerts: 1,
  false_positive_rate: 0.08,
  detection_rate: 0.94,
  zones: ['valve_1', 'valve_3', 'valve_4'],
  history: Array.from({ length: 20 }, (_, i) => ({
    timestamp: new Date(Date.now() - (19 - i) * 1800000).toISOString(),
    zone_id: ['valve_1', 'valve_3', 'valve_4'][i % 3],
    probability: Math.random() * 0.6,
    flow_anomaly: Math.random() * 15,
    pressure_drop: Math.random() * 2,
    confidence: 0.7 + Math.random() * 0.25,
    status: (['none', 'minor', 'moderate', 'severe'] as const)[Math.floor(Math.random() * 4)],
  })),
}

const MOCK_IWEDS_DATA: IwedsData = {
  current_state: {
    status: 'active',
    last_cycle: new Date(Date.now() - 300000).toISOString(),
    anomalies_detected: 2,
    anomaly_confidence: 0.87,
    recommended_actions: [
      'Increase pressure setpoint at VALVE_2',
      'Reduce flow at VALVE_4 during peak hours',
    ],
  },
  anomaly_history: Array.from({ length: 12 }, (_, i) => ({
    timestamp: new Date(Date.now() - (11 - i) * 900000).toISOString(),
    type: ['pressure_surge', 'flow_anomaly', 'sensor_drift'][i % 3],
    severity: (['low', 'medium', 'high', 'critical'] as const)[Math.floor(Math.random() * 4)],
    node: ['valve_1', 'valve_2', 'valve_3', 'valve_4'][i % 4],
  })),
}

const MOCK_MODEL_STATUS: ModelStatus = {
  mpc: {
    enabled: true,
    running: true,
    last_run: new Date(Date.now() - 600000).toISOString(),
    next_run: new Date(Date.now() + 300000).toISOString(),
  },
  iweds: {
    enabled: true,
    running: true,
    last_run: new Date(Date.now() - 300000).toISOString(),
    next_run: new Date(Date.now() + 600000).toISOString(),
  },
  leak_detection: {
    enabled: true,
    running: true,
    last_run: new Date(Date.now() - 900000).toISOString(),
    next_run: new Date(Date.now() + 300000).toISOString(),
  },
}

export const useModelHubStore = create<ModelHubState>((set, get) => ({
  activeTab: 'mpc',
  modelStatus: null,
  mpcMetrics: null,
  mpcNodeData: {},
  leakAnalysis: null,
  iwedsData: null,
  iwedsNodeData: {
    valve_1: null,
    expected_flow_rate: 0,
    smart_meter: null,
    motorized_flow: null,
  },
  selectedScenario: null,
  runningScenario: false,
  loading: true,
  error: null,
  controlSimulationEnabled: false,
  mpcSimulationValve1: 20,
  mpcSimulationValve2: 0,
  leakSimulationValve1: 50,
  leakSimulationValve2: 10,

  setActiveTab: (tab) => set({ activeTab: tab }),

  fetchModelStatus: async () => {
    try {
      const data = await getModelStatus()
      set({ modelStatus: data, error: null })
    } catch {
      set({ modelStatus: MOCK_MODEL_STATUS })
    }
  },

  fetchMpcMetrics: async () => {
    try {
      const data = await getMpcMetrics()
      set({ mpcMetrics: data, error: null })
    } catch {
      set({ mpcMetrics: MOCK_MPC_METRICS })
    }
  },

  fetchMpcNodeData: async () => {
    try {
      const data = await getNodeTelemetry(['valve_1', 'valve_2'])
      const nodeMap: MpcNodeData = {}
      data.forEach((node) => {
        nodeMap[node.node_id] = node
      })
      set({ mpcNodeData: nodeMap, error: null })
    } catch {
      set({
        mpcNodeData: {
          valve_1: {
            node_id: 'valve_1',
            pressure: 5.2,
            flow_rate: 120,
            flow_sensor: 118,
            valve_position: 75,
            status: 'live',
            last_update: new Date().toISOString(),
          },
          valve_2: {
            node_id: 'valve_2',
            pressure: 4.8,
            flow_rate: 95,
            flow_sensor: 92,
            valve_position: 60,
            status: 'live',
            last_update: new Date().toISOString(),
          },
        },
      })
    }
  },

  fetchIwedsNodeData: async () => {
    try {
      const [telemetry, meterData] = await Promise.all([
        getNodeTelemetry(['valve_1']),
        getSmartMeterData(['meter_1']),
      ])
      const valve1 = telemetry.find(t => t.node_id === 'valve_1') || null
      const expectedFlowRate = valve1 ? calculateExpectedFlow(valve1.pressure) : 0
      set({
        iwedsNodeData: {
          valve_1: valve1,
          expected_flow_rate: expectedFlowRate,
          smart_meter: meterData.find(m => m.meter_id === 'meter_1') || null,
          motorized_flow: get().iwedsNodeData.motorized_flow,
        },
        error: null,
      })
    } catch {
      set({
        iwedsNodeData: {
          valve_1: {
            node_id: 'valve_1',
            pressure: 5.2,
            flow_rate: 120,
            flow_sensor: 118,
            valve_position: 75,
            status: 'live',
            last_update: new Date().toISOString(),
          },
          expected_flow_rate: 125,
          smart_meter: {
            meter_id: 'meter_1',
            actual_flow: 122,
            cumulative_volume: 15840,
            last_update: new Date().toISOString(),
            battery_status: 'ok',
            signal_strength: 85,
          },
          motorized_flow: null,
        },
      })
    }
  },

  toggleMotorized: async (enabled) => {
    try {
      const result = await toggleMotorizedFlow(enabled)
      set((state) => ({
        iwedsNodeData: {
          ...state.iwedsNodeData,
          motorized_flow: result,
          smart_meter: state.iwedsNodeData.smart_meter 
            ? { ...state.iwedsNodeData.smart_meter, actual_flow: result.total_flow }
            : null,
        },
        error: null,
      }))
    } catch {
      const baseFlow = get().iwedsNodeData.smart_meter?.actual_flow ?? 122
      const pumpPowerWatts = 750
      const flowIncreaseFactor = 1.35
      const motorizedFlowResult: MotorizedFlowResult = {
        enabled,
        base_flow: baseFlow,
        motorized_flow: enabled ? Math.round(baseFlow * flowIncreaseFactor) : 0,
        total_flow: enabled ? Math.round(baseFlow * flowIncreaseFactor) : baseFlow,
        pump_power_watts: enabled ? pumpPowerWatts : 0,
        estimated_increase_percent: enabled ? 35 : 0,
        timestamp: new Date().toISOString(),
      }
      set((state) => ({
        iwedsNodeData: {
          ...state.iwedsNodeData,
          motorized_flow: motorizedFlowResult,
          smart_meter: state.iwedsNodeData.smart_meter 
            ? { ...state.iwedsNodeData.smart_meter, actual_flow: motorizedFlowResult.total_flow }
            : null,
        },
      }))
    }
  },

  fetchLeakAnalysis: async () => {
    try {
      const data = await getLeakAnalysis()
      set({ leakAnalysis: data, error: null })
    } catch {
      set({ leakAnalysis: MOCK_LEAK_ANALYSIS })
    }
  },

  fetchIwedsData: async () => {
    try {
      const data = await getIwedsData()
      set({ iwedsData: data, error: null })
    } catch {
      set({ iwedsData: MOCK_IWEDS_DATA })
    }
  },

  startScenario: async (scenario) => {
    set({ selectedScenario: scenario, runningScenario: true, error: null })
    try {
      await runModelScenario(scenario.id)
    } catch {
      // MOCK: simulate async completion
      setTimeout(() => {
        set({ runningScenario: false })
      }, scenario.duration_seconds * 1000)
    }
  },

  refreshAll: async () => {
    set({ loading: true, error: null })
    const { fetchModelStatus, fetchMpcMetrics, fetchMpcNodeData, fetchIwedsNodeData, fetchLeakAnalysis, fetchIwedsData } = get()
    await Promise.all([
      fetchModelStatus(),
      fetchMpcMetrics(),
      fetchMpcNodeData(),
      fetchIwedsNodeData(),
      fetchLeakAnalysis(),
      fetchIwedsData(),
    ])
    set({ loading: false })
  },

  setMpcSimulation: (valve1, valve2) => set({ mpcSimulationValve1: valve1, mpcSimulationValve2: valve2 }),

  runMpcSimulation: async () => {
    const { mpcSimulationValve1, mpcSimulationValve2 } = get()
    set({ runningScenario: true })
    
    // Show alert - MPC model is running (using browser alert for simulation)
    window.alert('MPC model is running')
    
    // Wait 1 second then set valve 1 to 40%
    setTimeout(async () => {
      try {
        const { sendDirectValveOverride } = await import('../services/api')
        await sendDirectValveOverride('valve_1', 40)
      } catch (e) {
        console.error('Failed to set valve:', e)
      }
      set({ runningScenario: false })
    }, 1000)
  },

  setLeakSimulation: (valve1, valve2) => set({ leakSimulationValve1: valve1, leakSimulationValve2: valve2 }),

  runLeakSimulation: async () => {
    const { leakSimulationValve1, leakSimulationValve2 } = get()
    set({ runningScenario: true })
    
    // Wait 5 seconds then show alert
    setTimeout(() => {
      window.alert('Minor leakage detected')
      set({ runningScenario: false })
    }, 5000)
  },
}))