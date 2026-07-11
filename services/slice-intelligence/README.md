# Slice Intelligence Service

This service is the restricted CAMEL-AI orchestration layer used by the Next.js endpoint at `/api/intelligence/forecast`.

It does **not** execute trades, access production databases, run shell commands, deploy code, or expose credentials to agents. When the service is unavailable, the Next.js forecast endpoint continues with Slice's deterministic local simulation and gives CAMEL zero forecast weight.

## Windows setup

Open PowerShell in the repository root:

```powershell
cd services\slice-intelligence
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install --pre -e .
```

Create `services\slice-intelligence\.env` locally. Do not commit it:

```text
OPENAI_API_KEY=replace-locally
SLICE_CAMEL_SERVICE_TOKEN=generate-a-long-random-secret
CAMEL_MODEL_TYPE=GPT_5_MINI
CAMEL_TASK_TIMEOUT_SECONDS=35
ENVIRONMENT=development
LOG_LEVEL=INFO
```

Start the service:

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8100 --reload
```

In the Next.js `.env.local`, add:

```text
CAMEL_AI_SERVICE_URL=http://127.0.0.1:8100
CAMEL_AI_SERVICE_TOKEN=the-same-long-random-secret
CAMEL_AI_TIMEOUT_MS=18000
```

For production, host the service behind HTTPS and use a secret manager. Do not use an HTTP production URL.

## Verify

```powershell
Invoke-RestMethod http://127.0.0.1:8100/health
```

Expected safeguards include:

- `tradingExecutionEnabled: false`
- `sharedMemory: false`
- `credentialsExposedToAgents: false`

The protected workforce endpoint requires the bearer token and a validated `slice-camel-bridge-1.0.0` request.
