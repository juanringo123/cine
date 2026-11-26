export default function MovieDetailLoading() {
  return (
    <main className="pb-20">
      <div className="h-[240px] w-full animate-pulse bg-cine-cream sm:h-[320px]" />
      <div className="cine-container pt-6 xl:pt-10">
        <div className="grid gap-8 xl:grid-cols-[252px_minmax(0,1fr)_356px] xl:gap-10">
          <div className="-mt-28 sm:-mt-36 xl:-mt-[190px]">
            <div className="mx-auto h-[300px] w-[200px] animate-pulse rounded-[16px] border-2 border-white bg-cine-cream xl:mx-0 xl:h-[378px] xl:w-[252px]" />
          </div>
          <div className="space-y-4">
            <div className="h-10 w-3/4 animate-pulse rounded-xl bg-cine-cream" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-cine-cream" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-cine-cream" />
          </div>
          <div className="h-64 w-full animate-pulse rounded-[24px] bg-cine-cream" />
        </div>
      </div>
    </main>
  );
}
