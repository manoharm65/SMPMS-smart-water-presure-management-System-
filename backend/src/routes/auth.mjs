import express from 'express'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { User } from '../models/User.mjs'
import { signToken, authRequired } from '../lib/auth.mjs'

export const authRouter = express.Router()

function normalizeUsername(v) {
  return String(v || '').trim().toLowerCase()
}

authRouter.post('/register', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database unavailable' })
  }

  const { username, password } = req.body || {}
  const u = normalizeUsername(username)
  if (!u || !password) {
    return res.status(400).json({ error: 'username and password are required' })
  }

  const existing = await User.findOne({ username: u }).lean()
  if (existing) return res.status(409).json({ error: 'Username already exists' })

  const passwordHash = await bcrypt.hash(String(password), 10)
  const created = await User.create({ username: u, passwordHash })

  const token = signToken({ sub: String(created._id), username: created.username })
  return res.json({ token, user: { id: String(created._id), username: created.username } })
})

authRouter.post('/login', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database unavailable' })
  }
  const { username, email, password } = req.body || {}
  const u = normalizeUsername(username || email)
  if (!u || !password) {
    return res.status(400).json({ error: 'username and password are required' })
  }

  const user = await User.findOne({ $or: [{ username: u }, { email: u }] }).lean()
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const ok = await bcrypt.compare(String(password), user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  const usernameOut = user.username || user.email || u
  const token = signToken({ sub: String(user._id), username: usernameOut, email: user.email })
  return res.json({ token, user: { id: String(user._id), username: usernameOut, email: user.email } })
})

authRouter.get('/me', authRequired, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database unavailable' })
  }
  return res.json({ user: { id: req.user?.sub, username: req.user?.username, email: req.user?.email } })
})
