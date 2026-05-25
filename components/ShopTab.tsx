"use client";

import { useCallback, useEffect, useState } from "react";
import StreamingMonitorFooter from "./StreamingMonitorFooter";

const PRODUCTS_WITH_IMAGES = [
  {
    id: "once-a-tiger-white",
    name: "Once A Tiger",
    variant: "White",
    category: "Tees",
    url: "https://shopee.co.id/WHITE-TIGER-Once-A-Tiger-White-i.1702868540.50453175591",
    image: "/images/once-a-tiger-white.png",
  },
  {
    id: "once-a-tiger-black",
    name: "Once A Tiger",
    variant: "Black",
    category: "Tees",
    url: "https://shopee.co.id/WHITE-TIGER-Once-A-Tiger-Black-i.1702868540.42327271606",
    image: "/images/once-a-tiger-black.png",
  },
  {
    id: "united-fury-black",
    name: "United Fury",
    variant: "Black",
    category: "Tees",
    url: "https://shopee.co.id/WHITE-TIGER-United-Fury-Black-i.1702868540.52153161881",
    image: "/images/united-fury-black.png",
  },
  {
    id: "united-fury-white",
    name: "United Fury",
    variant: "White",
    category: "Tees",
    url: "https://shopee.co.id/WHITE-TIGER-United-Fury-White-i.1702868540.49703195547",
    image: "/images/united-fury-white.png",
  },
  {
    id: "rawr-white",
    name: "Rawr",
    variant: "White",
    category: "Tees",
    url: "https://shopee.co.id/WHITE-TIGER-Tees-Rawr-White-i.1702868540.53159764738",
    image: "/images/rawr-white.png",
  },
  {
    id: "rawr-black-wash",
    name: "Rawr",
    variant: "Black Wash",
    category: "Tees",
    url: "https://shopee.co.id/WHITE-TIGER-Tees-Rawr-Black-Wash-i.1702868540.53709770854",
    image: "/images/rawr-black-wash.png",
  },
  {
    id: "varsity-2",
    name: "Varsity 2.0",
    variant: "From Chaos Come Strength",
    category: "Varsity",
    url: "https://shopee.co.id/WHITE-TIGER-Varsity-2.0-From-Chaos-Come-Strength-i.1702868540.49103661781",
    image: "/images/varsity-2.png",
  },
  {
    id: "hoodie-tiger",
    name: "Tiger Doesn't Forgive",
    variant: "Hoodie",
    category: "Hoodie",
    url: "https://shopee.co.id/WHITE-TIGER-Hoodie-Tiger-Doesnt-Forgive-i.1702868540.57906934702",
    image: "/images/hoodie-tiger.png",
  },
] as const;

const PRODUCTS = PRODUCTS_WITH_IMAGES;

const CATEGORY_COLORS: Record<string, string> = {
  Tees: "text-blue-400 border-blue-900/40",
  Varsity: "text-purple-400 border-purple-900/40",
  Hoodie: "text-amber-400 border-amber-900/40",
};

