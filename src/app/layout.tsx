import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "JaguarAI",
    template: "%s | JaguarAI",
  },
  description: "JaguarAI content hub for posts, daily AI briefings, courses, and projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="jaguarai-app">{children}</body>
    </html>
  );
}
