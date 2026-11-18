export class VitalsDedupe {
  private seen = new Map<string, string>();
  accept(metric: { id: string; name: string; value: number; rating?: string; navigationType?: string }, route: string): boolean {
    if (!Number.isFinite(metric.value) || metric.value < 0) return false;
    const key = JSON.stringify([metric.id, metric.name, route]);
    const value = JSON.stringify([metric.value, metric.rating, metric.navigationType]);
    if (this.seen.get(key) === value) return false;
    this.seen.delete(key); this.seen.set(key,value);
    if (this.seen.size > 128) this.seen.delete(this.seen.keys().next().value!);
    return true;
  }
}
