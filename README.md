# PickListFTC

A scouting and alliance selection dashboard for FIRST Tech Challenge, built for the DECODE 2025–2026 season. Pulls live data from the [FTC Scout API](https://ftcscout.org) with optional Google sign-in for cross-device sync.

Live at [picklistftc.com](https://picklistftc.com).

## Features

- **Season Dashboard** — season-at-a-glance with watched events, pick list stats, upcoming event countdown, and most scouted teams
- **Event Dashboard** — event overview with top teams, OPR leaders, score distribution, and prescout mode for pre-match analysis
- **Leaderboard** — sortable team rankings with OPR, averages, consistency, and penalty data; prescout rankings using season-wide data before matches are played
- **Schedule** — match list with win probability predictions, alliance OPR breakdowns, expanded row detail, and a "Now" indicator for the current match
- **Compare** — side-by-side radar chart and stat comparison for up to 3 teams
- **Partners** — alliance partner finder that ranks teams by complementarity score for a selected team
- **Pick List** — drag-and-drop pick list builder with penalty badges, cloud sync, and cross-event comparison
- **Pick Lists Manager** — overview of all saved pick lists across events with side-by-side comparison
- **Team Report** — per-team deep-dive with season OPR chart, match history, and scout notes
- **Watched Teams** — track teams across events with favoriting and quick access to reports
- **Scout Notes** — attach freeform notes and predefined tags to teams; filter, export/import as JSON; optional team sharing with teammates
- **QR Sharing** — share any view via QR code or copy link; URLs encode the current event and relevant state
- **Quick Switcher** — Cmd+K / Ctrl+K to search and switch events instantly

## Tech Stack

- [Next.js 14](https://nextjs.org) (App Router)
- [React 18](https://react.dev)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Supabase](https://supabase.com) (Auth, Postgres, RLS)
- [Recharts](https://recharts.org) for radar and line charts
- [qrcode.react](https://github.com/zpao/qrcode.react) for QR code generation
- FTC Scout GraphQL API (`https://api.ftcscout.org/graphql`)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Enter an FTC event code (e.g. `USTXCMP`) in the loader to pull live data.

```bash
npm run build   # production build
npm run lint    # ESLint
```

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your Supabase anon key>
```

## Project Structure

```
app/
  (dashboard)/
    dashboard/    # event overview + season overview
    season/       # season dashboard with watched events
    leaderboard/  # team rankings + notes
    schedule/     # match list + predictions
    compare/      # head-to-head comparison
    partners/     # alliance partner finder
    picklist/     # drag-and-drop pick list
    picklists/    # pick list manager across events
    watched/      # watched teams
  auth/callback/  # OAuth callback handler
  report/[teamNumber]/  # team deep-dive
components/       # shared UI components
context/          # AuthContext, EventContext, FavoritesContext, NotesContext
lib/              # API client, calculations, storage, types
```

## Auth & Data

- **Anonymous users** — all features work without an account; data is persisted in `localStorage` scoped to `plftc:anon:*` keys.
- **Signed-in users** — Google OAuth via Supabase; data syncs to Postgres with RLS policies. localStorage is scoped per user (`plftc:{userId}:*`) so multiple accounts on the same browser never share data.
- **Migration** — when a user signs in for the first time, anonymous localStorage data is automatically migrated to their account and synced to the cloud.

Event data comes from the [FTC Scout](https://ftcscout.org) public GraphQL API. No API key is required.

## Security

- Content Security Policy, HSTS, X-Frame-Options, and other security headers via `next.config.js`
- Supabase Row Level Security on all user data tables
- Input validation on all API calls and user inputs
- Server-side OAuth code exchange via `/auth/callback` route
