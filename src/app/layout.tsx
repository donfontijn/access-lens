import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Access Lens - Human-Centered Accessibility Evaluator",
  description: "Evaluate accessibility from a human-centered perspective. Get insights about readability, cognitive load, user stress, memory burden, and empathy alignment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${lexend.variable} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
