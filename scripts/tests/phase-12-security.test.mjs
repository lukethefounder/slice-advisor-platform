import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  join,
  resolve,
} from "node:path";
import {
  pathToFileURL,
} from "node:url";
import {
  createRequire,
} from "node:module";

const require =
  createRequire(
    import.meta.url,
  );

const ts =
  require(
    "typescript",
  );

const root =
  process.cwd();

const assertions = [];

function check(
  condition,
  message,
) {
  assert.ok(
    condition,
    message,
  );

  assertions.push(
    message,
  );
}

const sourcePath =
  resolve(
    root,
    "src/lib/security-headers.ts",
  );

const source =
  readFileSync(
    sourcePath,
    "utf8",
  );

const compiled =
  ts.transpileModule(
    source,
    {
      compilerOptions: {
        target:
          ts.ScriptTarget
            .ES2022,

        module:
          ts.ModuleKind
            .ES2022,
      },
    },
  ).outputText;

const temp =
  mkdtempSync(
    join(
      tmpdir(),
      "slice-phase12-",
    ),
  );

const modulePath =
  join(
    temp,
    "security-headers.mjs",
  );

writeFileSync(
  modulePath,
  compiled,
  "utf8",
);

const securityHeaders =
  await import(
    `${
      pathToFileURL(
        modulePath,
      ).href
    }?v=${Date.now()}`
  );

const productionCsp =
  securityHeaders
    .buildContentSecurityPolicy({
      development:
        false,
    });

const developmentCsp =
  securityHeaders
    .buildContentSecurityPolicy({
      development:
        true,
    });

const productionHeaders =
  securityHeaders
    .securityHeadersForRequest({
      development:
        false,

      https:
        true,

      reportOnly:
        false,
    });

const reportOnlyHeaders =
  securityHeaders
    .securityHeadersForRequest({
      development:
        false,

      https:
        true,

      reportOnly:
        true,
    });

check(
  !productionCsp.includes(
    "'unsafe-eval'",
  ),

  "Production CSP excludes unsafe-eval",
);

check(
  developmentCsp.includes(
    "'unsafe-eval'",
  ),

  "Development CSP permits the Next.js evaluator",
);

check(
  productionCsp.includes(
    "frame-ancestors 'none'",
  ),

  "CSP prevents framing",
);

check(
  productionCsp.includes(
    "object-src 'none'",
  ),

  "CSP blocks object embeds",
);

check(
  productionCsp.includes(
    "report-uri /api/security/csp-report",
  ),

  "CSP sends reports to Slice",
);

check(
  productionCsp.includes(
    "upgrade-insecure-requests",
  ),

  "Production CSP upgrades insecure requests",
);

check(
  Boolean(
    productionHeaders[
      "Content-Security-Policy"
    ],
  ),

  "CSP enforcement header is emitted",
);

check(
  !productionHeaders[
    "Content-Security-Policy-Report-Only"
  ],

  "Enforcement mode is not duplicated as report-only",
);

check(
  Boolean(
    reportOnlyHeaders[
      "Content-Security-Policy-Report-Only"
    ],
  ),

  "Report-only rollout remains available",
);

check(
  Boolean(
    productionHeaders[
      "Strict-Transport-Security"
    ],
  ),

  "HTTPS production responses receive HSTS",
);

check(
  productionHeaders[
    "X-Frame-Options"
  ] === "DENY",

  "Legacy frame protection is DENY",
);

check(
  productionHeaders[
    "X-Content-Type-Options"
  ] === "nosniff",

  "MIME sniffing is disabled",
);

const middleware =
  readFileSync(
    resolve(
      root,
      "src/middleware.ts",
    ),

    "utf8",
  );

check(
  middleware.includes(
    'const CLIENT_SESSION_COOKIE = "slice_client_portal_session"',
  ),

  "Middleware recognizes the client portal session",
);

check(
  middleware.includes(
    'pathname === "/api/documents/upload"',
  ),

  "Middleware preserves the Vercel Blob callback route",
);

check(
  !middleware.includes(
    '"/api/personal-bot/pdf-report"',
  ),

  "PDF reporting is no longer globally public",
);

check(
  !middleware.includes(
    '"/api/intelligence/scan"',
  ),

  "Authenticated source scans are not globally public",
);

check(
  middleware.includes(
    'pathname === "/api/operations/web-vitals"',
  ),

  "Web Vitals ingestion is explicitly public and bounded",
);

const rateLimit =
  readFileSync(
    resolve(
      root,
      "src/lib/rate-limit.ts",
    ),

    "utf8",
  );

check(
  rateLimit.includes(
    'INSERT INTO "SecurityRateLimitBucket"',
  ),

  "Rate limits are durable in PostgreSQL",
);

check(
  rateLimit.includes(
    'ON CONFLICT ("keyHash") DO UPDATE',
  ),

  "Rate-limit increments are atomic",
);

check(
  rateLimit.includes(
    "RATE_LIMIT_SERVICE_UNAVAILABLE",
  ),

  "Production rate-limit outages fail safely",
);

const security =
  readFileSync(
    resolve(
      root,
      "src/lib/security.ts",
    ),

    "utf8",
  );

check(
  security.includes(
    "createHmac",
  ),

  "Security fingerprints use keyed HMAC",
);

check(
  security.includes(
    "MAX_METADATA_DEPTH",
  ),

  "Security metadata has a depth bound",
);

check(
  security.includes(
    "[REDACTED]",
  ),

  "Sensitive security values are redacted",
);

rmSync(
  temp,
  {
    recursive:
      true,

    force:
      true,
  },
);

process.stdout.write(
  `${JSON.stringify(
    {
      ok:
        true,

      test:
        "phase-12-security-contract",

      assertions:
        assertions.length,
    },

    null,
    2,
  )}\n`,
);