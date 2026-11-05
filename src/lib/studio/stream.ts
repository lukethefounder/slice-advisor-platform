import { StudioError } from "./core";
/** Incremental SSE decoder: handles split UTF-8, CRLF, comments and multi-line data. */
export class SseDecoder {
    private buffer = "";
    push(chunk: string): string[] {
        this.buffer += chunk;
        if (this.buffer.length > 1000000)
            throw new StudioError("STREAM_LIMIT", "The provider stream exceeded its safety limit.", 502);
        const output: string[] = [];
        let match: RegExpExecArray | null;
        while ((match = /\r?\n\r?\n/.exec(this.buffer))) {
            const block = this.buffer.slice(0, match.index);
            this.buffer = this.buffer.slice(match.index + match[0].length);
            const lines = block.split(/\r?\n/).filter(l => l.startsWith("data:")).map(l => l.slice(5).replace(/^ /, ""));
            if (lines.length)
                output.push(lines.join("\n"));
        }
        return output;
    }
    finish(): string[] { return this.buffer.trim() ? this.push("\n\n") : []; }
}
export async function* sseFrames(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<unknown> {
    const reader = body.getReader(), decoder = new TextDecoder(), parser = new SseDecoder();
    const parse = (frame: string) => { if (frame === "[DONE]")
        return null; try {
        return JSON.parse(frame) as unknown;
    }
    catch {
        throw new StudioError("STREAM_FORMAT", "The provider returned an invalid stream event.", 502);
    } };
    let finished = false;
    try {
        while (true) {
            if (signal?.aborted)
                throw new DOMException("Request cancelled", "AbortError");
            const { value, done } = await reader.read();
            if (done)
                break;
            for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
                const event = parse(frame);
                if (event !== null)
                    yield event;
            }
        }
        for (const frame of [...parser.push(decoder.decode()), ...parser.finish()]) {
            const event = parse(frame);
            if (event !== null)
                yield event;
        }
        finished = true;
    }
    finally {
        if (!finished)
            await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}
