# League Sports API

Backend for the **Sport Hub**: tools for fans, players, and pros across sports (padel, golf, darts today). Venues and events are part of discovery; live play is recorded on scorecards that lock when finished.

## Domain docs

Read these before changing structure or naming:

- [GLOSSARY.md](./GLOSSARY.md) — product language
- [GLOSSARY-MAP.md](./GLOSSARY-MAP.md) — contexts and how they relate
- [docs/adr/](./docs/adr/) — architectural decisions

Notable ADRs:

- [0001 – In-process Domain Events](./docs/adr/0001-in-process-domain-events.md)
- [0002 – Incremental context restructure](./docs/adr/0002-incremental-context-restructure.md)

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

We are moving toward named **contexts** incrementally (docs → Domain Event bus → hot-path folder moves). See ADR-0002. HTTP routes and payloads stay stable across that work.

## Contexts (target)

| Context | Owns (roughly) |
| --- | --- |
| Identity | accounts, sessions, profiles, Google OAuth |
| Discovery | venues, venue leaderboards; future Event |
| Scorecards | padel (`match`), golf-round, darts, scorecard lock seam |
| Organise | organised-games, lobby |
| Competition | teams, team-matches, tournaments, golf-tours |
| Social | friends, communities, notifications |
| Platform | parked tools (badges, preferences, integrations, roadmap, intents, openf1, pools, training) |
