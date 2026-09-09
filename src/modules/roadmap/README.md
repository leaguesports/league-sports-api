# Roadmap / waitlist API v1

Public Features | Requests surface. **No admin portal.** Email is behind an interface. `githubIssueUrl` is **DB-only** and is never returned from public JSON.

## Public Frontend contract

All routes are unauthenticated unless noted. Do not render GitHub issue links, issue numbers, or `githubIssueUrl`.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/roadmap/features?status=&sort=` | `status` = `PLANNED` \| `IN_PROGRESS` \| `SHIPPED`. `sort` = `votes` (default) \| `newest`. Archived rows omitted. **No `githubIssueUrl`.** `viewerHasVoted` is true when the `roadmap_voter_id` cookie and/or session `token` cookie matches a vote. |
| `POST` | `/api/roadmap/features/:id/vote` | Toggle. Sets httpOnly `roadmap_voter_id` (UUID). Rate-limited (20 / 60s / IP+cookie). |
| `POST` | `/api/roadmap/features/:id/notify` | Body `{ "email" }`. Idempotent. Re-notify after unsub reactivates that feature. |
| `POST` | `/api/roadmap/unsubscribe` | Body `{ "token" }`. Global unsubscribe for that email. |
| `GET` | `/api/roadmap/preferences?token=` | Watching features for the token email. |
| `DELETE` | `/api/roadmap/preferences` | Body or query `{ token, featureId }`. Stops watching one feature. |
| `POST` | `/api/roadmap/requests` | Body `{ type, title, details, email? }`. `type` = `FEATURE_REQUEST` \| `BUG`. Creates `NEW`. Response has no email. |
| `GET` | `/api/roadmap/requests` | Non-archived: `id`, `type`, `title`, `status`, `createdAt` only. **No emails, no details.** |

`:id` on feature routes accepts UUID **or** slug.

### Vote identity

1. Every vote sets/reads httpOnly cookie `roadmap_voter_id` (UUID, 1 year, SameSite/Secure as session cookies).
2. If the existing session `token` cookie is valid, the vote is stored as `user:<userId>`.
3. Otherwise it is stored as `cookie:<roadmap_voter_id>`.
4. Logging in later does **not** migrate anonymous cookie votes; new votes bind to the user.

### Unsubscribe uniqueness

`RoadmapNotify` is unique on `(featureId, email)` always. Soft-unsubscribe sets `unsubscribedAt`. A later `POST .../notify` for the same pair clears `unsubscribedAt` (reactivate). Global unsubscribe sets `unsubscribedAt` on every row for that email. Tokens are signed JWTs (`purpose=roadmap_unsub`) using `JWT_SECRET`, not a table.

## Ops

### Seed

```sh
yarn roadmap:seed
```

Inserts three placeholder features by slug (`friends-and-teams`, `live-scorecards`, `club-nights`) if missing. Safe to re-run. You can also insert SQL directly into `RoadmapFeature` (including optional `githubIssueUrl` for eng notes).

### Status without email (Planned / In progress)

Update the row in Postgres. **Do not** set `SHIPPED` this way if you want notify mail.

```sql
UPDATE "RoadmapFeature"
SET status = 'IN_PROGRESS', "updatedAt" = NOW()
WHERE slug = 'live-scorecards';

-- archive (hides from public list)
UPDATE "RoadmapFeature"
SET "archivedAt" = NOW(), "updatedAt" = NOW()
WHERE slug = 'club-nights';
```

A raw `status = 'SHIPPED'` **does not send email.**

### Ship (sends mail)

Only the ship command / protected endpoint sets `SHIPPED` + `shippedAt` **and** emails active `RoadmapNotify` rows.

```sh
yarn roadmap:ship -- --feature live-scorecards
# or
yarn roadmap:ship -- --feature <uuid>
```

HTTP (optional, same service):

```
POST /api/roadmap/features/:id/ship
X-Roadmap-Ship-Secret: <ROADMAP_SHIP_SECRET>
```

Re-running a shipped feature returns 409 / CLI error and **does not** resend mail.

### Email

Interface: `RoadmapEmailSender`. Resolution order:

1. `RESEND_API_KEY` → Resend HTTP API
2. else `SENDGRID_API_KEY` → SendGrid HTTP API
3. else **console stub** (`[roadmap-email] ...`) — default for local/dev

Env:

| Var | Purpose |
| --- | --- |
| `ROADMAP_FROM_EMAIL` | From header (default `League Sports <noreply@leaguesports.co.za>`) |
| `RESEND_API_KEY` | Resend |
| `SENDGRID_API_KEY` | SendGrid |
| `ROADMAP_SHIP_SECRET` | Required for HTTP ship. CLI does not need it. |
| `FRONTEND_URL` | Product + unsubscribe links (`/roadmap`, `/roadmap/unsubscribe?token=`) |
| `JWT_SECRET` | Signs unsubscribe tokens |

### `githubIssueUrl`

Nullable column for eng/DB ops only. **Never** in public API JSON. Do not expose it on the Frontend.

## Migration

`20260908090000_roadmap` — applied on merge via Railway `preDeployCommand` (`prisma migrate deploy`). Do not merge until ready to migrate.
