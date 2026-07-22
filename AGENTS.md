# AGENTS.md — ViStay Employee Management System

## Project Overview

Vietnamese hotel staff management system. 3-tier architecture: SQL Server database, Express.js API, vanilla HTML/JS frontend.

**Language**: Code comments, error messages, and UI are in Vietnamese. Keep responses in the user's language.

## Tech Stack

- **Runtime**: Node.js (CommonJS)
- **Server**: Express 4.x
- **Database**: MS SQL Server via `mssql` package
- **Auth**: JWT (bcryptjs)
- **File uploads**: Multer
- **Frontend**: Vanilla HTML/CSS/JS (no framework)

## Commands

```bash
npm start          # Production server (port 3000)
npm run dev        # Dev with auto-reload (--watch)
npm run seed       # Destructive: wipes all data, re-seeds from seed.sql
```

No linter, formatter, typecheck, or test framework is configured.

## Database

- Connection config in `server/.env` (not committed)
- Database name: `ungdungquanlynhanvienvistay`
- Schema: `database/schema.sql`
- Migrations: `database/migration*.sql` (run manually in SSMS)
- `npm run seed` runs `server/seed.js` — destructive, recreates all data

## Architecture

```
server/
  index.js          # Express entry point
  db.js             # SQL Server connection pool (auto-reconnect, retry logic)
  config.js         # Central config: salary rates, room rates, tech prices
  seed.js           # Destructive seed script
  statusHistory.js  # Room status history tracking
  sse.js            # Server-Sent Events for real-time updates
  middleware/
    auth.js         # JWT verify + role checks (authenticate, requireAdmin, etc.)
    upload.js       # Multer config
  routes/
    auth.js         # Login, /me, change-password, migrate-offline
    staff.js        # Staff CRUD
    apartments.js   # Apartments, status history, timeline
    work.js         # Work assignments (housekeeping)
    tasks.js        # Technical tasks
    salary.js       # Salary calculations
    tech.js         # Tech task routes

Root level:
  index.html, admin.html, employee.html  # Frontend pages
  admin.js, employee.js, app.js          # Frontend logic
  style.css                              # Styles
```

## Key Patterns

- **Roles**: `admin`, `manager`, `employee` (checked via `req.user.role`)
- **Auth middleware**: Import from `server/middleware/auth.js` — `authenticate`, `requireAdmin`, `requireManagerOrAdmin`, `requireSelfOrAdmin`
- **DB queries**: Use `queryDb()` wrapper from `server/db.js` for auto-reconnect on socket errors
- **Config**: All salary/rate constants live in `server/config.js` — edit there, not inline
- **Uploads**: Housekeeping photos stored in `ảnh dọn phòng của nhân viên/` (Vietnamese folder name with spaces)
- **Static serving**: Frontend served from project root via `express.static`

## Gotchas

- `server/.env` must exist with `DB_SERVER`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`
- JWT fallback secret is hardcoded in `server/middleware/auth.js` and `server/routes/auth.js` — keep them in sync if changing
- The `web/` directory is a placeholder (not implemented)
- No automated tests or CI — verify changes manually
- Port 3000 default; override with `PORT` env var
