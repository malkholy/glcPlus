import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { ColumnDef, SortState, FilterState, GridSettings, DataGridProps } from './DataGridTypes';
import { DataGridToolbar } from './DataGridToolbar';
import { DataGridPagination } from './DataGridPagination';

const DENSITY_HEIGHT = { compact: 32, normal: 42, comfortable: 54 };

function getRowKey<T>(row: T, rowKey: DataGridProps<T>['rowKey']): string {
  if (typeof rowKey === 'function') return rowKey(row);
  return String((row as any)[rowKey]);
}

function compareValues(a: any, b: any): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

function aggregate(values: number[], fn: string): string {
  if (!values.length) return '—';
  switch (fn) {
    case 'sum':   return values.reduce((a, b) => a + b, 0).toLocaleString();
    case 'avg':   return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
    case 'min':   return Math.min(...values).toLocaleString();
    case 'max':   return Math.max(...values).toLocaleString();
    case 'count': return values.length.toLocaleString();
    default:      return '—';
  }
}

interface CtxMenu { x: number; y: number; row: any }

export function DataGrid<T extends Record<string, any>>({
  columns: columnDefs, data: rawData, rowKey,
  loading = false, error = null,
  title, description,
  darkMode: initDark = false,
  rtl: initRtl = false,
  selectable = true,
  expandable = false,
  renderExpand,
  onRowClick,
  onAddRow,
  onDeleteRows,
  storageKey = 'datagrid_settings',
  height = 520,
  stickyHeader = true,
}: DataGridProps<T>) {

  const loadSettings = (): Partial<GridSettings> => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  };
  const saved = loadSettings();

  const [darkMode,     setDarkMode]     = useState(saved.darkMode ?? initDark);
  const [rtl,          setRtl]          = useState(saved.rtl ?? initRtl);
  const [sort,         setSort]         = useState<SortState>({ col: '', dir: null });
  const [filters,      setFilters]      = useState<FilterState>({});
  const [globalSearch, setGlobalSearch] = useState('');
  const [groupCol,     setGroupCol]     = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState(saved.pageSize ?? 20);
  const [density,      setDensity]      = useState<'compact' | 'normal' | 'comfortable'>('normal');
  const [colOrder,     setColOrder]     = useState<string[]>(() =>
    saved.columnOrder?.length ? saved.columnOrder : columnDefs.map(c => c.key)
  );
  const [colWidths,    setColWidths]    = useState<Record<string, number>>(() =>
    saved.columnWidths || Object.fromEntries(columnDefs.map(c => [c.key, c.width || 150]))
  );
  const [hiddenCols,   setHiddenCols]   = useState<Set<string>>(() =>
    new Set(saved.hiddenCols || columnDefs.filter(c => c.hidden).map(c => c.key))
  );
  const [data,         setData]         = useState<T[]>(rawData);
  const [ctxMenu,      setCtxMenu]      = useState<CtxMenu | null>(null);
  const [editCell,     setEditCell]     = useState<{ rowKey: string; col: string } | null>(null);
  const [editValue,    setEditValue]    = useState<any>(null);
  const [dragCol,      setDragCol]      = useState<string | null>(null);
  const [dragOver,     setDragOver]     = useState<string | null>(null);

  const rowHeight = DENSITY_HEIGHT[density];

  useEffect(() => { setData(rawData); }, [rawData]);

  useEffect(() => {
    const s: GridSettings = {
      columnOrder: colOrder, columnWidths: colWidths,
      hiddenCols: Array.from(hiddenCols), pageSize, darkMode, rtl,
    };
    localStorage.setItem(storageKey, JSON.stringify(s));
  }, [colOrder, colWidths, hiddenCols, pageSize, darkMode, rtl]);

  useEffect(() => {
    const handler = () => setCtxMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const columns = useMemo(() => {
    const map = Object.fromEntries(columnDefs.map(c => [c.key, c]));
    return colOrder.filter(k => map[k]).map(k => map[k]);
  }, [columnDefs, colOrder]);

  const visibleCols = useMemo(
    () => columns.filter(c => !hiddenCols.has(c.key)),
    [columns, hiddenCols]
  );

  const processed = useMemo(() => {
    let rows = [...data];
    Object.entries(filters).forEach(([col, val]) => {
      if (!val) return;
      const lv = val.toLowerCase();
      rows = rows.filter(r => String(r[col] ?? '').toLowerCase().includes(lv));
    });
    if (globalSearch) {
      const gs = globalSearch.toLowerCase();
      rows = rows.filter(r =>
        visibleCols.some(c => String(r[c.key] ?? '').toLowerCase().includes(gs))
      );
    }
    if (sort.col && sort.dir) {
      rows.sort((a, b) => {
        const v = compareValues(a[sort.col], b[sort.col]);
        return sort.dir === 'asc' ? v : -v;
      });
    }
    return rows;
  }, [data, filters, globalSearch, sort, visibleCols]);

  const totalRows = processed.length;
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processed.slice(start, start + pageSize);
  }, [processed, page, pageSize]);

  useEffect(() => { setPage(1); }, [filters, globalSearch, sort, groupCol]);

  const groupedRows = useMemo(() => {
    if (!groupCol) return null;
    const groups: Record<string, T[]> = {};
    pagedRows.forEach(r => {
      const key = String(r[groupCol] ?? '(blank)');
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  }, [pagedRows, groupCol]);

  const allSelected  = pagedRows.length > 0 && pagedRows.every(r => selectedRows.has(getRowKey(r, rowKey)));
  const someSelected = pagedRows.some(r => selectedRows.has(getRowKey(r, rowKey)));

  const toggleSelectAll = useCallback(() => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (allSelected) pagedRows.forEach(r => next.delete(getRowKey(r, rowKey)));
      else             pagedRows.forEach(r => next.add(getRowKey(r, rowKey)));
      return next;
    });
  }, [allSelected, pagedRows, rowKey]);

  const toggleRow = useCallback((key: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const handleSort = (col: string) => {
    setSort(prev => ({
      col,
      dir: prev.col === col
        ? (prev.dir === 'asc' ? 'desc' : prev.dir === 'desc' ? null : 'asc')
        : 'asc',
    }));
  };

  const startResize = (e: React.MouseEvent, col: string) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[col] || 150;
    const onMove = (ev: MouseEvent) =>
      setColWidths(prev => ({ ...prev, [col]: Math.max(60, startW + ev.clientX - startX) }));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleDragStart = (col: string) => setDragCol(col);
  const handleDragOver  = (e: React.DragEvent, col: string) => { e.preventDefault(); setDragOver(col); };
  const handleDrop      = (col: string) => {
    if (!dragCol || dragCol === col) { setDragCol(null); setDragOver(null); return; }
    setColOrder(prev => {
      const next = [...prev];
      const from = next.indexOf(dragCol);
      const to   = next.indexOf(col);
      next.splice(from, 1);
      next.splice(to, 0, dragCol);
      return next;
    });
    setDragCol(null); setDragOver(null);
  };

  const startEdit   = (rKey: string, col: string, val: any) => { setEditCell({ rowKey: rKey, col }); setEditValue(val); };
  const commitEdit  = () => {
    if (!editCell) return;
    setData(prev => prev.map(r =>
      getRowKey(r, rowKey) === editCell.rowKey ? { ...r, [editCell.col]: editValue } : r
    ));
    setEditCell(null);
  };

  const handleImport = (rows: any[]) => setData(prev => [...prev, ...rows as T[]]);

  const toggleCol = (key: string) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const aggRow = useMemo(() => Object.fromEntries(
    visibleCols.map(c => {
      if (!c.aggFn || c.aggFn === 'none') return [c.key, null];
      const vals = processed.map(r => Number(r[c.key])).filter(v => !isNaN(v));
      return [c.key, aggregate(vals, c.aggFn)];
    })
  ), [visibleCols, processed]);

  const getPinnedLeft = (col: ColumnDef<T>) => {
    if (col.pinned !== 'left') return undefined;
    let offset = selectable ? 40 : 0;
    for (const c of visibleCols) {
      if (c.key === col.key) break;
      if (c.pinned === 'left') offset += (colWidths[c.key] || 150);
    }
    return offset;
  };

  const renderCell = (row: T, col: ColumnDef<T>) => {
    const rKey = getRowKey(row, rowKey);
    const val  = row[col.key];
    const isEditing = editCell?.rowKey === rKey && editCell?.col === col.key;

    if (isEditing && col.editable) {
      return (
        <input autoFocus value={editValue ?? ''}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditCell(null); }}
          style={{ width: '100%', padding: '3px 6px', border: '2px solid var(--accent)',
            borderRadius: 4, background: 'var(--input-bg)', color: 'var(--text)',
            fontSize: 13, fontFamily: 'var(--font)', outline: 'none' }} />
      );
    }

    if (col.render) return col.render(val, row);

    if (col.type === 'badge' && col.badgeMap) {
      const badge = col.badgeMap[val];
      if (!badge) return <span style={{ color: 'var(--text-secondary)' }}>{val}</span>;
      return (
        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20,
          fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      );
    }

    if (col.type === 'boolean') return (
      <span style={{ color: val ? '#22c55e' : '#94a3b8', fontWeight: 700 }}>{val ? '✓' : '—'}</span>
    );

    if (col.format) return <span>{col.format(val, row)}</span>;
    if (val == null || val === '') return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
    return <span>{String(val)}</span>;
  };

  const renderHeader = (col: ColumnDef<T>) => {
    const isSorted   = sort.col === col.key;
    const pinnedLeft = col.pinned === 'left' ? getPinnedLeft(col) : undefined;

    return (
      <th key={col.key} draggable
        onDragStart={() => handleDragStart(col.key)}
        onDragOver={e => handleDragOver(e, col.key)}
        onDrop={() => handleDrop(col.key)}
        style={{
          position: stickyHeader || col.pinned ? 'sticky' : undefined,
          top: stickyHeader ? 0 : undefined,
          left: pinnedLeft != null ? pinnedLeft : undefined,
          zIndex: col.pinned === 'left' ? 30 : stickyHeader ? 20 : undefined,
          width: colWidths[col.key] || 150,
          minWidth: col.minWidth || 60,
          padding: '0 8px',
          textAlign: col.align || 'left',
          background: dragOver === col.key ? 'var(--accent-bg)' : 'var(--header-bg)',
          borderBottom: '2px solid var(--border)',
          borderRight: '1px solid var(--border)',
          fontWeight: 700, fontSize: 12,
          color: isSorted ? 'var(--accent)' : 'var(--text-secondary)',
          letterSpacing: '.4px', textTransform: 'uppercase',
          userSelect: 'none', whiteSpace: 'nowrap',
          overflow: 'hidden', cursor: 'grab',
        }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 0' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 4,
              cursor: col.sortable !== false ? 'pointer' : 'default' }}
            onClick={() => col.sortable !== false && handleSort(col.key)}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.title}</span>
            {col.sortable !== false && (
              <span style={{ fontSize: 10, opacity: isSorted ? 1 : 0.3 }}>
                {isSorted ? (sort.dir === 'asc' ? '▲' : sort.dir === 'desc' ? '▼' : '⇅') : '⇅'}
              </span>
            )}
          </div>
          {col.filterable && (
            <input placeholder="Filter..."
              value={filters[col.key] || ''}
              onChange={e => { setFilters(f => ({ ...f, [col.key]: e.target.value })); setPage(1); }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', padding: '2px 6px', border: '1px solid var(--border)',
                borderRadius: 4, background: 'var(--input-bg)', color: 'var(--text)',
                fontSize: 11, fontFamily: 'var(--font)', outline: 'none',
                fontWeight: 400, textTransform: 'none', letterSpacing: 0 }} />
          )}
        </div>
        {col.resizable !== false && (
          <div onMouseDown={e => startResize(e, col.key)}
            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} />
        )}
      </th>
    );
  };

  const renderRow = (row: T, idx: number) => {
    const rKey       = getRowKey(row, rowKey);
    const isSelected = selectedRows.has(rKey);
    const isExpanded = expandedRows.has(rKey);

    return (
      <React.Fragment key={rKey}>
        <tr
          style={{
            height: rowHeight,
            background: isSelected ? 'var(--row-selected)'
              : idx % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)',
            cursor: onRowClick ? 'pointer' : 'default',
          }}
          onClick={() => onRowClick?.(row)}
          onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, row }); }}
          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--row-hover)'; }}
          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)'; }}
        >
          {selectable && (
            <td style={{ position: 'sticky', left: 0, zIndex: 10, width: 40, textAlign: 'center',
              background: isSelected ? 'var(--row-selected)' : idx % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)',
              borderRight: '1px solid var(--border)', padding: 0 }}>
              <input type="checkbox" checked={isSelected}
                onChange={() => toggleRow(rKey)} onClick={e => e.stopPropagation()}
                style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
            </td>
          )}
          {expandable && (
            <td style={{ width: 32, textAlign: 'center', padding: 0 }}>
              <button onClick={e => {
                e.stopPropagation();
                setExpandedRows(prev => { const n = new Set(prev); n.has(rKey) ? n.delete(rKey) : n.add(rKey); return n; });
              }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 14, padding: 4 }}>
                {isExpanded ? '▼' : '▶'}
              </button>
            </td>
          )}
          {visibleCols.map(col => {
            const pinnedLeft  = col.pinned === 'left' ? getPinnedLeft(col) : undefined;
            const customStyle = col.cellStyle?.(row[col.key], row) || {};
            return (
              <td key={col.key}
                style={{
                  position: col.pinned === 'left' ? 'sticky' : undefined,
                  left: pinnedLeft != null ? pinnedLeft : undefined,
                  zIndex: col.pinned === 'left' ? 10 : undefined,
                  padding: '0 10px',
                  width: colWidths[col.key] || 150,
                  maxWidth: colWidths[col.key] || 150,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: 13, color: 'var(--text)',
                  textAlign: col.align || 'left',
                  borderRight: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  background: col.pinned === 'left'
                    ? (isSelected ? 'var(--row-selected)' : idx % 2 === 0 ? 'var(--row-even)' : 'var(--row-odd)')
                    : undefined,
                  ...customStyle,
                }}
                onDoubleClick={() => col.editable && startEdit(rKey, col.key, row[col.key])}>
                {renderCell(row, col)}
              </td>
            );
          })}
        </tr>
        {expandable && isExpanded && renderExpand && (
          <tr>
            <td colSpan={visibleCols.length + (selectable ? 1 : 0) + 1}
              style={{ padding: '12px 24px', background: 'var(--expand-bg)', borderBottom: '1px solid var(--border)' }}>
              {renderExpand(row)}
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  const cssVars: React.CSSProperties = darkMode ? {
    '--bg': '#0f1117', '--surface': '#1a1d27', '--header-bg': '#1a1d27',
    '--border': '#2d3149', '--text': '#e2e8f0', '--text-secondary': '#64748b',
    '--accent': '#6366f1', '--accent-bg': 'rgba(99,102,241,.15)',
    '--blue': '#60a5fa', '--purple': '#a78bfa',
    '--input-bg': '#252836', '--btn-bg': '#252836',
    '--row-even': '#1a1d27', '--row-odd': '#1e2130',
    '--row-hover': '#252836', '--row-selected': 'rgba(99,102,241,.18)',
    '--expand-bg': '#252836',
    '--font': "'DM Sans', system-ui, sans-serif",
    '--font-display': "'Sora', system-ui, sans-serif",
  } as React.CSSProperties : {
    '--bg': '#f8fafc', '--surface': '#ffffff', '--header-bg': '#f8fafc',
    '--border': '#e2e8f0', '--text': '#0f172a', '--text-secondary': '#64748b',
    '--accent': '#6366f1', '--accent-bg': '#ede9fe',
    '--blue': '#1d4ed8', '--purple': '#7c3aed',
    '--input-bg': '#ffffff', '--btn-bg': '#f8fafc',
    '--row-even': '#ffffff', '--row-odd': '#f8fafc',
    '--row-hover': '#f0f4ff', '--row-selected': '#ede9fe',
    '--expand-bg': '#f8fafc',
    '--font': "'DM Sans', system-ui, sans-serif",
    '--font-display': "'Sora', system-ui, sans-serif",
  } as React.CSSProperties;

  return (
    <div style={{ ...cssVars, direction: rtl ? 'rtl' : 'ltr', fontFamily: 'var(--font)' }}
      onKeyDown={e => { if (e.key === 'Escape') { setEditCell(null); setCtxMenu(null); } if (e.key === 'Enter' && editCell) commitEdit(); }}
      tabIndex={0}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: darkMode ? '0 4px 32px rgba(0,0,0,.4)' : '0 1px 16px rgba(0,0,0,.08)' }}>

        <DataGridToolbar
          columns={columnDefs} data={data} filteredData={processed}
          selectedRows={selectedRows} globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch} groupCol={groupCol} setGroupCol={setGroupCol}
          hiddenCols={hiddenCols} toggleCol={toggleCol}
          darkMode={darkMode} toggleDark={() => setDarkMode(v => !v)}
          rtl={rtl} toggleRtl={() => setRtl(v => !v)}
          onAddRow={onAddRow}
          onDeleteRows={onDeleteRows ? () => {
            const sel = data.filter(r => selectedRows.has(getRowKey(r, rowKey)));
            onDeleteRows(sel); setSelectedRows(new Set());
          } : undefined}
          onImport={handleImport}
          rowKey={r => getRowKey(r, rowKey)}
          title={title} description={description}
          density={density} setDensity={setDensity}
        />

        <div style={{ overflowX: 'auto', overflowY: 'auto', height, position: 'relative' }}>

          {loading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(2px)' }}>
              <div style={{ textAlign: 'center', color: 'var(--accent)' }}>
                <div style={{ fontSize: 32, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</div>
                <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600 }}>Loading data…</div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: 48, textAlign: 'center', color: '#dc2626' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Error loading data</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{error}</div>
            </div>
          )}

          {!loading && !error && processed.length === 0 && (
            <div style={{ padding: 64, textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: .3 }}>◫</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>No results found</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Try adjusting your filters or search query</div>
              {(Object.values(filters).some(Boolean) || globalSearch) && (
                <button onClick={() => { setFilters({}); setGlobalSearch(''); }}
                  style={{ marginTop: 16, padding: '8px 20px', background: 'var(--accent)', color: '#fff',
                    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {!error && processed.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 13 }}>
              <colgroup>
                {selectable && <col style={{ width: 40 }} />}
                {expandable && <col style={{ width: 32 }} />}
                {visibleCols.map(c => <col key={c.key} style={{ width: colWidths[c.key] || 150 }} />)}
              </colgroup>
              <thead>
                <tr>
                  {selectable && (
                    <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 31, width: 40,
                      textAlign: 'center', background: 'var(--header-bg)',
                      borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', padding: 0 }}>
                      <input type="checkbox" checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                        onChange={toggleSelectAll}
                        style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                    </th>
                  )}
                  {expandable && (
                    <th style={{ width: 32, background: 'var(--header-bg)',
                      borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, zIndex: 20 }} />
                  )}
                  {visibleCols.map(col => renderHeader(col))}
                </tr>
              </thead>
              <tbody>
                {groupedRows
                  ? Object.entries(groupedRows).map(([groupVal, groupRows]) => (
                    <React.Fragment key={groupVal}>
                      <tr>
                        <td colSpan={visibleCols.length + (selectable ? 1 : 0) + (expandable ? 1 : 0)}
                          style={{ padding: '6px 16px', fontWeight: 700, fontSize: 12,
                            background: 'var(--accent-bg)', color: 'var(--accent)',
                            borderBottom: '1px solid var(--border)',
                            letterSpacing: '.4px', textTransform: 'uppercase' }}>
                          {columns.find(c => c.key === groupCol)?.title}: {groupVal}
                          <span style={{ marginLeft: 8, fontWeight: 400, opacity: .7 }}>({groupRows.length} rows)</span>
                        </td>
                      </tr>
                      {groupRows.map((row, i) => renderRow(row, i))}
                    </React.Fragment>
                  ))
                  : pagedRows.map((row, i) => renderRow(row, i))
                }
                {visibleCols.some(c => c.aggFn && c.aggFn !== 'none') && (
                  <tr style={{ background: 'var(--header-bg)', fontWeight: 700, position: 'sticky', bottom: 0, zIndex: 10 }}>
                    {selectable && <td style={{ borderTop: '2px solid var(--border)', background: 'var(--header-bg)' }} />}
                    {expandable && <td style={{ borderTop: '2px solid var(--border)', background: 'var(--header-bg)' }} />}
                    {visibleCols.map(col => (
                      <td key={col.key} style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700,
                        color: aggRow[col.key] ? 'var(--accent)' : 'var(--text-secondary)',
                        textAlign: col.align || 'left',
                        borderTop: '2px solid var(--border)', background: 'var(--header-bg)' }}>
                        {aggRow[col.key] && (
                          <span title={col.aggFn?.toUpperCase()}>
                            {col.aggFn === 'count' ? `# ${aggRow[col.key]}` : aggRow[col.key]}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <DataGridPagination
          page={page} pageSize={pageSize} total={totalRows}
          onPageChange={setPage} onSizeChange={setPageSize} darkMode={darkMode} />
      </div>

      {ctxMenu && (
        <div style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.2)',
          minWidth: 180, padding: '4px 0', fontFamily: 'var(--font)' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ padding: '4px 14px 8px', fontSize: 11, fontWeight: 700,
            color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.8px' }}>
            Row Actions
          </div>
          {[
            { icon: '✓', label: 'Select row',  fn: () => { toggleRow(getRowKey(ctxMenu.row, rowKey)); setCtxMenu(null); } },
            { icon: '⎘', label: 'Copy row',    fn: () => { navigator.clipboard?.writeText(JSON.stringify(ctxMenu.row)); setCtxMenu(null); } },
            ...(expandable ? [{ icon: '▶', label: 'Expand row', fn: () => {
              const k = getRowKey(ctxMenu.row, rowKey);
              setExpandedRows(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
              setCtxMenu(null);
            }}] : []),
            ...(onDeleteRows ? [{ icon: '🗑', label: 'Delete row', fn: () => { onDeleteRows([ctxMenu.row]); setCtxMenu(null); } }] : []),
          ].map(item => (
            <div key={item.label} onClick={item.fn}
              style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ width: 16, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
