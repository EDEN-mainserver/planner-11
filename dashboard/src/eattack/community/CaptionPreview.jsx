// 자막 미리보기 컴포넌트 (9:16 숏폼 시뮬레이션)
import { useState, useEffect } from "react";

export default function CaptionPreview({ script, fontFamily }) {
  const words = script.trim().split(/\s+/).filter(Boolean).slice(0, 12);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (words.length === 0) return;
    const interval = setInterval(() => {
      setActiveIdx(i => (i + 1) % words.length);
    }, 600);
    return () => clearInterval(interval);
  }, [words.length]);

  if (words.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center py-4">
        스크립트를 입력하면 자막 미리보기가 표시됩니다
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{ aspectRatio: "9/16", maxHeight: 220, background: "#1a1a2e" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div
          className="rounded-xl px-4 py-2 text-center"
          style={{ background: "rgba(0,0,0,0.5)", fontFamily }}
        >
          <p className="font-black leading-tight" style={{ fontSize: 18, color: "#111" }}>
            {words.map((w, i) => (
              <span key={i}>{i === 0 ? w : ` ${w}`}</span>
            ))}
          </p>
        </div>
      </div>
      <div className="absolute bottom-2 right-2 text-[9px] text-white/40 font-mono">9:16</div>
    </div>
  );
}
