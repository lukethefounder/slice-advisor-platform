from __future__ import annotations

import json
import logging
import math
import os
import re
from datetime import datetime, timezone
from typing import Any

from .models import (
    CamelBehavioralFeatures,
    CamelBridgeRequest,
)

LOGGER = logging.getLogger(
    "slice_intelligence.workforce"
)

AGENT_ROLES = [
    "Market Data and Microstructure Agent",
    "Fundamental and Valuation Agent",
    "Macro Regime Agent",
    "Options and Positioning Agent",
    "Environmental and Geographic Risk Agent",
    "Supply-Chain Propagation Agent",
    "Contradiction and Source-Independence Agent",
    "Historical Analogy Agent",
    "Scenario Simulation Designer",
    "Risk and Red-Team Agent",
    "Explanation and Structured Aggregation Agent",
]


def _clamp(
    value: float,
    minimum: float,
    maximum: float,
) -> float:
    if not math.isfinite(value):
        return minimum

    return max(
        minimum,
        min(maximum, value),
    )


def _number(
    mapping: dict[str, Any],
    key: str,
    fallback: float = 0.0,
) -> float:
    try:
        value = float(
            mapping.get(key, fallback)
        )
    except (TypeError, ValueError):
        return fallback

    return (
        value
        if math.isfinite(value)
        else fallback
    )


def _score_signal(
    value: float,
) -> float:
    return _clamp(
        (value - 50.0) / 50.0,
        -1.0,
        1.0,
    )


