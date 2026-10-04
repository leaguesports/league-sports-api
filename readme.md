# League Sports API

Backend for the **Sport Hub**: tools for fans, players, and pros across sports (padel, golf, darts today). Venues and events are part of discovery; live play is recorded on scorecards that lock when finished.

## Domain docs

Read these before changing structure or naming:

- [GLOSSARY.md](./GLOSSARY.md) — product language
- [GLOSSARY-MAP.md](./GLOSSARY-MAP.md) — sports, hub contexts, and how they relate
- [docs/adr/](./docs/adr/) — architectural decisions

Notable ADRs:

- [0001 – In-process Domain Events](./docs/adr/0001-in-process-domain-events.md)
- [0002 – Incremental restructure (superseded)](./docs/adr/0002-incremental-context-restructure.md)
- [0003 – Sport segments and hub](./docs/adr/0003-sport-segments-and-hub.md)

## Stack

- Node.js, Express 5, TypeScript
- PostgreSQL via Prisma
- Yarn 4

## Local development

```bash
yarn install
# set DATABASE_URL and secrets — see .env.example
yarn prisma:deploy
yarn dev
```

| Script | Purpose |
| --- | --- |
| `yarn dev` | API with nodemon |
| `yarn test` | Jest |
| `yarn build` / `yarn start` | Compile and run `dist/` |

Default port: `3000` (see `.env.example`).

## Code layout (today)

Feature modules live under `src/modules/*` (controllers → services → repositories). Composition root: `src/app.ts`.

We are moving toward **sport segments** plus a **thin hub** (docs → Domain Event bus → move sport modules). See ADR-0003. HTTP routes and payloads stay stable across that work.

## Target layout

| Segment | Owns (roughly) |
| --- | --- |
| Padel | padel Scorecard (`match`) |
| Golf | golf Scorecard (`golf-round`), GolfTour |
| Darts | darts Scorecard (`darts`) |
| Identity | accounts, sessions, profiles, Google OAuth |
| Discovery | venues, venue leaderboards; future Event |
| Organise | lobby; OrganisedGame (starts via Padel/Golf) |
| Competition | teams, TeamMatch, Tournament (calls into the Sport) |
| Social | friends, communities, notifications |
| Platform | parked tools (badges, preferences, integrations, roadmap, intents, openf1, pools, training) |
