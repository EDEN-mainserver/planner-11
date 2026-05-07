import { useState } from 'react'
import TranscribeTest from './tests/TranscribeTest.jsx'
import CapcutTest     from './tests/CapcutTest.jsx'

const TABS = [
  { id: 'transcribe', label: '01 전사',       icon: '🎙️' },
  { id: 'capcut',     label: '02 캡컷 자동화', icon: '🎬' },
]

const PANELS = {
  transcribe: <TranscribeTest />,
  capcut:     <CapcutTest />,
}

export default function App() {
  const [tab, setTab] = useState('capcut')

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow">
            <span className="text-lg">🧪</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">AutoEdit Lab</h1>
            <p className="text-xs text-gray-400">영상 편집 자동화 독립 테스트 환경</p>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* 패널 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          {PANELS[tab]}
        </div>

      </div>
    </div>
  )
}