def _utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _fallback_features(
    request: CamelBridgeRequest,
    reason: str,
) -> CamelBehavioralFeatures:
    evidence = (
        request.immutableEvidenceSnapshot
    )

    technicals = evidence.technicals
    fundamentals = evidence.fundamentals
    news = evidence.news
    macro = evidence.macro
    positioning = evidence.positioning
    environment = evidence.environment
    supply_chain = evidence.supplyChain

    technical_signal = (
        _score_signal(
            _number(
                technicals,
                "trendScore",
                50,
            )
        )
        * 0.45
        + _score_signal(
            _number(
                technicals,
                "momentumScore",
                50,
            )
        )
        * 0.35
        + _score_signal(
            _number(
                technicals,
                "volumeScore",
                50,
            )
        )
        * 0.20
    )

    news_signal = _clamp(
        _number(
            news,
            "relevanceWeightedSentiment",
            0,
        ),
        -1,
        1,
    )

    fundamental_signal = (
        _clamp(
            _number(
                fundamentals,
                "quarterlyRevenueGrowthYOY",
                0,
            )
            / 0.30,
            -1,
            1,
        )
        * 0.35
        + _clamp(
            _number(
                fundamentals,
                "quarterlyEarningsGrowthYOY",
                0,
            )
            / 0.40,
            -1,
            1,
        )
        * 0.35
        + _clamp(
            _number(
                fundamentals,
                "operatingMargin",
                0,
            )
            / 0.30,
            -1,
            1,
        )
        * 0.30
    )

    macro_signal = (
        _score_signal(
            _number(
                macro,
                "alignmentScore",
                50,
            )
        )
        * 0.45
        + _score_signal(
            _number(
                macro,
                "liquidityScore",
                50,
            )
        )
        * 0.30
        - _number(
            macro,
            "stressScore",
            30,
        )
        / 100
        * 0.35
    )

    positioning_signal = (
        _score_signal(
            _number(
                positioning,
                "optionsScore",
                50,
            )
        )
        * 0.45
        + _clamp(
            _number(
                positioning,
                "dealerGammaScore",
                0,
            )
            / 100,
            -1,
            1,
        )
        * 0.30
        - _number(
            positioning,
            "crowdingScore",
            40,
        )
        / 100
        * 0.25
    )

    environmental_signal = (
        _score_signal(
            _number(
                environment,
                "alignmentScore",
                50,
            )
        )
        * 0.45
        - _number(
            environment,
            "disruptionRisk",
            20,
        )
        / 100
        * 0.55
    )

    supply_signal = (
        _score_signal(
            _number(
                supply_chain,
                "resilienceScore",
                50,
            )
        )
        * 0.50
        - _number(
            supply_chain,
            "propagationRisk",
            30,
        )
        / 100
        * 0.30
        - _number(
            supply_chain,
            "concentrationRisk",
            30,
        )
        / 100
        * 0.20
    )

    slice_signal = _score_signal(
        evidence.sliceSentimentScore
    )

    signals = {
        "Slice Sentiment": slice_signal,
        "Technical": technical_signal,
        "Fundamental": fundamental_signal,
        "News": news_signal,
        "Macro": macro_signal,
        "Options and Positioning": positioning_signal,
        "Environmental": environmental_signal,
        "Supply Chain": supply_signal,
    }

    directional_pressure = _clamp(
        sum(signals.values())
        / len(signals),
        -1,
        1,
    )

    sorted_factors = sorted(
        signals.items(),
        key=lambda item: abs(item[1]),
        reverse=True,
    )

    positive = [
        f"{name} is supportive."
        for name, value
        in sorted_factors
        if value > 0.15
    ][:8]

    negative = [
        f"{name} is adverse."
        for name, value
        in sorted_factors
        if value < -0.15
    ][:8]

    disagreement_values = list(
        signals.values()
    )

    mean = (
        sum(disagreement_values)
        / len(disagreement_values)
    )

    variance = sum(
        (value - mean) ** 2
        for value
        in disagreement_values
    ) / len(disagreement_values)

    disagreement = _clamp(
        math.sqrt(variance) * 100,
        0,
        100,
    )

    contradiction = _number(
        news,
        "contradictionScore",
        20,
    )

    liquidity_stress = _clamp(
        _number(
            macro,
            "stressScore",
            30,
        )
        * 0.45
        + _number(
            positioning,
            "crowdingScore",
            40,
        )
        * 0.25
        + _number(
            technicals,
            "volatility20",
            2.5,
        )
        * 4,
        0,
        100,
    )

    short_covering = _clamp(
        _number(
            positioning,
            "shortInterestScore",
            30,
        )
        * max(
            directional_pressure,
            0,
        )
        + max(
            -_number(
                positioning,
                "dealerGammaScore",
                0,
            ),
            0,
        )
        * 0.35,
        0,
        100,
    )

    contagion = _clamp(
        _number(
            supply_chain,
            "propagationRisk",
            30,
        )
        * 0.50
        + _number(
            environment,
            "disruptionRisk",
            20,
        )
        * 0.25
        + liquidity_stress
        * 0.25,
        0,
        100,
    )

    reversal = _clamp(
        contradiction * 0.40
        + disagreement * 0.35
        + abs(
            news_signal
            - technical_signal
        )
        * 25,
        0,
        100,
    )

    dominant_factor, dominant_value = (
        sorted_factors[0]
    )

    dominant_narrative = (
        f"{dominant_factor} is the dominant "
        f"{'supportive' if dominant_value >= 0 else 'adverse'} "
        "behavioral narrative in the supplied evidence snapshot."
    )

    contradictions: list[str] = []

    if contradiction >= 50:
        contradictions.append(
            "The evidence snapshot contains material claim contradictions."
        )

    if (
        technical_signal
        * fundamental_signal
        < 0
        and abs(
            technical_signal
            - fundamental_signal
        )
        > 0.6
    ):
        contradictions.append(
            "Technical and fundamental participant reactions materially disagree."
        )

    if (
        news_signal
        * positioning_signal
        < 0
        and abs(
            news_signal
            - positioning_signal
        )
        > 0.6
    ):
        contradictions.append(
            "News direction conflicts with options and positioning behavior."
        )

    if evidence.staleData:
        contradictions.append(
            "The point-in-time snapshot contains stale inputs."
        )

    return CamelBehavioralFeatures(
        status="degraded",

        generatedAt=_utc_now(),

        modelVersion=(
            "deterministic-camel-"
            "fallback-1.1.0"
        ),

        confidence=_clamp(
            evidence.dataQuality
            * 0.45
            + evidence.sentimentConfidence
            * 0.25
            + (
                100
                - disagreement
            )
            * 0.20
            - (
                15
                if evidence.staleData
                else 0
            ),
            0,
            85,
        ),

        directionalPressure=(
            directional_pressure
        ),

        agentDisagreement=(
            disagreement
        ),

        narrativeConcentration=_clamp(
            abs(dominant_value) * 100,
            0,
            100,
        ),

        reversalRisk=reversal,

        contagionRisk=contagion,

        liquidityStress=(
            liquidity_stress
        ),

        institutionalRepricingDelay=_clamp(
            45
            + contradiction * 0.25
            - abs(
                fundamental_signal
            )
            * 15,
            0,
            100,
        ),

        shortCoveringPotential=(
            short_covering
        ),

        dominantNarrative=(
            dominant_narrative
        ),

        dominantBuyers=[
            name
            for name, signal
            in [
                (
                    "Momentum traders",
                    technical_signal,
                ),
                (
                    "Value investors",
                    fundamental_signal,
                ),
                (
                    "Macro funds",
                    macro_signal,
                ),
                (
                    "Options-sensitive funds",
                    positioning_signal,
                ),
            ]
            if signal > 0.15
        ][:5],

        dominantSellers=[
            name
            for name, signal
            in [
                (
                    "Momentum traders",
                    technical_signal,
                ),
                (
                    "Fundamental short sellers",
                    fundamental_signal,
                ),
                (
                    "Macro risk reducers",
                    macro_signal,
                ),
                (
                    "Volatility-sensitive dealers",
                    positioning_signal,
                ),
            ]
            if signal < -0.15
        ][:5],

        positiveDrivers=positive,

        negativeDrivers=negative,

        contradictions=contradictions,

        limitations=[
            reason,

            (
                "The fallback uses deterministic role proxies "
                "rather than live language-model agents."
            ),

            (
                "Behavioral features are scenario evidence "
                "and cannot reveal actual institutional positions."
            ),
        ],

        audit={
            "workforceMode": "FALLBACK",

            "sharedMemory": False,

            "tradingExecutionEnabled": False,

            "credentialsExposedToAgents": False,

            "toolsUsed": [],

            "agentRoles": AGENT_ROLES,
        },
    )


