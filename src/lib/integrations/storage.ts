import { getOptionalEnv } from "@/lib/env";

export type BlobUploadResult = {
  ok: boolean;
  provider: string;
  status: "uploaded" | "simulated" | "failed" | "missing";
  url?: string;
  pathname?: string;
  error?: string;
};

export async function uploadBackendBlob(input: {
  pathname: string;
  body: string | Buffer | Blob | ArrayBuffer;
  contentType?: string;
  access?: "public" | "private";
}): Promise<BlobUploadResult> {
  const token = getOptionalEnv("BLOB_READ_WRITE_TOKEN");

  if (!token) {
    return {
      ok: false,
      provider: "Vercel Blob",
      status: "missing",
      pathname: input.pathname,
      error: "BLOB_READ_WRITE_TOKEN is missing.",
    };
  }

  try {
    const { put } = await import("@vercel/blob");

    const blob = await put(input.pathname, input.body, {
      access: input.access || (getOptionalEnv("BLOB_ACCESS") === "public" ? "public" : "private"),
      token,
      contentType: input.contentType,
      addRandomSuffix: true,
    });

    return {
      ok: true,
      provider: "Vercel Blob",
      status: "uploaded",
      url: blob.url,
      pathname: blob.pathname,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "Vercel Blob",
      status: "failed",
      pathname: input.pathname,
      error: error instanceof Error ? error.message : "Blob upload failed.",
    };
  }
}