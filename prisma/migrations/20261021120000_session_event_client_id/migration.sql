-- Client retry key. Existing payloads stored it inside data, next to the writer and seq.
ALTER TABLE "SessionEvent" ADD COLUMN "clientEventId" TEXT;

UPDATE "SessionEvent"
SET "clientEventId" = data->>'clientEventId'
WHERE jsonb_typeof(data) = 'object'
  AND jsonb_typeof(data->'clientEventId') = 'string';

UPDATE "SessionEvent"
SET data = data - 'clientEventId' - 'scoredBy' - 'seq'
WHERE jsonb_typeof(data) = 'object';

-- PostgreSQL treats NULL as distinct, so events without a retry key stay insertable.
CREATE UNIQUE INDEX "SessionEvent_sessionId_participantId_clientEventId_key"
ON "SessionEvent"("sessionId", "participantId", "clientEventId");
