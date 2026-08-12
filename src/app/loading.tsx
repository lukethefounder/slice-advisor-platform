export default function RootLoading() {
  return (
    <main
      className="min-h-screen bg-[#020604] px-4 py-5 text-white sm:px-6 lg:px-8"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading Slice</span>

      <div className="mx-auto max-w-[1600px] animate-pulse">
        <div className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-emerald-300/10 bg-zinc-950/70 p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/15" />
            <div className="space-y-2">
              <div className="h-4 w-28 rounded-full bg-white/10" />
              <div className="h-2.5 w-44 rounded-full bg-emerald-400/10" />
            </div>
          </div>
          <div className="hidden h-10 w-36 rounded-2xl bg-white/[0.06] sm:block" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
          <div className="min-h-[28rem] rounded-[2rem] border border-emerald-300/10 bg-zinc-950/70 p-6">
            <div className="h-3 w-32 rounded-full bg-emerald-400/12" />
            <div className="mt-7 h-12 max-w-2xl rounded-2xl bg-white/10" />
            <div className="mt-3 h-12 max-w-xl rounded-2xl bg-white/[0.07]" />
            <div className="mt-7 space-y-3">
              <div className="h-4 max-w-3xl rounded-full bg-white/[0.06]" />
              <div className="h-4 max-w-2xl rounded-full bg-white/[0.06]" />
              <div className="h-4 max-w-xl rounded-full bg-white/[0.06]" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 rounded-[1.5rem] border border-white/8 bg-white/[0.035]"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}