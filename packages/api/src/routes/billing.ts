import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { getUserId, requireAuth } from "../auth.js";
import { decryptOptional, encryptOptional } from "../crypto-tokens.js";
import { db, prisma } from "../db.js";
import { clearFallbackState } from "../model-fallback.js";
import {
  getEffectivePlan,
  isModelAllowedForPlan,
  PLAN_FEATURES,
  PLAN_MODELS,
  PLANS,
  stripe,
} from "../stripe.js";

function keyHash(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  return crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 12);
}

export async function billingRoutes(app: FastifyInstance) {
  // All billing routes require authentication
  app.addHook("preHandler", requireAuth);
  // POST /api/billing/checkout — Create Stripe checkout session
  app.post("/checkout", async (request, reply) => {
    const userId = getUserId(request);
    const { plan } = request.body as {
      plan: "PRO";
    };

    // Only PRO accepts new checkouts. Legacy TEAM subscriptions keep working
    // via webhook/status routes but cannot be purchased from the UI.
    if (plan !== "PRO") {
      return reply.code(400).send({ error: "Invalid plan" });
    }

    const planConfig = PLANS[plan];
    if (!planConfig?.priceId) {
      return reply.code(400).send({ error: "Invalid plan" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ error: "User not found" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.stripeId ? undefined : user.email,
      customer: user.stripeId || undefined,
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${process.env.WEB_URL || "http://localhost:8001"}/billing?success=true`,
      cancel_url: `${process.env.WEB_URL || "http://localhost:8001"}/billing?canceled=true`,
      metadata: { userId, plan },
    });

    return { url: session.url };
  });

  // POST /api/billing/portal — Create Stripe customer portal session
  app.post("/portal", async (request, reply) => {
    const userId = getUserId(request);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeId) {
      return reply.code(400).send({ error: "No billing account" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeId,
      return_url: `${process.env.WEB_URL || "http://localhost:8001"}/billing`,
    });

    return { url: session.url };
  });

  // GET /api/billing/status — Get user's billing status
  app.get("/status", async (request, reply) => {
    const userId = getUserId(request);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ error: "User not found" });

    const planConfig = getEffectivePlan(user.plan, user.role);

    // Count user messages and tokens this billing period (current calendar month)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [messageCount, tokenAgg] = await Promise.all([
      prisma.message.count({
        where: {
          conversation: { userId },
          role: "USER",
          createdAt: { gte: periodStart },
        },
      }),
      db.tokenUsage.aggregate({
        where: { userId, createdAt: { gte: periodStart } },
        _sum: { totalTokens: true, estimatedCost: true },
      }),
    ]);

    return {
      plan: user.plan,
      planName: planConfig.name,
      messageLimit: planConfig.messageLimit,
      messageCount,
      tokenLimit: planConfig.tokenLimit,
      tokenUsage: tokenAgg._sum.totalTokens || 0,
      estimatedCost: Math.round((tokenAgg._sum.estimatedCost || 0) * 10000) / 10000,
      stripeId: user.stripeId,
    };
  });

  // GET /api/billing/features — Get features available for user's plan
  app.get("/features", async (request, reply) => {
    const userId = getUserId(request);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ error: "User not found" });

    const features = PLAN_FEATURES[user.plan];
    const featureList = features ? Array.from(features) : [];

    return {
      plan: user.plan,
      features: featureList,
    };
  });

  // GET /api/billing/models — Get available models for user's plan + current selection
  app.get("/models", async (request, reply) => {
    const userId = getUserId(request);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ error: "User not found" });

    const planModels = PLAN_MODELS[user.plan] || PLAN_MODELS.FREE;
    const userFields = user as unknown as { chatModel?: string; agentModel?: string };
    const [keyFields] =
      typeof prisma.$queryRaw === "function"
        ? await prisma.$queryRaw<
            Array<{
              openRouterApiKey?: string | null;
              geminiApiKey?: string | null;
            }>
          >`
            SELECT "openRouterApiKey", "geminiApiKey"
            FROM "User"
            WHERE "id" = ${userId}
            LIMIT 1
          `
        : [user as unknown as { openRouterApiKey?: string | null; geminiApiKey?: string | null }];
    const keys = keyFields ?? {
      openRouterApiKey: null,
      geminiApiKey: null,
    };
    const openRouterSameAsPlatform =
      !!keys.openRouterApiKey &&
      keyHash(decryptOptional(keys.openRouterApiKey)) === keyHash(process.env.OPENROUTER_API_KEY);
    const geminiSameAsPlatform =
      !!keys.geminiApiKey &&
      keyHash(decryptOptional(keys.geminiApiKey)) === keyHash(process.env.GEMINI_API_KEY);

    return {
      plan: user.plan,
      chatModels: planModels.chat,
      agentModels: planModels.agent,
      currentChatModel: userFields.chatModel || planModels.chat[0],
      currentAgentModel: userFields.agentModel || planModels.agent[0] || null,
      hasOpenRouterApiKey: !!keys.openRouterApiKey,
      hasGeminiApiKey: !!keys.geminiApiKey,
      openRouterSameAsPlatform,
      geminiSameAsPlatform,
      // Show all models across all plans (locked ones for upsell UI)
      allModels: PLAN_MODELS,
    };
  });

  // PATCH /api/billing/models — Update user's selected model and personal LLM keys
  app.patch("/models", async (request, reply) => {
    const userId = getUserId(request);
    const {
      chatModel,
      agentModel,
      openRouterApiKey,
      geminiApiKey,
      clearOpenRouterApiKey,
      clearGeminiApiKey,
    } = request.body as {
      chatModel?: string;
      agentModel?: string | null;
      openRouterApiKey?: string | null;
      geminiApiKey?: string | null;
      clearOpenRouterApiKey?: boolean;
      clearGeminiApiKey?: boolean;
    };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ error: "User not found" });

    const updateData: Record<string, string | null> = {};

    if (chatModel !== undefined) {
      if (!isModelAllowedForPlan(user.plan, chatModel, "chat")) {
        return reply.code(403).send({
          error: `Model "${chatModel}" is not available on your ${user.plan} plan`,
          allowedModels: PLAN_MODELS[user.plan]?.chat || [],
        });
      }
      updateData.chatModel = chatModel;
    }

    if (agentModel !== undefined) {
      if (agentModel === null) {
        updateData.agentModel = null;
      } else if (!isModelAllowedForPlan(user.plan, agentModel, "agent")) {
        return reply.code(403).send({
          error: `Agent model "${agentModel}" is not available on your ${user.plan} plan`,
          allowedModels: PLAN_MODELS[user.plan]?.agent || [],
        });
      } else {
        updateData.agentModel = agentModel;
      }
    }

    if (typeof openRouterApiKey === "string") {
      const trimmed = openRouterApiKey.trim();
      if (trimmed && keyHash(trimmed) === keyHash(process.env.OPENROUTER_API_KEY)) {
        return reply.code(400).send({
          error:
            "이 OpenRouter 키는 현재 서버의 기본 무료 키와 같아요. 이미 한도가 막힌 키라 복구되지 않습니다. OpenRouter에서 새 개인 키를 만들어 등록해 주세요.",
        });
      }
      updateData.openRouterApiKey = trimmed ? encryptOptional(trimmed) : null;
      if (trimmed) clearFallbackState(`openrouter:${keyHash(trimmed)}`);
    } else if (clearOpenRouterApiKey) {
      updateData.openRouterApiKey = null;
    }

    if (typeof geminiApiKey === "string") {
      const trimmed = geminiApiKey.trim();
      if (trimmed && keyHash(trimmed) === keyHash(process.env.GEMINI_API_KEY)) {
        return reply.code(400).send({
          error:
            "이 Gemini 키는 현재 서버의 기본 무료 키와 같아요. 이미 한도가 막힌 키라 복구되지 않습니다. Google AI Studio에서 새 개인 키를 만들어 등록해 주세요.",
        });
      }
      updateData.geminiApiKey = trimmed ? encryptOptional(trimmed) : null;
      if (trimmed) clearFallbackState(`gemini:${keyHash(trimmed)}`);
    } else if (clearGeminiApiKey) {
      updateData.geminiApiKey = null;
    }

    if (Object.keys(updateData).length === 0) {
      return reply.code(400).send({ error: "No model or key setting specified" });
    }

    // Use raw update to handle new fields before Prisma regenerate
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET ${Object.keys(updateData)
        .map((k, i) => `"${k}" = $${i + 2}`)
        .join(", ")}, "updatedAt" = NOW() WHERE "id" = $1`,
      userId,
      ...Object.values(updateData),
    );

    return {
      success: true,
      ...(updateData.chatModel !== undefined ? { chatModel: updateData.chatModel } : {}),
      ...(updateData.agentModel !== undefined ? { agentModel: updateData.agentModel } : {}),
      hasOpenRouterApiKey:
        updateData.openRouterApiKey !== undefined
          ? !!updateData.openRouterApiKey
          : !!(user as unknown as { openRouterApiKey?: string | null }).openRouterApiKey,
      hasGeminiApiKey:
        updateData.geminiApiKey !== undefined
          ? !!updateData.geminiApiKey
          : !!(user as unknown as { geminiApiKey?: string | null }).geminiApiKey,
      ...(updateData.openRouterApiKey !== undefined ? { openRouterSameAsPlatform: false } : {}),
      ...(updateData.geminiApiKey !== undefined ? { geminiSameAsPlatform: false } : {}),
    };
  });
}
