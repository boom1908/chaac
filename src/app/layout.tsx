import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CHAAC | Where Chaos Becomes Legend",
  description: "A digital archive of friendship chaos. Join the ultimate private social network for legendary friend stories.",
  keywords: ["CHAAC", "social network", "friends", "stories", "chaos", "digital archive"],
  openGraph: {
    title: "CHAAC | Where Chaos Becomes Legend",
    description: "A digital archive of friendship chaos. Join the private network.",
    type: "website",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
