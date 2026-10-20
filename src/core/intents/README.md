# Coverage / conversion notify intents API v1

SEO landings can collect “notify me when {sport} in {city} fills in.” This is **coverage intent**, not roadmap ship-notify. Do not store these rows on `RoadmapNotify`.

## Public contract

No auth. Email is **never** returned on these responses.

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/intents/coverage` | `{ "email", "sport?", "city?", "sourcePage?" }` | Idempotent. `200` `{ intent: { id, sport, city, sourcePage, createdAt } }`. |
| `POST` | `/api/intents/coverage/unsubscribe` | `{ "token" }` | Soft-unsub all intents for the token email. `200` `{ unsubscribed: true, count }`. |

### Example

```http
POST /api/intents/coverage
Content-Type: application/json

{"email":"fan@example.com","sport":"padel","city":"Cape Town","sourcePage":"/padel/cape-town"}
```

```json
{
  "intent": {
    "id": "…",
    "sport": "padel",
    "city": "cape town",
    "sourcePage": "/padel/cape-town",
    "createdAt": "2026-09-08T18:00:00.000Z"
  }
}
```

- `sport` = `padel` \| `golf` \| `darts` (extensible in `COVERAGE_SPORTS`). Omit / blank = any sport.
- `city` is trimmed and lowercased. Omit / blank = any city.
- `sourcePage` is a path or URL, max 500 chars. Not part of uniqueness.
- Same `email + sport + city` returns the existing row (`200`) and **reactivates** if `unsubscribedAt` was set.
- Rate-limit: **20 requests / 60s / IP** (same window as roadmap votes). `429` when exceeded.
- Email is omitted from JSON so landings cannot leak PII in client logs / analytics. Ops read it from Postgres.

### Uniqueness

`(email, sport, city)` is unique. Unspecified sport/city are **stored as empty string** (`""`), not SQL `NULL`. Postgres `UNIQUE` treats `NULL` as distinct, which would allow duplicate “any sport / any city” rows for one email.

| API input | Stored `sport` | Stored `city` |
| --- | --- | --- |
| omitted / `""` / whitespace | `""` | `""` |
| `"PADEL"` / `"Cape Town"` | `padel` | `cape town` |

`foo@bar.com` + no sport + no city is one row. `foo@bar.com` + `padel` + no city is a different row.

## Unsubscribe token

**Dedicated JWT**, not the roadmap token.

| | Roadmap | Coverage |
| --- | --- | --- |
| Purpose claim | `roadmap_unsub` | `coverage_unsub` |
| Endpoint | `POST /api/roadmap/unsubscribe` | `POST /api/intents/coverage/unsubscribe` |
| Scope | `RoadmapNotify` rows | `CoverageIntent` rows for that email |

Signed with `JWT_SECRET`, `{ purpose, email }`, `365d`. A roadmap token is rejected here (and vice versa). Storage is ready (`unsubscribedAt`); threshold emails are **not** sent in v1. When those emails ship, include a link that posts this token.

Minimum today: storage + `POST /api/intents/coverage/unsubscribe`. Frontend CTA / mailer / admin UI are out of scope.

## Ops

Active intents (Brandon / ops):

```sql
SELECT * FROM "CoverageIntent" WHERE "unsubscribedAt" IS NULL;
```

Useful filters:

```sql
SELECT sport, city, COUNT(*) 
FROM "CoverageIntent"
WHERE "unsubscribedAt" IS NULL
GROUP BY sport, city
ORDER BY COUNT(*) DESC;
```

Empty `sport` / `city` means “any”. Emails are in this table only — do not log them from the API.

## Migration (Railway pre-deploy)

`20260908180000_coverage_intent`

Applied on merge via Railway `preDeployCommand` (`prisma migrate deploy`). Do not merge until ready to migrate.
