// 전사 테스트 패널
// Whisper API 직접 호출 or Blob 경유 업로드 테스트
import { useState, useRef, useCallback } from 'react'

const ACCEPTED = '.mp4,.mov,.avi,.mkv,.webm,.m4v,.mp3,.wav,.m4a'

function fmtBytes(b) {
  if (b < 1024) return `${b}B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`
  return `${(b / 1024 / 1024).toFixed(1)}MB`
}
function fmtSec(s) {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m > 0 ? `${m}분 ${sec}초` : `${sec}초`
}

// ── API 엔드포인트 설정 ────────────────────────────────────────────
// 테스트 환경에 맞게 여기서 바꿔가며 실험
const CONFIG = {
  // 'direct'  : 파일 직접 FormData 전송
  // 'blob'    : Vercel Blob 경유 업로드
  mode: 'direct',
  apiUrl: '/api/transcribe',
}

export default function TranscribeTest() {
  const [file,     setFile]     = useState(null)
  const [step,     setStep]     = useState('idle')  // idle | uploading | transcribing | done | error
  const [progress, setProgress] = useState('')
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState('')
  const [expand,   setExpand]   = useState(false)
  const inputRef = useRef()

  const handleFile = useCallback((f) => {
    if (!f) return
    setFile(f)
    setStep('idle')
    setResult(null)
    setError('')
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handleRun = useCallback(async () => {
    if (!file) return
    setError('')
    setResult(null)

    try {
      let body, headers

      if (CONFIG.mode === 'direct') {
        // ── 직접 FormData 전송 (25MB 이하) ────────────────────
        setStep('uploading')
        setProgress(`파일 전송 중... (${fmtBytes(file.size)})`)
        const fd = new FormData()
        fd.append('file', file)
        body = fd
        headers = {}
      } else {
        // ── Blob 경유 업로드 ───────────────────────────────────
        setStep('uploading')
        setProgress(`Blob 업로드 중... (${fmtBytes(file.size)})`)
        const { upload } = await import('@vercel/blob/client')
        const blob = await upload(
          `transcribe-tmp/${Date.now()}-${file.name}`,
          file,
          { access: 'public', handleUploadUrl: '/api/blob-upload' }
        )
        body = JSON.stringify({ url: blob.url })
        headers = { 'Content-Type': 'application/json' }
      }

      setStep('transcribing')
      setProgress('Whisper 전사 중...')

      const res = await fetch(CONFIG.apiUrl, { method: 'POST', headers, body })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `서버 오류 (${res.status})`)
      }

      const data = await res.json()
      setResult(data)
      setStep('done')
      setProgress('')

    } catch (e) {
      console.error('[TranscribeTest]', e)
      setError(e.message || String(e))
      setStep('error')
      setProgress('')
    }
  }, [file])

  const reset = () => {
    setFile(null)
    setStep('idle')
    setResult(null)
    setError('')
    setProgress('')
  }

  return (
    <div className="space-y-4">

      {/* 설정 배지 */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
          mode: {CONFIG.mode}
        </span>
        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
          {CONFIG.apiUrl}
        </span>
      </div>

      {/* 드롭존 */}
      {!file ? (
        <label
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-3 w-full border-2 border-dashed border-purple-200 rounded-xl bg-purple-50/40 py-10 cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all"
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={e => handleFile(e.target.files[0])}
          />
          <span className="text-3xl">📁</span>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">영상 또는 오디오 파일 드래그 / 클릭</p>
            <p className="text-xs text-gray-400 mt-1">mp4 · mov · avi · mkv · webm · mp3 · wav · m4a</p>
          </div>
        </label>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
          <span className="text-xl">🎬</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
            <p className="text-xs text-gray-400">{fmtBytes(file.size)}</p>
          </div>
          {step === 'idle' && (
            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">변경</button>
          )}
        </div>
      )}

      {/* 실행 버튼 */}
      {file && step === 'idle' && (
        <button
          onClick={handleRun}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow"
        >
          전사 시작
        </button>
      )}

      {/* 진행 */}
      {(step === 'uploading' || step === 'transcribing') && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-50 border border-purple-200">
          <svg className="animate-spin text-purple-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <p className="text-xs text-purple-700">{progress}</p>
        </div>
      )}

      {/* 에러 */}
      {step === 'error' && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-xs font-semibold text-red-600 mb-1">오류</p>
          <p className="text-xs text-red-500 font-mono whitespace-pre-wrap">{error}</p>
          <button onClick={reset} className="text-xs text-red-400 underline mt-2">다시 시도</button>
        </div>
      )}

      {/* 결과 */}
      {step === 'done' && result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="세그먼트" value={result.count} color="purple" />
            <Stat label="영상 길이" value={result.duration ? fmtSec(result.duration) : '-'} color="violet" />
            <Stat label="글자 수" value={result.text?.length ?? 0} color="indigo" />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">전체 텍스트</p>
            <p className="text-sm text-gray-700 leading-relaxed">{result.text}</p>
          </div>

          {/* 원본 JSON */}
          <details className="rounded-xl border border-gray-200 overflow-hidden">
            <summary className="px-4 py-2.5 text-[11px] font-semibold text-gray-400 cursor-pointer hover:bg-gray-50">
              원본 JSON 응답
            </summary>
            <pre className="px-4 pb-4 text-[11px] text-gray-600 overflow-x-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>

          {/* 세그먼트 */}
          {result.segments?.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpand(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-[11px] font-semibold text-gray-400"
              >
                <span>세그먼트 ({result.count}개)</span>
                <span>{expand ? '▲' : '▼'}</span>
              </button>
              {expand && (
                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {result.segments.map((seg, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                      <span className="text-[10px] font-mono text-gray-300 w-16 flex-shrink-0 mt-0.5">
                        {fmtSec(seg.start)}
                      </span>
                      <p className="text-xs text-gray-600 flex-1">{seg.text}</p>
                      <span className="text-[10px] text-gray-300 flex-shrink-0 mt-0.5">
                        {(seg.end - seg.start).toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 underline">
            다른 파일 테스트
          </button>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  const colors = {
    purple: 'bg-purple-50 border-purple-100 text-purple-700 text-purple-400',
    violet: 'bg-violet-50 border-violet-100 text-violet-700 text-violet-400',
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700 text-indigo-400',
  }
  const [bg, border, val, lbl] = colors[color].split(' ')
  return (
    <div className={`px-3 py-2.5 rounded-xl ${bg} border ${border} text-center`}>
      <p className={`text-lg font-bold ${val}`}>{value}</p>
      <p className={`text-[10px] ${lbl} mt-0.5`}>{label}</p>
    </div>
  )
}
