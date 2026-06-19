# poc-inbox

A fullstack monorepo POC for an inbox-style conversation management interface. It handles multi-channel communications (email, WhatsApp, SMS, calls) with contact management and conversation tracking.

## Repository Structure

```
poc-inbox/
├── apps/
│   ├── api/          # NestJS REST API with Prisma ORM
│   └── web/          # React + Vite frontend
└── package.json      # Root workspace configuration
```

This project uses **npm workspaces** to manage both apps from the root.

---

## Tech Stack

| Layer    | Technology                                  |
| -------- | ------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend  | NestJS 11, TypeScript, CQRS                 |
| Database | PostgreSQL via Prisma ORM                   |
| Icons    | Lucide React                                |
| Testing  | Jest, Supertest                             |

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9 (workspaces support)
- **PostgreSQL** instance — a [Supabase](https://supabase.com) free project works well
- **[ngrok](https://ngrok.com)** (or equivalent) to expose your local API for webhooks during development
- Accounts on [Twilio](https://twilio.com), [Cloudmailin](https://www.cloudmailin.com), and [Resend](https://resend.com)

---

## Getting Started

### 1. Install dependencies

From the root of the repository, install all workspace dependencies at once:

```bash
npm install
```

### 2. Configure the API environment

Copy the example file and fill in the values:

```bash
cp apps/api/.env.example apps/api/.env
```

Full reference for `apps/api/.env`:

```env
# ── Database ────────────────────────────────────────────────────────────────
# Supabase connection pooler URL (port 6543 for Transaction mode)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/DATABASE?pgbouncer=true"

# ── App ─────────────────────────────────────────────────────────────────────
PORT=3000
# Public base URL of this API (used to build webhook callback URLs for Twilio)
# Use your ngrok / production URL — no trailing slash
APP_PUBLIC_URL="https://your-ngrok-subdomain.ngrok-free.app"

# ── Twilio ───────────────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# Your Twilio phone number for SMS (E.164 format)
TWILIO_SMS_NUMBER="+33XXXXXXXXX"
# Your Twilio WhatsApp-enabled number (sandbox or approved sender)
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"
# Your Twilio number for voice calls
TWILIO_VOICE_NUMBER="+33XXXXXXXXX"
# The real phone number inbound calls are forwarded to
TWILIO_FORWARD_NUMBER="+33XXXXXXXXX"

# ── Resend ───────────────────────────────────────────────────────────────────
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# Verified sender address in your Resend domain
RESEND_FROM_EMAIL="contact@yourdomain.com"
# Webhook signing secret (from Resend dashboard → Webhooks)
RESEND_INBOUND_WEBHOOK_SECRET="whsec_xxxxxxxxxxxx"

# ── Cloudmailin ──────────────────────────────────────────────────────────────
# The inbound address assigned to your Cloudmailin target
CLOUDMAILIN_ADDRESS="xxxxxxxx@cloudmailin.net"
```

### 3. Run database migrations

```bash
cd apps/api
npx prisma migrate deploy
```

> For local development you can also use `npx prisma migrate dev` which will prompt for a migration name when the schema changes.

### 4. Start both apps concurrently

```bash
# From the root — starts api + web in parallel
npm run dev
```

Or start each app individually:

```bash
npm run dev:api   # NestJS API on http://localhost:3000
npm run dev:web   # Vite dev server on http://localhost:5173
```

---

## Webhook Setup

The API exposes three inbound webhook endpoints that external services must be able to reach. During local development, expose port 3000 with ngrok:

```bash
ngrok http 3000
```

Copy the HTTPS forwarding URL (e.g. `https://xxxx.ngrok-free.app`) and set it as `APP_PUBLIC_URL` in `apps/api/.env`, then restart the API.

### Twilio (SMS, WhatsApp, Voice)

All Twilio configuration is done in the [Twilio Console](https://console.twilio.com).

| Channel  | Setting                      | Value                                                            |
| -------- | ---------------------------- | ---------------------------------------------------------------- |
| SMS      | Webhook — A message comes in | `POST https://<APP_PUBLIC_URL>/api/webhooks/twilio/sms`          |
| WhatsApp | Webhook — A message comes in | `POST https://<APP_PUBLIC_URL>/api/webhooks/twilio/whatsapp`     |
| Voice    | Webhook — A call comes in    | `POST https://<APP_PUBLIC_URL>/api/webhooks/twilio/voice`        |
| Voice    | Status callback URL          | `POST https://<APP_PUBLIC_URL>/api/webhooks/twilio/voice/status` |

Steps:

1. Open **Phone Numbers → Manage → Active numbers** and select the number.
2. Under **Messaging**, set the webhook URL for SMS.
3. For **WhatsApp**, go to **Messaging → Try it out → Send a WhatsApp message** (sandbox) and set the webhook URL.
4. Under **Voice**, set both the call-comes-in webhook and the status-callback URL.
5. Make sure the HTTP method is **POST** for every entry.

> Twilio signs every request with an `X-Twilio-Signature` header. The API validates it using `TWILIO_AUTH_TOKEN`. Requests with an invalid signature are rejected with `401 Unauthorized`.

### Cloudmailin (Inbound email)

Cloudmailin delivers inbound emails to the API as HTTP POST requests.

1. Create a free account at [cloudmailin.com](https://www.cloudmailin.com).
2. Create an **Address** — Cloudmailin assigns an address like `xxxxxxxx@cloudmailin.net`. Set this as `CLOUDMAILIN_ADDRESS` in `.env`.
3. Set the **Target URL** to:
   ```
   POST https://<APP_PUBLIC_URL>/api/webhooks/mail/inbound
   ```
4. Set the **Post Format** to **JSON** (the API parses the body as `application/json`).
5. Share the `CLOUDMAILIN_ADDRESS` with contacts so their emails are routed here.

### Resend (Outbound email + Inbound webhook)

Resend is used both to **send** outbound emails and to receive **inbound delivery events**.

#### Sending emails

1. Create an account at [resend.com](https://resend.com) and obtain an API key → set as `RESEND_API_KEY`.
2. Add and verify your sending domain, then set `RESEND_FROM_EMAIL` to a verified address on that domain.

#### Inbound webhook (delivery events / inbound routing)

1. In the Resend dashboard, go to **Webhooks** and create a new endpoint pointing to:
   ```
   POST https://<APP_PUBLIC_URL>/api/webhooks/resend/inbound
   ```
2. Copy the **Signing Secret** and set it as `RESEND_INBOUND_WEBHOOK_SECRET` in `.env`.

> The API verifies the `svix-signature` header on every Resend webhook request. Requests with an invalid signature are rejected.

---

## Apps

### `apps/api` — NestJS API

A NestJS application structured around the **CQRS** pattern.

#### Key dependencies

| Package          | Role                         |
| ---------------- | ---------------------------- |
| `@nestjs/common` | Core NestJS framework        |
| `@nestjs/cqrs`   | Command/Query Responsibility |
| `@prisma/client` | Type-safe database client    |
| `prisma`         | ORM & migration tooling      |

#### Available scripts

```bash
# Run in development (watch mode)
npm run start:dev --workspace=apps/api

# Build for production
npm run build --workspace=apps/api

# Start production build
npm run start:prod --workspace=apps/api

# Lint
npm run lint --workspace=apps/api

# Format
npm run format --workspace=apps/api
```

#### Testing

```bash
# Unit tests
npm run test --workspace=apps/api

# Unit tests in watch mode
npm run test:watch --workspace=apps/api

# Coverage report
npm run test:cov --workspace=apps/api

# End-to-end tests
npm run test:e2e --workspace=apps/api
```

#### Database

The API uses **Prisma** with a **PostgreSQL** datasource. The schema is located at `apps/api/prisma/schema.prisma`.

```bash
# Generate Prisma client after schema changes
npx prisma generate --schema=apps/api/prisma/schema.prisma

# Open Prisma Studio (database GUI)
npx prisma studio --schema=apps/api/prisma/schema.prisma
```

---

### `apps/web` — React Frontend

A React 19 SPA built with **Vite**, styled with **Tailwind CSS v4**, providing an inbox-style UI for managing multi-channel conversations.

#### Key dependencies

| Package          | Role                        |
| ---------------- | --------------------------- |
| `react` 19       | UI framework                |
| `vite` 8         | Build tool & dev server     |
| `tailwindcss` v4 | Utility-first CSS framework |
| `lucide-react`   | Icon library                |

#### Available scripts

```bash
# Development server with HMR
npm run dev --workspace=apps/web

# Type-check & production build
npm run build --workspace=apps/web

# Preview production build locally
npm run preview --workspace=apps/web

# Lint
npm run lint --workspace=apps/web
```

#### Project structure

```
apps/web/src/
├── components/         # UI components
│   ├── Avatar.tsx
│   ├── ChannelIcon.tsx
│   ├── ContactPanel.tsx
│   ├── ConversationItem.tsx
│   ├── ConversationList.tsx
│   ├── MessageBubble.tsx
│   ├── MessageThread.tsx
│   ├── ReplyBox.tsx
│   └── StatusBadge.tsx
├── data/
│   └── mockData.ts     # Local mock data for development
├── types/
│   └── index.ts        # Shared TypeScript types
├── utils/
│   └── helpers.ts      # Utility functions
├── App.tsx
└── main.tsx
```

#### Domain model

| Type                 | Values                                                              |
| -------------------- | ------------------------------------------------------------------- |
| `Channel`            | `mail`, `whatsapp`, `sms`, `call`                                   |
| `ConversationStatus` | `to_attach`, `to_plan`, `quote_after_meeting`, `waiting`, `treated` |
| `CallStatus`         | `missed`, `answered`, `outbound`                                    |
| `FilterChannel`      | `all` + all `Channel` values                                        |
| `FilterStatus`       | `pending`, `treated`                                                |

---

## Root Scripts

Defined in the root `package.json`:

| Script    | Description                             |
| --------- | --------------------------------------- |
| `dev`     | Start both `api` and `web` concurrently |
| `dev:api` | Start the NestJS API in watch mode      |
| `dev:web` | Start the Vite development server       |

---

## License

Private — all rights reserved.
