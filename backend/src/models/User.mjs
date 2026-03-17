import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    email: { type: String, required: false, unique: true, sparse: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
)

export const User = mongoose.models.User || mongoose.model('User', UserSchema)
