// ─── Eden Crawl 확장 프로그램 설치 안내 모달 (공유) ───
export default function ExtensionInstallModal({ onClose }) {
  const steps = [
    {
      num: 1,
      title: "GitHub에서 파일 다운로드",
      desc: (
        <>
          아래 링크를 클릭해서 GitHub 페이지로 이동하세요.
          <a
            href="https://github.com/EDEN-mainserver/E-ATTACK-"
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-1.5 px-3 py-1.5 bg-gray-900 text-green-400 rounded-lg text-xs font-mono hover:bg-gray-800 transition-all truncate"
          >
            github.com/EDEN-mainserver/E-ATTACK-
          </a>
          <span className="block mt-1.5">페이지에서 초록색 <strong>{"<>"} Code</strong> 버튼 → <strong>Download ZIP</strong> 클릭</span>
        </>
      ),
    },
    {
      num: 2,
      title: "ZIP 압축 해제",
      desc: (
        <>
          다운로드된 ZIP 파일을 압축 해제하세요.<br />
          압축을 풀면 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-purple-700">E-ATTACK--master</code> 폴더가 생깁니다.
        </>
      ),
    },
    {
      num: 3,
      title: "Chrome 확장 프로그램 페이지 열기",
      desc: (
        <>
          Chrome 주소창에 아래를 그대로 붙여넣고 엔터를 누르세요.
          <code className="block mt-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-mono text-blue-700">chrome://extensions</code>
        </>
      ),
    },
    {
      num: 4,
      title: "개발자 모드 켜기",
      desc: (
        <>
          페이지 <strong>우측 상단</strong>에 있는 <strong>개발자 모드</strong> 토글을 클릭해서 <strong>파란색(ON)</strong>으로 켜주세요.
        </>
      ),
    },
    {
      num: 5,
      title: "'압축 해제된 확장 프로그램을 로드합니다' 클릭",
      desc: (
        <>
          개발자 모드를 켜면 <strong>좌측 상단</strong>에 버튼이 생깁니다.<br />
          클릭 후 압축 해제한 폴더 안의{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-purple-700">extension</code>{" "}
          하위 폴더를 선택하세요.
          <div className="mt-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-500 leading-relaxed">
            📁 E-ATTACK--master<br />
            {'  '}└── 📁 <span className="text-purple-700 font-bold">extension</span> ← 이 폴더 선택<br />
            {'       '}├── manifest.json<br />
            {'       '}├── background.js<br />
            {'       '}└── ...
          </div>
        </>
      ),
    },
    {
      num: 6,
      title: "이미 설치된 경우 — 재로드",
      desc: (
        <>
          이전에 설치했다면 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-blue-700">chrome://extensions</code> 에서 Eden Crawl 카드의{" "}
          <strong>새로고침(↺) 버튼</strong>을 클릭해 업데이트하세요.
        </>
      ),
    },
    {
      num: 7,
      title: "각 플랫폼 로그인 후 수집 시작",
      desc: (
        <>
          수집하려는 플랫폼에 미리 로그인한 상태여야 합니다.
          <div className="mt-1.5 space-y-0.5">
            <div className="flex items-center gap-1.5"><span className="text-emerald-600 font-bold">B</span> <span>아이보스: i-boss.co.kr 로그인</span></div>
            <div className="flex items-center gap-1.5"><span className="text-purple-500 font-bold">🧵</span> <span>쓰레드: threads.com 로그인</span></div>
            <div className="flex items-center gap-1.5"><span className="font-bold text-gray-800">𝕏</span> <span>X(트위터): x.com 로그인</span></div>
            <div className="flex items-center gap-1.5"><span className="font-bold text-blue-600">in</span> <span>링크드인: linkedin.com 로그인</span></div>
          </div>
          <span className="block mt-1.5">로그인 후 이 사이트에서 각 탭의 수집 버튼을 누르면 자동으로 수집됩니다.</span>
        </>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Eden Crawl 확장 프로그램 설치</h3>
              <p className="text-[11px] text-gray-400">Chrome 전용 · 아이보스 / 쓰레드 / X / LinkedIn 자동 수집</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* 단계별 안내 */}
        <div className="px-5 py-4 space-y-4">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                {s.num}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-0.5">{s.title}</p>
                <div className="text-xs text-gray-500 leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 주의사항 */}
        <div className="mx-5 mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs text-amber-700 font-medium mb-1">⚠️ 주의사항</p>
          <ul className="text-xs text-amber-600 space-y-0.5 list-disc list-inside">
            <li>Chrome 브라우저 전용입니다 (Edge 불가)</li>
            <li>반드시 <code className="bg-amber-100 px-1 rounded font-mono">extension</code> 하위 폴더를 선택해야 합니다 (루트 폴더 X)</li>
            <li>수집 전 해당 플랫폼에 미리 로그인 필수</li>
            <li>업데이트 시 ZIP 재다운로드 → extension 폴더 교체 → chrome://extensions에서 새로고침(↺)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
