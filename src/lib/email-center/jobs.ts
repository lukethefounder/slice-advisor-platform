import "server-only";

import { ApiError } from "@/lib/api-route";
import type { BackgroundJobRuntime } from "@/lib/background-jobs/queue";
import type { BackendContext } from "@/lib/backend/config";
import { recordAiToolRun } from "@/lib/backend/events";
import type {
  EmailAiGenerationPayload,
  EmailPromptPlan,
  EmailResearchSource,
} from "@/lib/email-center/contracts";
import {
  claimEmailDeliveryForJob,
  completeEmailDelivery,
  emailServiceSafeError,
  getEmailCenterContextForJob,
  getEmailClientForJob,
  loadEmailDeliveryForJob,
  getEmailDraftRowsForJob,
  markAiGenerationFailed,
  markEmailDeliverySending,
  parseEmailDeliveryPayload,
  recordEmailBackgroundEvent,
  updateDraftAfterAiGeneration,
  verifyDeliveryDraftAndRecipient,
} from "@/lib/email-center/service";
import {
  appendStoredEmailVersion,
  cleanEmailBody,
  cleanEmailSubject,
  cleanEmailTone,
  createStoredEmailVersion,
  decryptEmailText,
  readEmailDraftMetadata,
  safeEmailError,
  writeEmailDraftMetadata,
} from "@/lib/email-center/storage";
import { decryptSensitiveText } from "@/lib/data-vault";
import {
  assessGeneratedEmail,
  compileEmailPrompt,
} from "@/lib/email-center/prompt";
import { generateCustomAiEmailOptions } from "@/lib/email-center/ai-generator";
import { generateAiText } from "@/lib/integrations/ai";
import { sendEmail } from "@/lib/integrations/email";
import { prisma } from "@/lib/prisma";

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asGenerationPayload(value: unknown): EmailAiGenerationPayload {
  const record = asObject(value);
  const mode = record.mode === "Polish" ? "Polish" : "Generate";
  const draftId = String(record.draftId ?? "").trim();
  const requestedByUserId = String(record.requestedByUserId ?? "").trim();

  if (record.schemaVersion !== 2 || !draftId || !requestedByUserId) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_AI_JOB_PAYLOAD_INVALID",
      message: "The AI email job payload is invalid.",
      expose: false,
    });
  }

  const completePrompt = String(
    record.completePrompt ?? record.purpose ?? record.topic ?? "",
  )
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, 12_000);
  const promptPlan = compileEmailPrompt({
    prompt: completePrompt,
    tone: record.tone,
    legacyTopic: record.topic,
    legacyPurpose: record.purpose,
    legacyInstructions: record.advisorInstructions,
    legacyCallToAction: record.callToAction,
  });

  return {
    schemaVersion: 2,
    mode,
    draftId,
    topic: cleanEmailSubject(record.topic) || promptPlan.subjectFocus,
    purpose:
      String(record.purpose ?? "").replace(/\u0000/g, "").trim().slice(0, 2_000) ||
      promptPlan.communicationGoal,
    completePrompt: promptPlan.originalPrompt,
    promptPlan,
    tone: cleanEmailTone(record.tone),
    advisorInstructions: String(record.advisorInstructions ?? "")
      .replace(/\u0000/g, "")
      .trim()
      .slice(0, 4_000),
    callToAction:
      String(record.callToAction ?? "").replace(/\u0000/g, "").trim().slice(0, 2_000) ||
      promptPlan.callToAction,
    useResearch: record.useResearch === true,
    speedMode: record.speedMode === "Researched" ? "Researched" : "Quick",
    optionCount: Math.max(1, Math.min(3, Number(record.optionCount) || 2)),
    requestedByUserId,
    requestedAt: String(record.requestedAt ?? new Date().toISOString()),
  };
}

function safeStringList(value: unknown, maximum = 20) {
  return Array.isArray(value)
    ? value
        .map((item) => String(item ?? "").replace(/\s+/g, " ").trim().slice(0, 800))
        .filter(Boolean)
        .slice(0, maximum)
    : [];
}

