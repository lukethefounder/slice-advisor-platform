export type RequestErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
  renderType?: string;
};

export type InstrumentationRequest = {
  path?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

/**
 * Next.js loads this module for both the Node.js and Edge runtimes.
 * Keep it runtime-neutral and import runtime-specific implementations only
 * after NEXT_RUNTIME has been resolved by Next.js.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeInstrumentation } = await import(
      "./instrumentation-node"
    );

    await registerNodeInstrumentation();
    return;
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const { registerEdgeInstrumentation } = await import(
      "./instrumentation-edge"
    );

    registerEdgeInstrumentation();
  }
}

export async function onRequestError(
  error: unknown,
  request: InstrumentationRequest,
  context: RequestErrorContext,
) {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { onNodeRequestError } = await import("./instrumentation-node");

    await onNodeRequestError(error, request, context);
    return;
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const { onEdgeRequestError } = await import("./instrumentation-edge");

    onEdgeRequestError(error, request, context);
  }
}