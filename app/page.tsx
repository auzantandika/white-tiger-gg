"use client";

import { useState } from "react";
import Header from "@/components/Header";
import PlayerFinderTab from "@/components/PlayerFinderTab";
import StreamingTab from "@/components/StreamingTab";
import TabButton from "@/components/TabButton";
import type { TabId } from "@/lib/types";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("streaming");

  return (
    <div className="scanlines grid-bg relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08),transparent_55%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[90rem] flex-col px-3 pb-10 pt-2 sm:px-6 sm:pb-12 lg:px-8">
        <Header />

        <nav
          className="portal-glow mt-6 flex w-full gap-2 rounded border border-white/10 bg-black/60 p-2 backdrop-blur-sm sm:mt-8"
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
        </nav>

        <main className="portal-glow mt-4 min-w-0 flex-1 rounded border border-white/10 bg-black/70 p-3 backdrop-blur-sm sm:mt-6 sm:p-6">
          {activeTab === "streaming" ? <StreamingTab /> : <PlayerFinderTab />}
        </main>

        <footer className="mt-6 text-center sm:mt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-700">
            White Tiger // Secure Operations Network
          </p>
          <p className="mt-1 font-mono text-[10px] text-zinc-800">
            v1.0 — All channels encrypted
          </p>
        </footer>
      </div>
    </div>
  );
}
