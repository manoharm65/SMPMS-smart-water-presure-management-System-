export type ApiConfig = {
  baseUrl?: string
  token?: string
}

const defaultBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL as
  | string
  | undefined

function resolveBaseUrl(cfg?: ApiConfig) {
  const baseUrl = cfg?.baseUrl ?? defaultBaseUrl ?? ''
  return String(baseUrl).trim().replace(/\/$/, '')
}

function toUrl(path: string, cfg?: ApiConfig) {
  const baseUrl = resolveBaseUrl(cfg)
  const p = path.startsWith('/') ? path : `/${path}`
  return baseUrl ? `${baseUrl}${p}` : p
}

async function readJsonOrText(res: Response) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return { raw: text }
  }
}

export async function apiGet<T>(path: string, cfg?: ApiConfig): Promise<T> {
  const res = await fetch(toUrl(path, cfg), {
    headers: {
      Accept: 'application/json',
      ...(cfg?.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
    },
  })

  if (!res.ok) {
    const data: any = await readJsonOrText(res)
    throw new Error(data?.error || `API GET ${path} failed: ${res.status}`)
  }

  return (await res.json()) as T
}

export async function apiPost<T>(path: string, body: unknown, cfg?: ApiConfig): Promise<T> {
  const res = await fetch(toUrl(path, cfg), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(cfg?.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data: any = await readJsonOrText(res)
    throw new Error(data?.error || `API POST ${path} failed: ${res.status}`)
  }

  return (await res.json()) as T
}
