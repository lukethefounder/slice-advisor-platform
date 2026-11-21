-- Operational MFA state is separate from public account preferences.
ALTER TABLE "Session"
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "mfaVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
  ADD COLUMN IF NOT EXISTS "ipHash" TEXT;

ALTER TABLE "UserSecuritySetting"
  ADD COLUMN IF NOT EXISTS "idleTimeoutMinutes" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE IF NOT EXISTS "UserAuthenticator" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "secretEncrypted" TEXT,
  "pendingSecretEncrypted" TEXT,
  "pendingExpiresAt" TIMESTAMP(3),
  "enabledAt" TIMESTAMP(3),
  "lastUsedStep" INTEGER,
  "recoveryCodeHashesJson" TEXT NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserAuthenticator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserAuthenticator_userId_key" ON "UserAuthenticator"("userId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserAuthenticator_userId_fkey' AND conrelid = '"UserAuthenticator"'::regclass) THEN
    ALTER TABLE "UserAuthenticator" ADD CONSTRAINT "UserAuthenticator_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- The old MFA checkbox was only a readiness flag, with no enrolled authenticator.
-- Real MFA is enabled only after an authenticator challenge succeeds.
UPDATE "UserSecuritySetting" AS setting SET "mfaEnabled" = false
WHERE setting."mfaEnabled" = true AND NOT EXISTS (
  SELECT 1 FROM "UserAuthenticator" AS factor
  WHERE factor."userId" = setting."userId" AND factor."enabledAt" IS NOT NULL
);
