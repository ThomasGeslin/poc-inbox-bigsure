# poc-inbox

A fullstack monorepo POC for an inbox-style conversation management interface. It handles multi-channel communications (email, WhatsApp, SMS, calls) with contact management and conversation tracking. The inbox updates in real time over Server-Sent Events, and messages can carry image/PDF attachments across every channel.

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

| Layer    | Technology                                                |
| -------- | --------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4               |
| Backend  | NestJS 11, TypeScript, CQRS                               |
| Database | PostgreSQL via Prisma ORM                                 |
| Email    | Microsoft 365 / Microsoft Graph (Entra app registration)  |
| SMS / WhatsApp / Voice | Twilio                                      |
| Attachments | Supabase Storage                                       |
| Realtime | Server-Sent Events (SSE)                                  |
| Icons    | Lucide React                                              |
| Testing  | Jest, Supertest                                           |

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9 (workspaces support)
- A [Supabase](https://supabase.com) free project — provides both the **PostgreSQL** database and the **Storage** bucket used for attachments
- **[ngrok](https://ngrok.com)** (or equivalent) to expose your local API for webhooks during development
- A [Twilio](https://twilio.com) account (SMS, WhatsApp, Voice)
- A **Microsoft Entra (Azure AD) app registration** with application-level Microsoft Graph mail permissions, for sending and receiving email through a Microsoft 365 mailbox

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
# ── Database (Supabase) ──────────────────────────────────────────────────────
# Connection pooler URL (port 6543, Transaction mode) — used at runtime
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/DATABASE?pgbouncer=true"
# Direct connection (port 5432) — used by Prisma for migrations
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"

# ── Supabase Storage (attachments) ───────────────────────────────────────────
# The secret key is server-side only — never expose it to the frontend.
# Settings → API Keys: Project URL + a "secret key" (sb_secret_…)
SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
SUPABASE_SECRET_KEY="sb_secret_..."
# Public storage bucket name (create it in the Supabase dashboard, set to public)
SUPABASE_STORAGE_BUCKET="attachments"

# ── App ─────────────────────────────────────────────────────────────────────
PORT=3000
# Public base URL of this API (used to build webhook callback URLs)
# Use your ngrok / production URL — no trailing slash
APP_PUBLIC_URL="https://your-ngrok-or-domain.example.com"

# ── Twilio (SMS, WhatsApp, Voice) ────────────────────────────────────────────
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# Base URL Twilio uses to sign requests (defaults to APP_PUBLIC_URL if unset)
TWILIO_WEBHOOK_BASE_URL="https://your-ngrok-or-domain.example.com"
# SMS sender number (E.164 format)
TWILIO_SMS_NUMBER="+33XXXXXXXXX"
# WhatsApp sender number — the "whatsapp:" prefix is added automatically if missing
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"
# Voice number — can be the same as the SMS number if it supports both
TWILIO_VOICE_NUMBER="+33XXXXXXXXX"
# Real phone number inbound calls are forwarded to (E.164 format)
TWILIO_FORWARD_NUMBER="+33XXXXXXXXX"

# ── Microsoft Entra / Graph (email send + receive) ───────────────────────────
ENTRA_CLIENT_SECRET="xxxxxxxxxxxxxxxx"
ENTRA_CLIENT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
ENTRA_TENANT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# Arbitrary shared secret echoed back as `clientState` on every Graph notification
MS_GRAPH_WEBHOOK_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# Mailbox used as the default sender and watched for inbound mail
TEST_MAIL="your-mailbox@yourdomain.com"
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

The API exposes inbound webhook endpoints that external services (Twilio and Microsoft Graph) must be able to reach. During local development, expose port 3000 with ngrok:

```bash
ngrok http 3000
```

Copy the HTTPS forwarding URL (e.g. `https://xxxx.ngrok-free.app`) and set it as `APP_PUBLIC_URL` in `apps/api/.env`, then restart the API.

### Twilio (SMS, WhatsApp, Voice)

All Twilio configuration is done in the [Twilio Console](https://console.twilio.com).

| Channel  | Setting                      | Value                                                            |
| -------- | ---------------------------- | ---------------------------------------------------------------- |
| SMS      | Webhook — A message comes in | `POST https://<APP_PUBLIC_URL>/api/webhooks/twilio/sms`          |
| WhatsApp | Webhook — A message comes in | `POST https://<APP_PUBLIC_URL>/api/webhooks/twilio/inbound`      |
| Voice    | Webhook — A call comes in    | `POST https://<APP_PUBLIC_URL>/api/webhooks/twilio/voice`        |
| Voice    | Status callback URL          | `POST https://<APP_PUBLIC_URL>/api/webhooks/twilio/voice/status` |

> The `twilio/inbound` endpoint auto-detects SMS vs WhatsApp from the `whatsapp:` prefix, so it can also serve as a single combined messaging webhook.

Steps:

1. Open **Phone Numbers → Manage → Active numbers** and select the number.
2. Under **Messaging**, set the webhook URL for SMS.
3. For **WhatsApp**, go to **Messaging → Try it out → Send a WhatsApp message** (sandbox) and set the webhook URL to the `twilio/inbound` endpoint.
4. Under **Voice**, set both the call-comes-in webhook and the status-callback URL.
5. Make sure the HTTP method is **POST** for every entry.

Inbound media (MMS / WhatsApp images and PDFs) are downloaded from Twilio and re-uploaded to Supabase Storage, then attached to the stored message.

> Twilio signs every request with an `X-Twilio-Signature` header. The API validates it using `TWILIO_AUTH_TOKEN`. Requests with an invalid signature are rejected with `401 Unauthorized`.

### Microsoft 365 / Microsoft Graph (Email send + receive)

Email is sent and received through a Microsoft 365 mailbox using the Microsoft Graph API, authenticated with a **Microsoft Entra (Azure AD) app registration** (client credentials flow — no user sign-in).

#### Entra app registration

1. In the [Entra admin center](https://entra.microsoft.com), go to **Applications → App registrations → New registration**.
2. Copy the **Application (client) ID** → `ENTRA_CLIENT_ID` and the **Directory (tenant) ID** → `ENTRA_TENANT_ID`.
3. Under **Certificates & secrets**, create a **client secret** → `ENTRA_CLIENT_SECRET`.
4. Under **API permissions**, add the **Application** Microsoft Graph permissions `Mail.Read` and `Mail.Send` (`Mail.ReadWrite` if you need to mark/move messages), then **grant admin consent**.
5. Set `TEST_MAIL` to the mailbox the app should send from and watch for inbound mail.

#### Inbound mail (Graph change notifications)

Rather than a manually configured webhook, the API **registers a Graph change-notification subscription automatically on startup** (see `MsGraphMailService.registerSubscriptions`, called from [main.ts](apps/api/src/main.ts) once the server is listening). Graph then POSTs notifications to:

```
POST https://<APP_PUBLIC_URL>/api/webhooks/ms-graph/mail
```

What you need to know:

- `APP_PUBLIC_URL` must be reachable from the internet **before the API starts**, because Graph performs a validation handshake (it calls the endpoint with a `?validationToken=…` query param, which the API echoes back verbatim).
- `MS_GRAPH_WEBHOOK_SECRET` is sent as the subscription's `clientState`; the API rejects any notification whose `clientState` doesn't match.
- Subscriptions are short-lived (~3 days), so the service auto-renews them every 2 days.
- On each notification the API fetches the full message from Graph, strips the quoted reply chain, downloads image/PDF attachments to Supabase Storage, and dispatches a `ReceiveMailCommand`.

---

## Realtime (SSE)

The inbox updates live over **Server-Sent Events** instead of polling. The API exposes a single stream:

```
GET https://<APP_PUBLIC_URL>/api/realtime/stream
```

The backend pushes `message.created` and `conversation.updated` events whose payloads match the REST response shapes, so the frontend applies them to state directly. The browser uses a native `EventSource`, which reconnects automatically on connection drop. See [realtime.service.ts](apps/api/src/realtime/realtime.service.ts) and [realtime.ts](apps/web/src/lib/realtime.ts).

---

## Apps

### `apps/api` — NestJS API

A NestJS application structured around the **CQRS** pattern.

#### Key dependencies

| Package                 | Role                                          |
| ----------------------- | --------------------------------------------- |
| `@nestjs/common`        | Core NestJS framework                         |
| `@nestjs/cqrs`          | Command/Query Responsibility Segregation      |
| `@prisma/client`        | Type-safe database client                     |
| `prisma`                | ORM & migration tooling                       |
| `twilio`                | SMS / WhatsApp / Voice + signature validation |
| `@supabase/supabase-js` | Supabase Storage client (attachments)         |
| `axios`                 | HTTP client for Microsoft Graph & media fetch |
| `libphonenumber-js`     | Phone number parsing / E.164 normalization    |

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

| Package                    | Role                                    |
| -------------------------- | --------------------------------------- |
| `react` 19                 | UI framework                            |
| `vite` 8                   | Build tool & dev server                 |
| `tailwindcss` v4           | Utility-first CSS framework             |
| `lucide-react`             | Icon library                            |
| `react-phone-number-input` | International phone input with E.164 output |

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
├── components/             # UI components
│   ├── Avatar.tsx
│   ├── ChannelIcon.tsx
│   ├── ContactPanel.tsx
│   ├── ConversationItem.tsx
│   ├── ConversationList.tsx
│   ├── CreateContactModal.tsx
│   ├── EditContactModal.tsx
│   ├── MessageBubble.tsx
│   ├── MessageThread.tsx
│   ├── PhoneInputField.tsx     # International phone input (E.164)
│   ├── ReplyBox.tsx
│   ├── StatusBadge.tsx
│   ├── Toaster.tsx             # Toast notifications
│   ├── ToastContext.ts
│   └── useToast.ts
├── lib/
│   ├── api.ts              # REST client for the API
│   └── realtime.ts         # SSE subscription (EventSource)
├── types/
│   └── index.ts            # Shared TypeScript types
├── utils/
│   └── helpers.ts          # Utility functions
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
