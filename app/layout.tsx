import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ADO Feature Dashboard",
  description: "Track ADO features, user stories, area paths, iteration paths and assignees",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen text-gray-900 antialiased">{children}</body>
    </html>
  );
}
