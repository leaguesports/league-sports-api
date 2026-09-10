# OpenF1

Read-only Formula 1 meeting and session data from [OpenF1](https://openf1.org/docs), used to enrich CMS event pages such as `/events/spanish-grand-prix-2026-09-13`.

Historical meetings and sessions (2023 onwards) are public and unauthenticated. Live race telemetry is **out of v1** — the client is shaped so later routes can key off `sessionKey`.

## Auth

None. Event pages are public.

## Frontend contract

| Method | Path | Query | Response |
| --- | --- | --- | --- |
| `GET` | `/api/openf1/meetings` | `year`, `countryName`, `countryCode`, `meetingName`, `location`, `circuitShortName`, `meetingKey`, `eventSlug` | `200 { meetings }` |
| `GET` | `/api/openf1/meetings/:meetingKey` | `meetingKey` may be a numeric OpenF1 id or `latest` | `200 { meeting, sessions }` |
| `GET` | `/api/openf1/events/:eventSlug` | slug is `{kebab-meeting-name}-{YYYY-MM-DD}` using the meeting end/race day | `200 { meeting, sessions }` |
| `GET` | `/api/openf1/sessions` | `year`, `meetingKey`, `sessionKey`, `sessionName`, `sessionType`, `countryName`, `countryCode`, `location`, `circuitShortName` | `200 { sessions }` |
| `GET` | `/api/openf1/sessions/:sessionKey` | `sessionKey` may be numeric or `latest` | `200 { session }` |

Missing meetings/sessions return `404`. Upstream OpenF1 failures return `503`.

`eventSlug` is derived from `meetingName` + UTC `dateEnd` (`spanish-grand-prix` + `2026-09-13`). Lookup also matches when the date falls anywhere in the meeting window, so a CMS slug that uses Friday or Sunday still resolves.

### `meeting` shape

```json
{
  "meetingKey": 1294,
  "meetingName": "Spanish Grand Prix",
  "meetingOfficialName": "FORMULA 1 TAG HEUER GRAN PREMIO DE ESPAÑA 2026",
  "eventSlug": "spanish-grand-prix-2026-09-13",
  "circuitKey": 153,
  "circuitShortName": "Madring",
  "circuitType": "Temporary - Street",
  "circuitImage": "https://…",
  "circuitInfoUrl": "https://…",
  "countryKey": 1,
  "countryCode": "ESP",
  "countryName": "Spain",
  "countryFlag": "https://…",
  "dateStart": "2026-09-11T11:30:00+00:00",
  "dateEnd": "2026-09-13T15:00:00+00:00",
  "gmtOffset": "02:00:00",
  "isCancelled": false,
  "location": "Madrid",
  "year": 2026
}
```

Sessions are ordered by `dateStart`. Each includes `sessionKey`, `sessionName` (`Practice 1`, `Qualifying`, `Race`, …), `sessionType`, and the same location/timing fields.

## Config

Optional. Defaults talk to `https://api.openf1.org/v1` with a 15-minute in-process cache (meetings/sessions refresh daily at midnight UTC).

| Env | Purpose |
| --- | --- |
| `OPENF1_BASE_URL` | Override the API origin (no trailing slash required) |
| `OPENF1_API_KEY` | Sent as `Authorization: Bearer` when set — needed later for paid live data |

## Later: live race updates

OpenF1 live endpoints (`/position`, `/intervals`, `/race_control`, `/laps`, `/weather`, …) all take `session_key`. Add methods on `OpenF1Client` and routes under `/api/openf1/sessions/:sessionKey/…`. Real-time data requires a paid OpenF1 subscription and `OPENF1_API_KEY`.
