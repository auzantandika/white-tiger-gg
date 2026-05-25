const PRODUCTS = [
  {
    id: "once-a-tiger-black",
    name: "Once A Tiger",
    variant: "Black",
    category: "Tees",
    url: "https://shopee.co.id/WHITE-TIGER-Once-A-Tiger-Black-i.1702868540.42327271606",
    image: null,
  },
  {
    id: "once-a-tiger-white",
    name: "Once A Tiger",
    variant: "White",
    category: "Tees",
    url: "https://shopee.co.id/WHITE-TIGER-Once-A-Tiger-White-i.1702868540.50453175591",
    image: null,
  },
  {
    id: "united-fury-black",
    name: "United Fury",
    variant: "Black",
    category: "Tees",
    url: "https://shopee.co.id/WHITE-TIGER-United-Fury-Black-i.1702868540.52153161881",
    image: null,
  },
  {
    id: "united-fury-white",
    name: "United Fury",
    variant: "White",
    category: "Tees",
    url: "https://shopee.co.id/WHITE-TIGER-United-Fury-White-i.1702868540.49703195547",
    image: null,
  },
  {
    id: "rawr-black-wash",
    name: "Rawr",
    variant: "Black Wash",
    category: "Tees",
    url: "https://shopee.co.id/WHITE-TIGER-Tees-Rawr-Black-Wash-i.1702868540.53709770854",
    image: null,
  },
  {
    id: "rawr-white",
    name: "Rawr",
    variant: "White",
    category: "Tees",
    url: "https://shopee.co.id/WHITE-TIGER-Tees-Rawr-White-i.1702868540.53159764738",
    image: null,
  },
  {
    id: "varsity-2",
    name: "Varsity 2.0",
    variant: "From Chaos Come Strength",
    category: "Varsity",
    url: "https://shopee.co.id/WHITE-TIGER-Varsity-2.0-From-Chaos-Come-Strength-i.1702868540.49103661781",
    image: null,
  },
  {
    id: "hoodie-tiger",
    name: "Tiger Doesn't Forgive",
    variant: "Hoodie",
    category: "Hoodie",
    url: "https://shopee.co.id/WHITE-TIGER-Hoodie-Tiger-Doesnt-Forgive-i.1702868540.57906934702",
    image: null,
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Tees: "text-blue-400 border-blue-900/40",
  Varsity: "text-purple-400 border-purple-900/40",
  Hoodie: "text-amber-400 border-amber-900/40",
};

export default function ShopTab() {
  return (
    <div className="flex flex-col gap-6 py-4 sm:py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-blue-500">
            Official Merchandise
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
            White Tiger Shop
          </h2>
        </div>
        <a
          href="https://shopee.co.id/whitetigerinc"
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-2 border border-orange-500/40 bg-orange-500/10 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-orange-400 transition-all hover:border-orange-400 hover:bg-orange-500/20"
        >
          View All
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {PRODUCTS.map((product) => (
          <a
            key={product.id}
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col border border-white/10 bg-white/[0.02] transition-all hover:border-white/20 hover:bg-white/[0.04]"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-zinc-900">
              {product.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image}
                  alt={`${product.name} ${product.variant}`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
                  <span className="font-mono text-3xl font-bold text-white/10">
                    WT
                  </span>
                  <span className="text-center font-mono text-[8px] uppercase tracking-widest text-zinc-700">
                    No Image
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            <div className="flex flex-1 flex-col gap-1 p-3">
              <span
                className={`w-fit border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest ${
                  CATEGORY_COLORS[product.category] ?? "text-zinc-400 border-white/10"
                }`}
              >
                {product.category}
              </span>
              <p className="mt-1 text-sm font-semibold leading-tight text-white">
                {product.name}
              </p>
              <p className="text-[11px] text-zinc-500">{product.variant}</p>
              <div className="mt-auto pt-2">
                <span className="font-mono text-[9px] uppercase tracking-wider text-orange-400/70 transition-colors group-hover:text-orange-400">
                  Buy on Shopee →
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      <p className="text-center font-mono text-[9px] uppercase tracking-widest text-zinc-700">
        Official store — shopee.co.id/whitetigerinc
      </p>
    </div>
  );
}