def _extract_json(
    value: str,
) -> dict[str, Any]:
    stripped = value.strip()

    if stripped.startswith("```"):
        stripped = re.sub(
            r"^```(?:json)?\s*",
            "",
            stripped,
            flags=re.IGNORECASE,
        )

        stripped = re.sub(
            r"\s*```$",
            "",
            stripped,
        )

    try:
        parsed = json.loads(
            stripped
        )

        if isinstance(
            parsed,
            dict,
        ):
            return parsed

    except json.JSONDecodeError:
        pass

    start = stripped.find("{")

    if start < 0:
        raise ValueError(
            "CAMEL result did not contain JSON"
        )

    depth = 0
    in_string = False
    escaped = False

    for index in range(
        start,
        len(stripped),
    ):
        character = stripped[index]

        if in_string:
            if escaped:
                escaped = False

            elif character == "\\":
                escaped = True

            elif character == '"':
                in_string = False

            continue

        if character == '"':
            in_string = True

        elif character == "{":
            depth += 1

        elif character == "}":
            depth -= 1

            if depth == 0:
                parsed = json.loads(
                    stripped[
                        start:
                        index + 1
                    ]
                )

                if not isinstance(
                    parsed,
                    dict,
                ):
                    raise ValueError(
                        "CAMEL JSON result must be an object"
                    )

                return parsed

    raise ValueError(
        "CAMEL result contained incomplete JSON"
    )


