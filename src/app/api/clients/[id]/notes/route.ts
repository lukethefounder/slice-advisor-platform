import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cleanText,
  noStoreJson,
  protectClientDataRoute,
  recordClientMutation,
  requireClientAccess,
} from "@/lib/client-data-security";
import {
  decryptAdvisorNote,
  encryptSensitiveText,
  vaultStatus,
} from "@/lib/data-vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function protectedRouteResponse(
  protection: Awaited<ReturnType<typeof protectClientDataRoute>>
) {
  return (
    protection.response ??
    noStoreJson(
      {
        error: "Security policy blocked this client note request.",
      },
      { status: 403 }
    )
  );
}

function clientAccessResponse(
  access: Awaited<ReturnType<typeof requireClientAccess>>
) {
  return (
    access.response ??
    noStoreJson(
      {
        error: "Client access denied.",
      },
      { status: 404 }
    )
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Client Data",
    eventType: "client.note.create",
    title: "Client note creation",
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const { id } = await context.params;

    const access = await requireClientAccess({
      user,
      clientId: id,
      scope: "write",
      request,
    });

    if (!access.allowed) {
      return clientAccessResponse(access);
    }

    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      body?: string;
      noteType?: string;
    };

    const title = cleanText(body.title);
    const noteBody = cleanText(body.body);
    const noteType = cleanText(body.noteType, "General");

    if (!title || !noteBody) {
      return noStoreJson(
        { error: "Note title and body are required." },
        { status: 400 }
      );
    }

    const note = await prisma.advisorNote.create({
      data: {
        userId: user.id,
        clientId: id,
        title: encryptSensitiveText(title) ?? "",
        body: encryptSensitiveText(noteBody) ?? "",
        noteType,
      },
    });

    await recordClientMutation({
      user,
      request,
      clientId: id,
      action: "note.create",
      title: "Client note created",
      detail: "An encrypted note was added to a protected client profile.",
      metadata: {
        noteId: note.id,
        noteType,
        titleLength: title.length,
        bodyLength: noteBody.length,
        vault: vaultStatus(),
      },
    });

    return noStoreJson({
      note: decryptAdvisorNote(note),
      vault: vaultStatus(),
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create client note.",
      },
      { status: 500 }
    );
  }
}