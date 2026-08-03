import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Geo Decision Platform — Hà Nội',
  description: 'Bản đồ trạm sạc & cửa hàng tại Hà Nội',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
