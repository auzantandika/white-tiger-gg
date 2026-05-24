import Image from "next/image";

export default function Header() {
  return (
    <header className="relative border-b border-white/10 pb-6 pt-6 text-center sm:pb-8 sm:pt-10">
      <div className="mb-4 flex items-center justify-center gap-3 sm:mb-6">
        <span className="inline-flex items-center gap-2 rounded border border-blue-500/30 bg-blue-950/40 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-blue-400 sm:px-3 sm:text-[10px] sm:tracking-[0.25em]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
          SYSTEM ONLINE
        </span>
      </div>

      <div className="flex flex-col items-center gap-4 sm:gap-5 md:flex-row md:justify-center md:gap-8">
        <Image
          src="/logo/white-tiger-logo.png"
          alt="White Tiger logo"
          width={1024}
          height={1024}
          priority
          unoptimized
          className="h-auto w-[90px] shrink-0 sm:w-[120px] md:w-[150px] lg:w-[180px]"
        />

        <div className="min-w-0 text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-[0.08em] text-white sm:text-4xl sm:tracking-[0.12em] md:text-5xl lg:text-6xl">
            WHITE TIGER{" "}
            <span className="text-blue-500">GG</span>
          </h1>

          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500 sm:mt-4 sm:text-sm sm:tracking-[0.2em]">
            Once a Tiger, Always a Tiger
          </p>
        </div>
      </div>

      <div className="mx-auto mt-5 h-px w-32 bg-gradient-to-r from-transparent via-blue-600/60 to-transparent sm:mt-6 sm:w-48" />
    </header>
  );
}
