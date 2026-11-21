export default function KnowledgeGraphLoading() {
  return (
    <div className="min-h-dvh bg-[var(--slice-bg,#030811)] px-4 py-10 sm:px-6 lg:px-8" role="status" aria-busy="true">
      <span className="sr-only">Loading the knowledge graph</span>
      <div className="mx-auto w-full max-w-[1500px] animate-pulse motion-reduce:animate-none" aria-hidden="true">
        <div className="h-16 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface)]" />
        <div className="mt-12 h-48 max-w-4xl rounded-[2rem] bg-[var(--slice-accent-soft)]" />
        <div className="mt-12 grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="h-[42rem] rounded-[2rem] border border-[var(--slice-border)] bg-[var(--slice-surface)]" />
          <div className="h-[34rem] rounded-[2rem] border border-[var(--slice-border)] bg-[var(--slice-surface)]" />
        </div>
      </div>
    </div>
  );
}
