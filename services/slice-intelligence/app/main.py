from __future__ import annotations

import asyncio
import hmac
import importlib.util
import logging
import os

from contextlib import (
    asynccontextmanager,
)

from fastapi import (
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Request,
    status,
)

from fastapi.responses import (
    JSONResponse,
)

from .models import (
    CamelBehavioralFeatures,
    CamelBridgeRequest,
    HealthResponse,
)

from .workforce import (
    run_workforce,
)

SERVICE_VERSION = "1.1.0"

MAX_BODY_BYTES = 160_000


def _bounded_int_env(
    name: str,
    fallback: int,
    minimum: int,
    maximum: int,
) -> int:
    try:
        parsed = int(
            os.getenv(
                name,
                str(fallback),
            )
        )

    except ValueError:
        parsed = fallback

    return max(
        minimum,
        min(parsed, maximum),
    )


MAX_CONCURRENT_WORKFORCES = (
    _bounded_int_env(
        "MAX_CONCURRENT_WORKFORCES",
        fallback=2,
        minimum=1,
        maximum=8,
    )
)

WORKFORCE_SEMAPHORE = (
    asyncio.Semaphore(
        MAX_CONCURRENT_WORKFORCES
    )
)

logging.basicConfig(
    level=os.getenv(
        "LOG_LEVEL",
        "INFO",
    ).upper(),

    format=(
        "%(asctime)s "
        "%(levelname)s "
        "%(name)s "
        "%(message)s"
    ),
)

LOGGER = logging.getLogger(
    "slice_intelligence.api"
)


@asynccontextmanager
async def lifespan(
    _: FastAPI,
):
    LOGGER.info(
        (
            "Starting Slice intelligence "
            "service version=%s "
            "environment=%s "
            "concurrency=%s"
        ),

        SERVICE_VERSION,

        os.getenv(
            "ENVIRONMENT",
            "development",
        ),

        MAX_CONCURRENT_WORKFORCES,
    )

    yield

    LOGGER.info(
        "Stopping Slice intelligence service"
    )


is_production = (
    os.getenv(
        "ENVIRONMENT",
        "development",
    ).lower()
    == "production"
)

app = FastAPI(
    title=(
        "Slice Restricted "
        "Intelligence Workforce"
    ),

    version=SERVICE_VERSION,

    docs_url=(
        None
        if is_production
        else "/docs"
    ),

    redoc_url=None,

    openapi_url=(
        None
        if is_production
        else "/openapi.json"
    ),

    lifespan=lifespan,
)


@app.middleware("http")
async def security_middleware(
    request: Request,
    call_next,
):
    content_length = (
        request.headers.get(
            "content-length"
        )
    )

    if content_length:
        try:
            if (
                int(content_length)
                > MAX_BODY_BYTES
            ):
                return JSONResponse(
                    status_code=(
                        status
                        .HTTP_413_REQUEST_ENTITY_TOO_LARGE
                    ),

                    content={
                        "detail": (
                            "Request exceeds "
                            f"{MAX_BODY_BYTES} bytes."
                        )
                    },
                )

        except ValueError:
            return JSONResponse(
                status_code=(
                    status
                    .HTTP_400_BAD_REQUEST
                ),

                content={
                    "detail": (
                        "Invalid Content-Length header."
                    )
                },
            )

    if (
        request.method == "POST"
        and request.url.path
        == "/v1/workforce/analyze"
    ):
        content_type = (
            request.headers.get(
                "content-type",
                "",
            ).lower()
        )

        if (
            "application/json"
            not in content_type
        ):
            return JSONResponse(
                status_code=(
                    status
                    .HTTP_415_UNSUPPORTED_MEDIA_TYPE
                ),

                content={
                    "detail": (
                        "Content-Type must be "
                        "application/json."
                    )
                },
            )

    response = await call_next(
        request
    )

    response.headers[
        "Cache-Control"
    ] = "no-store, max-age=0"

    response.headers[
        "X-Content-Type-Options"
    ] = "nosniff"

    response.headers[
        "Referrer-Policy"
    ] = "no-referrer"

    response.headers[
        "X-Frame-Options"
    ] = "DENY"

    response.headers[
        "Permissions-Policy"
    ] = (
        "camera=(), "
        "microphone=(), "
        "geolocation=()"
    )

    return response


def verify_bearer_token(
    authorization: str | None = Header(
        default=None
    ),
) -> None:
    expected = (
        os.getenv(
            "SLICE_CAMEL_SERVICE_TOKEN",
            "",
        )
        .strip()
    )

    if not expected:
        raise HTTPException(
            status_code=(
                status
                .HTTP_503_SERVICE_UNAVAILABLE
            ),

            detail=(
                "SLICE_CAMEL_SERVICE_TOKEN "
                "is not configured."
            ),
        )

    if (
        not authorization
        or not authorization.startswith(
            "Bearer "
        )
    ):
        raise HTTPException(
            status_code=(
                status
                .HTTP_401_UNAUTHORIZED
            ),

            detail=(
                "Bearer token required."
            ),

            headers={
                "WWW-Authenticate": (
                    "Bearer"
                )
            },
        )

    supplied = (
        authorization
        .removeprefix("Bearer ")
        .strip()
    )

    if (
        not supplied
        or not hmac.compare_digest(
            supplied,
            expected,
        )
    ):
        raise HTTPException(
            status_code=(
                status
                .HTTP_401_UNAUTHORIZED
            ),

            detail=(
                "Invalid bearer token."
            ),

            headers={
                "WWW-Authenticate": (
                    "Bearer"
                )
            },
        )


@app.get(
    "/health",
    response_model=HealthResponse,
)
async def health() -> HealthResponse:
    return HealthResponse(
        ok=True,

        service=(
            "Slice Restricted "
            "Intelligence Workforce"
        ),

        version=SERVICE_VERSION,

        environment=os.getenv(
            "ENVIRONMENT",
            "development",
        ),

        camelInstalled=(
            importlib.util.find_spec(
                "camel"
            )
            is not None
        ),

        modelConfigured=bool(
            os.getenv(
                "OPENAI_API_KEY"
            )
        ),

        safeguards={
            "tradingExecutionEnabled": False,

            "sharedMemory": False,

            "credentialsExposedToAgents": False,

            "arbitraryShellEnabled": False,

            "productionDatabaseWriteEnabled": False,
        },
    )


@app.post(
    "/v1/workforce/analyze",

    response_model=(
        CamelBehavioralFeatures
    ),

    dependencies=[
        Depends(
            verify_bearer_token
        )
    ],
)
async def analyze(
    request: CamelBridgeRequest,
) -> CamelBehavioralFeatures:
    LOGGER.info(
        (
            "Starting restricted workforce "
            "request_id=%s symbol=%s as_of=%s"
        ),

        request.requestId,

        request.symbol,

        request.asOf,
    )

    async with WORKFORCE_SEMAPHORE:
        result = await asyncio.to_thread(
            run_workforce,
            request,
        )

    LOGGER.info(
        (
            "Completed restricted workforce "
            "request_id=%s status=%s mode=%s"
        ),

        request.requestId,

        result.status,

        result.audit.workforceMode,
    )

    return result