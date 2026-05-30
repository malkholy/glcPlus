export type ColumnType = 'text' | 'number' | 'date' | 'boolean' | 'badge' | 'custom';
export type SortDir    = 'asc' | 'desc' | null;
export type AggFn      = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'none';

export interface ColumnDef<T = any> {
  key:          string;
  title:        string;
  type?:        ColumnType;
  width?:       number;
  minWidth?:    number;
  pinned?:      'left' | 'right' | false;
  sortable?:    boolean;
  filterable?:  boolean;
  resizable?:   boolean;
  hidden?:      boolean;
  aggFn?:       AggFn;
  align?:       'left' | 'center' | 'right';
  format?:      (value: any, row: T) => string;
  render?:      (value: any, row: T) => React.ReactNode;
  cellClass?:   (value: any, row: T) => string;
  cellStyle?:   (value: any, row: T) => React.CSSProperties;
  badgeMap?:    Record<string, { label: string; color: string; bg: string }>;
  editable?:    boolean;
}

export interface SortState    { col: string; dir: SortDir; }
export interface FilterState  { [col: string]: string; }

export interface GridSettings {
  columnOrder:  string[];
  columnWidths: Record<string, number>;
  hiddenCols:   string[];
  pageSize:     number;
  darkMode:     boolean;
  rtl:          boolean;
}

export interface DataGridProps<T = any> {
  columns:        ColumnDef<T>[];
  data:           T[];
  rowKey:         keyof T | ((row: T) => string);
  loading?:       boolean;
  error?:         string | null;
  title?:         string;
  description?:   string;
  darkMode?:      boolean;
  rtl?:           boolean;
  selectable?:    boolean;
  expandable?:    boolean;
  renderExpand?:  (row: T) => React.ReactNode;
  onRowClick?:    (row: T) => void;
  onAddRow?:      () => void;
  onDeleteRows?:  (rows: T[]) => void;
  storageKey?:    string;
  height?:        number | string;
  stickyHeader?:  boolean;
}
