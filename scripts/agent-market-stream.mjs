// Protocol: https://docs.alpaca.markets/docs/streaming-market-data
// This worker only relays observed bid/ask data. It never creates an order.
const CONFIG_PATH = "/api/cron/agent-market";
const REFRESH_MS = 30_000, HEARTBEAT_MS = 10_000, FLUSH_MS = 1_000;
const FETCH_TIMEOUT_MS = 15_000, AUTH_TIMEOUT_MS = 10_000;
const symbolPattern = /^[A-Z][A-Z0-9.-]{0,31}$/;

function validConnections(value) {
  if (value?.ok !== true || !Array.isArray(value.connections) || value.connections.length > 100) throw new Error("Invalid market-stream configuration.");
  const identities = new Set();
  return value.connections.map(item => {
    if (!item || !["paper", "live"].includes(item.mode) || !["iex", "sip"].includes(item.feed) || !Number.isSafeInteger(item.revision) || item.revision < 0
      || ![item.id, item.userId, item.firmId, item.accountId, item.key, item.secret].every(text => typeof text === "string" && text.length > 0 && text.length <= 1024)
      || !Array.isArray(item.symbols) || item.symbols.length === 0 || item.symbols.length > 100 || !item.symbols.every(symbol => typeof symbol === "string" && symbolPattern.test(symbol))) {
      throw new Error("Invalid market-stream connection.");
    }
    if (identities.has(item.id)) throw new Error("Duplicate market-stream identity.");
    identities.add(item.id);
    return { id: item.id, userId: item.userId, firmId: item.firmId, mode: item.mode, key: item.key, secret: item.secret, feed: item.feed, revision: item.revision, accountId: item.accountId, symbols: [...new Set(item.symbols)].sort() };
  });
}

