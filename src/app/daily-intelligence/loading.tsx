export default function DailyIntelligenceLoading() {
  return (
    <div className="min-h-dvh bg-[var(--slice-bg)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px] animate-pulse">
        <div className="h-16 rounded-2xl bg-emerald-100/70" />
        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_0.75fr]">
          <div>
            <div className="h-5 w-48 rounded-full bg-emerald-100" />
            <div className="mt-6 h-14 max-w-3xl rounded-2xl bg-emerald-100" />
            <div className="mt-4 h-28 max-w-4xl rounded-2xl bg-emerald-50" />
          </div>
          <div className="h-72 rounded-[2rem] bg-white shadow-sm" />
        </div>
        <div className="mt-12 h-[36rem] rounded-[2rem] bg-white shadow-sm" />
      </div>
    </div>
  );
}