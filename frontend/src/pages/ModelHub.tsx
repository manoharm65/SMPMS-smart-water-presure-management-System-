import { useEffect, useState } from "react";
import { useModelHubStore, type ModelHubTab } from "../store/modelHubStore";
import { useModelHubPolling, useTelemetryPolling } from "../hooks/useModelPolling";
import { SCENARIOS, type Scenario } from "../config/scenarios";
import ModelTab from "../components/model-hub/ModelTab";
import PressureComparisonChart from "../components/model-hub/charts/PressureComparisonChart";
import FlowSimulation from "../components/model-hub/FlowSimulation";

const TAB_CONFIG: Record<ModelHubTab, { title: string; description: string }> =
  {
    mpc: {
      title: "Model Predictive Control",
      description:
        "Real-time optimization of pressure setpoints across network nodes",
    },
    leak: {
      title: "Leak Detection",
      description:
        "Anomaly detection and localization of potential leak events",
    },
    iweds: {
      title: "IWEDS State",
      description:
        "Intelligent Water Event Detection System monitoring and recommendations",
    },
  };

export default function ModelHub() {
  const {
    activeTab,
    setActiveTab,
    mpcNodeData,
    iwedsNodeData,
    modelStatus,
    runningScenario,
    startScenario,
    toggleMotorized,
    loading,
    error,
    controlSimulationEnabled,
    setMpcSimulation,
    runMpcSimulation,
    setLeakSimulation,
    runLeakSimulation,
  } = useModelHubStore();

  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [showSimulationModal, setShowSimulationModal] = useState(false);

  useModelHubPolling(30000);
  useTelemetryPolling(1000);

  useEffect(() => {
    useModelHubStore.getState().refreshAll();
  }, []);

  useEffect(() => {
    if (activeTab === "iweds") {
      useModelHubStore.getState().fetchIwedsNodeData();
    }
  }, [activeTab]);

  const handleScenarioSelect = async (scenario: Scenario) => {
    await startScenario(scenario);
    setShowScenarioModal(false);
  };

  const tabs: ModelHubTab[] = ["mpc", "leak", "iweds"];

  const renderTabContent = () => {
    switch (activeTab) {
      case "mpc":
        return (
          <ModelTab
            title={TAB_CONFIG.mpc.title}
            description={TAB_CONFIG.mpc.description}
            stats={
              <div className="grid grid-cols-2 gap-6 mb-4">
                {["valve_1", "valve_2"].map((nodeId) => {
                  const node = mpcNodeData[nodeId];
                  return (
                    <div
                      key={nodeId}
                      className="border-2 border-rule p-4 rounded bg-paper"
                    >
                      <div className="font-condensed text-[12px] uppercase tracking-wider text-dim mb-2">
                        {nodeId.replace("_", " ").toUpperCase()}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
                            Pressure
                          </div>
                          <div className="font-mono text-[32px] text-ink">
                            {node ? node.pressure.toFixed(1) : "-.-"}
                          </div>
                          <div className="font-condensed text-[10px] text-dim">
                            BAR
                          </div>
                        </div>
                        <div>
                          <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
                            Status
                          </div>
                          <div
                            className={`font-mono text-[24px] ${node?.status === "live" ? "text-pass" : "text-signal"}`}
                          >
                            {node?.status === "live" ? "LIVE" : "OFFLINE"}
                          </div>
                          <div className="font-condensed text-[10px] text-dim">
                            {node?.status === "live"
                              ? "Water Flowing"
                              : "No Flow"}
                          </div>
                        </div>
                      </div>
                      {node?.flow_sensor !== undefined && (
                        <div className="mt-3 pt-3 border-t border-rule">
                          <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
                            Flow Sensor
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="font-mono text-[20px] text-ink">
                              {node.flow_sensor.toFixed(1)}
                            </span>
                            <span className="font-condensed text-[10px] text-dim">
                              L/min
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            }
            actions={
              controlSimulationEnabled ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setMpcSimulation(20, 0);
                      window.alert("Valve 1: 20%, Valve 2: 0%");
                    }}
                    className="px-3 py-1.5 font-condensed text-[11px] uppercase tracking-wider border border-rule bg-paper text-ink hover:bg-ink hover:text-paper transition-colors"
                  >
                    SET
                  </button>
                  <button
                    onClick={runMpcSimulation}
                    disabled={runningScenario}
                    className="px-3 py-1.5 font-condensed text-[11px] uppercase tracking-wider border border-rule bg-paper text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
                  >
                    {runningScenario ? "Running..." : "RUN"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowScenarioModal(true)}
                  disabled={runningScenario}
                  className="px-3 py-1.5 font-condensed text-[11px] uppercase tracking-wider border border-rule bg-paper text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
                >
                  {runningScenario ? "Running..." : "Run Scenario"}
                </button>
              )
            }
          >
            <div className="p-4 h-full flex items-center justify-center">
              <div className="text-dim font-condensed text-[12px]">
                MPC optimization running in background
              </div>
            </div>
          </ModelTab>
        );

      case "leak":
        return (
          <ModelTab
            title={TAB_CONFIG.leak.title}
            description={TAB_CONFIG.leak.description}
            stats={
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="border border-rule p-3 rounded">
                  <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
                    Valve 1 Pressure
                  </div>
                  <div className="font-mono text-[28px] text-ink">
                    {mpcNodeData.valve_1?.pressure.toFixed(1) ?? "-.-"}
                  </div>
                  <div className="font-condensed text-[10px] text-dim">BAR</div>
                  {mpcNodeData.valve_1?.flow_sensor !== undefined && (
                    <div className="mt-1 pt-1 border-t border-rule/50">
                      <div className="font-condensed text-[9px] text-dim">
                        Flow: {mpcNodeData.valve_1.flow_sensor.toFixed(1)} L/min
                      </div>
                    </div>
                  )}
                </div>
                <div className="border border-rule p-3 rounded">
                  <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
                    Valve 2 Pressure
                  </div>
                  <div className="font-mono text-[28px] text-ink">
                    {mpcNodeData.valve_2?.pressure.toFixed(1) ?? "-.-"}
                  </div>
                  <div className="font-condensed text-[10px] text-dim">BAR</div>
                  {mpcNodeData.valve_2?.flow_sensor !== undefined && (
                    <div className="mt-1 pt-1 border-t border-rule/50">
                      <div className="font-condensed text-[9px] text-dim">
                        Flow: {mpcNodeData.valve_2.flow_sensor.toFixed(1)} L/min
                      </div>
                    </div>
                  )}
                </div>
                <div className="border border-rule p-3 rounded">
                  <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
                    Delta
                  </div>
                  <div className="font-mono text-[28px] text-ink">
                    {mpcNodeData.valve_1 && mpcNodeData.valve_2
                      ? (
                          mpcNodeData.valve_1.pressure -
                          mpcNodeData.valve_2.pressure
                        ).toFixed(1)
                      : "-"}
                  </div>
                  <div className="font-condensed text-[10px] text-dim">BAR</div>
                </div>
              </div>
            }
            actions={
              controlSimulationEnabled ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLeakSimulation(50, 10);
                      window.alert("Valve 1: 50%, Valve 2: 10%");
                    }}
                    className="px-3 py-1.5 font-condensed text-[11px] uppercase tracking-wider border border-rule bg-paper text-ink hover:bg-ink hover:text-paper transition-colors"
                  >
                    SET
                  </button>
                  <button
                    onClick={runLeakSimulation}
                    disabled={runningScenario}
                    className="px-3 py-1.5 font-condensed text-[11px] uppercase tracking-wider border border-rule bg-paper text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
                  >
                    {runningScenario ? "Running..." : "RUN"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowScenarioModal(true)}
                  disabled={runningScenario}
                  className="px-3 py-1.5 font-condensed text-[11px] uppercase tracking-wider border border-rule bg-paper text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
                >
                  {runningScenario ? "Running..." : "Run Scenario"}
                </button>
              )
            }
          >
            <div className="p-4 h-full">
              <PressureComparisonChart
                valve1={mpcNodeData.valve_1 ?? null}
                valve2={mpcNodeData.valve_2 ?? null}
                loading={loading}
              />
            </div>
          </ModelTab>
        );

      case "iweds":
        return (
          <ModelTab
            title={TAB_CONFIG.iweds.title}
            description={TAB_CONFIG.iweds.description}
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    toggleMotorized(!iwedsNodeData.motorized_flow?.enabled)
                  }
                  disabled={runningScenario}
                  className={`px-3 py-1.5 font-condensed text-[11px] uppercase tracking-wider border transition-colors ${
                    iwedsNodeData.motorized_flow?.enabled
                      ? "bg-pass text-paper border-pass"
                      : "bg-paper text-ink border-rule hover:bg-ink hover:text-paper"
                  } disabled:opacity-50`}
                >
                  {iwedsNodeData.motorized_flow?.enabled
                    ? "Motor ON"
                    : "Motorized Flow"}
                </button>
                <button
                  onClick={() => setShowSimulationModal(true)}
                  className="px-3 py-1.5 font-condensed text-[11px] uppercase tracking-wider border border-rule bg-paper text-ink hover:bg-ink hover:text-paper transition-colors"
                >
                  Simulation
                </button>
                <button
                  onClick={() => setShowScenarioModal(true)}
                  disabled={runningScenario}
                  className="px-3 py-1.5 font-condensed text-[11px] uppercase tracking-wider border border-rule bg-paper text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
                >
                  {runningScenario ? "Running..." : "Run Scenario"}
                </button>
              </div>
            }
          >
            {/*<div className="p-4 h-full">*/}
            <div className="grid grid-cols-2 gap-6 mb-4">
              <div className="border-2 border-rule p-4 rounded bg-paper">
                <div className="font-condensed text-[12px] uppercase tracking-wider text-dim mb-2">
                  HOUSE_1
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
                      Flow
                    </div>
                    <div className="font-mono text-[32px] text-ink">
                      {iwedsNodeData.house_1?.flow_rate?.toFixed(1) ?? "0.0"}
                    </div>
                    <div className="font-condensed text-[10px] text-dim">
                      L/MIN
                    </div>
                  </div>
                  <div>
                    <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
                      Status
                    </div>
                    <div
                      className={`font-mono text-[14px] mt-2 ${
                        iwedsNodeData.house_1?.status === "live"
                          ? "text-pass"
                          : "text-signal"
                      }`}
                    >
                      {iwedsNodeData.house_1?.status?.toUpperCase() ?? "OFFLINE"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-2 border-rule p-4 rounded bg-paper">
                <div className="font-condensed text-[12px] uppercase tracking-wider text-dim mb-2">
                  VALVE_1
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
                      Pressure
                    </div>
                    <div className="font-mono text-[32px] text-ink">
                      {iwedsNodeData.valve_1?.pressure?.toFixed(1) ?? "0.0"}
                    </div>
                    <div className="font-condensed text-[10px] text-dim">
                      BAR
                    </div>
                  </div>
                  <div>
                    <div className="font-condensed text-[10px] uppercase tracking-wider text-dim">
                      Derived Expected Flow
                    </div>
                    <div className="font-mono text-[32px] text-ink">
                      {iwedsNodeData.expected_flow_rate?.toFixed(1) ?? "0.0"}
                    </div>
                    <div className="font-condensed text-[10px] text-dim">
                      L/MIN
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ModelTab>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-paper min-h-screen">
      <div className="border-b-2 border-rule px-5 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <h1 className="font-syne font-extrabold text-[36px] text-ink leading-none">
            MODEL HUB
          </h1>
          <div className="flex items-center gap-4">
            <span className="font-condensed text-[12px] text-dim">
              14 March 2026 · Solapur Municipal Corporation
            </span>
            <div className="flex items-center gap-2 px-3 py-1 border border-rule rounded-full">
              <span className="w-2 h-2 rounded-full bg-pass animate-blink" />
              <span className="font-condensed text-[10px] uppercase tracking-wider text-ink">
                Live Feed
              </span>
            </div>
            {modelStatus && (
              <div className="flex items-center gap-2 px-3 py-1 border border-rule rounded-full bg-paper">
                <span
                  className={`w-2 h-2 rounded-full ${modelStatus.mpc.running ? "bg-pass" : "bg-[#E8001D]"}`}
                />
                <span className="font-condensed text-[10px] uppercase tracking-wider text-ink">
                  MPC {modelStatus.mpc.running ? "Active" : "Offline"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-b-2 border-rule px-5 py-3">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-condensed text-[11px] uppercase tracking-wider border border-rule transition-colors ${
                activeTab === tab
                  ? "bg-ink text-paper border-ink"
                  : "bg-paper text-ink hover:bg-rule/30"
              }`}
            >
              {TAB_CONFIG[tab].title}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 h-[calc(100vh-180px)]">{renderTabContent()}</div>

      {showScenarioModal && (
        <div className="fixed inset-0 bg-ink/80 flex items-center justify-center z-50">
          <div className="bg-paper border-2 border-rule p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-syne font-bold text-[18px] text-ink">
                Select Scenario
              </h3>
              <button
                onClick={() => setShowScenarioModal(false)}
                className="text-dim hover:text-ink text-[20px]"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => handleScenarioSelect(scenario)}
                  className="w-full text-left p-3 border border-rule hover:border-ink transition-colors"
                >
                  <div className="font-mono text-[14px] text-ink">
                    {scenario.name}
                  </div>
                  <div className="font-condensed text-[11px] text-dim mt-1">
                    {scenario.description}
                  </div>
                  <div className="font-mono text-[10px] text-dim mt-2">
                    Type: {scenario.type} · Duration:{" "}
                    {scenario.duration_seconds}s
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 px-4 py-3 bg-signal text-paper border border-rule rounded">
          <div className="font-condensed text-[11px] uppercase tracking-wider">
            Error
          </div>
          <div className="font-mono text-[12px]">{error}</div>
        </div>
      )}

      {showSimulationModal && (
        <div className="fixed inset-0 bg-ink/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-paper border-2 border-rule rounded-lg shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-rule">
              <h3 className="font-syne font-bold text-[18px] text-ink">
                IWEDS Pipeline Simulation
              </h3>
              <button
                onClick={() => setShowSimulationModal(false)}
                className="text-dim hover:text-ink text-[24px] leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4 overflow-hidden relative">
              <FlowSimulation
                mainFlow={
                  iwedsNodeData.valve_1?.pressure
                    ? iwedsNodeData.valve_1.pressure * 2
                    : 100
                }
                houseMeterFlow={
                  iwedsNodeData.house_1?.flow_sensor ??
                  iwedsNodeData.house_1?.flow_rate ??
                  iwedsNodeData.smart_meter?.actual_flow ??
                  0
                }
                houseMeterStatus={iwedsNodeData.house_1?.status}
                expectedFlow={iwedsNodeData.expected_flow_rate}
                className="w-full h-full border-none shadow-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
