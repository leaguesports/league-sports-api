# League Sports API

Backend for the **Sport Hub**. A round is a session. Each sport is a plug-in that folds client events into the next state (`src/sports`). The rest of the API is the hub: identity, venues, friends, preferences, communities, notifications, roadmap, and coverage intents.

## Domain docs

Read these before changing structure or naming:

- [GLOSSARY.md](./GLOSSARY.md) — product language
- [GLOSSARY-MAP.md](./GLOSSARY-MAP.md) — sports, hub contexts, and how they relate
- [docs/adr/](./docs/adr/) — architectural decisions
- [src/core/sessions/readme.md](./src/core/sessions/readme.md) — session lifecycle
- [src/sports/readme.md](./src/sports/readme.md) — sport plug-in contract

Notable ADRs:

- [0001 – In-process Domain Events](./docs/adr/0001-in-process-domain-events.md)
- [0002 – Incremental restructure (superseded)](./docs/adr/0002-incremental-context-restructure.md)
- [0003 – Sport segments and hub](./docs/adr/0003-sport-segments-and-hub.md)
- [0004 – Sessions and sport plug-ins](./docs/adr/0004-session-plugins.md)

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

## Code layout

Hub modules live under `src/core/*`. Sessions are `src/core/sessions`. Sport plug-ins live under `src/sports/*`. Composition root: `src/app.ts`.
