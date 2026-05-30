import React from 'react';

interface PaginationProps {
  page:         number;
  pageSize:     number;
  total:        number;
  onPageChange: (p: number) => void;
  onSizeChange: (s: number) => void;
  darkMode:     boolean;
}

const PAGE_SIZES = [10, 20, 50, 100, 200];

export function DataGridPagination({
  page, pageSize, total, onPageChange, onSizeChange, darkMode,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  const getPages = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 10, padding: '10px 16px',
      borderTop: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13,
    }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong> rows
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Rows per page:</span>
        <select
          value={pageSize}
          onChange={e => { onSizeChange(Number(e.target.value)); onPageChange(1); }}
          style={{
            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--input-bg)', color: 'var(--text)',
            fontSize: 13, fontFamily: 'var(--font)', cursor: 'pointer', outline: 'none',
          }}>
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <button style={navBtn(false)} disabled={page === 1} onClick={() => onPageChange(1)}>«</button>
        <button style={navBtn(false)} disabled={page === 1} onClick={() => onPageChange(page - 1)}>‹</button>
        {getPages().map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--text-secondary)' }}>…</span>
            : <button key={p} style={navBtn(p === page)} onClick={() => onPageChange(p as number)}>{p}</button>
        )}
        <button style={navBtn(false)} disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>›</button>
        <button style={navBtn(false)} disabled={page === totalPages} onClick={() => onPageChange(totalPages)}>»</button>
      </div>
    </div>
  );
}

const navBtn = (active: boolean): React.CSSProperties => ({
  minWidth: 32, height: 32, borderRadius: 6, padding: '0 6px',
  border: active ? 'none' : '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'var(--btn-bg)',
  color: active ? '#fff' : 'var(--text)',
  fontSize: 13, fontWeight: active ? 700 : 400,
  fontFamily: 'var(--font)', cursor: 'pointer', transition: 'all .12s',
});