export default function ShopTab() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const imageProducts = PRODUCTS.filter((p) => p.image);
  const total = imageProducts.length;

  const openLightbox = useCallback((idx: number) => setLightboxIndex(idx), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const goPrev = useCallback(() => setLightboxIndex((i) => (i === null ? null : (i - 1 + total) % total)), [total]);
  const goNext = useCallback(() => setLightboxIndex((i) => (i === null ? null : (i + 1) % total)), [total]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [lightboxIndex, closeLightbox, goPrev, goNext]);

  const activeProd = lightboxIndex !== null ? imageProducts[lightboxIndex] : null;

  return (
    <div className="flex flex-col gap-6 py-4 sm:py-6">
      <div className="relative w-full overflow-hidden rounded border border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/shop-catalog.png"
          alt="White Tiger merchandise catalog"
          className="w-full object-contain max-h-[320px] sm:max-h-[400px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 p-4 sm:p-6">
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-blue-400">
            Official Merchandise
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            White Tiger Shop
          </h2>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          {PRODUCTS.length} products available
        </p>
        <a
          href="https://shopee.co.id/whitetigerinc"
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-2 border border-orange-500/40 bg-orange-500/10 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-orange-400 transition-all hover:border-orange-400 hover:bg-orange-500/20"
        >
          View All
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {PRODUCTS.map((product, idx) => (
          <div
            key={product.id}
            className="group flex flex-col border border-white/10 bg-white/[0.02] transition-all hover:border-white/20 hover:bg-white/[0.04]"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-zinc-900">
              {product.image ? (
                <button
                  type="button"
                  className="h-full w-full"
                  onClick={() => openLightbox(idx)}
                  aria-label={`View ${product.name} ${product.variant}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.image}
                    alt={`${product.name} ${product.variant}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </button>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
                  <span className="font-mono text-3xl font-bold text-white/10">WT</span>
                  <span className="text-center font-mono text-[8px] uppercase tracking-widest text-zinc-700">No Image</span>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            <div className="flex flex-1 flex-col gap-1 p-3">
              <span className={`w-fit border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest ${CATEGORY_COLORS[product.category] ?? "text-zinc-400 border-white/10"}`}>
                {product.category}
              </span>
              <p className="mt-1 text-sm font-semibold leading-tight text-white">{product.name}</p>
              <p className="text-[11px] text-zinc-500">{product.variant}</p>
              <div className="mt-auto pt-2">
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[9px] uppercase tracking-wider text-orange-400/70 transition-colors hover:text-orange-400"
                >
                  Buy on Shopee →
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center font-mono text-[9px] uppercase tracking-widest text-zinc-700">
        Official store — shopee.co.id/whitetigerinc
      </p>

      <StreamingMonitorFooter />

      {activeProd && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeProd.name} ${activeProd.variant}`}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(4px)" }}
          onClick={closeLightbox}
        >
          {/* Close — top-right of viewport */}
          <button
            type="button"
            onClick={closeLightbox}
            style={{ position: "absolute", top: 12, right: 12, zIndex: 10000 }}
            className="flex h-11 w-11 items-center justify-center border border-white/20 bg-black/80 text-white transition-colors hover:border-blue-500/60 hover:bg-blue-950/60"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          {/* Prev — vertically centered */}
          {total > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", zIndex: 10000 }}
              className="flex h-11 w-11 items-center justify-center border border-white/20 bg-black/80 text-white transition-colors hover:border-blue-500/60 hover:bg-blue-950/60"
              aria-label="Previous image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}

          {/* Next — vertically centered */}
          {total > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", zIndex: 10000 }}
              className="flex h-11 w-11 items-center justify-center border border-white/20 bg-black/80 text-white transition-colors hover:border-blue-500/60 hover:bg-blue-950/60"
              aria-label="Next image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}

          {/* Viewer grid: image row (1fr) + caption row (auto) */}
          <div
            style={{
              display: "grid",
              gridTemplateRows: "1fr auto",
              height: "100dvh",
              width: "100vw",
              padding: "24px",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image area — min-h-0 is critical so 1fr doesn't overflow */}
            <div
              style={{
                minHeight: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeProd.image}
                alt={`${activeProd.name} ${activeProd.variant}`}
                style={{
                  display: "block",
                  width: "auto",
                  height: "auto",
                  maxWidth: "min(92vw, 1100px)",
                  maxHeight: "calc(100dvh - 120px)",
                  objectFit: "contain",
                  boxShadow: "0 0 0 1px rgba(59,130,246,0.3)",
                }}
              />
            </div>

            {/* Caption row */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-center">
              <p className="font-semibold text-white">{activeProd.name}</p>
              <span className="text-zinc-600">·</span>
              <p className="text-sm text-zinc-400">{activeProd.variant}</p>
              {total > 1 && (
                <>
                  <span className="text-zinc-600">·</span>
                  <p className="font-mono text-[10px] text-zinc-600">{(lightboxIndex ?? 0) + 1} / {total}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
