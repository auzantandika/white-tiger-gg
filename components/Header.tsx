import Image from "next/image";

export default function Header() {
  return (
    <header className="relative border-b border-white/10 pb-8 pt-10 text-center">
      <div className="mb-6 flex items-center justify-center gap-3">
        <span className="inline-flex items-center gap-2 rounded border border-blue-500/30 bg-blue-950/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-blue-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
          SYSTEM ONLINE
        </span>
      </div>

      <div className="flex flex-col items-center gap-5 md:flex-row md:justify-center md:gap-8">
        <Image
          src="/logo/white-tiger-logo.png"
          alt="White Tiger logo"
          width={1024}
          height={1024}
          priority
          unoptimized
          className="h-auto w-[100px] shrink-0 sm:w-[120px] md:w-[150px] lg:w-[180px]"
        />

        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold tracking-[0.12em] text-white sm:text-5xl md:text-6xl">
            WHITE TIGER{" "}
            <span className="text-blue-500">GG</span>
          </h1>

          <p className="mt-4 font-mono text-sm uppercase tracking-[0.2em] text-zinc-500">
            Once a Tiger, Always a Tiger
          </p>
        </div>
      </div>

      <div className="mx-auto mt-6 h-px w-48 bg-gradient-to-r from-transparent via-blue-600/60 to-transparent" />
    </header>
  );
}
