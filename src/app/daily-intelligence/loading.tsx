export default function DailyIntelligenceLoading() {
  return (
    <div className="min-h-dvh bg-[var(--slice-bg,#030811)] px-4 py-12 sm:px-6 lg:px-8" role="status" aria-busy="true">
      <span className="sr-only">Loading daily intelligence</span>
      <div className="mx-auto w-full max-w-[1500px] animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <div className="h-16 rounded-2xl bg-[var(--slice-accent-soft)]" />
        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_0.75fr]">
          <div>
            <div className="h-5 w-48 rounded-full bg-[var(--slice-accent-soft)]" />
            <div className="mt-6 h-14 max-w-3xl rounded-2xl bg-[var(--slice-accent-soft)]" />
            <div className="mt-4 h-28 max-w-4xl rounded-2xl bg-[var(--slice-surface-muted)]" />
          </div>
          <div className="h-72 rounded-[2rem] border border-[var(--slice-border)] bg-[var(--slice-surface)]" />
        </div>
        <div className="mt-12 h-[36rem] rounded-[2rem] border border-[var(--slice-border)] bg-[var(--slice-surface)]" />
      </div>
    </div>
  );
}
