import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "INFLOW",
  description: "인스타그램 AI 기획 툴",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-[#F4F4F8] text-[#111] antialiased">
        <div className="flex min-h-screen">
          {/* 사이드바 260px 고정 */}
          <Sidebar />
          {/* 메인 콘텐츠 1fr */}
          <main className="flex-1 min-h-screen overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
