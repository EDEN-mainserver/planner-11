import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LongShot — AI 쇼츠 자동 생성",
  description: "롱폼 영상을 입력하면 AI가 자동으로 핵심 하이라이트를 추출하여 쇼츠를 생성합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
