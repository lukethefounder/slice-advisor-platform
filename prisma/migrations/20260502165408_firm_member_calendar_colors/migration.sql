-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FirmMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Member',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "canAccessPortfolios" BOOLEAN NOT NULL DEFAULT true,
    "canManageProjects" BOOLEAN NOT NULL DEFAULT false,
    "canInviteMembers" BOOLEAN NOT NULL DEFAULT false,
    "canManageFirm" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "calendarColor" TEXT NOT NULL DEFAULT '#ef4444',
    CONSTRAINT "FirmMembership_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FirmMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FirmMembership" ("canAccessPortfolios", "canInviteMembers", "canManageFirm", "canManageProjects", "createdAt", "firmId", "id", "role", "status", "updatedAt", "userId") SELECT "canAccessPortfolios", "canInviteMembers", "canManageFirm", "canManageProjects", "createdAt", "firmId", "id", "role", "status", "updatedAt", "userId" FROM "FirmMembership";
DROP TABLE "FirmMembership";
ALTER TABLE "new_FirmMembership" RENAME TO "FirmMembership";
CREATE INDEX "FirmMembership_userId_idx" ON "FirmMembership"("userId");
CREATE INDEX "FirmMembership_firmId_idx" ON "FirmMembership"("firmId");
CREATE UNIQUE INDEX "FirmMembership_firmId_userId_key" ON "FirmMembership"("firmId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
