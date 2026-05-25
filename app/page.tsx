"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import TabButton from "@/components/TabButton";
import type { TabId } from "@/lib/types";

const StreamingTab = dynamic(() => import("@/components/StreamingTab"), {
  loading: () => <div className="flex-1 min-h-[60vh]" />,
  ssr: false,
});
const PlayerFinderTab = dynamic(() => import("@/components/PlayerFinderTab"), {
  loading: () => <div className="flex-1 min-h-[60vh]" />,
  ssr: false,
});
const ShopTab = dynamic(() => import("@/components/ShopTab"), {
  loading: () => <div className="flex-1 min-h-[60vh]" />,
  ssr: false,
});

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("streaming");
  const isStreaming = activeTab === "streaming";
  const isShop = activeTab === "shop";

  return (
    <div className="scanlines grid-bg relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08),transparent_55%)]" />

      <div
        className={`relative mx-auto flex min-h-screen w-full max-w-[100rem] flex-col overflow-x-hidden px-2 pb-6 sm:px-4 sm:pb-8 lg:px-6 ${
          isStreaming ? "pt-1" : "pt-2 sm:pb-12"
        }`}
      >
        {!isStreaming && !isShop && <Header />}

        <nav
          className={`portal-glow flex w-full gap-2 rounded border border-white/10 bg-black/60 p-1.5 backdrop-blur-sm ${
            isStreaming ? "mt-0" : "mt-6 sm:mt-8"
          }`}
          aria-label="Portal sections"
        >
          <TabButton
            id="streaming"
            label="Streaming"
            active={activeTab === "streaming"}
            onClick={setActiveTab}
          />
          <TabButton
            id="player-finder"
            label="Player Finder"
            active={activeTab === "player-finder"}
            onClick={setActiveTab}
          />
          <TabButton
            id="shop"
            label="Shop"
            active={activeTab === "shop"}
            onClick={setActiveTab}
          />
        </nav>

        <main
          className={`min-w-0 flex-1 ${
            isStreaming
              ? "mt-1"
              : "portal-glow mt-4 rounded border border-white/10 bg-black/70 p-3 backdrop-blur-sm sm:mt-6 sm:p-6"
          }`}
        >
          {activeTab === "streaming" && <StreamingTab />}
          {activeTab === "player-finder" && <PlayerFinderTab />}
          {activeTab === "shop" && <ShopTab />}
        </main>

        {!isStreaming && (
          <footer className="mt-6 text-center sm:mt-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-700">
              White Tiger // Secure Operations Network
            </p>
            <p className="mt-1 font-mono text-[10px] text-zinc-800">
              v1.0 — All channels encrypted
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}