def _system_message(
    role: str,
    focus: str,
) -> str:
    return f"""
You are the {role} inside Slice, a financial decision-support platform.

Your focus: {focus}

Hard rules:
- Analyze only the immutable evidence snapshot provided in the task.
- Never claim access to real positions, hidden dealer books, credentials, production databases, or live trading.
- Never execute trades, deploy code, call a shell, browse the web, or invent citations.
- Separate observed evidence from inference.
- Treat simulated-agent behavior as scenario evidence, not truth.
- Return concise structured reasoning that another agent can audit.
- Explicitly reduce confidence for missing, stale, contradictory, or low-independence evidence.
""".strip()


def _evidence_json(
    request: CamelBridgeRequest,
) -> str:
    return json.dumps(
        request
        .immutableEvidenceSnapshot
        .model_dump(mode="json"),

        separators=(",", ":"),

        sort_keys=True,
    )


def _pipeline_tasks(
    request: CamelBridgeRequest,
) -> tuple[
    str,
    list[str],
    str,
]:
    evidence_json = _evidence_json(
        request
    )

    validate_task = f"""
Validate this immutable point-in-time evidence snapshot for {request.symbol} as of {request.asOf}.

Identify missing, stale, duplicated, contradictory, or low-independence evidence.
Do not add external facts.

Return a compact evidence-quality memo that preserves all material caveats.

EVIDENCE_SNAPSHOT_JSON:
{evidence_json}
""".strip()

    parallel_tasks = [
        (
            "Analyze market data, microstructure, trend, momentum, "
            "volume, liquidity, and volatility behavior. "
            f"Evidence: {evidence_json}"
        ),

        (
            "Analyze fundamentals, valuation, quality, growth, "
            "and likely institutional repricing speed. "
            f"Evidence: {evidence_json}"
        ),

        (
            "Analyze macro regime, liquidity, stress, surprises, "
            "and cross-asset dominance risk. "
            f"Evidence: {evidence_json}"
        ),

        (
            "Analyze options, dealer gamma, skew, crowding, "
            "short interest, hedging ambiguity, and "
            "short-covering risk. "
            f"Evidence: {evidence_json}"
        ),

        (
            "Analyze environmental, geographic, facility, "
            "and supply-chain propagation paths and "
            "second-order contagion. "
            f"Evidence: {evidence_json}"
        ),

        (
            "Analyze contradictions, source independence, "
            "narrative concentration, manipulation risk, "
            "and false confirmation. "
            f"Evidence: {evidence_json}"
        ),

        (
            "Design heterogeneous participant reactions, "
            "information delays, liquidity feedback, reversals, "
            "and bullish and bearish tail paths. "
            f"Evidence: {evidence_json}"
        ),

        (
            "Red-team all conclusions for overconfidence, "
            "correlated-agent errors, false precision, missing data, "
            "and regime breaks. "
            f"Evidence: {evidence_json}"
        ),
    ]

    join_task = _final_task_prompt(
        request
    )

    return (
        validate_task,
        parallel_tasks,
        join_task,
    )


def _final_task_prompt(
    request: CamelBridgeRequest,
) -> str:
    evidence_json = _evidence_json(
        request
    )

    return f"""
Synthesize the pipeline results and this immutable Slice evidence snapshot for {request.symbol} as of {request.asOf}.

EVIDENCE_SNAPSHOT_JSON:
{evidence_json}

Return ONLY one valid JSON object with these exact fields:

{{
  "schemaVersion": "slice-camel-output-1.0.0",
  "status": "completed",
  "generatedAt": "ISO-8601 UTC timestamp",
  "modelVersion": "camel-ai-workforce-1.1.0",
  "confidence": 0-100,
  "directionalPressure": -1.0 to 1.0,
  "agentDisagreement": 0-100,
  "narrativeConcentration": 0-100,
  "reversalRisk": 0-100,
  "contagionRisk": 0-100,
  "liquidityStress": 0-100,
  "institutionalRepricingDelay": 0-100,
  "shortCoveringPotential": 0-100,
  "dominantNarrative": "string",
  "dominantBuyers": ["maximum 5 strings"],
  "dominantSellers": ["maximum 5 strings"],
  "positiveDrivers": ["maximum 8 strings"],
  "negativeDrivers": ["maximum 8 strings"],
  "contradictions": ["maximum 8 strings"],
  "limitations": ["maximum 12 strings"],
  "audit": {{
    "workforceMode": "PIPELINE",
    "sharedMemory": false,
    "tradingExecutionEnabled": false,
    "credentialsExposedToAgents": false,
    "toolsUsed": [],
    "agentRoles": {json.dumps(AGENT_ROLES)}
  }}
}}

Do not output markdown.

Do not convert the Slice Sentiment Score directly into a probability.

Do not claim this simulated behavior reveals actual positions or guarantees future returns.
""".strip()


