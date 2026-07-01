import { getCurrentUser } from "@/lib/auth";
import {
  cleanEmail,
  cleanText,
  noStoreJson,
  protectClientDataRoute,
} from "@/lib/client-data-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AiImportedHolding = {
  symbol: string;
  assetName: string;
  assetClass: string;
  riskLevel: string;
  thesis: string;
};

type AiImportedClient = {
  importKey: string;
  sourceRow: number;
  fullName: string;
  email: string;
  householdName: string;
  clientType: string;
  riskProfile: string;
  liquidityNeeds: string;
  timeHorizon: string;
  objective: string;
  status: string;
  notes: string;
  holdings: AiImportedHolding[];
  confidence: number;
  warnings: string[];
  duplicateHint: string;
};

type CurrentUserShape = {
  id: string;
  name: string;
  email: string;
};

function protectedRouteResponse(
  protection: Awaited<ReturnType<typeof protectClientDataRoute>>,
) {
  return (
    protection.response ??
    noStoreJson(
      {
        error: "Security policy blocked this client import request.",
      },
      { status: 403 },
    )
  );
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function csvParse(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if ((char === "," || char === "\t") && !quoted) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      field = "";

      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);

  return rows;
}

function rowsToObjects(text: string) {
  const parsed = csvParse(text).filter((row) => row.some(Boolean));
  if (parsed.length <= 1) return [];

  const headers = parsed[0].map((header) => header.trim());
  const rows = parsed.slice(1);

  return rows.map((row, index) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      obj[header || `Column ${headerIndex + 1}`] = row[headerIndex] ?? "";
    });
    obj.__sourceRow = String(index + 2);
    return obj;
  });
}

function firstValue(row: Record<string, string>, aliases: string[]) {
  const entries = Object.entries(row);

  for (const alias of aliases) {
    const match = entries.find(([key]) => key.toLowerCase().replace(/[^a-z0-9]/g, "") === alias.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function normalizeRisk(value: string) {
  const lower = value.toLowerCase();

  if (lower.includes("aggressive")) return "Aggressive";
  if (lower.includes("growth")) return "Growth";
  if (lower.includes("conservative")) return "Conservative";
  if (lower.includes("balanced")) return "Balanced";

  return "Balanced";
}

function normalizeStatus(value: string) {
  const lower = value.toLowerCase();

  if (lower.includes("inactive")) return "Inactive";
  if (lower.includes("prospect")) return "Prospect";
  if (lower.includes("review")) return "Needs Review";

  return "Active";
}

function cleanSymbol(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9._/!\-$]/g, "").trim();
}

function assetClassForSymbol(symbol: string) {
  const upper = symbol.toUpperCase();

  if (upper.includes("BTC") || upper.includes("ETH") || upper.includes("USDT")) return "Crypto";
  if (upper.endsWith("1!")) return "Futures";
  if (["SPY", "QQQ", "VOO", "VTI", "TLT", "GLD", "IWM", "DIA"].includes(upper)) return "ETF";

  return "Stock";
}

function splitSymbols(value: string) {
  return Array.from(
    new Set(
      value
        .split(/,|;|\n|\s/)
        .map(cleanSymbol)
        .filter(Boolean),
    ),
  ).slice(0, 40);
}

function heuristicProfilesFromRows(rows: Record<string, string>[]) {
  return rows
    .map((row, index) => {
      const fullName =
        firstValue(row, ["fullName", "clientName", "name", "client", "householdMember"]) ||
        [firstValue(row, ["firstName", "first"]), firstValue(row, ["lastName", "last"])].filter(Boolean).join(" ");

      const email = cleanEmail(firstValue(row, ["email", "clientEmail", "emailAddress"])) ?? "";
      const householdName = firstValue(row, ["household", "householdName", "family", "accountName"]);
      const symbols = splitSymbols(firstValue(row, ["holdings", "symbols", "tickers", "securities", "positions", "portfolio"]));
      const sourceRow = Number(row.__sourceRow || index + 2);

      const warnings = [
        fullName ? "" : "Missing client name.",
        email || !firstValue(row, ["email", "clientEmail", "emailAddress"]) ? "" : "Invalid email format.",
      ].filter(Boolean);

      return {
        importKey: id("import"),
        sourceRow,
        fullName: fullName || `Unnamed Client Row ${sourceRow}`,
        email,
        householdName,
        clientType: firstValue(row, ["clientType", "type"]) || "Private Client",
        riskProfile: normalizeRisk(firstValue(row, ["risk", "riskProfile", "riskTolerance"])),
        liquidityNeeds: firstValue(row, ["liquidity", "liquidityNeeds"]) || "Moderate",
        timeHorizon: firstValue(row, ["timeHorizon", "horizon"]) || "5-10 years",
        objective: firstValue(row, ["objective", "goal", "goals", "investmentObjective"]) || "Long-term wealth growth",
        status: normalizeStatus(firstValue(row, ["status", "clientStatus"])),
        notes: firstValue(row, ["notes", "advisorNotes", "comments"]),
        holdings: symbols.map((symbol) => ({
          symbol,
          assetName: symbol,
          assetClass: assetClassForSymbol(symbol),
          riskLevel: "Medium",
          thesis: "Imported from advisor client file.",
        })),
        confidence: warnings.length ? 72 : 88,
        warnings,
        duplicateHint: "",
      } satisfies AiImportedClient;
    })
    .filter((profile) => profile.fullName.trim());
}

async function excelBase64ToCsv(base64: string) {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<Record<string, any>>;
    const xlsx = await dynamicImport("xlsx");
    const workbook = xlsx.read(Buffer.from(base64, "base64"), { type: "buffer" });
    const sheetName = workbook.SheetNames?.[0];

    if (!sheetName) {
      throw new Error("No worksheet found.");
    }

    const sheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_csv(sheet);
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.includes("Cannot find")
        ? "Excel import requires the xlsx package on the server. Install xlsx or save the file as CSV."
        : error instanceof Error
          ? error.message
          : "Unable to read Excel file.",
    );
  }
}

