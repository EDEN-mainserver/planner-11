'use client'
import { MessageCircle } from 'lucide-react'

export default function ChatButton() {
  return (
    <button
      onClick={() => window.open('https://www.helpu.kr/agcglobal', '_blank')}
      className="
        fixed bottom-6 right-6 z-50
        w-14 h-14 rounded-full
        bg-indigo-600 text-white
        flex items-center justify-center
        shadow-lg shadow-indigo-200
        hover:bg-indigo-700 hover:scale-110
        transition-all duration-200
      "
      aria-label="채팅 문의"
    >
      <MessageCircle className="w-6 h-6" />
    </button>
  )
}
