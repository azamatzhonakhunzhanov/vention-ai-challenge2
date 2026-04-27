import { useState, useMemo, useEffect } from 'react';
import rawEmployees, { computeEmployees } from './data/employees';
import type { Category } from './data/employees';
import FilterBar from './components/FilterBar';
import Podium from './components/Podium';
import LeaderboardRow from './components/LeaderboardRow';
import './App.css';

export default function App() {
  const [year, setYear] = useState('');
  const [quarter, setQuarter] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch(
      `https://randomuser.me/api/?results=${rawEmployees.length}&seed=vention-leaderboard&inc=picture`,
    )
      .then((r) => r.json())
      .then((data: { results: { picture: { medium: string; large: string } }[] }) => {
        const map: Record<number, string> = {};
        rawEmployees.forEach((emp, i) => {
          if (data.results[i]) map[emp.id] = data.results[i].picture.large;
        });
        setPhotos(map);
      })
      .catch(() => {});
  }, []);

  const ranked = useMemo(
    () => computeEmployees(rawEmployees, year, quarter, category),
    [year, quarter, category],
  );

  const displayed = useMemo(() => {
    const filtered = search.trim()
      ? ranked.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
      : ranked;
    return filtered.map((emp) => ({ ...emp, photo: photos[emp.id] }));
  }, [ranked, search, photos]);

  function toggle(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="app">
      <div className="page-header">
        <h1 className="page-title">Leaderboard</h1>
        <p className="page-subtitle">Top performers based on contributions and activity</p>
      </div>

      <FilterBar
        year={year}
        quarter={quarter}
        category={category}
        search={search}
        onYear={setYear}
        onQuarter={setQuarter}
        onCategory={setCategory}
        onSearch={setSearch}
      />

      {displayed.length === 0 ? (
        <div className="empty-state">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="8" stroke="#9ca3af" strokeWidth="1.5" />
            <path d="M9 8v5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="9" cy="5.5" r="0.9" fill="#9ca3af" />
          </svg>
          <span>No activities found matching the current filters.</span>
        </div>
      ) : (
        <>
          <Podium top3={displayed.slice(0, 3)} />
          <div className="leaderboard-list">
            {displayed.map((emp, idx) => (
              <LeaderboardRow
                key={emp.id}
                emp={emp}
                rank={idx + 1}
                expanded={expandedId === emp.id}
                onToggle={() => toggle(emp.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
