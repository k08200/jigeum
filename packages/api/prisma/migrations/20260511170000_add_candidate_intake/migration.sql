ALTER TABLE "AutomationConfig"
  ADD COLUMN IF NOT EXISTS "notifyEmailCandidate" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "CandidateIntake" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emailId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY_TO_REVIEW',
  "name" TEXT,
  "role" TEXT,
  "contact" TEXT,
  "emailAddress" TEXT,
  "phone" TEXT,
  "summary" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "missingFields" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "evidenceFiles" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "notes" TEXT,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateIntake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CandidateIntake_userId_emailId_key"
  ON "CandidateIntake"("userId", "emailId");
CREATE INDEX IF NOT EXISTS "CandidateIntake_userId_status_updatedAt_idx"
  ON "CandidateIntake"("userId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "CandidateIntake_emailId_idx"
  ON "CandidateIntake"("emailId");

ALTER TABLE "CandidateIntake"
  ADD CONSTRAINT "CandidateIntake_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateIntake"
  ADD CONSTRAINT "CandidateIntake_emailId_fkey"
  FOREIGN KEY ("emailId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
