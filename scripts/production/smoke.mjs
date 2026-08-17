import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const port = Number(process.env.SLICE_SMOKE_PORT || 3107);
const origin = `http://127.0.0.1:${port}`;
const command = isWindows ? "npm.cmd" : "npm";

const child = spawn(command, ["run", "start", "--", "-p", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: "production",
  },
  detached: !isWindows,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";

child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});

child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

function delay(milliseconds) {
  return new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds),
  );
}

function killPosixProcessGroup(signal) {
  if (!child.pid) return;

  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") {
      throw error;
    }
  }
}

async function killWindowsProcessTree() {
  if (!child.pid) return;

  await new Promise((resolvePromise) => {
    const killer = spawn(
      "taskkill",
      ["/PID", String(child.pid), "/T", "/F"],
      {
        stdio: "ignore",
        windowsHide: true,
      },
    );

    killer.once("error", resolvePromise);
    killer.once("exit", resolvePromise);
  });
}

async function stopServer() {
  try {
    if (isWindows) {
      await killWindowsProcessTree();
    } else {
      /*
       * The smoke server is launched in its own process group on Linux.
       * Kill the entire group rather than only the npm wrapper process.
       */
      killPosixProcessGroup("SIGTERM");
      await delay(750);
      killPosixProcessGroup("SIGKILL");
    }
  } finally {
    /*
     * Destroy inherited pipes so a surviving descendant cannot keep
     * the smoke-test Node process alive.
     */
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.unref();
  }
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/api/health/live`, {
        redirect: "manual",
      });

      if (response.ok) {
        return;
      }
    } catch {
      // The production server is still starting.
    }

    await delay(500);
  }

  throw new Error(
    `Slice did not start within 45 seconds.\n${output.slice(-4_000)}`,
  );
}

const assertions = [];

function check(condition, message) {
  if (!condition) {
    throw new Error(message);
  }

  assertions.push(message);
}

try {
  await waitForServer();

  const live = await fetch(`${origin}/api/health/live`);

  check(live.status === 200, "Liveness returns HTTP 200");

  const liveBody = await live.json();

  check(liveBody.ok === true, "Liveness body reports ok");

  check(
    Boolean(live.headers.get("x-request-id")),
    "Liveness includes request ID",
  );

  check(
    Boolean(
      live.headers.get("content-security-policy") ||
        live.headers.get("content-security-policy-report-only"),
    ),
    "Responses include a Content Security Policy",
  );

  check(
    live.headers.get("x-content-type-options") === "nosniff",
    "MIME sniffing is disabled",
  );

  const ready = await fetch(`${origin}/api/health/ready`);

  check(
    ready.status === 200,
    "Readiness returns HTTP 200 in the clean test environment",
  );

  const home = await fetch(`${origin}/`);

  check(home.status === 200, "Public homepage returns HTTP 200");

  const protectedApi = await fetch(`${origin}/api/jobs`, {
    redirect: "manual",
  });

  check(
    protectedApi.status === 401,
    "Protected API rejects an unauthenticated request",
  );

  const workspace = await fetch(`${origin}/workspace`, {
    redirect: "manual",
  });

  check(
    [307, 308].includes(workspace.status),
    "Protected workspace redirects to login",
  );

  const blocked = await fetch(`${origin}/.env`, {
    redirect: "manual",
  });

  check(blocked.status === 404, "Suspicious .env path is hidden");

  const metric = await fetch(`${origin}/api/operations/web-vitals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      metricId: `smoke-${Date.now()}`,
      name: "LCP",
      value: 1200,
      rating: "good",
      route: "/smoke/:id",
      navigationType: "navigate",
      sessionId: "smoke-session",
      deviceClass: "desktop",
      connectionType: "4g",
    }),
  });

  check(
    metric.status === 202,
    "Web Vitals ingestion accepts a valid sample",
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        test: "production-smoke",
        assertions: assertions.length,
        origin,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await stopServer();
}