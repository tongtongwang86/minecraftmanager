import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Minecraft Server Manager",
  description: "Manage your Minecraft servers with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
