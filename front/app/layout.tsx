import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google" 
import "./globals.css"
import ContextProvider from '@/context'

import { headers } from 'next/headers' 
const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "PayStream - Multi-Payment dApp",
  description: "Web3 multi-payment platform powered by blockchain",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersData = await headers();
  const cookies = headersData.get('cookie');

  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <ContextProvider cookies={cookies}>{children}</ContextProvider>
         
      </body>
    </html>
  )
}
