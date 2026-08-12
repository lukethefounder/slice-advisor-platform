import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";

import { ApiError } from "@/lib/api-route";
import {
  DOCUMENT_ALLOWED_CONTENT_TYPES,
} from "@/lib/document-center/contracts";
import {
  documentServiceError,
  finalizeDocumentUploadFromToken,
  prepareDocumentUpload,
} from "@/lib/document-center/service";
import {
  documentPathIsAllowed,
  sanitiseDocumentFileName,
} from "@/lib/document-center/storage";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function parseClientPayload(
  value: string | null | undefined,
) {
  if (!value) {
    throw new ApiError({
      status: 400,
      code: "DOCUMENT_UPLOAD_DECLARATION_MISSING",
      message: "Document upload information is missing.",
      expose: true,
    });
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new ApiError({
      status: 400,
      code: "DOCUMENT_UPLOAD_DECLARATION_INVALID",
      message: "Document upload information is invalid.",
      expose: true,
    });
  }
}

export async function POST(request: Request) {
  if (
    isPotentiallyCrossSiteUnsafeRequest(
      request,
    )
  ) {
    return Response.json(
      {
        error:
          "Security policy blocked this upload request.",
      },
      {
        status: 403,
      },
    );
  }

  const body = (await request
    .json()
    .catch(
      () => null,
    )) as HandleUploadBody | null;

  if (!body) {
    return Response.json(
      {
        error:
          "The upload request is invalid.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const response =
      await handleUpload({
        body,
        request,

        onBeforeGenerateToken:
          async (
            pathname: string,
            clientPayload:
              | string
              | null
              | undefined,
          ) => {
            if (
              !documentPathIsAllowed(
                pathname,
              )
            ) {
              throw new ApiError({
                status: 400,
                code:
                  "DOCUMENT_STORAGE_PATH_INVALID",
                message:
                  "The document upload path is invalid.",
                expose: true,
              });
            }

            const prepared =
              await prepareDocumentUpload(
                {
                  declaration:
                    parseClientPayload(
                      clientPayload,
                    ),
                },
              );

            const rate =
              checkRateLimit({
                key: `document-upload:${prepared.actor.kind}:${prepared.actor.actorId}:${hashForSecurity(
                  getClientIp(
                    request,
                  ),
                )}`,

                limit:
                  prepared.actor
                    .kind ===
                  "client"
                    ? 20
                    : 40,

                windowMs:
                  60_000,
              });

            if (!rate.allowed) {
              throw new ApiError({
                status: 429,
                code:
                  "DOCUMENT_UPLOAD_RATE_LIMITED",
                message:
                  "Too many document upload attempts. Try again shortly.",
                expose: true,
                details: {
                  retryAfterSeconds:
                    rate.retryAfterSeconds,
                },
              });
            }

            const expectedFileName =
              sanitiseDocumentFileName(
                prepared
                  .declaration
                  .originalFileName,
              ).toLowerCase();

            if (
              !pathname
                .toLowerCase()
                .endsWith(
                  expectedFileName,
                )
            ) {
              throw new ApiError({
                status: 400,
                code:
                  "DOCUMENT_UPLOAD_PATH_MISMATCH",
                message:
                  "The document upload path does not match its file name.",
                expose: true,
              });
            }

            return {
              allowedContentTypes:
                [
                  ...DOCUMENT_ALLOWED_CONTENT_TYPES,
                ],

              maximumSizeInBytes:
                prepared
                  .maximumSizeInBytes,

              addRandomSuffix:
                true,

              tokenPayload:
                prepared
                  .tokenPayload,
            };
          },

        /*
         * Do not manually narrow this parameter type.
         *
         * @vercel/blob defines tokenPayload as optional, so allowing
         * handleUpload to infer the callback contract prevents the
         * incompatible-function-parameter error.
         */
        onUploadCompleted:
          async ({
            blob,
            tokenPayload,
          }) => {
            /*
             * Slice requires the trusted token even though the SDK
             * allows applications that do not use one.
             */
            if (!tokenPayload) {
              throw new ApiError({
                status: 400,
                code:
                  "DOCUMENT_UPLOAD_TOKEN_MISSING",
                message:
                  "The completed upload is missing its authorization token.",
                expose: true,
              });
            }

            /*
             * PutBlobResult structurally satisfies Slice's internal
             * document-blob reference. The document service performs
             * the authoritative private Blob lookup before registering
             * size, type, ETag, processing, and audit information.
             */
            await finalizeDocumentUploadFromToken(
              {
                tokenPayload,
                blob,
              },
            );
          },
      });

    return Response.json(
      response,
      {
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    const status =
      error instanceof ApiError
        ? error.status
        : 500;

    return Response.json(
      {
        error:
          documentServiceError(
            error,
          ),
      },
      {
        status,

        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  }
}