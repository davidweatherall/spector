import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
