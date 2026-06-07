import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WB Operator AI Agent",
  description: "AI Operations Manager for Wildberries Sellers"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
