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
| Access   | Single shared team password (NestJS global guard)          |
| Icons    | Lucide React                                              |
| Testing  | Jest, Supertest                                           |

---

## Prerequisites

- **Node.js 24** — pinned in [.nvmrc](.nvmrc) and in the root `engines` field. Prisma 7 refuses to install below 20.19, and one of its transitive dependencies requires 22+. The pin is also what tells Railway's builder which Node version to use; without it, it defaults to Node 18 and the install fails.
- **npm** >= 10 (workspaces support)
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

# ── Access control ───────────────────────────────────────────────────────────
# Shared team password required on every /api route except the webhooks.
# The API REFUSES TO START without it, so a forgotten variable can never leave
# the endpoints open. Any long random string works.
APP_ACCESS_PASSWORD="change-me"
# Browser origins allowed by CORS, comma-separated. Leave empty in local
# development: the Vite dev servers (5173/5174) are then allowed by default.
CORS_ORIGINS=""

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

### 3. Configure the frontend environment

```bash
cp apps/web/.env.example apps/web/.env
```

A single variable, the API base URL including its `/api` prefix:

```env
VITE_API_URL="http://localhost:3000/api"
```

> Vite inlines this at **build** time. Changing it on a host requires a redeploy, not just a restart.

### 4. Run database migrations

```bash
cd apps/api
npx prisma migrate deploy
```

> For local development you can also use `npx prisma migrate dev` which will prompt for a migration name when the schema changes.

### 5. Start both apps concurrently

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

## Access Control

The POC is gated by **one shared team password**, not per-user accounts. `AccessPasswordGuard` is registered globally in [app.module.ts](apps/api/src/app.module.ts) and compares the `x-poc-password` header against `APP_ACCESS_PASSWORD` in constant time.

| Route | Protection |
| ----- | ---------- |
| `/api/*` | `x-poc-password` header, injected by `apiFetch` in [api.ts](apps/web/src/lib/api.ts) |
| `/api/realtime/stream` | Same password as `?token=` — `EventSource` cannot send custom headers |
| `/api/webhooks/*` | `@Public()`: Twilio signature and Graph `clientState` instead |
| `/api` (root) | `@Public()`: platform health check |

Two decorators control this, both in [public.decorator.ts](apps/api/src/auth/public.decorator.ts): `@Public()` exempts a route, `@AllowQueryToken()` additionally accepts the `?token=` form. Keep `@AllowQueryToken()` on the SSE route only — query strings land in access logs.

The frontend prompts for the password once ([PasswordGate.tsx](apps/web/src/components/PasswordGate.tsx)), stores it in `localStorage`, and re-validates it against `GET /api/auth/check` on every load. A `401` from any call clears it and brings the prompt back.

**Known limitation:** attachments live in a *public* Supabase bucket, so their URLs are reachable without the password. Signed URLs would be needed to close that.

---

## Deployment

The API runs on **Railway** (a persistent process — it must not sleep, since the Graph subscription is registered at startup and renewed every 2 days) and the frontend on **Vercel** (static build). Railway is configured by [railway.json](railway.json); Vercel needs no config file, its Vite preset covers the build.

Because `APP_PUBLIC_URL` must contain the Railway domain, which only exists after the first deploy, the order matters:

1. Push to `main`.
2. **Railway** → new project from the GitHub repo, **Root Directory left at the repository root**. Add every variable from `apps/api/.env`, `PORT=3000` included, plus `APP_ACCESS_PASSWORD`. Deploy. The Graph subscription fails at this stage — expected, the domain does not exist yet.
3. Generate the domain: service **Settings → Networking → Public Networking → Generate Domain**, and answer **3000** when it asks for the target port. It must match the `PORT` variable, otherwise every request returns 502 — Railway injects `8080` when `PORT` is undefined, which is the usual cause of that error here.
4. Set `APP_PUBLIC_URL` and `TWILIO_WEBHOOK_BASE_URL` to `https://<project>.up.railway.app` — **no `/api`, no trailing slash** — and redeploy. The subscription now registers.

   The code appends the path itself: `${APP_PUBLIC_URL}/api/webhooks/ms-graph/mail` for Graph, and `${TWILIO_WEBHOOK_BASE_URL}${req.originalUrl}` for Twilio. A trailing slash yields `//api/…`, and since Twilio signs the exact URL, its signature check then rejects every inbound webhook with a 401 while the URL still works fine in a browser.
5. **Vercel** → import the same repo, set **Root Directory** to `apps/web` and **Framework Preset** to *Vite* (both are auto-detected). Vercel installs from the workspace lockfile at the repository root on its own. Set `VITE_API_URL` to `https://<project>.up.railway.app/api` — **with `/api` this time**, since the frontend concatenates paths straight onto it — then deploy.
6. Back on Railway, set `CORS_ORIGINS` to the Vercel URL and redeploy.
7. **Twilio Console** → repoint the four webhooks (SMS, WhatsApp, voice, voice status) at the Railway domain, as described under [Webhook Setup](#webhook-setup).
8. Stop the local API and ngrok.

> **Run one environment at a time.** Production and local development share the same Supabase project and the same mailbox. Two instances running together would both register a Graph subscription and both store each inbound mail, duplicating messages.

Migrations are not replayed by the deploy: the target Supabase database is already migrated. Run `npx prisma migrate deploy` manually after a schema change.

Both platforms watch the same repository, so a push touching only one app would redeploy both. They handle it differently:

- **Vercel** skips unaffected projects by itself, but only if every workspace package carries a unique `name`. This is why `apps/web` is named `web` and not `poc-inbox` like the repository root — a duplicate name silently disables the feature.
- **Railway** has no equivalent, so [railway.json](railway.json) declares `watchPatterns`. It covers `apps/api/**` plus the root files that affect the API build — the lockfile, the root `package.json` holding the Node pin, `.nvmrc` and the config itself. Without it, a frontend-only commit restarts the API and re-registers a Graph subscription for nothing.

On Railway, leave **Root Directory** at the repository root. This is a *shared* monorepo — one lockfile, npm workspaces — so the service is targeted by the `--workspace=apps/api` commands in `railway.json`, not by the directory setting. Pointing it at `apps/api` would hide the root lockfile and break the install. Note that Vercel works the opposite way: there, the Root Directory *is* the mechanism.

Notes on the build:

- `npm run build` in `apps/api` runs `prisma generate` first, since the Prisma 7 client is not generated at install time.
- The compiled entrypoint is `dist/src/main.js` — not `dist/main.js` — because the source tree spans both `src/` and `prisma/`, which lifts TypeScript's inferred root directory.
- The Node version reaching the builder comes from the root `engines.node` field and [.nvmrc](.nvmrc). Removing either sends Nixpacks back to its Node 18 default, and `npm ci` then dies on Prisma's version check. If the builder ever fails to resolve the pinned version, the override is a `NIXPACKS_NODE_VERSION` variable on the service.
- **Do not set `NODE_ENV=production` on Railway.** The build needs `@nestjs/cli`, a devDependency; with that variable set, the install step skips devDependencies and `nest build` fails with "nest: not found". Railway already runs the app in production mode without it.

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