export async function runAgentMarketStreams(config, signal, dependencies = {}) {
  const request = dependencies.fetch || globalThis.fetch, Socket = dependencies.WebSocket === undefined ? globalThis.WebSocket : dependencies.WebSocket;
  const log = dependencies.log || console.log, clock = dependencies.now || Date.now, random = dependencies.random || Math.random;
  const later = dependencies.setTimeout || setTimeout, cancel = dependencies.clearTimeout || clearTimeout;
  const base = new URL(config.origin), local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (!(["http:", "https:"].includes(base.protocol)) || (!local && base.protocol !== "https:") || base.username || base.password || base.search || base.hash || !config.secret) throw new Error("Market streams require the validated Slice worker origin and CRON_SECRET.");
  if (signal.aborted) return;
  if (typeof Socket !== "function") { log("Market streams: Node.js 22 or newer with the built-in WebSocket API is required. Streaming is offline; no synthetic quotes will be generated."); return; }
  const endpoint = new URL(CONFIG_PATH, base.origin), groups = new Map(), controllers = new Set(), requestTimers = new Map();
  let stopped = false, refreshTimer, configFailures = 0, finish;
  const done = new Promise(resolve => { finish = resolve; });
  function cleanTimer(group, key) { if (group.timers[key] !== undefined) cancel(group.timers[key]); group.timers[key] = undefined; }
  function timer(group, key, action, delay) { cleanTimer(group, key); group.timers[key] = later(() => { group.timers[key] = undefined; if (!stopped && !group.stopped) action(); }, Math.max(1, delay)); }
  function active(group) { return !stopped && !group.stopped && groups.get(group.id) === group; }
  function closeSocket(group) { const socket = group.socket; group.socket = null; if (socket) { try { socket.close(); } catch { /* It may already be closed. */ } } cleanTimer(group, "auth"); }
  function abortRequest(controller) { if (!controller) return; controller.abort(); if (requestTimers.has(controller)) cancel(requestTimers.get(controller)); requestTimers.delete(controller); }
  function dispose(group) { group.stopped = true; for (const key of Object.keys(group.timers)) cleanTimer(group, key); closeSocket(group); abortRequest(group.controller); group.quotes.clear(); }
  function stop() {
    if (stopped) return;
    stopped = true; if (refreshTimer !== undefined) cancel(refreshTimer);
    for (const group of groups.values()) dispose(group); groups.clear();
    for (const controller of controllers) abortRequest(controller); controllers.clear();
    signal.removeEventListener("abort", stop); finish();
  }
  signal.addEventListener("abort", stop, { once: true });

  async function call(init, group) {
    const controller = new AbortController(); controllers.add(controller); if (group) group.controller = controller;
    const timeout = later(() => controller.abort(), FETCH_TIMEOUT_MS); requestTimers.set(controller, timeout);
    try { return await request(endpoint, { ...init, redirect: "error", cache: "no-store", signal: controller.signal, headers: { authorization: `Bearer ${config.secret}`, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) } }); }
    finally { cancel(timeout); requestTimers.delete(controller); controllers.delete(controller); if (group?.controller === controller) group.controller = null; }
  }
  function scheduleFlush(group, immediate = false) {
    if (!active(group) || group.configurationStale || group.inFlight || group.timers.flush !== undefined) return;
    const wait = Math.max(immediate ? 1 : FLUSH_MS, group.nextPostAt - clock());
    timer(group, "flush", () => { void flush(group); }, wait);
  }
  function changed(group, status, message = null) { group.status = status; group.message = message; group.version++; scheduleFlush(group, true); }
  async function flush(group) {
    if (!active(group) || group.inFlight) return;
    const version = group.version, quotes = [...group.quotes.values()], state = group.status, message = group.message;
    group.inFlight = true; group.nextPostAt = clock() + FLUSH_MS;
    let failed = false;
    try {
      for (const connection of group.connections) {
        if (!active(group)) return;
        const allowed = new Set(connection.symbols), currentTime = clock();
        // Heartbeats must not keep retransmitting old quote payloads: the
        // server retains those observations and rejects stale new batches.
        const freshPayload = quotes.filter(quote => allowed.has(quote.symbol) && currentTime - Date.parse(quote.receivedAt) <= 45_000 && currentTime - Date.parse(quote.observedAt) <= 90_000);
        const response = await call({ method: "POST", body: JSON.stringify({ id: connection.id, userId: connection.userId, firmId: connection.firmId, revision: connection.revision, feed: connection.feed, status: state, ...(message ? { message } : {}), quotes: freshPayload }) }, group);
        if (!active(group)) return;
        if ([401, 403].includes(response.status)) { log("Market streams: Slice authorization was rejected. Verify CRON_SECRET and restart the worker."); stop(); return; }
        if ([404, 409].includes(response.status)) {
          group.configurationStale = true; group.blocked = true; group.deliveredVersion = group.version;
          for (const key of Object.keys(group.timers)) cleanTimer(group, key); closeSocket(group); return;
        }
        if (!response.ok) throw new Error("Snapshot delivery failed.");
      }
      group.deliveryFailures = 0; group.deliveredVersion = version;
    } catch {
      if (active(group)) {
        failed = true; group.deliveryFailures++; group.nextPostAt = clock() + Math.min(60_000, 5_000 * 2 ** Math.min(group.deliveryFailures - 1, 4));
        if (group.deliveryFailures === 1) log("Market streams: the Slice snapshot endpoint is unavailable. Retaining original quote timestamps while delivery backs off.");
      }
    } finally {
      group.inFlight = false;
      if (active(group) && (failed || group.version !== group.deliveredVersion)) scheduleFlush(group);
    }
  }
  function heartbeat(group) {
    if (!active(group)) return;
    group.version++; scheduleFlush(group); timer(group, "heartbeat", () => heartbeat(group), HEARTBEAT_MS);
  }
  function disconnected(group, reason, permanent = false, minimumDelay = 0) {
    if (!active(group)) return;
    closeSocket(group); changed(group, "error", reason);
    if (permanent) { group.blocked = true; return; }
    group.failures++;
    const backoff = Math.min(60_000, Math.max(minimumDelay, 2_000 * 2 ** Math.min(group.failures - 1, 5)));
    const delay = Math.max(1_000, Math.min(60_000, Math.round(backoff * (.8 + Math.max(0, Math.min(1, random())) * .4))));
    timer(group, "reconnect", () => connect(group), delay);
  }
  function connect(group) {
    if (!active(group) || group.blocked || group.socket) return;
    const source = group.connections[0];
    changed(group, "connecting", "Connecting to the entitled Alpaca quote feed.");
    let socket;
    try { socket = new Socket(`wss://stream.data.alpaca.markets/v2/${source.feed}`); }
    catch { disconnected(group, "The broker quote stream could not be opened."); return; }
    group.socket = socket; let authenticated = false, subscribed = false;
    timer(group, "auth", () => disconnected(group, "The broker did not complete stream authentication in time."), AUTH_TIMEOUT_MS);
    socket.addEventListener("open", () => {
      if (!active(group) || group.socket !== socket) return;
      try { socket.send(JSON.stringify({ action: "auth", key: source.key, secret: source.secret })); }
      catch { disconnected(group, "The broker stream authentication request could not be sent."); }
    });
    socket.addEventListener("message", event => {
      if (!active(group) || group.socket !== socket) return;
      let messages;
      try { if (typeof event.data !== "string" || event.data.length > 4_000_000) throw new Error(); messages = JSON.parse(event.data); if (!Array.isArray(messages)) throw new Error(); }
      catch { disconnected(group, "The broker stream returned an unsupported message format."); return; }
      for (const message of messages) {
        if (!active(group) || group.socket !== socket) break;
        if (message?.T === "success" && message.msg === "authenticated") {
          authenticated = true;
          try { socket.send(JSON.stringify({ action: "subscribe", quotes: [...group.symbols] })); }
          catch { disconnected(group, "The broker quote subscription request could not be sent."); }
        } else if (message?.T === "subscription" && authenticated) {
          const received = new Set(Array.isArray(message.quotes) ? message.quotes : []);
          if ([...group.symbols].some(symbol => !received.has(symbol))) { disconnected(group, "The broker did not authorize the complete requested symbol subscription.", true); continue; }
          subscribed = true; cleanTimer(group, "auth"); changed(group, "live", "Quote subscription acknowledged. Individual quotes retain their own observation times.");
        } else if (message?.T === "error") {
          const code = Number(message.code), permanent = [400, 401, 402, 403, 405, 409, 410].includes(code);
          const safe = [401, 402, 403].includes(code) ? "Broker stream authentication was rejected. Verify the saved API connection."
            : code === 409 ? "The selected market-data feed is not included in the broker account’s entitlement."
              : code === 405 ? "The requested symbols exceed the broker subscription limit. Reduce the research universe."
                : code === 406 ? "The broker stream connection limit is in use. Close another connection or review the data subscription."
                  : "The broker quote stream reported an error. Review its connection and data subscription.";
          disconnected(group, safe, permanent, code === 406 ? 60_000 : 0);
        } else if (message?.T === "q" && authenticated && subscribed && group.symbols.has(message.S)) {
          const observed = typeof message.t === "string" ? Date.parse(message.t) : NaN, received = clock();
          if (![message.bp, message.ap, observed].every(Number.isFinite) || message.bp <= 0 || message.ap <= 0 || message.ap < message.bp || observed > received + 5_000) continue;
          const previous = group.quotes.get(message.S);
          if (previous && (Date.parse(previous.observedAt) > observed || previous.observedAt === message.t && previous.bid === message.bp && previous.ask === message.ap)) continue;
          group.quotes.set(message.S, { symbol: message.S, bid: message.bp, ask: message.ap, observedAt: message.t, receivedAt: new Date(received).toISOString() });
          group.failures = 0; group.version++; scheduleFlush(group);
        }
      }
    });
    socket.addEventListener("error", () => { if (active(group) && group.socket === socket) disconnected(group, "The broker quote stream connection failed."); });
    socket.addEventListener("close", () => { if (active(group) && group.socket === socket) disconnected(group, "The broker quote stream disconnected. Retrying with bounded backoff."); });
  }
  function replace(connections) {
    const desired = new Map();
    for (const connection of connections) {
      // Alpaca limits concurrent streams per account/feed. Reuse one socket when
      // the same account is connected to more than one authorized workspace.
      const id = `${connection.mode}:${connection.accountId}:${connection.feed}`, existing = desired.get(id) || [];
      existing.push(connection); desired.set(id, existing);
    }
    for (const [id, group] of groups) if (!desired.has(id)) { dispose(group); groups.delete(id); }
    for (const [id, members] of desired) {
      members.sort((a, b) => a.id.localeCompare(b.id));
      const signature = JSON.stringify(members), previous = groups.get(id);
      if (previous?.signature === signature && !previous.stopped) continue;
      if (previous) dispose(previous);
      const group = { id, signature, connections: members, symbols: new Set(members.flatMap(item => item.symbols)), socket: null, stopped: false, blocked: false, configurationStale: false, quotes: new Map(), timers: {}, status: "connecting", message: null, version: 0, deliveredVersion: -1, nextPostAt: 0, inFlight: false, failures: 0, deliveryFailures: 0, controller: null };
      groups.set(id, group); connect(group); timer(group, "heartbeat", () => heartbeat(group), HEARTBEAT_MS);
    }
  }
  async function refresh() {
    if (stopped) return;
    let wait = REFRESH_MS;
    try {
      const response = await call({ method: "GET" });
      if (stopped) return;
      if ([401, 403].includes(response.status)) { log("Market streams: Slice authorization was rejected. Verify CRON_SECRET and restart the worker."); stop(); return; }
      if (!response.ok) throw new Error("Configuration request failed.");
      const connections = validConnections(await response.json());
      if (stopped) return;
      configFailures = 0; replace(connections);
    } catch {
      if (stopped) return;
      // Access must remain current. A failed refresh never grants indefinite
      // permission to keep using a previously returned private connection.
      for (const group of groups.values()) dispose(group); groups.clear();
      configFailures++; wait = Math.min(300_000, REFRESH_MS * 2 ** Math.min(configFailures - 1, 4));
      log("Market streams: verified connection settings are unavailable. Streams are closed until access can be checked again.");
    } finally { if (!stopped) refreshTimer = later(() => { refreshTimer = undefined; void refresh(); }, wait); }
  }
  void refresh();
  await done;
}
