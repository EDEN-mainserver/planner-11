"use client";

interface PaginationProps {
  page: number;
  total: number;
  perPage?: number;
  onChange: (page: number) => void;
}

export default function Pagination({
  page,
  total,
  perPage = 12,
  onChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="flex items-center justify-center gap-4 py-4 text-sm text-[#555]">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="disabled:opacity-30 hover:text-[#6C63FF] transition-colors"
      >
        ‹
      </button>
      <span>
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="disabled:opacity-30 hover:text-[#6C63FF] transition-colors"
      >
        ›
      </button>
    </div>
  );
}
