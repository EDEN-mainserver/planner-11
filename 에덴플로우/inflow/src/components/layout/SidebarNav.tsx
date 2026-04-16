"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_GROUPS } from "@/constants/navigation";

export default function SidebarNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (title: string) =>
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
      {NAV_GROUPS.map((group) => {
        const isCollapsed = collapsed[group.title] ?? false;
        return (
          <div key={group.title} className="mb-1">
            {/* 그룹 헤더 */}
            <button
              onClick={() => toggle(group.title)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-[12px] font-semibold text-[#999] uppercase tracking-[0.05em] hover:text-[#555] transition-colors"
            >
              <span>{group.title}</span>
              <span>{isCollapsed ? "∨" : "∧"}</span>
            </button>

            {/* 메뉴 아이템 */}
            {!isCollapsed && (
              <ul className="mt-0.5 space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[14px] transition-colors ${
                          isActive
                            ? "bg-[#6C63FF] text-white font-medium"
                            : "text-[#555] hover:bg-[#EEEEF8] hover:text-[#111]"
                        }`}
                      >
                        <span className="w-5 text-center text-base leading-none shrink-0">
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
