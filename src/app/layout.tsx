import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
//import ToasterProvider from "@/components/ToasterProvider"; // if you added Sonner

export const metadata: Metadata = {
  title: "BRM – Renewal Calendar",
  description: "Track renewal & notice deadlines",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Note: layout.tsx stays a Server Component; AppShell is a Client Component child. That’s fine.
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
