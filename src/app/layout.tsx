import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WSSO — Work Management System",
  description:
    "WSSO is the Work Management System from TLBISBIG Consulting Group, LLC. Subscribe in USD for your whole company. Payments processed by Stripe.",
  icons: { icon: "/brand/wsso-logo.png" },
  openGraph: {
    title: "WSSO — Work Management System",
    description: "A TLBISBIG Consulting Group, LLC product. Run the company in one workspace. Subscribe in USD.",
    images: ["/brand/wsso-logo.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-US">
      <body>{children}</body>
    </html>
  );
}
