import type { Metadata } from 'next'
import './globals.css'
import { GridDataProvider } from './contexts/GridDataContext'

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
    <html lang="en">
      <body>
        <GridDataProvider>
          {children}
        </GridDataProvider>
      </body>
    </html>
  )
}
