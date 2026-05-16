import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const ENCRYPTED_PREFIX = "enc:v1:";

function encryptionEnabled() {
  return process.env.CLIENT_DATA_ENCRYPTION_ENABLED === "true";
}

function getVaultSecret() {
  return (
    process.env.CLIENT_DATA_ENCRYPTION_KEY ||
    process.env.SECURITY_PEPPER ||
    process.env.NEXTAUTH_SECRET ||
    ""
  );
}

function getVaultKey() {
  const secret = getVaultSecret();

  if (!secret) {
    if (encryptionEnabled()) {
      throw new Error(
        "CLIENT_DATA_ENCRYPTION_ENABLED=true requires CLIENT_DATA_ENCRYPTION_KEY, SECURITY_PEPPER, or NEXTAUTH_SECRET."
      );
    }

    return null;
  }

  return createHash("sha256").update(secret).digest();
}

export function isEncryptedText(value: unknown) {
  return typeof value === "string" && value.startsWith(ENCRYPTED_PREFIX);
}

export function encryptSensitiveText(value: string | null | undefined) {
  if (value === null || value === undefined) return null;

  const clean = String(value);

  if (!clean) return null;
  if (isEncryptedText(clean)) return clean;
  if (!encryptionEnabled()) return clean;

  const key = getVaultKey();

  if (!key) return clean;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(clean, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString("base64url")}.${tag.toString(
    "base64url"
  )}.${ciphertext.toString("base64url")}`;
}

export function decryptSensitiveText(value: string | null | undefined) {
  if (value === null || value === undefined) return value;
  if (!isEncryptedText(value)) return value;

  const key = getVaultKey();

  if (!key) return "[ENCRYPTED_VALUE_KEY_MISSING]";

  try {
    const encoded = value.slice(ENCRYPTED_PREFIX.length);
    const [ivRaw, tagRaw, ciphertextRaw] = encoded.split(".");

    if (!ivRaw || !tagRaw || !ciphertextRaw) {
      return "[ENCRYPTED_VALUE_CORRUPT]";
    }

    const iv = Buffer.from(ivRaw, "base64url");
    const tag = Buffer.from(tagRaw, "base64url");
    const ciphertext = Buffer.from(ciphertextRaw, "base64url");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "[ENCRYPTED_VALUE_DECRYPT_FAILED]";
  }
}

export function decryptAdvisorNote<T extends Record<string, any>>(note: T): T {
  return {
    ...note,
    title: decryptSensitiveText(note.title),
    body: decryptSensitiveText(note.body),
  };
}

export function decryptPortfolioHolding<T extends Record<string, any>>(
  holding: T
): T {
  return {
    ...holding,
    value: decryptSensitiveText(holding.value),
    allocationPct: decryptSensitiveText(holding.allocationPct),
    costBasis: decryptSensitiveText(holding.costBasis),
    thesis: decryptSensitiveText(holding.thesis),
  };
}

export function decryptDocumentVaultItem<T extends Record<string, any>>(
  document: T
): T {
  return {
    ...document,
    fileName: decryptSensitiveText(document.fileName),
    notes: decryptSensitiveText(document.notes),
  };
}

export function decryptClientProfile<T extends Record<string, any>>(client: T): T {
  return {
    ...client,
    email: decryptSensitiveText(client.email),
    portfolioValue: decryptSensitiveText(client.portfolioValue),
    notes: decryptSensitiveText(client.notes),
    holdings: Array.isArray(client.holdings)
      ? client.holdings.map(decryptPortfolioHolding)
      : client.holdings,
    notesList: Array.isArray(client.notesList)
      ? client.notesList.map(decryptAdvisorNote)
      : client.notesList,
    documents: Array.isArray(client.documents)
      ? client.documents.map(decryptDocumentVaultItem)
      : client.documents,
  };
}

export function decryptClientProfiles<T extends Record<string, any>>(
  clients: T[]
): T[] {
  return clients.map(decryptClientProfile);
}

export function vaultStatus() {
  return {
    enabled: encryptionEnabled(),
    keyConfigured: Boolean(getVaultSecret()),
    prefix: ENCRYPTED_PREFIX,
    algorithm: "aes-256-gcm",
  };
}