import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InternAtlas | Find Software Engineering Internships & New Grad Jobs",
  description: "InternAtlas aggregates software engineering internships and new grad job opportunities from top tech companies. Search through hundreds of positions updated daily from Greenhouse, Lever, and Workday job boards.",
  keywords: [
    "software engineering internships",
    "new grad jobs",
    "tech internships",
    "computer science jobs",
    "entry level software engineer",
    "internship search",
    "job board",
    "tech careers",
    "engineering jobs",
    "graduate positions"
  ],
  authors: [{ name: "InternAtlas" }],
  creator: "InternAtlas",
  publisher: "InternAtlas",
  metadataBase: new URL("https://internatlas.vercel.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://internatlas.vercel.app",
    title: "InternAtlas | Find Software Engineering Internships & New Grad Jobs",
    description: "Discover software engineering internships and new grad opportunities from top tech companies. Updated daily.",
    siteName: "InternAtlas",
  },
  twitter: {
    card: "summary_large_image",
    title: "InternAtlas | Find Software Engineering Internships & New Grad Jobs",
    description: "Discover software engineering internships and new grad opportunities from top tech companies.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