function extractText(payload: unknown) {
  const root = payload as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
      }>;
    }>;
  };

  if (typeof root.output_text === "string") return root.output_text;

  const chunks: string[] = [];

  for (const item of root.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }

  return chunks.join("\n");
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1);
  }

  return candidate;
}

function normalizeAiProfiles(input: unknown, fallbackRows: Record<string, string>[]) {
  const root = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const profilesRaw = Array.isArray(root.profiles) ? root.profiles : [];
  const fallback = heuristicProfilesFromRows(fallbackRows);

  if (!profilesRaw.length) return fallback;

  return profilesRaw.slice(0, 250).map((profile, index) => {
    const row = profile && typeof profile === "object" ? (profile as Record<string, unknown>) : {};
    const fallbackProfile = fallback[index];

    const holdingsRaw = Array.isArray(row.holdings) ? row.holdings : [];
    const holdings: AiImportedHolding[] = holdingsRaw
      .map((holding) => {
        const item = holding && typeof holding === "object" ? (holding as Record<string, unknown>) : {};
        const symbol = cleanSymbol(String(item.symbol ?? ""));

        if (!symbol) return null;

        return {
          symbol,
          assetName: cleanText(item.assetName) || symbol,
          assetClass: cleanText(item.assetClass) || assetClassForSymbol(symbol),
          riskLevel: cleanText(item.riskLevel) || "Medium",
          thesis: cleanText(item.thesis) || "Imported from advisor client file.",
        } satisfies AiImportedHolding;
      })
      .filter(Boolean) as AiImportedHolding[];

    const confidence = Number(row.confidence);
    const warnings = Array.isArray(row.warnings) ? row.warnings.map(String).filter(Boolean) : [];

    return {
      importKey: id("import"),
      sourceRow: Number(row.sourceRow) || fallbackProfile?.sourceRow || index + 2,
      fullName: cleanText(row.fullName) || fallbackProfile?.fullName || `Unnamed Client Row ${index + 2}`,
      email: cleanEmail(row.email) ?? fallbackProfile?.email ?? "",
      householdName: cleanText(row.householdName) || fallbackProfile?.householdName || "",
      clientType: cleanText(row.clientType) || fallbackProfile?.clientType || "Private Client",
      riskProfile: normalizeRisk(cleanText(row.riskProfile) || fallbackProfile?.riskProfile || "Balanced"),
      liquidityNeeds: cleanText(row.liquidityNeeds) || fallbackProfile?.liquidityNeeds || "Moderate",
      timeHorizon: cleanText(row.timeHorizon) || fallbackProfile?.timeHorizon || "5-10 years",
      objective: cleanText(row.objective) || fallbackProfile?.objective || "Long-term wealth growth",
      status: normalizeStatus(cleanText(row.status) || fallbackProfile?.status || "Active"),
      notes: cleanText(row.notes) || fallbackProfile?.notes || "",
      holdings: holdings.length ? holdings : fallbackProfile?.holdings ?? [],
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : fallbackProfile?.confidence ?? 75,
      warnings,
      duplicateHint: cleanText(row.duplicateHint) || "",
    } satisfies AiImportedClient;
  });
}

