import type { Metadata } from 'next'
import { Be_Vietnam_Pro, Fraunces } from 'next/font/google'
import './globals.css'

const beVietnam = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-fraunces',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MapPlatform — Bản đồ quyết định đô thị Việt Nam',
  description:
    'Tìm trạm sạc, cây xăng, xưởng dịch vụ, cứu hộ, bệnh viện, đại học, TTTM, metro và hơn thế. Hỏi tiếng Việt — AI chọn điểm và chỉ đường theo mạng đường thật.',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. bis_register) mutate <html>/<body>
    <html lang="vi" className={`${beVietnam.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
