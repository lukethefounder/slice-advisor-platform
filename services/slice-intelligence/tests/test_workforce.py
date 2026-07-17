from fastapi.testclient import (
    TestClient,
)

from pydantic import (
    ValidationError,
)

from app.main import app

from app.models import (
    CamelBridgeRequest,
)

from app.workforce import (
    run_workforce,
)


def sample_payload() -> dict:
    return {
        "schemaVersion": (
            "slice-camel-bridge-1.0.0"
        ),

        "requestId": (
            "MSFT:test-1"
        ),

        "symbol": "MSFT",

        "asOf": (
            "2026-07-10T12:00:00Z"
        ),

        "immutableEvidenceSnapshot": {
            "sliceSentimentScore": 72,

            "sentimentConfidence": 76,

            "dataQuality": 82,

            "sourceCount": 24,

            "independentSourceCount": 11,

            "duplicateCount": 4,

            "staleData": False,

            "technicals": {
                "trendScore": 68,

                "momentumScore": 61,

                "volumeScore": 58,

                "volatility20": 2.4,
            },

            "fundamentals": {
                "quarterlyRevenueGrowthYOY": 0.16,

                "quarterlyEarningsGrowthYOY": 0.21,

                "operatingMargin": 0.31,
            },

            "news": {
                "relevanceWeightedSentiment": 0.18,

                "contradictionScore": 25,
            },

            "macro": {
                "alignmentScore": 55,

                "liquidityScore": 52,

                "stressScore": 28,
            },

            "positioning": {
                "optionsScore": 54,

                "dealerGammaScore": -15,

                "crowdingScore": 48,

                "shortInterestScore": 42,
            },

            "environment": {
                "alignmentScore": 50,

                "disruptionRisk": 12,
            },

            "supplyChain": {
                "resilienceScore": 64,

                "propagationRisk": 22,

                "concentrationRisk": 34,
            },
        },

        "policy": {
            "decisionSupportOnly": True,

            "autonomousTradingEnabled": False,

            "credentialsExposedToAgents": False,

            "sharedMemory": False,

            "allowedTools": [
                (
                    "read_immutable_"
                    "evidence_snapshot"
                ),

                (
                    "calculate_structured_"
                    "behavioral_features"
                ),
            ],

            "forbiddenTools": [
                "broker_execution",
                "shell",
            ],
        },
    }


def sample_request() -> CamelBridgeRequest:
    return (
        CamelBridgeRequest
        .model_validate(
            sample_payload()
        )
    )


def test_fallback_is_bounded_and_safe(
    monkeypatch,
):
    monkeypatch.delenv(
        "OPENAI_API_KEY",
        raising=False,
    )

    result = run_workforce(
        sample_request()
    )

    assert (
        result.status
        == "degraded"
    )

    assert (
        -1
        <= result.directionalPressure
        <= 1
    )

    assert (
        0
        <= result.confidence
        <= 100
    )

    assert (
        result.audit.sharedMemory
        is False
    )

    assert (
        result.audit.tradingExecutionEnabled
        is False
    )

    assert (
        result.audit.credentialsExposedToAgents
        is False
    )

    assert (
        result.audit.workforceMode
        == "FALLBACK"
    )


def test_policy_cannot_enable_trading():
    payload = sample_payload()

    payload["policy"][
        "autonomousTradingEnabled"
    ] = True

    try:
        (
            CamelBridgeRequest
            .model_validate(payload)
        )

    except ValidationError:
        return

    raise AssertionError(
        (
            "Unsafe autonomous-trading "
            "policy was accepted"
        )
    )


def test_health_reports_hard_safeguards():
    with TestClient(app) as client:
        response = client.get(
            "/health"
        )

    assert response.status_code == 200

    payload = response.json()

    assert (
        payload["safeguards"]
        ["tradingExecutionEnabled"]
        is False
    )

    assert (
        payload["safeguards"]
        ["sharedMemory"]
        is False
    )

    assert (
        payload["safeguards"]
        ["credentialsExposedToAgents"]
        is False
    )


def test_analyze_requires_token(
    monkeypatch,
):
    monkeypatch.setenv(
        "SLICE_CAMEL_SERVICE_TOKEN",
        "test-secret",
    )

    with TestClient(app) as client:
        response = client.post(
            "/v1/workforce/analyze",

            json=sample_payload(),
        )

    assert response.status_code == 401


def test_analyze_accepts_valid_token_and_degrades_safely(
    monkeypatch,
):
    monkeypatch.setenv(
        "SLICE_CAMEL_SERVICE_TOKEN",
        "test-secret",
    )

    monkeypatch.delenv(
        "OPENAI_API_KEY",
        raising=False,
    )

    with TestClient(app) as client:
        response = client.post(
            "/v1/workforce/analyze",

            json=sample_payload(),

            headers={
                "Authorization": (
                    "Bearer test-secret"
                )
            },
        )

    assert response.status_code == 200

    payload = response.json()

    assert (
        payload["status"]
        == "degraded"
    )

    assert (
        payload["audit"]
        ["workforceMode"]
        == "FALLBACK"
    )

    assert (
        payload["audit"]
        ["tradingExecutionEnabled"]
        is False
    )