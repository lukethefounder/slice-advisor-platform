/** Bounded request coalescing. Values are not retained after work settles. */
export class FlightCapacityError extends Error {
  constructor() { super("The provider queue is busy. Retry shortly."); this.name = "FlightCapacityError"; }
}
export class FlightPool<T> {
  private entries = new Map<string, Promise<T>>();
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private concurrency = 3, private capacity = 48) {}
  has(key: string) { return this.entries.has(key); }
  get size() { return this.entries.size; }
  run(key: string, work: () => Promise<T>): Promise<T> {
    const current = this.entries.get(key);
    if (current) return current;
    if (this.entries.size >= this.capacity) return Promise.reject(new FlightCapacityError());
    let resolve!: (value: T | PromiseLike<T>) => void, reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    this.entries.set(key, promise);
    const start = () => {
      this.active++;
      Promise.resolve().then(work).then(resolve, reject).finally(() => {
        if (this.entries.get(key) === promise) this.entries.delete(key);
        this.active--;
        this.waiting.shift()?.();
      });
    };
    if (this.active < this.concurrency) start(); else this.waiting.push(start);
    return promise;
  }
}
/** Cancels this subscriber, not work shared with a different authenticated request. */
export function subscribe<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const stop = () => { signal.removeEventListener("abort", stop); reject(signal.reason ?? new DOMException("Aborted", "AbortError")); };
    // Always attach a rejection handler, including when this caller is already aborted.
    work.then(value => { signal.removeEventListener("abort", stop); if (!signal.aborted) resolve(value); }, error => { signal.removeEventListener("abort", stop); if (!signal.aborted) reject(error); });
    if (signal.aborted) { stop(); return; }
    signal.addEventListener("abort", stop, { once: true });
  });
}
