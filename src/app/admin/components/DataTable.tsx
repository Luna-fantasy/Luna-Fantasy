'use client';

import { useState, useMemo } from 'react';

export interface Column<T = any> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T = any> {
  title?: string;
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  totalItems?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  serverPagination?: boolean;
  actions?: React.ReactNode;
}

export default function DataTable<T extends Record<string, any>>({
  title,
  columns,
  data,
  pageSize = 20,
  totalItems,
  currentPage: controlledPage,
  onPageChange,
  serverPagination = false,
  actions,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [localPage, setLocalPage] = useState(1);

  const page = controlledPage ?? localPage;
  const setPage = onPageChange ?? setLocalPage;

  const sortedData = useMemo(() => {
    if (!sortKey || serverPagination) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [data, sortKey, sortDir, serverPagination]);

  const total = totalItems ?? data.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const displayData = serverPagination
    ? sortedData
    : sortedData.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: string, sortable?: boolean) => {
    if (sortable === false) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className="admin-table-container">
      {(title || actions) && (
        <div className="admin-table-header">
          {title && <h3 className="admin-table-title">{title}</h3>}
          {actions && <div>{actions}</div>}
        </div>
      )}
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={sortKey === col.key ? 'sorted' : ''}
                onClick={() => handleSort(col.key, col.sortable)}
                style={col.sortable === false ? { cursor: 'default' } : undefined}
              >
                {col.label}
                {sortKey === col.key && (sortDir === 'asc' ? ' \u2191' : ' \u2193')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                No data found
              </td>
            </tr>
          ) : (
            displayData.map((row, i) => (
              <tr key={(row._id as string) ?? (row.id as string) ?? i}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : (row[col.key] as React.ReactNode) ?? '-'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="admin-pagination">
          <span className="admin-pagination-info">
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="admin-pagination-buttons">
            <button
              className="admin-pagination-btn"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </button>
            <button
              className="admin-pagination-btn"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
