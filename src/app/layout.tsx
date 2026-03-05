import type { Metadata } from "next";
import { Manrope, Raleway } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Synthetic Person",
  description: "Gerencie e interaja com suas personas sintéticas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <body
        className={`${manrope.variable} ${raleway.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

