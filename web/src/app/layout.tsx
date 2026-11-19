import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DemoToolbar } from "@/components/DemoToolbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "The Continuum-Standard", template: "%s · The Continuum-Standard" },
  description: "Scenario-based training for behavioral-health teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <DemoToolbar />
      </body>
    </html>
  );
}