function publicResearchPrompt(plan: EmailPromptPlan) {
  return JSON.stringify(
    {
      task:
        "Collect only the current public facts needed to support an advisor-client communication. Research the topic, not the private client.",
      communicationType: plan.messageType,
      subjectFocus: plan.subjectFocus,
      communicationGoal: plan.communicationGoal,
      publicResearchTopics: plan.publicResearchTopics,
      publicSymbols: plan.symbols,
      keyFactsFromAdvisor: plan.keyFacts ?? [],
      supportingDetails: plan.supportingDetails ?? [],
      missingInformation: plan.missingInformation ?? [],
      output: {
        conciseSummary: "string",
        verifiedFacts: [
          {
            fact: "string",
            asOf: "exact date or null",
            whyItMatters: "string",
          },
        ],
        uncertainties: ["string"],
        advisorCautions: ["string"],
      },
      rules: [
        "Use primary and authoritative public sources wherever possible.",
        "Use exact dates for time-sensitive facts.",
        "Do not include recommendations, predictions, or performance guarantees.",
        "Do not search for or mention a private client, household, email address, portfolio value, risk profile, or private note.",
        "Return concise research that can be translated into plain client language after advisor review.",
      ],
    },
    null,
    2,
  );
}

function clientContext(input: {
  client: Awaited<ReturnType<typeof getEmailClientForJob>>;
  communicationStyle: string | null;
  doList: string[];
  dontList: string[];
}) {
  if (!input.client) {
    return {
      name: "Client",
      household: null,
      clientType: null,
      riskProfile: null,
      portfolioValue: null,
      liquidityNeeds: null,
      timeHorizon: null,
      objective: null,
      holdings: [],
      communicationStyle: input.communicationStyle,
      do: input.doList,
      dont: input.dontList,
    };
  }

  return {
    name: input.client.fullName,
    household: input.client.householdName,
    clientType: input.client.clientType,
    riskProfile: input.client.riskProfile,
    portfolioValue:
      decryptSensitiveText(input.client.portfolioValue) ?? input.client.portfolioValue ?? null,
    liquidityNeeds: input.client.liquidityNeeds,
    timeHorizon: input.client.timeHorizon,
    objective: input.client.objective,
    holdings: input.client.holdings.map((holding) => ({
      symbol: holding.symbol,
      assetName: holding.assetName,
      assetClass: holding.assetClass,
      value: decryptSensitiveText(holding.value) ?? holding.value ?? null,
      allocationPct:
        decryptSensitiveText(holding.allocationPct) ?? holding.allocationPct ?? null,
      riskLevel: holding.riskLevel,
      thesis: decryptSensitiveText(holding.thesis) ?? null,
    })),
    communicationStyle: input.communicationStyle,
    do: input.doList,
    dont: input.dontList,
  };
}

function draftPrompt(input: {
  mode: "Generate" | "Polish";
  advisorName: string;
  advisorEmail: string;
  client: ReturnType<typeof clientContext>;
  plan: EmailPromptPlan;
  tone: string;
  advisorInstructions: string;
  optionCount: number;
  publicResearch: string;
  speedMode: "Quick" | "Researched";
  currentSubject: string;
  currentBody: string;
}) {
  return JSON.stringify(
    {
      task:
        input.mode === "Polish"
          ? `Create ${input.optionCount} materially improved, fully editable versions of the existing advisor-client email.`
          : `Transform the communication brief into ${input.optionCount} complete, fully editable advisor-client email option(s).`,
      output: {
        options: [
          {
            subject: "specific 3-12 word client-facing subject",
            body: "complete client-facing email, not a restatement of the prompt",
            strategy: "short explanation of the communication approach",
            complianceNotes: ["specific fact or review item the advisor should verify"],
          },
        ],
      },
      advisor: {
        name: input.advisorName,
        email: input.advisorEmail,
      },
      client: input.client,
      communicationBrief: {
        type: input.plan.messageType,
        subjectFocus: input.plan.subjectFocus,
        goal: input.plan.communicationGoal,
        tone: input.tone || input.plan.tone,
        desiredLength: input.plan.desiredLength,
        urgency: input.plan.urgency,
        requiredPoints: input.plan.requiredPoints,
        prohibitedPoints: input.plan.prohibitedPoints,
        callToAction: input.plan.callToAction,
        suggestedSubjects: input.plan.subjectCandidates,
        keyFacts: input.plan.keyFacts ?? [],
        supportingDetails: input.plan.supportingDetails ?? [],
        informationArchitecture: input.plan.informationArchitecture ?? [],
        missingInformation: input.plan.missingInformation ?? [],
        intendedClientOutcome: input.plan.audienceOutcome ?? null,
        originalAdvisorPrompt: input.plan.originalPrompt,
        advisorInstructions: input.advisorInstructions,
      },
      verifiedPublicResearch: input.publicResearch,
      existingDraft:
        input.mode === "Polish"
          ? {
              subject: input.currentSubject,
              body: input.currentBody,
            }
          : null,
      rules: [
        "Return strict JSON only.",
        "Write the actual client email. Never explain the prompt, repeat the instructions, mention a drafting task, or use meta-language such as 'as requested.'",
        "Create a specific subject suited to this exact communication brief; do not use generic subjects such as Client Email, Message, Update, or Quick Note unless the brief truly requires it.",
        "Transform every supported detail from the advisor prompt into useful client-facing information. Do not merely paraphrase the prompt.",
        "Follow the information architecture in order: orient the client, explain the relevant information, connect it to planning context, distinguish known facts from open questions, and finish with a clear next action.",
        "When current facts are not supplied or research is unavailable, state what the advisory team is monitoring or will verify instead of inventing a statistic, event, or conclusion.",
        "Start with a natural greeting, use concise paragraphs or short bullets when they improve scanning, and write in polished plain English.",
        "Use supplied private client facts only as internal personalization context. Never infer missing holdings, performance, personal circumstances, or recommendations.",
        "Do not guarantee outcomes, returns, safety, tax results, or regulatory conclusions.",
        "Do not issue automatic buy, sell, hold, allocation, or liquidation instructions.",
        "Separate verified current public context from assumptions and clearly qualify uncertainty.",
        input.speedMode === "Quick"
          ? "Keep the email focused and normally between 130 and 260 words. Produce the strongest single option first."
          : "Keep the email normally between 180 and 420 words and make each option meaningfully different in structure or emphasis.",
        "Every option remains subject to advisor review and editing before approval or delivery.",
      ],
    },
    null,
    2,
  );
}

