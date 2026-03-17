import dotenv from 'dotenv'

export function loadEnv() {
  const result = dotenv.config({ path: new URL('../.env', import.meta.url) })
  // If .env doesn't exist, dotenv returns an error; that's fine in CI.
  if (result.error) return
}

export function requireEnv(name) {
  const v = process.env[name]
  if (!v || String(v).trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return v
}
