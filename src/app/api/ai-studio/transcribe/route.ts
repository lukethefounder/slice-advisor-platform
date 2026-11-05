import { studioAccess, failure, PRIVATE_HEADERS, limitedBytes } from "@/lib/studio/request";
import { acquireOperation } from "@/lib/studio/store";
import { transcribe } from "@/lib/studio/provider";
import { STUDIO_LIMITS } from "@/lib/studio/contracts";
import { StudioError } from "@/lib/studio/core";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
    let lease: Awaited<ReturnType<typeof acquireOperation>> | null = null;
    try {
        const scope = await studioAccess(request, true), type = request.headers.get("content-type") || "";
        if (!type.toLowerCase().startsWith("multipart/form-data;"))
            throw new StudioError("AUDIO_TYPE", "Send a microphone recording as multipart/form-data.", 415);
        const bytes = await limitedBytes(request, STUDIO_LIMITS.audioBytes + 20000);
        const form = await new Response(bytes.buffer as ArrayBuffer, { headers: { "content-type": type } }).formData();
        const file = form.get("audio");
        if (!(file instanceof File) || file.size < 1 || file.size > STUDIO_LIMITS.audioBytes || !/^audio\/(webm|mp4|mpeg|wav|x-wav|ogg)(;|$)/i.test(file.type))
            throw new StudioError("AUDIO_INVALID", "Use a supported microphone recording of no more than 3 MB.", 415);
        lease = await acquireOperation(scope, "transcribe");
        const result = await transcribe(file, AbortSignal.any([request.signal, AbortSignal.timeout(45000)]));
        return Response.json({ ok: true, ...result, autoSent: false }, { headers: PRIVATE_HEADERS });
    }
    catch (e) {
        if (e instanceof Error && ["AbortError", "TimeoutError"].includes(e.name))
            return failure(new StudioError("AUDIO_TIMEOUT", "Transcription timed out or was cancelled. Type the message or retry the recording.", 504));
        return failure(e);
    }
    finally {
        await lease?.release().catch(() => undefined);
    }
}
