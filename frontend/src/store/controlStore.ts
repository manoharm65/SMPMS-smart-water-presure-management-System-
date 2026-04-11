import { create } from 'zustand'
import {
  getControlState,
  setPressureSetpoint,
  sendValveCommand,
  setControlMode,
  applyEmergencyOverrides,
  type ControlState,
  type SetpointResponse,
  type ValveCommand,
  type ValveCommandResponse,
} from '../services/api'

type ControlStateStore = {
  controlMode: 'auto' | 'manual'
  activeSetpoints: Record<string, number>
  valvePositions: Record<string, number>
  lastUpdate: string | null
  loading: boolean
  error: string | null
  pendingCommands: string[]

  fetchControlState: () => Promise<void>
  updateSetpoint: (nodeId: string, setpoint: number) => Promise<SetpointResponse>
  sendValveAction: (command: ValveCommand) => Promise<ValveCommandResponse>
  toggleMode: () => Promise<void>
  emergencyOverride: (nodes: string[]) => Promise<void>
  clearError: () => void
}

const MOCK_CONTROL_STATE: ControlState = {
  mode: 'auto',
  active_setpoints: {
    valve_1: 5.5,
    valve_2: 4.8,
    valve_3: 5.2,
    valve_4: 4.5,
    valve_5: 5.0,
    valve_6: 4.2,
  },
  valve_positions: {
    valve_1: 78,
    valve_2: 65,
    valve_3: 82,
    valve_4: 55,
    valve_5: 70,
    valve_6: 48,
  },
  last_update: new Date().toISOString(),
}

export const useControlStore = create<ControlStateStore>((set, get) => ({
  controlMode: 'auto',
  activeSetpoints: {},
  valvePositions: {},
  lastUpdate: null,
  loading: true,
  error: null,
  pendingCommands: [],

  fetchControlState: async () => {
    set({ loading: true, error: null })
    try {
      const data = await getControlState()
      set({
        controlMode: data.mode,
        activeSetpoints: data.active_setpoints,
        valvePositions: data.valve_positions,
        lastUpdate: data.last_update,
        loading: false,
      })
    } catch {
      set({
        controlMode: MOCK_CONTROL_STATE.mode,
        activeSetpoints: MOCK_CONTROL_STATE.active_setpoints,
        valvePositions: MOCK_CONTROL_STATE.valve_positions,
        lastUpdate: MOCK_CONTROL_STATE.last_update,
        loading: false,
      })
    }
  },

  updateSetpoint: async (nodeId, setpoint) => {
    set((state) => ({
      pendingCommands: [...state.pendingCommands, nodeId],
      error: null,
    }))
    try {
      const result = await setPressureSetpoint(nodeId, setpoint)
      set((state) => ({
        activeSetpoints: { ...state.activeSetpoints, [nodeId]: setpoint },
        pendingCommands: state.pendingCommands.filter((id) => id !== nodeId),
        lastUpdate: result.timestamp,
      }))
      return result
    } catch (err) {
      set((state) => ({
        pendingCommands: state.pendingCommands.filter((id) => id !== nodeId),
        error: err instanceof Error ? err.message : 'Failed to update setpoint',
      }))
      throw err
    }
  },

  sendValveAction: async (command) => {
    set((state) => ({
      pendingCommands: [...state.pendingCommands, command.node_id],
      error: null,
    }))
    try {
      const result = await sendValveCommand(command)
      if (command.action === 'set_position' && command.value !== undefined) {
        set((state) => ({
          valvePositions: { ...state.valvePositions, [command.node_id]: command.value! },
        }))
      }
      set((state) => ({
        pendingCommands: state.pendingCommands.filter((id) => id !== command.node_id),
        lastUpdate: result.timestamp,
      }))
      return result
    } catch (err) {
      set((state) => ({
        pendingCommands: state.pendingCommands.filter((id) => id !== command.node_id),
        error: err instanceof Error ? err.message : 'Failed to send valve command',
      }))
      throw err
    }
  },

  toggleMode: async () => {
    const currentMode = get().controlMode
    const newMode = currentMode === 'auto' ? 'manual' : 'auto'
    set({ error: null })
    try {
      await setControlMode(newMode)
      set({ controlMode: newMode })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to toggle control mode',
      })
      throw err
    }
  },

  emergencyOverride: async (nodes) => {
    set({ error: null })
    try {
      await applyEmergencyOverrides(nodes)
      set({ controlMode: 'manual' })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to apply emergency overrides',
      })
      throw err
    }
  },

  clearError: () => set({ error: null }),
}))