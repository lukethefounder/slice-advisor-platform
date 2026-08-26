export default function MarketsLoading() {
  return (
    <div className="min-h-dvh bg-[#f7fcf9] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px] animate-pulse">
        <div className="h-16 rounded-2xl border border-emerald-950/10 bg-white" />
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="h-7 w-52 rounded-full bg-emerald-100" />
            <div className="mt-6 h-14 w-full max-w-2xl rounded-2xl bg-emerald-100" />
            <div className="mt-4 h-14 w-4/5 rounded-2xl bg-emerald-100" />
            <div className="mt-6 h-24 w-full rounded-2xl bg-white" />
          </div>
          <div className="h-80 rounded-[2rem] border border-emerald-950/10 bg-white" />
        </div>
        <div className="mt-14 h-[34rem] rounded-[2rem] border border-emerald-950/10 bg-white" />
      </div>
    </div>
  );
}