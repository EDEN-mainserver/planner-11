import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'
export const metadata: Metadata = { title: 'EDEN FLOW', description: 'AI 인스타그램 성장 플랫폼' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-[#F8FAFC]">
        <div className="flex w-full min-h-screen bg-[#F8FAFC]">
          <Sidebar />
          <MobileHeader />
          <main className="flex-1 w-full overflow-y-auto">
            <div className="pt-16 lg:pt-0 flex flex-col min-h-screen">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
