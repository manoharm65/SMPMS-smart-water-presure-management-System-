import bcrypt from 'bcryptjs'
import { User } from '../models/User.mjs'

export async function seedAdminUser() {
  const username = (process.env.ADMIN_USERNAME || process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = String(process.env.ADMIN_PASSWORD || '')
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()

  if (!username || !password) return { seeded: false, reason: 'missing ADMIN_USERNAME/ADMIN_PASSWORD' }

  const passwordHash = await bcrypt.hash(password, 10)
  await User.updateOne(
    { username },
    { $set: { username, ...(email ? { email } : {}), passwordHash } },
    { upsert: true },
  )

  return { seeded: true, email: username }
}
