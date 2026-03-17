import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { loadEnv, requireEnv } from '../lib/env.mjs'
import { User } from '../models/User.mjs'

loadEnv()

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

const username = arg('username')
const email = arg('email')
const password = arg('password')

if ((!username && !email) || !password) {
  console.error('Usage: node server/scripts/create-user.mjs --username admin --password YourPass')
  console.error('   or: node server/scripts/create-user.mjs --email you@example.com --password YourPass')
  process.exit(1)
}

const uri = requireEnv('MONGODB_URI')
await mongoose.connect(uri)

const normalized = String(username || email).toLowerCase().trim()
const passwordHash = await bcrypt.hash(String(password), 10)

await User.updateOne(
  { username: normalized },
  { $set: { username: normalized, ...(email ? { email: String(email).toLowerCase().trim() } : {}), passwordHash } },
  { upsert: true },
)

console.log('User upserted:', normalized)
await mongoose.disconnect()
