import type { Metadata } from 'next'
import { Oswald } from 'next/font/google'
import './globals.css'
import { GridDataProvider } from './contexts/GridDataContext'

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-oswald',
})

export const metadata: Metadata = {
  title: 'Spector',
  description: 'Professional esports companion for League of Legends and Valorant',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={oswald.variable}>
      <body>
        <GridDataProvider>
          {children}
        </GridDataProvider>
      </body>
    </html>
  )
}
