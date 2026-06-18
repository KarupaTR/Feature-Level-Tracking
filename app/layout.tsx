import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ADO Feature Dashboard",
  description: "PM Feature Tracker — Thomson Reuters TaxProf",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
