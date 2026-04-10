import { useState } from "react";

export default function FreeTextInput({ onSend, disabled }) {
  const [val, setVal] = useState('');

  const handleSend = () => {
    const trimmed = val.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setVal('');
  };

  return (
    <div className="px-4 pb-4 pt-2 border-t border-gray-100">
      <div className="flex gap-2 items-end">
        <textarea
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={disabled}
          placeholder="직접 입력하거나 위에서 선택하세요..."
          rows={2}
          className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-400 disabled:opacity-50 bg-white"
        />
        <button onClick={handleSend} disabled={disabled || !val.trim()}
          className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-40 transition-colors shrink-0">
          전송
        </button>
      </div>
    </div>
  );
}
