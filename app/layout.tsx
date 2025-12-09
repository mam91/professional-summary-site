import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Michael Miller',
  description: 'Ask me about my professional experience',
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

