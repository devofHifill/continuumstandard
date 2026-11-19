import type { Metadata } from "next";
import { PocClient } from "./PocClient";

export const metadata: Metadata = { title: "Video engine POC" };

export default function PocPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 pb-28">
      <PocClient />
    </main>
  );
}
