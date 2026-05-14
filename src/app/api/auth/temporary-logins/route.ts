import { NextResponse } from "next/server";
import { temporaryLoginsEnabled } from "@/lib/founder-access";
import {
  ensureTemporaryLogins,
  temporaryLoginAccounts,
} from "@/lib/temporary-logins";

export async function GET() {
  if (!temporaryLoginsEnabled()) {
    return NextResponse.json({
      enabled: false,
      accounts: [],
      message:
        "Temporary logins are disabled. Add ENABLE_TEMP_LOGINS=true to .env.local, restart the dev server, and try again.",
    });
  }

  const result = await ensureTemporaryLogins();

  return NextResponse.json({
    enabled: true,
    accounts: temporaryLoginAccounts,
    seedError: result.seedError,
    message: result.seedError
      ? `Temporary accounts were exposed, but demo firm seed had an issue: ${result.seedError}`
      : "Temporary accounts are ready.",
  });
}

export async function POST() {
  if (!temporaryLoginsEnabled()) {
    return NextResponse.json(
      {
        enabled: false,
        error:
          "Temporary logins are disabled. Add ENABLE_TEMP_LOGINS=true to .env.local, restart the dev server, and try again.",
      },
      { status: 403 }
    );
  }

  const result = await ensureTemporaryLogins();

  return NextResponse.json({
    enabled: true,
    accounts: temporaryLoginAccounts,
    seedError: result.seedError,
    message: result.seedError
      ? `Temporary accounts were created as much as possible, but demo firm seed had an issue: ${result.seedError}`
      : "Temporary logins created successfully.",
  });
}