async function normalizeWithOpenAi(input: {
  rows: Record<string, string>[];
  fileName: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      aiUsed: false,
      profiles: heuristicProfilesFromRows(input.rows),
      warnings: ["OPENAI_API_KEY is not configured. Used deterministic CSV mapping fallback."],
    };
  }

  const compactRows = input.rows.slice(0, 250);

  const prompt = `
You are normalizing a wealth advisor client list into client profiles.

Return JSON only. No markdown.

Rules:
- Do not invent client identity, emails, or securities.
- Preserve sourceRow.
- If a field is unclear, leave a sensible default and add a warning.
- Never merge two clients unless the row clearly represents the same household.
- Treat securities/holdings/tickers as symbols only. Do not create position amounts.
- Confidence must reflect certainty from the provided row only.
- Put possible duplicate warning into duplicateHint, but do not drop the row.
- Normalize riskProfile to one of: Conservative, Balanced, Growth, Aggressive.
- Normalize status to one of: Active, Needs Review, Prospect, Inactive.
- Max 40 holdings per profile.

Schema:
{
  "profiles": [
    {
      "sourceRow": number,
      "fullName": "string",
      "email": "string",
      "householdName": "string",
      "clientType": "Private Client|Household|Business Owner|Trust / Estate|Prospect",
      "riskProfile": "Conservative|Balanced|Growth|Aggressive",
      "liquidityNeeds": "string",
      "timeHorizon": "string",
      "objective": "string",
      "status": "Active|Needs Review|Prospect|Inactive",
      "notes": "string",
      "holdings": [
        {
          "symbol": "string",
          "assetName": "string",
          "assetClass": "Stock|ETF|Mutual Fund|Bond|Crypto|Futures|Alternative|Other",
          "riskLevel": "Low|Medium|High|Aggressive",
          "thesis": "string"
        }
      ],
      "confidence": number,
      "warnings": ["string"],
      "duplicateHint": "string"
    }
  ],
  "warnings": ["string"]
}

File: ${input.fileName}
Rows:
${JSON.stringify(compactRows)}
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CLIENT_IMPORT_MODEL || "gpt-5.5",
      input: prompt,
      max_output_tokens: 6000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    return {
      aiUsed: false,
      profiles: heuristicProfilesFromRows(input.rows),
      warnings: [`OpenAI normalization failed. Used deterministic fallback. ${errorText.slice(0, 180)}`],
    };
  }

  const payload = await response.json();
  const text = extractText(payload);
  const parsed = JSON.parse(extractJson(text)) as Record<string, unknown>;

  return {
    aiUsed: true,
    profiles: normalizeAiProfiles(parsed, input.rows),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String).filter(Boolean) : [],
  };
}

export async function POST(request: Request) {
  const user = (await getCurrentUser()) as CurrentUserShape | null;

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Client Data",
    eventType: "client.ai_import",
    title: "AI client import normalization",
    limit: 20,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const fileName = cleanText(body.fileName, "client-import.csv");
    const base64 = typeof body.base64 === "string" ? body.base64 : "";
    let text = typeof body.text === "string" ? body.text : "";

    if (!text && base64) {
      text = await excelBase64ToCsv(base64);
    }

    if (!text.trim()) {
      return noStoreJson(
        {
          ok: false,
          message: "No import text was found in the uploaded file.",
          warnings: ["Upload a CSV/TSV/TXT file or install xlsx for Excel parsing."],
          profiles: [],
        },
        { status: 400 },
      );
    }

    const rows = rowsToObjects(text).slice(0, 250);

    if (!rows.length) {
      return noStoreJson(
        {
          ok: false,
          message: "No client rows were detected. Confirm the file has a header row and at least one client row.",
          warnings: [],
          profiles: [],
        },
        { status: 400 },
      );
    }

    const normalized = await normalizeWithOpenAi({
      rows,
      fileName,
    });

    return noStoreJson({
      ok: true,
      fileName,
      detectedRows: rows.length,
      aiUsed: normalized.aiUsed,
      profiles: normalized.profiles,
      warnings: normalized.warnings,
      message: normalized.aiUsed
        ? "AI normalized client profiles. Advisor review is required before import."
        : "Client profiles were staged using deterministic fallback normalization. Advisor review is required before import.",
    });
  } catch (error) {
    return noStoreJson(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Client import failed.",
        warnings: [],
        profiles: [],
      },
      { status: 500 },
    );
  }
}