import { useEffect, useRef, useState } from "react";
import { flowEngine, type FlowReadings } from "../../services/flowEngine";

interface FlowSimulationProps {
  mainFlow?: number;
  houseMeterFlow?: number;
  houseMeterStatus?: "live" | "offline" | "error";
  expectedFlow?: number;
  className?: string;
}

const MAX_FLOW = 150;

function ExpandModal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80"
      onClick={onClose}
    >
      <div
        className="relative bg-paper rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ width: "90%", height: "90%", maxWidth: "1200px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-paper border border-rule hover:bg-ink hover:text-paper transition-colors text-lg"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

export default function FlowSimulation({
  mainFlow = 100,
  houseMeterFlow = 0,
  houseMeterStatus,
  expectedFlow,
  className = "",
}: FlowSimulationProps) {
  const [readings, setReadings] = useState<FlowReadings>({
    main: 0,
    branchA: 0,
    branchB: 0,
    timestamp: Date.now(),
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMotor, setActiveMotor] = useState<"motor1" | "motor2" | null>(
    null,
  );
  const [reversePulse, setReversePulse] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [fallbackMeterFlow, setFallbackMeterFlow] = useState<number>(
    5 + Math.random() * 4,
  );
  const engineRef = useRef(flowEngine);
  const previousReversePulseRef = useRef(false);
  const isMotor1On = activeMotor === "motor1";
  const isMotor2On = activeMotor === "motor2";
  const hasHouseFlowSignal = Number.isFinite(houseMeterFlow) && houseMeterFlow >= 0;
  const isHouseLive = houseMeterStatus === "live" || hasHouseFlowSignal;

  useEffect(() => {
    const engine = engineRef.current;
    engine.setOnUpdate((newReadings) => setReadings(newReadings));
    engine.startPolling(1500);
    return () => {
      engine.stopPolling();
    };
  }, []);

  useEffect(() => {
    engineRef.current.updateMainFlow(mainFlow);
  }, [mainFlow]);

  useEffect(() => {
    if (!isMotor2On) {
      setReversePulse(false);
      return;
    }

    setReversePulse(true);
    const timer = window.setTimeout(() => {
      setReversePulse(false);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [isMotor2On]);

  useEffect(() => {
    if (!isMotor1On || !isHouseLive) return;
    setToastMessage("Suspicious Flow - Chances of Motor usage");
  }, [isMotor1On, isHouseLive]);

  useEffect(() => {
    if (
      previousReversePulseRef.current &&
      !reversePulse &&
      isMotor2On &&
      isHouseLive
    ) {
      setToastMessage("Suspicious Flow - Chances of Motor usage");
    }
    previousReversePulseRef.current = reversePulse;
  }, [reversePulse, isMotor2On, isHouseLive]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (hasHouseFlowSignal) return;

    const intervalId = window.setInterval(() => {
      setFallbackMeterFlow(5 + Math.random() * 4);
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [hasHouseFlowSignal]);

  const displayedHouseFlow = hasHouseFlowSignal ? houseMeterFlow : fallbackMeterFlow;

  const effectiveMainFlow = readings.main * (isMotor1On ? 1.35 : 1);
  const effectiveBranchAFlow = readings.branchA * (isMotor1On ? 1.45 : 1);
  const effectiveBranchBFlow = readings.branchB;

  const mainAnimationSpeed = Math.max(0.2, 2.5 - effectiveMainFlow / MAX_FLOW);
  const branchAAnimationSpeed = Math.max(
    0.2,
    2.5 - effectiveBranchAFlow / MAX_FLOW,
  );
  const branchBAnimationSpeed = Math.max(
    0.3,
    2.5 - effectiveBranchBFlow / MAX_FLOW,
  );

  const expectedFlowLps = expectedFlow !== undefined 
    ? (expectedFlow / 60).toFixed(2)
    : (effectiveMainFlow / 60).toFixed(2);
    
  const actualFlowLps = hasHouseFlowSignal
    ? (houseMeterFlow / 60).toFixed(2)
    : ((isMotor2On ? effectiveBranchBFlow : effectiveBranchAFlow) / 60).toFixed(2);

  const backwardFlowDetected = effectiveBranchBFlow > 0;

  return (
    <>
      <div
        className={`border-2 border-rule rounded-lg bg-paper p-4 flex flex-col w-full h-full min-h-[450px] ${className}`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-syne font-bold text-lg text-ink tracking-wide">
              FLOW MONITOR
            </h3>
            <span className="text-dim text-xs font-condensed">
              Real-time Pipeline Simulation
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                setActiveMotor((prev) => (prev === "motor1" ? null : "motor1"))
              }
              className={`px-3 py-1.5 rounded border text-xs font-condensed uppercase tracking-wider transition-colors ${
                isMotor1On
                  ? "bg-pass text-paper border-pass"
                  : "bg-paper text-dim border-rule hover:bg-ink hover:text-paper"
              }`}
              title="Motor 1"
            >
              Motor1 {isMotor1On ? "ON" : "OFF"}
            </button>
            <button
              onClick={() =>
                setActiveMotor((prev) => (prev === "motor2" ? null : "motor2"))
              }
              className={`px-3 py-1.5 rounded border text-xs font-condensed uppercase tracking-wider transition-colors ${
                isMotor2On
                  ? "bg-pass text-paper border-pass"
                  : "bg-paper text-dim border-rule hover:bg-ink hover:text-paper"
              }`}
              title="Motor 2"
            >
              Motor2 {isMotor2On ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => setIsExpanded(true)}
              className="p-2 rounded border border-rule bg-paper hover:bg-ink hover:text-paper transition-colors text-lg"
              title="Expand to full view"
            >
              ⛶
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 border border-rule rounded bg-paper">
              <span
                className={`w-2 h-2 rounded-full ${readings.main > 0 ? "bg-pass" : "bg-signal"} ${readings.main > 0 ? "animate-pulse" : ""}`}
              />
              <span className="font-condensed text-xs text-dim uppercase tracking-wider">
                LIVE
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full h-full min-h-[350px] relative">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 1000 500"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="pipeShadow">
                <feDropShadow
                  dx="0"
                  dy="3"
                  stdDeviation="4"
                  floodOpacity="0.12"
                />
              </filter>
            </defs>

            <g filter="url(#pipeShadow)">
              {/* Main Pipe */}
              <line
                x1="950"
                y1="150"
                x2="50"
                y2="150"
                stroke="#475569"
                strokeWidth="32"
                strokeLinecap="round"
              />
              <line
                x1="950"
                y1="150"
                x2="50"
                y2="150"
                stroke="#BAE6FD"
                strokeWidth="24"
                strokeLinecap="round"
              />

              {isMotor1On && (
                <>
                  <line
                    x1="300"
                    y1="186"
                    x2="300"
                    y2="350"
                    stroke="#475569"
                    strokeWidth="32"
                    strokeLinecap="round"
                  />
                  <line
                    x1="300"
                    y1="186"
                    x2="300"
                    y2="350"
                    stroke="#BAE6FD"
                    strokeWidth="24"
                    strokeLinecap="round"
                  />
                </>
              )}

              {isMotor2On && (
                <>
                  <line
                    x1="700"
                    y1="186"
                    x2="700"
                    y2="350"
                    stroke="#475569"
                    strokeWidth="32"
                    strokeLinecap="round"
                  />
                  <line
                    x1="700"
                    y1="186"
                    x2="700"
                    y2="350"
                    stroke="#BAE6FD"
                    strokeWidth="24"
                    strokeLinecap="round"
                  />
                </>
              )}
            </g>

            {effectiveMainFlow > 0 && (
              <line
                x1="950"
                y1="150"
                x2="50"
                y2="150"
                stroke="#2563EB"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="60 40"
                opacity="0.4"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-100"
                  dur={`${mainAnimationSpeed}s`}
                  repeatCount="indefinite"
                />
              </line>
            )}
            {reversePulse && isMotor2On && (
              <line
                x1="700"
                y1="150"
                x2="500"
                y2="150"
                stroke="#60A5FA"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="40 30"
                opacity={0.7}
                style={{ transition: "opacity 0.3s ease" }}
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="-100"
                  to="0"
                  dur="0.6s"
                  repeatCount="indefinite"
                />
              </line>
            )}
            {isMotor1On && effectiveBranchAFlow > 0 && (
              <line
                x1="300"
                y1="186"
                x2="300"
                y2="350"
                stroke="#2563EB"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="60 40"
                opacity="0.4"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-100"
                  dur={`${branchAAnimationSpeed}s`}
                  repeatCount="indefinite"
                />
              </line>
            )}
            {isMotor2On && effectiveBranchBFlow > 0 && (
              <>
                {!reversePulse && (
                  <line
                    x1="700"
                    y1="186"
                    x2="700"
                    y2="350"
                    stroke="#2563EB"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray="60 40"
                    opacity="0.4"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0"
                      to="-100"
                      dur={`${branchBAnimationSpeed}s`}
                      repeatCount="indefinite"
                    />
                  </line>
                )}
                {reversePulse && (
                  <line
                    x1="700"
                    y1="250"
                    x2="700"
                    y2="186"
                    stroke="#60A5FA"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray="40 30"
                    opacity={0.7}
                    style={{ transition: "opacity 0.3s ease" }}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="-80"
                      to="0"
                      dur="0.5s"
                      repeatCount="indefinite"
                    />
                  </line>
                )}
              </>
            )}

            <g>
              <circle
                cx="500"
                cy="150"
                r="34"
                fill="#0F172A"
                stroke="#38BDF8"
                strokeWidth="3"
              />
              <text
                x="500"
                y="147"
                textAnchor="middle"
                fill="#E2E8F0"
                fontSize="14"
                fontFamily="Space Mono, monospace"
                fontWeight="700"
              >
                {displayedHouseFlow.toFixed(1)}
              </text>
              <text
                x="500"
                y="163"
                textAnchor="middle"
                fill="#94A3B8"
                fontSize="9"
                fontFamily="Barlow Condensed, sans-serif"
                fontWeight="600"
              >
                HOUSE_1
              </text>
            </g>

            <g>
              <text
                x="70"
                y="110"
                fill="#94A3B8"
                fontSize="12"
                fontFamily="Barlow Condensed, sans-serif"
              >
                ← OUT
              </text>
              <text
                x="930"
                y="110"
                textAnchor="end"
                fill="#94A3B8"
                fontSize="12"
                fontFamily="Barlow Condensed, sans-serif"
              >
                IN ←
              </text>
              {isMotor1On && (
                <text
                  x="250"
                  y="260"
                  textAnchor="end"
                  fill="#475569"
                  fontSize="14"
                  fontFamily="Barlow Condensed, sans-serif"
                  fontWeight="600"
                >
                  POST_METER
                </text>
              )}
              {isMotor2On && (
                <text
                  x="750"
                  y="260"
                  textAnchor="start"
                  fill="#475569"
                  fontSize="14"
                  fontFamily="Barlow Condensed, sans-serif"
                  fontWeight="600"
                >
                  PRE_METER
                </text>
              )}
            </g>

            <g>
              <rect
                x="20"
                y="440"
                width="960"
                height="60"
                rx="6"
                fill="#FFFFFF"
                stroke="#E2E8F0"
                strokeWidth="1"
                style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.04))" }}
              />
              <g transform="translate(180, 460)">
                <text
                  x="0"
                  y="0"
                  fill="#64748B"
                  fontSize="11"
                  fontFamily="Barlow Condensed, sans-serif"
                >
                  ⬌ EXPECTED FLOW
                </text>
                <text
                  x="0"
                  y="22"
                  fill="#0F172A"
                  fontSize="18"
                  fontFamily="Space Mono, monospace"
                  fontWeight="bold"
                >
                  {expectedFlowLps} L/S
                </text>
              </g>
              <g transform="translate(480, 460)">
                <text
                  x="0"
                  y="0"
                  fill="#64748B"
                  fontSize="11"
                  fontFamily="Barlow Condensed, sans-serif"
                >
                  ┃ACTUAL FLOW
                </text>
                <text
                  x="0"
                  y="22"
                  fill="#3B82F6"
                  fontSize="18"
                  fontFamily="Space Mono, monospace"
                  fontWeight="600"
                >
                  {actualFlowLps} L/S
                </text>
              </g>
              {isMotor2On && (
                <g transform="translate(780, 460)">
                  <text
                    x="0"
                    y="0"
                    fill="#64748B"
                    fontSize="11"
                    fontFamily="Barlow Condensed, sans-serif"
                  >
                    ┃ BACKWARD FLOW DETECTED?
                  </text>
                  <text
                    x="0"
                    y="22"
                    fill="#3B82F6"
                    fontSize="18"
                    fontFamily="Space Mono, monospace"
                    fontWeight="600"
                  >
                    {backwardFlowDetected ? "YES" : "NO"}
                  </text>
                </g>
              )}
            </g>
          </svg>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed top-6 right-6 z-[80] border border-signal bg-paper text-signal px-4 py-2 rounded shadow-lg">
          <div className="font-condensed text-[10px] uppercase tracking-wider">
            Error
          </div>
          <div className="font-mono text-[12px]">{toastMessage}</div>
        </div>
      )}

      <ExpandModal isOpen={isExpanded} onClose={() => setIsExpanded(false)}>
        <FlowSimulation
          mainFlow={mainFlow}
          houseMeterFlow={houseMeterFlow}
          houseMeterStatus={houseMeterStatus}
          expectedFlow={expectedFlow}
          className="h-full p-6 flex-1"
        />
      </ExpandModal>
    </>
  );
}
