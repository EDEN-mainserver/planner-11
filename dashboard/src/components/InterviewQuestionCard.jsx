import { useState } from "react";

export default function InterviewQuestionCard({ question, onSubmit, disabled }) {
  const [selected, setSelected] = useState([]);
  const [custom, setCustom] = useState('');

  const toggle = (opt) => {
    setSelected(p => p.includes(opt) ? p.filter(o => o !== opt) : [...p, opt]);
  };

  const canSubmit = selected.length > 0 || custom.trim();

  const handleSubmit = () => {
    const parts = [...selected];
    if (custom.trim()) parts.push(custom.trim());
    onSubmit(parts.join(', '));
  };

  if (question.type === 'open_text') {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-800">Q{question.number}. {question.text}</p>
        <textarea value={custom} onChange={e => setCustom(e.target.value)} rows={3}
          className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 resize-none"
          placeholder="자유롭게 입력해주세요..." />
        <button onClick={() => onSubmit(custom)} disabled={!custom.trim() || disabled}
          className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors">
          답변하기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-800">
        Q{question.number}. {question.text}{' '}
        <span className="text-xs text-gray-400 font-normal">(복수 선택)</span>
      </p>
      <div className="space-y-2">
        {question.options.map(opt => {
          if (opt === '직접 입력') {
            return (
              <div key={opt} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white">
                <div className="w-4 h-4 rounded border-2 border-gray-300 shrink-0" />
                <input type="text" value={custom} onChange={e => setCustom(e.target.value)}
                  className="flex-1 text-sm text-gray-700 outline-none placeholder-gray-300"
                  placeholder="직접 입력" />
              </div>
            );
          }
          const isSelected = selected.includes(opt);
          return (
            <button key={opt} onClick={() => toggle(opt)} disabled={disabled}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm text-left transition-all
                ${isSelected
                  ? 'border-purple-400 bg-purple-50 text-purple-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-purple-200 hover:bg-purple-50'}`}>
              <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all
                ${isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'}`}>
                {isSelected && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>
              {opt}
            </button>
          );
        })}
      </div>
      <button onClick={handleSubmit} disabled={!canSubmit || disabled}
        className="mt-2 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors">
        답변하기
      </button>
    </div>
  );
}
