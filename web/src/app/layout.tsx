import type { Metadata } from "next";
import { Suspense } from "react";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import { DemoToolbar } from "@/components/DemoToolbar";
import "./globals.css";

/**
 * Brand fonts from the client's site (F6): Hanken Grotesk for UI/body, Newsreader for
 * display headings. next/font self-hosts them, so no request goes to Google at runtime.
 */
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: { default: "The Continuum-Standard", template: "%s · The Continuum-Standard" },
  description: "Scenario-based training for behavioral-health teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hanken.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        {/* The toolbar reads the URL path (it hides on marketing pages), so it needs a Suspense boundary. */}
        <Suspense fallback={null}>
          <DemoToolbar />
        </Suspense>
      </body>
    </html>
  );
}
