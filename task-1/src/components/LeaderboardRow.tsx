import { useState } from 'react';
import type { RankedEmployee, Activity } from '../data/employees';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate().toString().padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.8',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function IconMonitor() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function IconGrad() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M22 10L12 5 2 10l10 5 10-5z" />
      <path d="M6 12.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
      <path d="M22 10v5" />
    </svg>
  );
}

function IconSmiley() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const CATEGORY_STYLES: Record<string, { bg: string; color: string }> = {
  Education: { bg: '#e0f2fe', color: '#0ea5e9' },
  'Public Speaking': { bg: '#f0f0f0', color: '#555' },
  'University Partnership': { bg: '#e8f4f0', color: '#2e7d5e' },
};

function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLES[category] ?? { bg: '#f0f0f0', color: '#555' };
  return (
    <span className="category-badge" style={{ background: style.bg, color: style.color }}>
      {category}
    </span>
  );
}

interface LeaderboardRowProps {
  emp: RankedEmployee;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}

export default function LeaderboardRow({ emp, rank, expanded, onToggle }: LeaderboardRowProps) {
  return (
    <div className={`leaderboard-row${expanded ? ' expanded' : ''}`}>
      <div className="row-main">
        <div className="row-rank">{rank}</div>
        {emp.photo ? (
          <img src={emp.photo} alt={emp.name} className="row-avatar row-avatar-photo" />
        ) : (
          <div className="row-avatar" style={{ background: emp.color, color: '#fff', fontSize: 14, fontWeight: 700 }}>
            {emp.initials}
          </div>
        )}
        <div className="row-info">
          <div className="row-name">{emp.name}</div>
          <div className="row-dept">{emp.title} ({emp.department})</div>
        </div>
        <div className="row-icons">
          {emp.publicSpeakingCount > 0 && (
            <span className="icon-count" title="Public Speaking">
              <IconMonitor />
              <span>{emp.publicSpeakingCount}</span>
            </span>
          )}
          {emp.educationCount > 0 && (
            <span className="icon-count" title="Education">
              <IconGrad />
              <span>{emp.educationCount}</span>
            </span>
          )}
          {emp.universityCount > 0 && (
            <span className="icon-count" title="University Partnership">
              <IconSmiley />
              <span>{emp.universityCount}</span>
            </span>
          )}
        </div>
        <div className="row-total">
          <span className="row-total-label">TOTAL</span>
          <span className="row-total-score">
            <span className="star">★</span>
            {emp.totalPoints}
          </span>
        </div>
        <button
          className={`chevron-btn${expanded ? ' open' : ''}`}
          type="button"
          onClick={onToggle}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="#0ea5e9" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="row-activities">
          <div className="activities-header">RECENT ACTIVITY</div>
          <table className="activities-table">
            <thead>
              <tr>
                <th>ACTIVITY</th>
                <th>CATEGORY</th>
                <th>DATE</th>
                <th>POINTS</th>
              </tr>
            </thead>
            <tbody>
              {[...emp.filteredActivities]
                .sort((a: Activity, b: Activity) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((act, i) => (
                  <tr key={i}>
                    <td className="act-name">{act.name}</td>
                    <td><CategoryBadge category={act.category} /></td>
                    <td className="act-date">{formatDate(act.date)}</td>
                    <td className="act-points">+{act.points}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
