## Module: Alerting & Notifications
## Owner: Full-Stack Team
## Phase: 4

---

## Purpose

Expand alerting beyond Telegram to multi-channel notifications (email, SMS),
build an alert management UI in the frontend, and add alert escalation rules.

---

## Sub-Tasks

### 4.1 Telegram Integration Completion
- Verify Telegram bot sends all 7 notification types:
  - CRITICAL pressure alert (🚨 emoji)
  - WARNING pressure alert (⚠️ emoji)
  - LOW pressure alert (ℹ️ emoji)
  - Valve command dispatched (🔴 emoji)
  - Command timeout (⚠️ emoji)
  - Manual override applied (🔧 emoji)
  - Auto-revert triggered (⚠️ emoji)
- Add rate limiting: max 1 Telegram message per minute per node
- Add Telegram inline keyboard: "Acknowledge" / "View Dashboard" buttons
- Store sent_at timestamp and sent flag in alerts table

### 4.2 Email Notifications
- Integrate with SMTP (use nodemailer or SendGrid)
- Config: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_EMAIL_FROM
- Email template per alert severity:
  - CRITICAL: immediate email with red header
  - WARNING: standard alert email
  - LOW: summary digest (batch every hour)
- Add EMAIL_ENABLED config flag (default false)

### 4.3 SMS Notifications (Optional)
- Integrate with Twilio
- Config: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
- SMS only for CRITICAL alerts
- Add SMS_ENABLED and SMS_RECIPIENTS config flags

### 4.4 Alert Management API
- PATCH /api/v1/alerts/:alertId/acknowledge
  → marks alert.acknowledged = true, alert.acknowledged_by = userId, alert.acknowledged_at = now
- PATCH /api/v1/alerts/:alertId/resolve
  → marks alert.resolved = true, alert.resolved_at = now
- GET /api/v1/alerts?status=unresolved|sent|acknowledged|resolved
- Alert escalation: if CRITICAL not acknowledged within 5 min → re-send + escalate to SMS

### 4.5 Frontend Alert Management UI
- In Alerts page: add "Acknowledge" and "Resolve" buttons per alert
- Show who acknowledged and when
- Show alert history (past 7 days)
- Add "Mute node" action — suppresses alerts for a specific node for X hours

### 4.6 Alert Aggregation
- If same CRITICAL alert fires multiple times in 5 min for same node,
  aggregate into single alert (update message to say "X events in 5 min")
- Store aggregation count in alerts table

---

## Acceptance Criteria

- [ ] All 7 Telegram notification types fire at correct trigger points
- [ ] Telegram messages rate-limited to 1/min/node
- [ ] Email notifications send for CRITICAL and WARNING
- [ ] Email LOW alerts batch into hourly digest
- [ ] SMS sends for CRITICAL if not acknowledged within 5 min
- [ ] Alert acknowledge/resolve endpoints work and persist
- [ ] Frontend shows alert history with all state transitions
- [ ] Mute node feature prevents alert fatigue
- [ ] Alert aggregation prevents duplicate alerts within 5-min window

---

## Claude Code Usage Instructions

### Recommended Agent Strategy

1. **code-reviewer agent** — After each alerting module is added,
   review for security (no credential hardcoding, env vars only).

2. **security-reviewer agent** — Before deploying alerting (especially
   email/SMS), verify no secrets leak, SMTP credentials are in env vars
   only, and webhook URLs are validated.

3. **Plan agent** — For 4.4 (Alert Management API), design the
   endpoint shapes and escalation logic before coding.

### Execution Order

  1. Start with 4.1 (Telegram completion) — verify existing code works
  2. Then 4.4 (API endpoints) — needed by frontend
  3. Then 4.5 (frontend UI) — depends on 4.4
  4. Then 4.2 (email) — separate concern, can run parallel with 4.4
  5. Then 4.3 (SMS) — if Twilio account available
  6. Then 4.6 (aggregation) — reduces alert fatigue

### Critical Files (Read First)

- `backend/src/integrations/telegram.service.ts` (current Telegram impl)
- `backend/src/modules/alert/alert.service.ts` (handleAlertTriggered)
- `backend/src/modules/alert/alert.controller.ts`
- `backend/src/modules/alert/alert.repository.ts`
- `backend/src/database/schema.sql` (alerts table schema)

### Notification Service Architecture

Create a notification service chain:
```
NotificationService.send(alert)
  → EmailService.send()    [if EMAIL_ENABLED]
  → SmsService.send()      [if SMS_ENABLED]
  → TelegramService.send() [if TELEGRAM_TOKEN set]
  → DatabaseService.save()  [always]
```

Use a queue (in-memory or Redis) for email batching.

### Environment Variables (All Required for Alerting)

```
TELEGRAM_TOKEN=
TELEGRAM_CHAT_ID=
EMAIL_ENABLED=false
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
ALERT_EMAIL_FROM=alerts@aquabytes.local
SMS_ENABLED=false
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
SMS_RECIPIENTS=+91XXXXXXXXXX
```