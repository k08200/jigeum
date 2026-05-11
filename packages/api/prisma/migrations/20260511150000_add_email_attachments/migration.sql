CREATE TABLE IF NOT EXISTS "EmailAttachment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emailId" TEXT NOT NULL,
  "gmailAttachmentId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER,
  "contentText" TEXT,
  "summary" TEXT,
  "keyPoints" TEXT,
  "extractedFields" TEXT,
  "category" TEXT,
  "analysisStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "analysisError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailAttachment_emailId_gmailAttachmentId_key"
  ON "EmailAttachment"("emailId", "gmailAttachmentId");
CREATE INDEX IF NOT EXISTS "EmailAttachment_userId_createdAt_idx"
  ON "EmailAttachment"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailAttachment_emailId_idx"
  ON "EmailAttachment"("emailId");
CREATE INDEX IF NOT EXISTS "EmailAttachment_userId_category_idx"
  ON "EmailAttachment"("userId", "category");
CREATE INDEX IF NOT EXISTS "EmailAttachment_userId_analysisStatus_idx"
  ON "EmailAttachment"("userId", "analysisStatus");

ALTER TABLE "EmailAttachment"
  ADD CONSTRAINT "EmailAttachment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailAttachment"
  ADD CONSTRAINT "EmailAttachment_emailId_fkey"
  FOREIGN KEY ("emailId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
