import {
  defineConfig,
  globalIgnores,
} from "eslint/config";

import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Slice ESLint baseline
 *
 * Goals:
 * 1. Lint Slice-owned source and scripts, never third-party virtualenv code.
 * 2. Keep correctness, security, Next.js, and TypeScript syntax rules enabled.
 * 3. Prevent newly introduced `any` values in modern critical modules.
 * 4. Treat legacy React-compiler migration findings as non-blocking until the
 *    affected pages are deliberately moved to server data or external stores.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores(
    [
      // Next.js and generated build output.
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "next-env.d.ts",
      "**/*.tsbuildinfo",

      // Generated clients and generated code.
      "src/generated/**",
      "prisma/generated/**",

      // Test, coverage, backup, and local tool output.
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      ".artifacts/**",
      "backups/**",
      ".cache/**",
      ".turbo/**",

      // Python environments and vendored Python package sources are not
      // maintained by the Slice TypeScript/Next.js lint configuration.
      "**/.venv/**",
      "**/venv/**",
      "**/site-packages/**",
      "**/__pycache__/**",
      "**/.pytest_cache/**",
      "**/.ruff_cache/**",
      "**/.mypy_cache/**",

      // Third-party browser assets copied into local service environments.
      "services/**/vendor/**",
    ],

    "Slice generated and third-party ignores",
  ),

  {
    name: "Slice Node scripts",

    files: [
      "scripts/**/*.{js,mjs,cjs,ts}",
    ],

    rules: {
      /*
       * Node VM test harnesses intentionally emulate CommonJS with a local
       * `module` record. This Next.js application rule is not applicable.
       */
      "@next/next/no-assign-module-variable":
        "off",

      /*
       * Scripts may use createRequire or compatibility loading without being
       * browser/application modules.
       */
      "@typescript-eslint/no-require-imports":
        "off",
    },
  },

  {
    name:
      "Slice legacy migration baseline",

    files: [
      "src/**/*.{js,jsx,ts,tsx}",
    ],

    rules: {
      /*
       * Existing legacy modules contain runtime-checked dynamic provider and
       * Prisma payloads. Keep the debt visible without blocking deployment;
       * modern critical modules are made strict again below.
       */
      "@typescript-eslint/no-explicit-any":
        "warn",

      /*
       * These React compiler-oriented rules require deliberate component/data
       * ownership refactors. Existing effects, polling, localStorage bridges,
       * and event-driven UI remain functional and visible for later cleanup.
       */
      "react-hooks/set-state-in-effect":
        "warn",

      "react-hooks/purity":
        "warn",

      "react-hooks/refs":
        "warn",

      "react-hooks/use-memo":
        "warn",

      /*
       * Existing legacy pages still include a small number of internal anchor
       * links. Keep them visible until each route is safely converted to Link.
       */
      "@next/next/no-html-link-for-pages":
        "warn",
    },
  },

  {
    name:
      "Slice modern critical modules",

    files: [
      "src/lib/email-center/**/*.{ts,tsx}",
      "src/lib/background-jobs/**/*.{ts,tsx}",
      "src/lib/watchlists/**/*.{ts,tsx}",
      "src/lib/clients/**/*.{ts,tsx}",
      "src/lib/document-center/**/*.{ts,tsx}",
      "src/app/api/client-emails/**/*.{ts,tsx}",
      "src/app/api/jobs/**/*.{ts,tsx}",
      "src/app/api/documents/**/*.{ts,tsx}",
    ],

    rules: {
      /*
       * New and recently rebuilt critical paths must not introduce untyped
       * `any` values even while older modules are being migrated.
       */
      "@typescript-eslint/no-explicit-any":
        "error",
    },
  },
]);

export default eslintConfig;