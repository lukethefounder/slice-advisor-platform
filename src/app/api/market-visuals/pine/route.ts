import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PineRequest = {
  symbol?: unknown;
  interval?: unknown;
  prompt?: unknown;
  scriptType?: unknown;
  existingCode?: unknown;
  marketContext?: unknown;
};

function cleanText(
  value: unknown,
  maxLength: number,
  fallback = ""
) {
  return typeof value === "string"
    ? value
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, maxLength)
    : fallback;
}

function cleanSymbol(value: unknown) {
  return cleanText(
    value,
    16,
    "AAPL"
  )
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "");
}

function cleanInterval(value: unknown) {
  const interval = cleanText(
    value,
    12,
    "5min"
  ).toLowerCase();

  return [
    "1min",
    "5min",
    "15min",
    "30min",
    "60min",
    "daily",
  ].includes(interval)
    ? interval
    : "5min";
}

function cleanScriptType(
  value: unknown
) {
  return cleanText(
    value,
    16,
    "indicator"
  ).toLowerCase() === "strategy"
    ? "strategy"
    : "indicator";
}

function safeMarketContext(
  value: unknown
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  const allowed = [
    "price",
    "changePct",
    "session",
    "directionalBias",
    "trend",
    "momentum",
    "support",
    "resistance",
    "rsi14",
    "sma20",
    "sma50",
    "sma200",
    "ema9",
    "ema21",
    "vwap",
    "atr14",
    "forecastProbabilityUp",
    "forecastExpectedMovePct",
    "forecastConfidence",
    "asOf",
  ];

  return Object.fromEntries(
    allowed
      .filter(
        (key) =>
          row[key] !== undefined &&
          row[key] !== null
      )
      .map((key) => [
        key,
        row[key],
      ])
  );
}

function stripCodeFences(
  value: string
) {
  const trimmed = value.trim();

  const fenced = trimmed.match(
    /^```(?:pine|pinescript|pine-script)?\s*([\s\S]*?)```$/i
  );

  return (
    fenced?.[1] || trimmed
  ).trim();
}

