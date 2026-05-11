import crypto from "node:crypto";
import { decryptOptional } from "./crypto-tokens.js";
import { prisma } from "./db.js";
import type { ProviderCredentials } from "./providers/index.js";

type UserWithKeys = {
  openRouterApiKey?: string | null;
  geminiApiKey?: string | null;
};

function keyHash(value: string | null | undefined): string | null {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function ignorePlatformDefaultKey(
  userKey: string | null | undefined,
  platformKey: string | null | undefined,
): string | null {
  if (!userKey) return null;
  if (platformKey && keyHash(userKey) === keyHash(platformKey)) return null;
  return userKey;
}

function serializeCredentials(user: UserWithKeys): ProviderCredentials {
  const openRouterApiKey = decryptOptional(user.openRouterApiKey);
  const geminiApiKey = decryptOptional(user.geminiApiKey);
  return {
    openRouterApiKey: ignorePlatformDefaultKey(openRouterApiKey, process.env.OPENROUTER_API_KEY),
    geminiApiKey: ignorePlatformDefaultKey(geminiApiKey, process.env.GEMINI_API_KEY),
  };
}

export async function getUserLlmCredentials(userId: string): Promise<ProviderCredentials> {
  if (typeof prisma.$queryRaw !== "function") {
    const user = (await prisma.user.findUnique({ where: { id: userId } })) as UserWithKeys | null;
    if (!user) return {};
    return serializeCredentials(user);
  }

  const [user] = await prisma.$queryRaw<UserWithKeys[]>`
    SELECT "openRouterApiKey", "geminiApiKey"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;
  if (!user) return {};

  return serializeCredentials(user);
}
