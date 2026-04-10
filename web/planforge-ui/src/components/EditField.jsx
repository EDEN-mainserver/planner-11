import { useState, useRef, useEffect } from "react";

export default function EditField({ value, onChange, multiline = false, className = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => { onChange(draft); setEditing(false); };

  if (!editing) {
    return (
      <span onClick={() => { setDraft(value); setEditing(true); }}
        className={`cursor-text rounded px-1 py-0.5 hover:bg-purple-50 hover:ring-1 hover:ring-purple-200 transition-all ${className}`}>
        {value || <span className="text-gray-300 italic">클릭하여 편집...</span>}
      </span>
    );
  }

  return multiline ? (
    <textarea ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => e.key === 'Escape' && setEditing(false)}
      className={`bg-white border border-purple-300 rounded px-2 py-1 outline-none text-gray-800 resize-none w-full ring-2 ring-purple-100 ${className}`}
      rows={3} />
  ) : (
    <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      className={`bg-white border border-purple-300 rounded px-2 py-1 outline-none text-gray-800 w-full ring-2 ring-purple-100 ${className}`} />
  );
}