def _read_timeout_seconds() -> float:
    try:
        raw = float(
            os.getenv(
                "CAMEL_TASK_TIMEOUT_SECONDS",
                "35",
            )
        )
    except ValueError:
        raw = 35.0

    return _clamp(
        raw,
        10,
        120,
    )


def run_workforce(
    request: CamelBridgeRequest,
) -> CamelBehavioralFeatures:
    """
    Lightweight CAMEL execution mode.

    This uses one restricted CAMEL ChatAgent instead of the
    larger Workforce pipeline. It is faster, cheaper, and less
    likely to time out while the integration is being validated.
    """

    if not os.getenv("OPENAI_API_KEY"):
        return _fallback_features(
            request,
            "OPENAI_API_KEY is not configured for the CAMEL service.",
        )

    try:
        from camel.agents import ChatAgent
        from camel.models import ModelFactory
        from camel.types import ModelPlatformType, ModelType

        model_name = (
            os.getenv(
                "CAMEL_MODEL_TYPE",
                "GPT_5_MINI",
            )
            .strip()
            .upper()
        )

        model_type = getattr(
            ModelType,
            model_name,
            ModelType.GPT_5_MINI,
        )

        model = ModelFactory.create(
            model_platform=ModelPlatformType.OPENAI,
            model_type=model_type,
        )

        agent = ChatAgent(
            system_message=_system_message(
                "Slice Market Intelligence Agent",
                (
                    "Analyze the immutable financial evidence snapshot, "
                    "identify likely participant behavior, contradictions, "
                    "liquidity risk, reversal risk, contagion risk, and "
                    "short-covering potential. Return only the requested "
                    "structured JSON. Never execute trades or invent data."
                ),
            ),
            model=model,
            tools=[],
        )

        prompt = _final_task_prompt(request)

        response = agent.step(prompt)

        if not response.msgs:
            raise RuntimeError(
                "CAMEL agent returned no messages."
            )

        result_text = response.msgs[0].content or ""

        if not result_text.strip():
            raise RuntimeError(
                "CAMEL agent returned an empty response."
            )

        parsed = _extract_json(result_text)

        parsed["schemaVersion"] = (
            "slice-camel-output-1.0.0"
        )

        parsed["status"] = "completed"

        parsed["generatedAt"] = _utc_now()

        parsed["modelVersion"] = (
            f"camel-ai-{model_name.lower()}-lightweight-1.0.0"
        )

        parsed["audit"] = {
            "workforceMode": "PIPELINE",
            "sharedMemory": False,
            "tradingExecutionEnabled": False,
            "credentialsExposedToAgents": False,
            "toolsUsed": [],
            "agentRoles": [
                "Slice Market Intelligence Agent",
                "Risk and Red-Team Analysis",
                "Structured Explanation Agent",
            ],
        }

        return CamelBehavioralFeatures.model_validate(
            parsed
        )

    except Exception as exc:
        LOGGER.exception(
            "Lightweight CAMEL execution failed"
        )

        return _fallback_features(
            request,
            f"Lightweight CAMEL execution failed safely: {exc}",
        )