import React, { useRef, useState } from 'react';
import type { ColumnDef } from './DataGridTypes';
import * as XLSX from 'xlsx';

interface ToolbarProps<T> {
  columns:        ColumnDef<T>[];
  data:           T[];
  filteredData:   T[];
  selectedRows:   Set<string>;
  globalSearch:   string;
  setGlobalSearch:(v: string) => void;
  groupCol:       string | null;
  setGroupCol:    (v: string | null) => void;
  hiddenCols:     Set<string>;
  toggleCol:      (key: string) => void;
  darkMode:       boolean;
  toggleDark:     () => void;
  rtl:            boolean;
  toggleRtl:      () => void;
  onAddRow?:      () => void;
  onDeleteRows?:  () => void;
  onImport:       (rows: any[]) => void;
  rowKey:         (row: T) => string;
  title?:         string;
  description?:   string;
  density:        'compact' | 'normal' | 'comfortable';
  setDensity:     (d: 'compact' | 'normal' | 'comfortable') => void;
}

export function DataGridToolbar<T>({
  columns, data, filteredData, selectedRows, globalSearch, setGlobalSearch,
  groupCol, setGroupCol, hiddenCols, toggleCol,
  darkMode, toggleDark, rtl, toggleRtl,
  onAddRow, onDeleteRows, onImport,
  title, description, density, setDensity,
}: ToolbarProps<T>) {
  const [showCols,    setShowCols]    = useState(false);
  const [showGroup,   setShowGroup]   = useState(false);
  const [showDensity, setShowDensity] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const exportExcel = () => {
    const exportable = columns.filter(c => !hiddenCols.has(c.key));
    const rows = filteredData.map(row =>
      Object.fromEntries(exportable.map(c => [c.title, (row as any)[c.key]]))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${title || 'export'}_${Date.now()}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb   = XLSX.read(ev.target?.result, { type: 'binary' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      onImport(rows as any[]);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', gap: 12, flexWrap: 'wrap',
      borderBottom: '1px solid var(--border)', background: 'var(--surface)',
    }}>
      {/* Left */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {title && (
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)',
            letterSpacing: -0.3, fontFamily: 'var(--font-display)' }}>{title}</div>
        )}
        {description && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{description}</div>
        )}
        {selectedRows.size > 0 && (
          <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700,
            background: 'var(--accent-bg)', color: 'var(--accent)',
            padding: '2px 8px', borderRadius: 20 }}>
            {selectedRows.size} row{selectedRows.size > 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>

        {/* Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 10, fontSize: 16,
            color: 'var(--text-secondary)', pointerEvents: 'none' }}>⌕</span>
          <input
            style={{ padding: '7px 32px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--input-bg)', color: 'var(--text)', fontSize: 13,
              fontFamily: 'var(--font)', outline: 'none', width: 220 }}
            placeholder="Search all columns..."
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
          />
          {globalSearch && (
            <button onClick={() => setGlobalSearch('')}
              style={{ position: 'absolute', right: 8, background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>✕</button>
          )}
        </div>

        {/* Group By */}
        <div style={{ position: 'relative' }}>
          <button style={{ ...btn, ...(groupCol ? btnActive : {}) }}
            onClick={() => setShowGroup(v => !v)}>⊞ Group</button>
          {showGroup && (
            <div style={dropdown}>
              <div style={dropTitle}>Group By Column</div>
              <div style={dropItem(groupCol === null)}
                onClick={() => { setGroupCol(null); setShowGroup(false); }}>— None</div>
              {columns.map(c => (
                <div key={c.key} style={dropItem(groupCol === c.key)}
                  onClick={() => { setGroupCol(c.key); setShowGroup(false); }}>
                  {groupCol === c.key ? '✓ ' : '  '}{c.title}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Columns */}
        <div style={{ position: 'relative' }}>
          <button style={btn} onClick={() => setShowCols(v => !v)}>⊟ Columns</button>
          {showCols && (
            <div style={{ ...dropdown, width: 200 }}>
              <div style={dropTitle}>Show / Hide Columns</div>
              {columns.map(c => (
                <label key={c.key} style={{ ...dropItem(false), cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={!hiddenCols.has(c.key)}
                    onChange={() => toggleCol(c.key)}
                    style={{ accentColor: 'var(--accent)' }} />
                  {c.title}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Density */}
        <div style={{ position: 'relative' }}>
          <button style={btn} onClick={() => setShowDensity(v => !v)}>☰</button>
          {showDensity && (
            <div style={{ ...dropdown, width: 160 }}>
              <div style={dropTitle}>Row Density</div>
              {(['compact', 'normal', 'comfortable'] as const).map(d => (
                <div key={d} style={dropItem(density === d)}
                  onClick={() => { setDensity(d); setShowDensity(false); }}>
                  {density === d ? '✓ ' : '  '}{d.charAt(0).toUpperCase() + d.slice(1)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

        {/* Add Row */}
        {onAddRow && (
          <button style={{ ...btn, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }}
            onClick={onAddRow}>+ Add Row</button>
        )}

        {/* Delete */}
        {onDeleteRows && selectedRows.size > 0 && (
          <button style={{ ...btn, background: '#fee2e2', borderColor: '#fca5a5', color: '#dc2626' }}
            onClick={onDeleteRows}>🗑 Delete ({selectedRows.size})</button>
        )}

        {/* Import */}
        <button style={btn} onClick={() => importRef.current?.click()}>↑ Import</button>
        <input ref={importRef} type="file" accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }} onChange={handleImport} />

        {/* Export */}
        <button style={btn} onClick={exportExcel}>↓ Export</button>

        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

        {/* Dark mode */}
        <button style={iconBtn} onClick={toggleDark}>{darkMode ? '☀' : '☾'}</button>

        {/* RTL */}
        <button style={{ ...iconBtn, ...(rtl ? btnActive : {}) }} onClick={toggleRtl}>⇄</button>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--btn-bg)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
  fontFamily: 'var(--font)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s',
};
const btnActive: React.CSSProperties = {
  background: 'var(--accent-bg)', borderColor: 'var(--accent)', color: 'var(--accent)',
};
const iconBtn: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--btn-bg)', color: 'var(--text)', fontSize: 14,
  cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
};
const dropdown: React.CSSProperties = {
  position: 'absolute', top: '110%', right: 0, zIndex: 200,
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.15)',
  minWidth: 180, maxHeight: 320, overflowY: 'auto', padding: '4px 0',
};
const dropTitle: React.CSSProperties = {
  padding: '8px 14px 4px', fontSize: 10, fontWeight: 700,
  color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.8px',
};
const dropItem = (active: boolean): React.CSSProperties => ({
  padding: '7px 14px', fontSize: 13, cursor: 'pointer',
  color: active ? 'var(--accent)' : 'var(--text)',
  background: active ? 'var(--accent-bg)' : 'transparent',
  fontWeight: active ? 600 : 400, transition: 'background .1s',
});
