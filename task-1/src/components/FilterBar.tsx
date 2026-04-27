import { useState, useRef, useEffect } from 'react';
import { YEARS, QUARTERS, CATEGORIES } from '../data/employees';
import type { Category } from '../data/employees';

interface DropdownProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}

function Dropdown({ label, value, options, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="dropdown" ref={ref}>
      <button
        className={`dropdown-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className="dropdown-label">{value || label}</span>
        <svg className={`chevron${open ? ' rotated' : ''}`} width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="dropdown-menu">
          <button
            className={`dropdown-item${!value ? ' selected' : ''}`}
            onClick={() => { onChange(''); setOpen(false); }}
            type="button"
          >
            {label}
          </button>
          {options.map((opt) => (
            <button
              key={opt}
              className={`dropdown-item${value === opt ? ' selected' : ''}`}
              onClick={() => { onChange(opt); setOpen(false); }}
              type="button"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface FilterBarProps {
  year: string;
  quarter: string;
  category: Category | '';
  search: string;
  onYear: (v: string) => void;
  onQuarter: (v: string) => void;
  onCategory: (v: Category | '') => void;
  onSearch: (v: string) => void;
}

export default function FilterBar({ year, quarter, category, search, onYear, onQuarter, onCategory, onSearch }: FilterBarProps) {
  return (
    <div className="filter-bar">
      <Dropdown label="All Years" value={year} options={YEARS} onChange={onYear} />
      <Dropdown label="All Quarters" value={quarter} options={QUARTERS} onChange={onQuarter} />
      <Dropdown label="All Categories" value={category} options={CATEGORIES} onChange={(v) => onCategory(v as Category | '')} />
      <div className="search-wrapper">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="#6b7280" strokeWidth="1.6" />
          <path d="M10.5 10.5l3 3" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          className="search-input"
          type="text"
          placeholder="Search employee..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        {search && (
          <button className="search-clear" onClick={() => onSearch('')} type="button">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
