export default function PublicLoading() {
  return (
    <main className="cine-container flex flex-col gap-8 pb-20 pt-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-2">
          <div className="h-9 w-48 animate-pulse rounded-xl bg-cine-cream" />
          <div className="h-4 w-72 animate-pulse rounded-lg bg-cine-cream" />
        </div>
        <div className="h-12 w-full animate-pulse rounded-[14px] bg-cine-cream md:w-[440px]" />
      </div>

      <div className="space-y-4">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-cine-cream" />
        <div className="flex gap-5 overflow-hidden">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="w-[173px] shrink-0 space-y-2">
              <div className="h-[256px] w-full animate-pulse rounded-[16px] bg-cine-cream" />
              <div className="h-4 w-32 animate-pulse rounded bg-cine-cream" />
              <div className="h-3 w-24 animate-pulse rounded bg-cine-cream" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
