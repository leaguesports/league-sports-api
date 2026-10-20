# League Sports API

Backend for the **Sport Hub**. Sport-specific play is not implemented yet; `src/sports` is reserved for it. The API today is the hub: identity, venues, friends, preferences, communities, notifications, roadmap, and coverage intents.

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

## Code layout

Hub modules live under `src/core/*` (controllers → services → repositories). Sport implementations will live under `src/sports/*`. Composition root: `src/app.ts`.
