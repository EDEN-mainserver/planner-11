"use client";

export default function ChatButton() {
  return (
    <button
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#6C63FF] hover:bg-[#4B44CC] text-white shadow-lg flex items-center justify-center text-xl transition-colors z-50"
      aria-label="채팅 지원"
    >
      💬
    </button>
  );
}
