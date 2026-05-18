# n8n Workflow Automation for Vault

n8n is used to automate workflows triggered by Claude Code events (deploys, alerts, etc.).

## Local Development

n8n is installed globally. Start it:
```bash
n8n start
# UI → http://localhost:5678
# Webhook base → http://localhost:5678/webhook/
```

## Deploy to Fly.io (Production)

```bash
# 1. Create the app (one-time)
flyctl apps create vault-n8n

# 2. Create persistent volume for n8n data
flyctl volumes create n8n_data --app vault-n8n --region iad --size 1

# 3. Set required secrets
flyctl secrets set --app vault-n8n \
  N8N_BASIC_AUTH_ACTIVE=true \
  N8N_BASIC_AUTH_USER=admin \
  N8N_BASIC_AUTH_PASSWORD=<choose-a-strong-password> \
  N8N_ENCRYPTION_KEY=<random-32-char-string>

# 4. Deploy
flyctl deploy --config infrastructure/n8n/fly.toml --app vault-n8n

# UI → https://vault-n8n.fly.dev
```

## Vault Events Webhook

The Claude Code `/n8n-notify` skill POSTs to:
- Local: `http://localhost:5678/webhook/vault-events`
- Production: `https://vault-n8n.fly.dev/webhook/vault-events`

In n8n, create a Webhook trigger node with path `vault-events` to receive these.

## Starter Workflows to Create

1. **Vault Deploy Notification** — on `vault-events` webhook with `event: "deploy"`, log to a file or send a notification
2. **Daily Health Check** — schedule trigger every day at 9am, curl `https://vault-api.fly.dev/api/health`, alert if down
3. **Error Alert** — on `vault-events` webhook with `event` containing "error", send an email/push notification
