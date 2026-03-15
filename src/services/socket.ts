import type { PressureUpdateEvent } from '../store/dashboardStore'

export type SocketStatus = {
  status: 'offline' | 'connecting' | 'connected'
  lastMessageAt?: number
}

export type PressureSocketOptions = {
  url?: string
  onEvent: (evt: PressureUpdateEvent) => void
  onStatus: (status: SocketStatus) => void
}

type Closable = { close: () => void }

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function startMockStream(onEvent: (evt: PressureUpdateEvent) => void): Closable {
  const zoneIds = ['DMA-01', 'DMA-02', 'DMA-03', 'DMA-04', 'DMA-05']
  const timer = window.setInterval(() => {
    const zoneId = zoneIds[Math.floor(Math.random() * zoneIds.length)]
    const base = 5.2 + (Math.random() - 0.5) * 1.4
    const anomaly = Math.max(0, Math.min(1, Math.random() * 0.98))

    onEvent({
      zoneId,
      pressure: base,
      valvePosition: 55 + (Math.random() - 0.5) * 30,
      flowRate: 38 + (Math.random() - 0.5) * 18,
      anomalyScore: anomaly,
    })
  }, 1100)

  return { close: () => window.clearInterval(timer) }
}

export function connectPressureSocket(opts: PressureSocketOptions): Closable {
  const useMock =
    (import.meta as any).env?.VITE_USE_MOCK_WS === 'true' || !opts.url

  opts.onStatus({ status: 'connecting' })

  if (useMock) {
    opts.onStatus({ status: 'connected', lastMessageAt: Date.now() })
    return startMockStream(opts.onEvent)
  }

  if (!opts.url) {
    opts.onStatus({ status: 'offline' })
    return { close: () => undefined }
  }

  const url = opts.url
  let ws: WebSocket | null = null
  try {
    ws = new WebSocket(url)
  } catch {
    opts.onStatus({ status: 'offline' })
    return { close: () => undefined }
  }

  ws.addEventListener('open', () => {
    opts.onStatus({ status: 'connected' })
  })
  ws.addEventListener('close', () => {
    opts.onStatus({ status: 'offline' })
  })
  ws.addEventListener('error', () => {
    opts.onStatus({ status: 'offline' })
  })
  ws.addEventListener('message', (msg) => {
    const evt = safeJsonParse<PressureUpdateEvent>(String(msg.data))
    if (!evt || typeof evt.zoneId !== 'string') return
    opts.onEvent(evt)
  })

  return {
    close: () => {
      try {
        ws?.close()
      } catch {
        // ignore
      }
      ws = null
    },
  }
}
