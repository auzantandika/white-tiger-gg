export default function ShopTab() {
  return (
    <div className="flex flex-col items-center gap-8 py-8 sm:py-12">
      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-blue-500">
          Official Store
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          White Tiger Shop
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Merchandise resmi White Tiger GG — tersedia di Shopee
        </p>
      </div>

      <a
        href="https://shopee.co.id/whitetigerinc"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 border border-orange-500/40 bg-orange-500/10 px-8 py-4 font-mono text-sm uppercase tracking-widest text-orange-400 transition-all hover:border-orange-400 hover:bg-orange-500/20 hover:text-orange-300"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        Buka Toko di Shopee
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </a>

      <div className="w-full max-w-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          shopee.co.id/whitetigerinc
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          Klik tombol di atas untuk melihat semua produk yang tersedia di toko resmi kami.
          <br />
          Tersedia berbagai merchandise eksklusif White Tiger GG.
        </p>
      </div>
    </div>
  );
}
