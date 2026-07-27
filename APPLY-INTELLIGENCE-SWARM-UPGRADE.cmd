@echo off
setlocal EnableExtensions

title SLICE Intelligence Swarm Validation

echo.
echo ============================================================
echo   SLICE INTELLIGENCE SWARM - VALIDATION AND BUILD
echo ============================================================
echo.

if not exist package.json (
  echo ERROR: package.json was not found.
  echo.
  echo Run this file from the main SLICE repository folder:
  echo C:\Users\luker\Slice-Restart-2\slice-platform
  echo.
  exit /b 1
)

if not exist scripts\validate-intelligence-swarm-upgrade.mjs (
  echo ERROR: The Intelligence validation script is missing.
  echo.
  echo Expected file:
  echo scripts\validate-intelligence-swarm-upgrade.mjs
  echo.
  exit /b 1
)

echo [1 of 5] Checking Intelligence file boundaries...
echo.

node scripts\validate-intelligence-swarm-upgrade.mjs

if errorlevel 1 (
  echo.
  echo ERROR: Intelligence file-boundary validation failed.
  echo Review the errors printed above before continuing.
  echo.
  exit /b 1
)

echo.
echo PASS: Intelligence file boundaries are valid.
echo.

echo [2 of 5] Generating Prisma client...
echo.

call npx prisma generate

if errorlevel 1 (
  echo.
  echo ERROR: Prisma client generation failed.
  echo.
  exit /b 1
)

echo.
echo PASS: Prisma client generated.
echo.

echo [3 of 5] Running TypeScript validation...
echo.

call npx tsc --noEmit

if errorlevel 1 (
  echo.
  echo ERROR: TypeScript validation failed.
  echo Review the TypeScript errors printed above.
  echo.
  exit /b 1
)

echo.
echo PASS: TypeScript validation completed.
echo.

echo [4 of 5] Running the production dependency audit...
echo.

call npm audit --omit=dev --audit-level=high

if errorlevel 1 (
  echo.
  echo ERROR: The production dependency audit found a high or critical issue.
  echo.
  echo Do not run:
  echo npm audit fix --force
  echo.
  echo Review the package names shown above before committing.
  echo.
  exit /b 1
)

echo.
echo PASS: Production dependency audit completed.
echo.

echo [5 of 5] Building the full production application...
echo.

call npm run build

if errorlevel 1 (
  echo.
  echo ERROR: The production build failed.
  echo Review the build error printed above.
  echo.
  exit /b 1
)

echo.
echo ============================================================
echo   SUCCESS
echo ============================================================
echo.
echo Intelligence file boundaries passed.
echo Prisma generation passed.
echo TypeScript validation passed.
echo Production dependency audit passed.
echo Production build passed.
echo.
echo The Intelligence Swarm upgrade is ready for Git review.
echo.

endlocal
exit /b 0