"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalCount: number;
  pageSize?: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalCount, pageSize = 50, onChange }: Props) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-4)", borderTop: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
        {start}–{end} of {totalCount}
      </span>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
          {page} / {totalPages}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
