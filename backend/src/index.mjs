import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { loadEnv, requireEnv } from './lib/env.mjs'
import { authRouter } from './routes/auth.mjs'
import { seedAdminUser } from './lib/seedAdmin.mjs'

loadEnv()

const app = express()

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : true,
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  const state = mongoose.connection.readyState
  const mongo = state === 1 ? 'connected' : state === 2 ? 'connecting' : 'disconnected'
  res.json({ ok: true, mongo })
})
app.use('/api/auth', authRouter)

const port = Number(process.env.PORT || 8080)

async function start() {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`)
  })

  const uri = requireEnv('MONGODB_URI')
  try {
    await mongoose.connect(uri)
    console.log('MongoDB connected')

    const seeded = await seedAdminUser()
    if (seeded.seeded) {
      console.log(`Default admin ensured: ${seeded.email}`)
    } else {
      console.log(`Default admin seed skipped: ${seeded.reason}`)
    }
  } catch (err) {
    console.error('MongoDB connection failed (API still running):')
    console.error(err)
  }
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
