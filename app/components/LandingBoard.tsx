"use client";
import Link from "next/link";
import PoolsTreemap from "./PoolsTreemap";
import { loadPools, usePolled } from "@/lib/live";
import { EXAMPLE_POOLS } from "@/lib/examples";
import { ExampleNote } from "./ui";

export default function LandingBoard() {
  const { data } = usePolled(loadPools, EXAMPLE_POOLS, 4000);
  const top = [...data].sort((a, b) => b.waitingUsd - a.waitingUsd).slice(0, 6);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><h2 className="text-[32px] font-semibold">What people are waiting on</h2>
        <Link href="/pools" className="text-bone-dim underline hover:text-flame">See every pool</Link></div>
      <PoolsTreemap pools={top} height={480} />
      <div className="mt-3"><ExampleNote show={top.every((p) => p.example)} /></div>
    </div>
  );
}
