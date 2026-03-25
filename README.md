# PickListFTC

A scouting and alliance selection dashboard for FIRST Tech Challenge, built for the DECODE 2025–2026 season. Pulls live data from the [FTC Scout API](https://ftcscout.org) and runs entirely in the browser — no backend or login required.

Live at [picklistftc.com](https://picklistftc.com).

## Features

- **Dashboard** — event overview with top teams, OPR leaders, and key stats at a glance
- **Leaderboard** — sortable team rankings with OPR, averages, consistency, and penalty data; scout notes with tags and export/import; prescout mode using season-wide data before matches are played
- **Schedule** — match list with win probability predictions, alliance OPR breakdowns, expanded row detail, and a "Now" indicator for the current match
- **Compare** — side-by-side radar chart and stat comparison for up to 3 teams
- **Partners** — alliance partner finder that ranks teams by complementarity score for a selected team
- **Pick List** — drag-and-drop pick list builder with penalty badges and local persistence
- **Team Report** — per-team deep-dive with season OPR chart, match history, and scout notes
- **QR Sharing** — share any view via QR code or copy link; URLs encode the current event and relevant state (teams, selected partner, etc.) and auto-restore on load
- **Scout Notes** — attach freeform notes and predefined tags to teams; filter, export, and import as JSON

## Tech Stack

- [Next.js 14](https://nextjs.org) (App Router)
- [React 18](https://react.dev)
- [Tailwind CSS 4](https://tailwindcss.com)
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

## Project Structure

```
app/
  (dashboard)/
    dashboard/    # event overview
    leaderboard/  # team rankings + notes
    schedule/     # match list + predictions
    compare/      # head-to-head comparison
    partners/     # alliance partner finder
    picklist/     # drag-and-drop pick list
  report/[teamNumber]/  # team deep-dive
components/       # shared UI components
context/          # EventContext, NotesContext
lib/              # API client, calculations, types
```

## Data

All data comes from the [FTC Scout](https://ftcscout.org) public GraphQL API. No API key is required. Event data is fetched on demand and cached in memory for the session; scout notes are persisted in `localStorage` keyed by event code.