async function runEmailAiGenerationJob(
  context: BackendContext,
  runtime: BackgroundJobRuntime,
) {
  const payload = asGenerationPayload(runtime.payload);
  const emailContext = await getEmailCenterContextForJob({
    userId: context.userId,
    firmId: context.firmId,
  });
  const [draft] = await getEmailDraftRowsForJob({
    userId: context.userId,
    firmId: emailContext.firmId,
    draftIds: [payload.draftId],
  });

  if (!draft) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_AI_DRAFT_NOT_FOUND",
      message: "The AI email draft no longer exists.",
      expose: false,
    });
  }

  const metadata = readEmailDraftMetadata(draft);
  await prisma.clientCommunicationDraft.update({
    where: { id: draft.id },
    data: {
      sourceSummaryJson: writeEmailDraftMetadata({
        ...metadata,
        generation: {
          ...metadata.generation,
          jobId: runtime.jobId,
          status: "Processing",
          error: null,
        },
      }),
      status: "Generating",
    },
  });

  await runtime.reportProgress(6, "Securing advisor and recipient context");
  await runtime.throwIfCancelled();

  const client = metadata.recipient.clientId
    ? await getEmailClientForJob({
        context: emailContext,
        clientId: metadata.recipient.clientId,
      })
    : null;

  if (metadata.recipient.clientId && !client) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_AI_CLIENT_SCOPE_CHANGED",
      message: "The client assignment changed before AI generation completed.",
      expose: false,
    });
  }

  const preference = client
    ? await prisma.clientPreferenceProfile.findFirst({
        where: {
          userId: context.userId,
          firmId: emailContext.firmId,
          clientName: client.fullName,
          status: "Active",
        },
        select: {
          communicationStyle: true,
          doJson: true,
          dontJson: true,
        },
      })
    : null;
  const parseList = (value: string | null | undefined) => {
    try {
      const parsed = JSON.parse(value ?? "[]") as unknown;
      return safeStringList(parsed, 12);
    } catch {
      return [];
    }
  };
  const currentSubject = decryptEmailText(draft.title);
  const currentBody = decryptEmailText(draft.body);
  let publicResearch = "No external research was requested.";
  let researchSources: EmailResearchSource[] = [];
  let researchUsed = false;
  let researchWarning: string | null = null;

  if (payload.speedMode === "Researched" && payload.useResearch) {
    await runtime.reportProgress(22, "Verifying current public source context");
    const research = await generateAiText({
      prompt: publicResearchPrompt(payload.promptPlan ?? compileEmailPrompt({
        prompt: payload.completePrompt,
        tone: payload.tone,
        legacyTopic: payload.topic,
        legacyPurpose: payload.purpose,
        legacyInstructions: payload.advisorInstructions,
        legacyCallToAction: payload.callToAction,
      })),
      instructions:
        "Research only public market, company, economic, or regulatory information. Never search for or infer private client information. Return concise sourced research for an advisor to review.",
      safetyIdentifier: context.actorEmail ?? context.userId,
      enableWebSearch: true,
      researchMode: "auto",
      speedMode: "fast",
      timeoutMs: 12_000,
      maxOutputTokens: 1_600,
      useCache: true,
      cacheTtlMs: 5 * 60_000,
      appendSources: false,
      fallbackText: "Public research was unavailable. Verify all current facts before external use.",
      metadata: {
        surface: "client_email_center",
        task: "public_email_research",
      },
    });

    publicResearch = research.text || research.error || publicResearch;
    researchSources = (research.sources ?? []).slice(0, 20).map((source) => ({
      title: source.title,
      url: source.url,
      type: source.type,
    }));
    researchUsed = research.ok && researchSources.length > 0;
    researchWarning = research.ok ? null : research.error ?? "Public research was unavailable.";
  }

  await runtime.throwIfCancelled();
  await runtime.reportProgress(38, "Writing the custom subject and complete email");

  const clientProfile = clientContext({
    client,
    communicationStyle: preference?.communicationStyle ?? null,
    doList: parseList(preference?.doJson),
    dontList: parseList(preference?.dontJson),
  });
  const promptPlan = payload.promptPlan ?? compileEmailPrompt({
    prompt: payload.completePrompt,
    tone: payload.tone,
    legacyTopic: payload.topic,
    legacyPurpose: payload.purpose,
    legacyInstructions: payload.advisorInstructions,
    legacyCallToAction: payload.callToAction,
  });
  const generationInput = {
    prompt: draftPrompt({
      mode: payload.mode,
      advisorName: context.actorName ?? "Advisor",
      advisorEmail: context.actorEmail ?? "",
      client: clientProfile,
      plan: promptPlan,
      tone: payload.tone,
      advisorInstructions: payload.advisorInstructions,
      optionCount: payload.optionCount,
      publicResearch,
      speedMode: payload.speedMode,
      currentSubject,
      currentBody,
    }),
    instructions:
      "You are Slice's senior wealth-management communications editor. Produce the actual finished client email from the complete advisor prompt. The result must be unique to this exact prompt and client—not a template, prompt summary, placeholder, or restatement. Create a purpose-built subject. Use every supported substantive instruction and supplied fact. Preserve supplied facts exactly. Never mention prompts, instructions, drafting, AI, or this task inside the client email. Never invent holdings, performance, recommendations, dates, statistics, personal facts, or approvals. Return only the required structured output.",
    optionCount: payload.optionCount,
    speedMode: payload.speedMode,
    safetyIdentifier: context.actorEmail ?? context.userId,
    signal: runtime.signal,
  } as const;

  const ai = await generateCustomAiEmailOptions(generationInput);

  if (!ai.ok) {
    const providerReason = safeEmailError(
      ai.error,
      "OpenAI did not return a complete custom email.",
    );

    throw new ApiError({
      status: 503,
      code: "EMAIL_AI_CUSTOM_GENERATION_FAILED",
      message: providerReason,
      expose: true,
      details: {
        provider: ai.provider,
        model: ai.model,
        attemptedModels: ai.attemptedModels,
        requestId: ai.requestId,
      },
      cause: new Error(providerReason),
    });
  }

  const evaluateOptions = (options: typeof ai.options) =>
    options
      .map((option) => {
        const subject = cleanEmailSubject(option.subject);
        const body = cleanEmailBody(option.body);
        const assessment = assessGeneratedEmail({
          plan: promptPlan,
          subject,
          body,
        });

        return {
          subject,
          body,
          strategy: String(option.strategy ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 2_000),
          complianceNotes: safeStringList(option.complianceNotes, 12),
          promptCoverage: safeStringList(option.promptCoverage, 16),
          factsUsed: safeStringList(option.factsUsed, 16),
          qualityScore: assessment.score,
          qualityProblems: assessment.problems,
          acceptable: assessment.acceptable,
        };
      })
      .filter((option) => option.subject && option.body && option.acceptable)
      .sort((left, right) => right.qualityScore - left.qualityScore)
      .slice(0, payload.optionCount);

  let finalOptions = evaluateOptions(ai.options);
  let generationProvider = ai.provider;
  let generationModel = ai.model;
  let generationLatencyMs = ai.latencyMs;
  let generationRequestId = ai.requestId;

  if (!finalOptions.length) {
    await runtime.reportProgress(
      72,
      "Rewriting the email to satisfy the prompt and quality checks",
    );

    const qualityFeedback = ai.options.flatMap((option) =>
      assessGeneratedEmail({
        plan: promptPlan,
        subject: cleanEmailSubject(option.subject),
        body: cleanEmailBody(option.body),
      }).problems,
    );

    const repaired = await generateCustomAiEmailOptions({
      ...generationInput,
      optionCount: 1,
      repairFeedback: Array.from(
        new Set([
          ...qualityFeedback,
          "The email must be materially customized to the original advisor prompt.",
          "The subject must be specific to the requested communication.",
          "The body must contain the prompt-specific facts, context, and requested next action.",
          "Do not return generic language that would work unchanged for unrelated prompts.",
        ]),
      ).slice(0, 16),
    });

    if (repaired.ok) {
      finalOptions = evaluateOptions(repaired.options);
      generationProvider = repaired.provider;
      generationModel = repaired.model;
      generationLatencyMs += repaired.latencyMs;
      generationRequestId = repaired.requestId;
    }
  }

  if (!finalOptions.length) {
    throw new ApiError({
      status: 422,
      code: "EMAIL_AI_CUSTOM_OUTPUT_REJECTED",
      message:
        "The AI response did not satisfy the prompt-specific email quality requirements. Slice did not substitute a generic template.",
      expose: false,
      details: {
        provider: generationProvider,
        model: generationModel,
      },
    });
  }

  const fallbackUsed = false;
  const selectedQualityScore = finalOptions[0]?.qualityScore ?? 0;
  let workingMetadata = metadata;
  const storedVersions = [...metadata.versions];

  for (let index = 0; index < finalOptions.length; index += 1) {
    const option = finalOptions[index];
    const version = createStoredEmailVersion({
      metadata: workingMetadata,
      subject: option.subject,
      body: option.body,
      tone: payload.tone,
      label:
        payload.mode === "Polish"
          ? `Polished option ${index + 1}`
          : `AI option ${index + 1}`,
      origin: payload.mode === "Polish" ? "Polished" : "AI",
      createdByUserId: context.userId,
      strategy: option.strategy,
      researchSummary: publicResearch,
      sources: researchSources,
      complianceNotes: [
        ...option.complianceNotes,
        ...(option.promptCoverage.length
          ? [`Prompt coverage confirmed: ${option.promptCoverage.join("; ")}`]
          : []),
        ...(option.factsUsed.length
          ? [`Facts used: ${option.factsUsed.join("; ")}`]
          : []),
        ...option.qualityProblems.map((problem) => `Draft quality review: ${problem}`),
        ...(researchWarning ? [researchWarning] : []),
        "Advisor review and editing are required before approval.",
      ],
    });
    workingMetadata = appendStoredEmailVersion(workingMetadata, version);
    storedVersions.push(version);
  }

  const selected = finalOptions[0];
  const complianceNotes = Array.from(
    new Set([
      ...selected.complianceNotes,
      ...(researchWarning ? [researchWarning] : []),
      "Confirm every current fact, date, recipient, and disclosure before approval.",
      "No email is sent automatically by AI generation.",
    ]),
  ).slice(0, 30);

  await runtime.throwIfCancelled();
  await runtime.reportProgress(84, "Saving the finished email and version history");

  try {
    await updateDraftAfterAiGeneration({
      draft,
      metadata: workingMetadata,
      selectedSubject: selected.subject,
      selectedBody: selected.body,
      selectedTone: payload.tone,
      versions: storedVersions.slice(-12),
      complianceNotes,
      provider: generationProvider,
      model: generationModel ?? null,
      researchUsed,
      sources: researchSources,
      fallbackUsed,
      error: null,
      qualityScore: selectedQualityScore,
      promptIntent: promptPlan.messageType,
      subjectStrategy: selected.strategy || promptPlan.subjectCandidates[0] || null,
    });

    await recordAiToolRun(context, {
      toolKey: payload.mode === "Polish" ? "client_email_polish" : "client_email_generate",
      toolName: payload.mode === "Polish" ? "Client Email Polish" : "Client Email Generation",
      input: {
        draftId: draft.id,
        clientId: metadata.recipient.clientId,
        optionCount: payload.optionCount,
        speedMode: payload.speedMode,
        useResearch: payload.useResearch,
      },
      output: {
        versionCount: finalOptions.length,
        provider: generationProvider,
        model: generationModel,
        requestId: generationRequestId ?? null,
        fallbackUsed,
        speedMode: payload.speedMode,
        researchUsed,
        sourceCount: researchSources.length,
        messageType: promptPlan.messageType,
        qualityScore: selectedQualityScore,
      },
      status: "Complete",
      durationMs: generationLatencyMs,
    });

    await recordEmailBackgroundEvent({
      userId: context.userId,
      eventType: "client_email.ai_generation_completed",
      title: "AI client email draft completed",
      detail: `${finalOptions.length} editable draft option(s) were saved for advisor review.`,
      metadata: {
        draftId: draft.id,
        jobId: runtime.jobId,
        provider: generationProvider,
        model: generationModel,
        fallbackUsed,
        speedMode: payload.speedMode,
        researchUsed,
        sourceCount: researchSources.length,
        messageType: promptPlan.messageType,
        qualityScore: selectedQualityScore,
      },
    });
  } catch (error) {
    await markAiGenerationFailed({ draft, error });
    throw error;
  }

  await runtime.reportProgress(100, "Real custom AI email complete and ready to edit");

  return {
    draftId: draft.id,
    optionCount: finalOptions.length,
    fallbackUsed,
    speedMode: payload.speedMode,
    provider: generationProvider,
    model: generationModel ?? null,
    requestId: generationRequestId ?? null,
    researchUsed,
    sourceCount: researchSources.length,
    messageType: promptPlan.messageType,
    qualityScore: selectedQualityScore,
  };
}