function normalizePineCode(
  value: string
) {
  let code = stripCodeFences(
    value
  )
    .replace(
      /^Here(?:'s| is)[^\n]*\n/i,
      ""
    )
    .replace(
      /^Pine Script[^\n]*\n/i,
      ""
    )
    .trim();

  code = code.replace(
    /^\/\/@version=\d+\s*/i,
    "//@version=6\n"
  );

  if (
    !code.startsWith(
      "//@version=6"
    )
  ) {
    code =
      `//@version=6\n${code}`;
  }

  return code.slice(0, 40_000);
}

function validatePine(
  code: string,
  scriptType:
    | "indicator"
    | "strategy"
) {
  const warnings: string[] = [];

  const declarationCount = (
    code.match(
      /\b(?:indicator|strategy|library)\s*\(/g
    ) || []
  ).length;

  if (
    !code.startsWith(
      "//@version=6"
    )
  ) {
    throw new Error(
      "The generated script does not declare Pine Script version 6."
    );
  }

  if (declarationCount !== 1) {
    throw new Error(
      "The generated script must contain exactly one indicator(), strategy(), or library() declaration."
    );
  }

  if (
    scriptType === "strategy" &&
    !/\bstrategy\s*\(/.test(code)
  ) {
    warnings.push(
      "The requested strategy was returned as an indicator. Review the declaration before use."
    );
  }

  if (
    scriptType === "indicator" &&
    !/\bindicator\s*\(/.test(code)
  ) {
    warnings.push(
      "The requested indicator was returned as a strategy. Review order settings before use."
    );
  }

  if (
    /\brequest\.security\s*\(/.test(
      code
    ) &&
    !/lookahead\s*=\s*barmerge\.lookahead_off/.test(
      code
    )
  ) {
    warnings.push(
      "The script uses request.security(); verify lookahead and repaint behavior in TradingView."
    );
  }

  if (
    /\bstrategy\.(entry|order|exit|close)\s*\(/.test(
      code
    )
  ) {
    warnings.push(
      "Strategy order logic requires TradingView backtesting before any use."
    );
  }

  if (
    !/alertcondition\s*\(/.test(
      code
    )
  ) {
    warnings.push(
      "No alertcondition() was generated."
    );
  }

  return warnings;
}

function fallbackPrompt(input: {
  symbol: string;
  interval: string;
  scriptType:
    | "indicator"
    | "strategy";
}) {
  return (
    `Create a professional ${input.scriptType} for ${input.symbol} on ${input.interval}. ` +
    "Use EMA 9/21, SMA 50/200, RSI 14, ATR risk controls, volume confirmation, " +
    "non-repainting signals, plots, labels, and alertcondition() calls."
  );
}

function configuredModel() {
  return (
    process.env.OPENAI_PINE_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-5-mini"
  );
}

export async function GET() {
  const user =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  return NextResponse.json({
    configured: Boolean(
      process.env.OPENAI_API_KEY
    ),
    model: configuredModel(),
    pineVersion: 6,
  });
}

export async function POST(
  request: Request
) {
  const user =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not configured.",
        configured: false,
      },
      {
        status: 503,
      }
    );
  }

  try {
    const body = (
      await request
        .json()
        .catch(() => ({}))
    ) as PineRequest;

    const symbol =
      cleanSymbol(body.symbol) ||
      "AAPL";

    const interval =
      cleanInterval(body.interval);

    const scriptType =
      cleanScriptType(
        body.scriptType
      ) as
        | "indicator"
        | "strategy";

    const prompt =
      cleanText(
        body.prompt,
        8_000
      ) ||
      fallbackPrompt({
        symbol,
        interval,
        scriptType,
      });

    const existingCode =
      cleanText(
        body.existingCode,
        30_000
      );

    const marketContext =
      safeMarketContext(
        body.marketContext
      );

    const model =
      configuredModel();

    const client = new OpenAI({
      apiKey,
    });

    const response =
      await client.responses.create({
        model,
        store: false,
        max_output_tokens: 7_000,
        instructions: [
          "You are SLICE Pine Lab, a senior TradingView Pine Script engineer.",
          "Return only compilable Pine Script code. Do not use Markdown fences or prose outside code comments.",
          "Always use //@version=6 as the first line and exactly one indicator() or strategy() declaration.",
          "Use Pine Script v6 syntax and current ta.*, math.*, strategy.*, input.*, color.*, alertcondition(), plot(), plotshape(), table.*, line.*, label.*, and request.* conventions.",
          "Avoid repainting and future leakage. Use confirmed-bar logic when appropriate. Never enable lookahead_on.",
          "Do not hardcode a generated forecast as if TradingView can receive SLICE server data. Market context may inform defaults and comments only; calculations must use native chart OHLCV series.",
          "For strategies, include conservative commission/slippage inputs, position sizing inputs, exits, and clear risk controls. Do not claim guaranteed profitability.",
          "For indicators, include useful plots, readable signals, alertcondition() calls, and inputs with validation bounds.",
          "Keep the script understandable, organized into sections, and within TradingView resource limits.",
        ].join("\n"),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  `Symbol context: ${symbol}`,
                  `Chart interval context: ${interval}`,
                  `Requested script type: ${scriptType}`,
                  `Current Alpha Vantage context: ${JSON.stringify(
                    marketContext
                  )}`,
                  existingCode
                    ? `Existing script to improve or rewrite:\n${existingCode}`
                    : "No existing script was supplied.",
                  `User request:\n${prompt}`,
                  "Generate the complete Pine Script v6 file now.",
                ].join("\n\n"),
              },
            ],
          },
        ],
      });

    const raw =
      response.output_text?.trim();

    if (!raw) {
      throw new Error(
        "OpenAI returned an empty Pine Script response."
      );
    }

    const code =
      normalizePineCode(raw);

    const warnings =
      validatePine(
        code,
        scriptType
      );

    return NextResponse.json({
      ok: true,
      configured: true,
      model,
      generatedAt:
        new Date().toISOString(),
      symbol,
      interval,
      scriptType,
      pineVersion: 6,
      code,
      warnings,
      usage:
        response.usage ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "OpenAI Pine generation failed.",
        detail:
          error instanceof Error
            ? error.message
            : "Unknown OpenAI error.",
      },
      {
        status: 502,
      }
    );
  }
}