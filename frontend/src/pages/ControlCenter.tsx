import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useControlStore } from '../store/controlStore'
import { useControlPolling } from '../hooks/useModelPolling'

const NODES = ['valve_1', 'valve_2', 'valve_3', 'valve_4', 'valve_5', 'valve_6']

export default function ControlCenter() {
  const [searchParams] = useSearchParams()
  const {
    controlMode,
    activeSetpoints,
    valvePositions,
    loading,
    error,
    pendingCommands,
    fetchControlState,
    updateSetpoint,
    sendValveAction,
    toggleMode,
    emergencyOverride,
    clearError,
  } = useControlStore()

  const [selectedNode, setSelectedNode] = useState<string>('')
  const [setpointSlider, setSetpointSlider] = useState<number>(5.0)
  const [positionSlider, setPositionSlider] = useState<number>(50)
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false)

  useControlPolling(15000)

  useEffect(() => {
    fetchControlState()
  }, [fetchControlState])

  useEffect(() => {
    const nodeParam = searchParams.get('node')
    if (nodeParam && NODES.includes(nodeParam.toLowerCase())) {
      setSelectedNode(nodeParam.toLowerCase())
    } else if (NODES.length > 0 && !selectedNode) {
      setSelectedNode(NODES[0])
    }
  }, [searchParams])

  useEffect(() => {
    if (selectedNode && activeSetpoints[selectedNode] !== undefined) {
      setSetpointSlider(activeSetpoints[selectedNode])
    }
  }, [selectedNode, activeSetpoints])

  useEffect(() => {
    if (selectedNode && valvePositions[selectedNode] !== undefined) {
      setPositionSlider(valvePositions[selectedNode])
    }
  }, [selectedNode, valvePositions])

  const handleSetpointApply = async () => {
    if (!selectedNode) return
    await updateSetpoint(selectedNode, setpointSlider)
  }

  const handleValveOpen = async () => {
    if (!selectedNode) return
    await sendValveAction({
      node_id: selectedNode,
      action: 'open',
      priority: 'normal',
    })
  }

  const handleValveClose = async () => {
    if (!selectedNode) return
    await sendValveAction({
      node_id: selectedNode,
      action: 'close',
      priority: 'normal',
    })
  }

  const handleValveSetPosition = async () => {
    if (!selectedNode) return
    await sendValveAction({
      node_id: selectedNode,
      action: 'set_position',
      value: positionSlider,
      priority: 'normal',
    })
  }

  const handleEmergency = async () => {
    await emergencyOverride(NODES)
    setShowEmergencyConfirm(false)
  }

  return (
    <div className="bg-paper min-h-screen">
      <div className="border-b-2 border-rule px-5 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <h1 className="font-syne font-extrabold text-[36px] text-ink leading-none">
            CONTROL CENTER
          </h1>
          <div className="flex items-center gap-4">
            <span className="font-condensed text-[12px] text-dim">
              14 March 2026 · Solapur Municipal Corporation
            </span>
            <div className="flex items-center gap-2 px-3 py-1 border border-rule rounded-full">
              <span className={`w-2 h-2 rounded-full ${controlMode === 'auto' ? 'bg-pass' : 'bg-warn'}`} />
              <span className="font-condensed text-[10px] uppercase tracking-wider text-ink">
                {controlMode.toUpperCase()} MODE
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border-b-2 border-rule">
        <div className="lg:col-span-2 p-5 border-r border-rule">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-syne font-bold text-[18px] text-ink">
              MANUAL CONTROL
            </h2>
              <button
                onClick={toggleMode}
                disabled={loading}
                className={`px-4 py-2 font-condensed text-[11px] uppercase tracking-wider border transition-colors ${
                  controlMode === 'manual'
                    ? 'bg-signal text-paper border-signal'
                    : 'bg-paper text-ink border-rule hover:bg-rule/30'
                }`}
              >
                Switch to {controlMode === 'auto' ? 'Manual' : 'Auto'} Control
              </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-rule p-4 rounded">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-condensed text-[12px] uppercase tracking-wider text-dim">
                  NODE SELECTION
                </h3>
                {pendingCommands.includes(selectedNode) && (
                  <span className="font-mono text-[10px] text-warn">Processing...</span>
                )}
              </div>
              <select
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
                className="w-full px-3 py-2 font-mono text-[14px] border border-rule bg-paper text-ink"
                disabled={controlMode === 'auto' || loading}
              >
                {NODES.map((node) => (
                  <option key={node} value={node}>
                    {node.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="border border-rule p-4 rounded">
              <h3 className="font-condensed text-[12px] uppercase tracking-wider text-dim mb-3">
                PRESSURE SETPOINT
              </h3>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="2"
                  max="8"
                  step="0.1"
                  value={setpointSlider}
                  onChange={(e) => setSetpointSlider(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-rule rounded-lg appearance-none cursor-pointer"
                  disabled={controlMode === 'auto' || loading}
                />
                <span className="font-mono text-[20px] text-ink w-16 text-right">
                  {setpointSlider.toFixed(1)}
                </span>
              </div>
              <span className="font-condensed text-[10px] text-dim">BAR</span>
              <button
                onClick={handleSetpointApply}
                disabled={controlMode === 'auto' || loading || !selectedNode}
                className="mt-3 w-full px-3 py-2 font-condensed text-[11px] uppercase tracking-wider bg-ink text-paper hover:bg-ink/80 disabled:opacity-50 transition-colors"
              >
                Apply Setpoint
              </button>
            </div>

            <div className="border border-rule p-4 rounded">
              <h3 className="font-condensed text-[12px] uppercase tracking-wider text-dim mb-3">
                VALVE POSITION
              </h3>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={positionSlider}
                  onChange={(e) => setPositionSlider(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-rule rounded-lg appearance-none cursor-pointer"
                  disabled={controlMode === 'auto' || loading}
                />
                <span className="font-mono text-[20px] text-ink w-16 text-right">
                  {positionSlider}
                </span>
              </div>
              <span className="font-condensed text-[10px] text-dim">%</span>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleValveOpen}
                  disabled={controlMode === 'auto' || loading || !selectedNode}
                  className="flex-1 px-3 py-2 font-condensed text-[11px] uppercase tracking-wider bg-pass text-paper hover:bg-pass/80 disabled:opacity-50 transition-colors"
                >
                  Open
                </button>
                <button
                  onClick={handleValveClose}
                  disabled={controlMode === 'auto' || loading || !selectedNode}
                  className="flex-1 px-3 py-2 font-condensed text-[11px] uppercase tracking-wider bg-signal text-paper hover:bg-signal/80 disabled:opacity-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleValveSetPosition}
                  disabled={controlMode === 'auto' || loading || !selectedNode}
                  className="flex-1 px-3 py-2 font-condensed text-[11px] uppercase tracking-wider border border-rule bg-paper text-ink hover:bg-rule/30 disabled:opacity-50 transition-colors"
                >
                  Set
                </button>
              </div>
            </div>

            <div className="border border-rule p-4 rounded flex flex-col justify-between">
              <div>
                <h3 className="font-condensed text-[12px] uppercase tracking-wider text-dim mb-3">
                  EMERGENCY OVERRIDE
                </h3>
                <p className="font-condensed text-[11px] text-dim">
                  Close all valves and switch to manual mode immediately.
                </p>
              </div>
              <button
                onClick={() => setShowEmergencyConfirm(true)}
                disabled={controlMode === 'auto' || loading}
                className="mt-3 w-full px-3 py-2 font-condensed text-[11px] uppercase tracking-wider bg-warn text-paper hover:bg-warn/80 disabled:opacity-50 transition-colors"
              >
                Emergency Override
              </button>
            </div>
          </div>
        </div>

        <div className="p-5">
          <h2 className="font-syne font-bold text-[18px] text-ink mb-4">
            ACTIVE STATE
          </h2>

          <div className="space-y-3">
            <div className="border border-rule p-3 rounded">
              <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
                Control Mode
              </div>
              <div className={`font-mono text-[20px] ${controlMode === 'auto' ? 'text-pass' : 'text-warn'}`}>
                {controlMode.toUpperCase()}
              </div>
            </div>

            <div className="border border-rule p-3 rounded">
              <div className="font-condensed text-[10px] uppercase tracking-wider text-dim mb-2">
                Pressure Setpoints (BAR)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {NODES.map((node) => (
                  <div key={node} className="flex justify-between items-center">
                    <span className="font-mono text-[12px] text-dim">{node.toUpperCase()}</span>
                    <span className="font-mono text-[14px] text-ink">
                      {activeSetpoints[node]?.toFixed(1) ?? '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-rule p-3 rounded">
              <div className="font-condensed text-[10px] uppercase tracking-wider text-dim mb-2">
                Valve Positions (%)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {NODES.map((node) => (
                  <div key={node} className="flex justify-between items-center">
                    <span className="font-mono text-[12px] text-dim">{node.toUpperCase()}</span>
                    <span className="font-mono text-[14px] text-ink">
                      {valvePositions[node] ?? '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEmergencyConfirm && (
        <div className="fixed inset-0 bg-ink/80 flex items-center justify-center z-50">
          <div className="bg-paper border-2 border-signal p-6 max-w-sm w-full mx-4">
            <h3 className="font-syne font-bold text-[18px] text-signal mb-2">
              Confirm Emergency Override
            </h3>
            <p className="font-condensed text-[12px] text-dim mb-4">
              This will immediately close all valves and switch to manual control. The system will not automatically regulate pressure until you switch back to auto mode.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEmergencyConfirm(false)}
                className="flex-1 px-3 py-2 font-condensed text-[11px] uppercase tracking-wider border border-rule bg-paper text-ink hover:bg-rule/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEmergency}
                className="flex-1 px-3 py-2 font-condensed text-[11px] uppercase tracking-wider bg-signal text-paper hover:bg-signal/80 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 px-4 py-3 bg-signal text-paper border border-rule rounded">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-condensed text-[11px] uppercase tracking-wider">
                Error
              </div>
              <div className="font-mono text-[12px]">{error}</div>
            </div>
            <button onClick={clearError} className="text-paper/70 hover:text-paper">
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}