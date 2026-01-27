import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "InternAtlas - Software Engineering Internship & New Grad Job Board",
    template: "%s | InternAtlas"
  },
  description: "Find software engineering internships and new grad jobs from 2,500+ companies. Search through 600,000+ positions from our database. InternAtlas crawls company career pages directly to give you complete coverage of internship opportunities and entry-level positions at top tech companies. Updated twice daily.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  keywords: [
    "internship job board",
    "software engineering internships",
    "new grad jobs",
    "tech internships 2025",
    "computer science internships",
    "entry level software engineer jobs",
    "internship search engine",
    "tech job board",
    "engineering internships",
    "software developer internships",
    "CS internships",
    "intern job board",
    "tech career board",
    "Greenhouse jobs",
    "Lever jobs",
    "Workday jobs",
    "iCIMS jobs",
    "internship aggregator",
    "tech internship finder",
    "software intern positions"
  ],
  authors: [{ name: "InternAtlas", url: "https://internatlas.tech" }],
  creator: "InternAtlas",
  publisher: "InternAtlas",
  metadataBase: new URL("https://internatlas.tech"),
  alternates: {
    canonical: "https://internatlas.tech",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://internatlas.tech",
    title: "InternAtlas - Software Engineering Internship & New Grad Job Board",
    description: "Search 600,000+ software engineering internships and new grad jobs from 2,500+ companies. Updated twice daily with direct links to company career pages.",
    siteName: "InternAtlas",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "InternAtlas - Software Engineering Internship Job Board",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "InternAtlas - Software Engineering Internship & New Grad Job Board",
    description: "Search 600,000+ software engineering internships and new grad jobs from 2,500+ companies. Updated twice daily.",
    images: ["/og-image.png"],
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
  category: "technology",
  classification: "Job Board",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": "https://internatlas.tech/#website",
                  "url": "https://internatlas.tech",
                  "name": "InternAtlas",
                  "description": "Search 600,000+ software engineering internships and new grad jobs from 2,500+ companies. Updated twice daily.",
                  "publisher": {
                    "@id": "https://internatlas.tech/#organization"
                  },
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": {
                      "@type": "EntryPoint",
                      "urlTemplate": "https://internatlas.tech/?search={search_term_string}"
                    },
                    "query-input": "required name=search_term_string"
                  }
                },
                {
                  "@type": "Organization",
                  "@id": "https://internatlas.tech/#organization",
                  "name": "InternAtlas",
                  "url": "https://internatlas.tech",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://internatlas.tech/icon.svg"
                  },
                  "sameAs": []
                },
                {
                  "@type": "JobPosting",
                  "name": "Software Engineering Internships",
                  "description": "Browse 600,000+ software engineering internship and new grad opportunities from 2,500+ companies, updated twice daily.",
                  "hiringOrganization": {
                    "@type": "Organization",
                    "name": "Multiple Tech Companies"
                  },
                  "jobLocation": {
                    "@type": "Place",
                    "address": {
                      "@type": "PostalAddress",
                      "addressCountry": "US"
                    }
                  },
                  "employmentType": "INTERN",
                  "industry": "Technology"
                },
                {
                  "@type": "WebApplication",
                  "name": "InternAtlas Job Board",
                  "url": "https://internatlas.tech",
                  "applicationCategory": "BusinessApplication",
                  "operatingSystem": "Web",
                  "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "USD"
                  },
                  "featureList": "Job search, Application tracking, Custom job tables, Real-time updates"
                }
              ]
            })
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
