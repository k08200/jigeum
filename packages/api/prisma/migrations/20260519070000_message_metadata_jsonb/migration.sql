-- Convert Message.metadata from TEXT (JSON-as-String) to JSONB.
-- Audited 2026-05-19: every writer (autonomous-agent.ts, skill-recorder.ts,
-- routes/receipt.ts, routes/chat.ts) used JSON.stringify of a small flag
-- object. NULLs stay NULL.
--
-- Last of the JSON-as-String columns in the schema (after #329 / #330 /
-- #331 / #332).

ALTER TABLE "Message"
  ALTER COLUMN "metadata" TYPE JSONB
  USING (CASE WHEN "metadata" IS NULL THEN NULL ELSE "metadata"::jsonb END);
