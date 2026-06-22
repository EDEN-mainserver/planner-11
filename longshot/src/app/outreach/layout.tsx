import Link from "next/link";

export default function OutreachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-56 border-r bg-card shrink-0 flex flex-col">
        <div className="p-4 border-b">
          <Link href="/outreach" className="text-lg font-bold">
            에덴 아웃리치
          </Link>
          <p className="text-xs text-muted-foreground mt-1">자동 콜드 아웃리치</p>
        </div>
        <nav className="p-2 space-y-1 text-sm flex-1">
          <Link
            href="/outreach"
            className="block px-3 py-2 rounded-md hover:bg-muted transition-colors"
          >
            키워드
          </Link>
          <Link
            href="/outreach/settings"
            className="block px-3 py-2 rounded-md hover:bg-muted transition-colors"
          >
            설정
          </Link>
          <span className="block px-3 py-2 rounded-md text-muted-foreground">
            발송로그 <span className="text-xs">(Day 3)</span>
          </span>
          <span className="block px-3 py-2 rounded-md text-muted-foreground">
            블랙리스트 <span className="text-xs">(Day 3)</span>
          </span>
        </nav>
        <div className="p-4 text-xs text-muted-foreground border-t">
          <Link href="/" className="hover:text-foreground">
            ← LongShot
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
