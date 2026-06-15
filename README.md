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

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | React 19, TypeScript, Vite, Tailwind CSS v4     |
| Backend   | NestJS 11, TypeScript, CQRS                     |
| Database  | PostgreSQL via Prisma ORM                       |
| Icons     | Lucide React                                    |
| Testing   | Jest, Supertest                                 |

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9 (workspaces support)
- **PostgreSQL** instance (local or remote)

---

## Getting Started

### 1. Install dependencies

From the root of the repository, install all workspace dependencies at once:

```bash
npm install
```

### 2. Configure the API environment

Create an `.env` file in `apps/api/` and set your database connection string:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
```

### 3. Run database migrations

```bash
cd apps/api
npx prisma migrate dev
```

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

## Apps

### `apps/api` — NestJS API

A NestJS application structured around the **CQRS** pattern.

#### Key dependencies

| Package              | Role                            |
|----------------------|---------------------------------|
| `@nestjs/common`     | Core NestJS framework           |
| `@nestjs/cqrs`       | Command/Query Responsibility    |
| `@prisma/client`     | Type-safe database client       |
| `prisma`             | ORM & migration tooling         |

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

| Package          | Role                              |
|------------------|-----------------------------------|
| `react` 19       | UI framework                      |
| `vite` 8         | Build tool & dev server           |
| `tailwindcss` v4 | Utility-first CSS framework       |
| `lucide-react`   | Icon library                      |

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

| Type                  | Values                                                              |
|-----------------------|---------------------------------------------------------------------|
| `Channel`             | `mail`, `whatsapp`, `sms`, `call`                                   |
| `ConversationStatus`  | `to_attach`, `to_plan`, `quote_after_meeting`, `waiting`, `treated` |
| `CallStatus`          | `missed`, `answered`, `outbound`                                    |
| `FilterChannel`       | `all` + all `Channel` values                                        |
| `FilterStatus`        | `pending`, `treated`                                                |

---

## Root Scripts

Defined in the root `package.json`:

| Script      | Description                                      |
|-------------|--------------------------------------------------|
| `dev`       | Start both `api` and `web` concurrently          |
| `dev:api`   | Start the NestJS API in watch mode               |
| `dev:web`   | Start the Vite development server                |

---

## License

Private — all rights reserved.
