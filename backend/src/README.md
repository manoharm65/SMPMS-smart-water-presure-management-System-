# AquaBytes API (MongoDB)

## Setup
- Copy `server/.env.example` to `server/.env`
- Fill in `MONGODB_URI` and `JWT_SECRET`

### Default admin login
Set these in `server/.env` (the server will auto-upsert this user on startup):
- `ADMIN_EMAIL=admin@gmail.com`
- `ADMIN_PASSWORD=admin@123`

## Run
- `npm run dev:server`

## Seed a user
- `npm run create:user -- --email you@example.com --password YourPassword`

## Endpoints
- `GET /api/health`
- `POST /api/auth/login` { email, password }
- `GET /api/auth/me` (Bearer token)
