export default function MarketsLoading() {
  return (
    <div className="min-h-dvh bg-[var(--slice-bg,#030811)] px-4 py-10 sm:px-6 lg:px-8" role="status" aria-busy="true">
      <span className="sr-only">Loading market research</span>
      <div className="mx-auto w-full max-w-[1500px] animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <div className="h-16 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface)]" />
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="h-7 w-52 rounded-full bg-[var(--slice-accent-soft)]" />
            <div className="mt-6 h-14 w-full max-w-2xl rounded-2xl bg-[var(--slice-accent-soft)]" />
            <div className="mt-4 h-14 w-4/5 rounded-2xl bg-[var(--slice-accent-soft)]" />
            <div className="mt-6 h-24 w-full rounded-2xl bg-[var(--slice-surface)]" />
          </div>
          <div className="h-80 rounded-[2rem] border border-[var(--slice-border)] bg-[var(--slice-surface)]" />
        </div>
        <div className="mt-14 h-[34rem] rounded-[2rem] border border-[var(--slice-border)] bg-[var(--slice-surface)]" />
      </div>
    </div>
  );
}
