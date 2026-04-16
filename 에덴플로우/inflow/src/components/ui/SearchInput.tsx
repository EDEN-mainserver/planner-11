"use client";

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onClear?: () => void;
  className?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "검색...",
  onClear,
  className = "",
}: SearchInputProps) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <span className="absolute left-3 text-[#999] text-sm">🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#F4F4F8] border-none outline-none rounded-[12px] pl-8 pr-8 py-2.5 text-sm text-[#111] placeholder:text-[#999] focus:ring-2 focus:ring-[#6C63FF]"
      />
      {value && onClear && (
        <button
          onClick={onClear}
          className="absolute right-3 text-[#999] hover:text-[#555] text-xs"
        >
          ✕
        </button>
      )}
    </div>
  );
}