export async function executeEmailAiGenerationJob(
  context: BackendContext,
  runtime: BackgroundJobRuntime,
) {
  try {
    return await runEmailAiGenerationJob(context, runtime);
  } catch (error) {
    try {
      const payload = asGenerationPayload(runtime.payload);
      const emailContext = await getEmailCenterContextForJob({
        userId: context.userId,
        firmId: context.firmId,
      });
      const [draft] = await getEmailDraftRowsForJob({
        userId: context.userId,
        firmId: emailContext.firmId,
        draftIds: [payload.draftId],
      });

      if (draft) {
        await markAiGenerationFailed({ draft, error });
      }
    } catch {
      // The worker still records the durable job failure even when the draft
      // record can no longer be updated.
    }

    throw error;
  }
}

async function runEmailDeliveryJob(
  context: BackendContext,
  runtime: BackgroundJobRuntime,
) {
  const payload = asObject(runtime.payload);
  const deliveryId = String(payload.deliveryId ?? "").trim();

  if (!deliveryId) {
    throw new ApiError({
      status: 400,
      code: "EMAIL_DELIVERY_JOB_PAYLOAD_INVALID",
      message: "The email delivery job payload is invalid.",
      expose: false,
    });
  }

  const emailContext = await getEmailCenterContextForJob({
    userId: context.userId,
    firmId: context.firmId,
  });
  await runtime.reportProgress(8, "Claiming approved email delivery");
  const delivery = await claimEmailDeliveryForJob({
    userId: context.userId,
    firmId: emailContext.firmId,
    deliveryId,
  });

  if (!delivery) {
    throw new ApiError({
      status: 404,
      code: "EMAIL_DELIVERY_NOT_FOUND",
      message: "The email delivery record no longer exists.",
      expose: false,
    });
  }

  if (["Sent", "Simulated"].includes(delivery.status)) {
    return {
      deliveryId: delivery.id,
      status: delivery.status,
      idempotent: true,
    };
  }

  if (delivery.status === "Cancelled") {
    return {
      deliveryId: delivery.id,
      status: "Cancelled",
      cancelled: true,
    };
  }

  const deliveryPayload = parseEmailDeliveryPayload(delivery.payloadJson);

  if (!deliveryPayload) {
    throw new ApiError({
      status: 409,
      code: "EMAIL_DELIVERY_PAYLOAD_INVALID",
      message: "The delivery metadata is invalid.",
      expose: false,
    });
  }

  const scheduledAt = Date.parse(deliveryPayload.scheduledAt);

  if (Number.isFinite(scheduledAt) && scheduledAt > Date.now() + 1_000) {
    throw new ApiError({
      status: 425,
      code: "EMAIL_DELIVERY_NOT_DUE",
      message: "The email is not due for delivery yet.",
      expose: false,
    });
  }

  await runtime.throwIfCancelled();
  await markEmailDeliverySending({ delivery, payload: deliveryPayload });
  await runtime.reportProgress(28, "Revalidating approval and recipient");

  const verified = await verifyDeliveryDraftAndRecipient({
    context: emailContext,
    delivery,
    payload: deliveryPayload,
  });

  await runtime.throwIfCancelled();
  await runtime.reportProgress(55, "Submitting approved email to the delivery provider");

  const result = await sendEmail({
    to: verified.email,
    subject: verified.subject,
    text: verified.body,
    html: verified.html,
    idempotencyKey: `client-email:${delivery.id}:revision:${deliveryPayload.draftRevision}`,
  });
  const completionStatus = result.ok
    ? result.status === "simulated"
      ? "Simulated"
      : "Sent"
    : "Failed";

  await completeEmailDelivery({
    delivery,
    payload: deliveryPayload,
    status: completionStatus,
    provider: result.provider,
    providerId: result.id ?? null,
    requestId: result.requestId ?? null,
    errorCode: result.errorCode ?? null,
    error: result.error ?? null,
    attempt: runtime.attempt,
  });

  if (!result.ok) {
    await recordEmailBackgroundEvent({
      userId: context.userId,
      eventType: "client_email.delivery_failed",
      title: "Client email delivery failed",
      detail: "The email provider did not confirm delivery. The background job will retry when appropriate.",
      severity: result.retryable ? "Medium" : "High",
      metadata: {
        deliveryId: delivery.id,
        draftId: deliveryPayload.draftId,
        jobId: runtime.jobId,
        provider: result.provider,
        errorCode: result.errorCode,
        retryable: result.retryable === true,
      },
    });

    throw new ApiError({
      status: result.retryable ? 502 : 422,
      code: result.errorCode ?? "EMAIL_PROVIDER_FAILED",
      message: result.error ?? "The email provider did not confirm delivery.",
      expose: false,
    });
  }

  await recordEmailBackgroundEvent({
    userId: context.userId,
    eventType:
      completionStatus === "Simulated"
        ? "client_email.delivery_simulated"
        : "client_email.delivery_sent",
    title:
      completionStatus === "Simulated"
        ? "Client email simulated"
        : "Client email sent",
    detail:
      completionStatus === "Simulated"
        ? "Live email is disabled, so the approved delivery was completed in simulation mode."
        : "The email provider confirmed the approved client delivery.",
    metadata: {
      deliveryId: delivery.id,
      draftId: deliveryPayload.draftId,
      clientId: deliveryPayload.clientId,
      jobId: runtime.jobId,
      provider: result.provider,
      providerId: result.id,
      requestId: result.requestId,
    },
  });

  await runtime.reportProgress(96, "Email delivery confirmed");

  return {
    deliveryId: delivery.id,
    draftId: deliveryPayload.draftId,
    status: completionStatus,
    provider: result.provider,
    providerId: result.id ?? null,
  };
}

export async function executeEmailDeliveryJob(
  context: BackendContext,
  runtime: BackgroundJobRuntime,
) {
  try {
    return await runEmailDeliveryJob(context, runtime);
  } catch (error) {
    try {
      const deliveryId = String(asObject(runtime.payload).deliveryId ?? "").trim();
      if (deliveryId && context.firmId) {
        const delivery = await loadEmailDeliveryForJob({
          userId: context.userId,
          firmId: context.firmId,
          deliveryId,
        });
        const payload = delivery
          ? parseEmailDeliveryPayload(delivery.payloadJson)
          : null;

        if (delivery && payload && delivery.status === "Processing") {
          await completeEmailDelivery({
            delivery,
            payload,
            status: "Failed",
            provider: delivery.provider ?? "Slice delivery validation",
            error: emailServiceSafeError(error),
            attempt: runtime.attempt,
          });
        }
      }
    } catch {
      // The durable job failure remains visible even when delivery cleanup fails.
    }

    throw error;
  }
}

export function emailJobError(error: unknown) {
  return emailServiceSafeError(error) || safeEmailError(error);
}