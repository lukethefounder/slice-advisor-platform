from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class CamelPolicy(StrictModel):
    decisionSupportOnly: Literal[True]
    autonomousTradingEnabled: Literal[False]
    credentialsExposedToAgents: Literal[False]
    sharedMemory: Literal[False]

    allowedTools: list[str] = Field(
        default_factory=list,
        max_length=20,
    )

    forbiddenTools: list[str] = Field(
        default_factory=list,
        max_length=30,
    )


class EvidenceSnapshot(StrictModel):
    sliceSentimentScore: float = Field(
        ge=0,
        le=100,
    )

    sentimentConfidence: float = Field(
        ge=0,
        le=100,
    )

    dataQuality: float = Field(
        ge=0,
        le=100,
    )

    sourceCount: int = Field(
        ge=0,
        le=100_000,
    )

    independentSourceCount: int = Field(
        ge=0,
        le=100_000,
    )

    duplicateCount: int = Field(
        ge=0,
        le=100_000,
    )

    staleData: bool

    technicals: dict[str, Any]
    fundamentals: dict[str, Any]
    news: dict[str, Any]
    macro: dict[str, Any]
    positioning: dict[str, Any]
    environment: dict[str, Any]
    supplyChain: dict[str, Any]


class CamelBridgeRequest(StrictModel):
    schemaVersion: Literal[
        "slice-camel-bridge-1.0.0"
    ]

    requestId: str = Field(
        min_length=1,
        max_length=100,
    )

    symbol: str = Field(
        pattern=r"^[A-Z0-9.\-]{1,15}$",
    )

    asOf: str = Field(
        min_length=10,
        max_length=40,
    )

    immutableEvidenceSnapshot: EvidenceSnapshot
    policy: CamelPolicy

    @field_validator("requestId")
    @classmethod
    def validate_request_id(
        cls,
        value: str,
    ) -> str:
        allowed = set(
            "abcdefghijklmnopqrstuvwxyz"
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            "0123456789:_-"
        )

        if any(
            character not in allowed
            for character in value
        ):
            raise ValueError(
                "requestId contains unsupported characters"
            )

        return value


class CamelAudit(StrictModel):
    workforceMode: Literal[
        "PIPELINE",
        "FALLBACK",
    ]

    sharedMemory: Literal[False] = False

    tradingExecutionEnabled: Literal[False] = False

    credentialsExposedToAgents: Literal[False] = False

    toolsUsed: list[str] = Field(
        default_factory=list,
        max_length=20,
    )

    agentRoles: list[str] = Field(
        default_factory=list,
        max_length=30,
    )


class CamelBehavioralFeatures(StrictModel):
    schemaVersion: Literal[
        "slice-camel-output-1.0.0"
    ] = "slice-camel-output-1.0.0"

    status: Literal[
        "completed",
        "degraded",
    ]

    generatedAt: str

    modelVersion: str = Field(
        min_length=1,
        max_length=120,
    )

    confidence: float = Field(
        ge=0,
        le=100,
    )

    directionalPressure: float = Field(
        ge=-1,
        le=1,
    )

    agentDisagreement: float = Field(
        ge=0,
        le=100,
    )

    narrativeConcentration: float = Field(
        ge=0,
        le=100,
    )

    reversalRisk: float = Field(
        ge=0,
        le=100,
    )

    contagionRisk: float = Field(
        ge=0,
        le=100,
    )

    liquidityStress: float = Field(
        ge=0,
        le=100,
    )

    institutionalRepricingDelay: float = Field(
        ge=0,
        le=100,
    )

    shortCoveringPotential: float = Field(
        ge=0,
        le=100,
    )

    dominantNarrative: str = Field(
        min_length=1,
        max_length=2_000,
    )

    dominantBuyers: list[str] = Field(
        default_factory=list,
        max_length=5,
    )

    dominantSellers: list[str] = Field(
        default_factory=list,
        max_length=5,
    )

    positiveDrivers: list[str] = Field(
        default_factory=list,
        max_length=8,
    )

    negativeDrivers: list[str] = Field(
        default_factory=list,
        max_length=8,
    )

    contradictions: list[str] = Field(
        default_factory=list,
        max_length=8,
    )

    limitations: list[str] = Field(
        default_factory=list,
        max_length=12,
    )

    audit: CamelAudit


class HealthResponse(StrictModel):
    ok: bool
    service: str
    version: str
    environment: str
    camelInstalled: bool
    modelConfigured: bool
    safeguards: dict[str, bool]