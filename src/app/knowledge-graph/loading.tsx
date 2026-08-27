export default function KnowledgeGraphLoading() {
  return (
    <div className="min-h-dvh bg-[#f7fcf9] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px] animate-pulse">
        <div className="h-16 rounded-2xl border border-emerald-950/10 bg-white" />
        <div className="mt-12 h-48 max-w-4xl rounded-[2rem] bg-emerald-100" />
        <div className="mt-12 grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="h-[42rem] rounded-[2rem] border border-emerald-950/10 bg-white" />
          <div className="h-[34rem] rounded-[2rem] border border-emerald-950/10 bg-white" />
        </div>
      </div>
    </div>
  );
}