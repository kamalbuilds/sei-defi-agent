import './globals.css'
import type { Metadata } from 'next'
import { Providers } from './providers'



export const metadata: Metadata = {
  title: 'NEXUS AI - Decentralized Finance Intelligence',
  description: 'Advanced AI-powered DeFi trading and portfolio management platform',
  keywords: 'DeFi, AI, trading, portfolio, blockchain, cryptocurrency',
  authors: [{ name: 'NEXUS AI Team' }],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}