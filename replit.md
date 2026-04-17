# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

The main user-facing app is **Investment Simulator**, a frontend-only learning simulation for beginner investors. It includes simple local signup/login, virtual rupee trading, time-based market timelines, live stock charts, portfolio tracking, trade history, behavior logging, and simple feedback about panic selling and patience.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Main app**: React + Vite (`artifacts/investment-simulator`)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

- `artifacts/investment-simulator` — React/Vite web app served at `/`. Frontend-only simulator with localStorage-based username/password accounts, predefined mock price timelines, chart visualization, portfolio/trade history screens, and panic-sell behavior detection. No real APIs, no real trading, and no backend persistence.
- `artifacts/api-server` — shared Express API server at `/api`.
- `artifacts/mockup-sandbox` — canvas/design preview sandbox at `/__mockup`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
