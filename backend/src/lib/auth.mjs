import jwt from 'jsonwebtoken'
import { requireEnv } from './env.mjs'

export function signToken(payload) {
  const secret = requireEnv('JWT_SECRET')
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
  return jwt.sign(payload, secret, { expiresIn })
}

export function verifyToken(token) {
  const secret = requireEnv('JWT_SECRET')
  return jwt.verify(token, secret)
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' })
  }
  const token = header.slice('Bearer '.length)
  try {
    const decoded = verifyToken(token)
    req.user = decoded
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
