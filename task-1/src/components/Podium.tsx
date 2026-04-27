import type { RankedEmployee } from '../data/employees';

const RANK_BORDER: Record<number, string> = {
  1: '#f5c518',
  2: '#fff',
  3: '#fff',
};

const BADGE_BG: Record<number, string> = {
  1: '#f5c518',
  2: '#8a9bb0',
  3: '#a0735a',
};

const PODIUM_BLOCK: Record<number, { bg: string; lipColor: string; numColor: string }> = {
  1: { bg: 'linear-gradient(180deg, #fef9c3 0%, #fde68a 100%)', lipColor: '#fde047', numColor: '#d4b84a' },
  2: { bg: 'linear-gradient(180deg, #e2e8f4 0%, #c8d0e0 100%)', lipColor: '#cbd5e1', numColor: '#b0b8cc' },
  3: { bg: 'linear-gradient(180deg, #e2e8f4 0%, #c8d0e0 100%)', lipColor: '#cbd5e1', numColor: '#b0b8cc' },
};

interface AvatarProps {
  emp: RankedEmployee;
  size: number;
  rank: number;
}

function Avatar({ emp, size, rank }: AvatarProps) {
  const borderColor = RANK_BORDER[rank] ?? '#ccc';
  const badgeBg = BADGE_BG[rank] ?? '#aaa';
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {emp.photo ? (
        <img
          src={emp.photo}
          alt={emp.name}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: `5px solid ${borderColor}`,
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: emp.color,
            border: `5px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(size * 0.3),
            fontWeight: 700,
            color: '#fff',
            userSelect: 'none',
          }}
        >
          {emp.initials}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: -2,
          width: Math.round(size * 0.36),
          height: Math.round(size * 0.36),
          borderRadius: '50%',
          background: badgeBg,
          color: '#fff',
          fontSize: Math.round(size * 0.18),
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2.5px solid #fff',
        }}
      >
        {rank}
      </div>
    </div>
  );
}

interface PodiumCardProps {
  emp: RankedEmployee;
  rank: number;
  height: number;
  avatarSize: number;
}

function PodiumCard({ emp, rank, height, avatarSize }: PodiumCardProps) {
  const block = PODIUM_BLOCK[rank]!;
  const isFirst = rank === 1;

  return (
    <div className={`podium-card podium-rank-${rank}`}>
      <div className="podium-person">
        <Avatar emp={emp} size={avatarSize} rank={rank} />
        <div className="podium-name">{emp.name}</div>
        <div className="podium-title">{emp.title} ({emp.department})</div>
        <div className={`podium-points ${isFirst ? 'podium-points-gold' : 'podium-points-silver'}`}>
          <span className={isFirst ? 'star-gold' : 'star-blue'}>★</span>
          <span>{emp.totalPoints}</span>
        </div>
      </div>
      <div
        className="podium-block"
        style={{
          height,
          background: block.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `inset 0 5px 0 ${block.lipColor}`,
        }}
      >
        <span
          style={{
            fontSize: 80,
            fontWeight: 900,
            color: block.numColor,
            opacity: 0.45,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {rank}
        </span>
      </div>
    </div>
  );
}

interface PodiumProps {
  top3: RankedEmployee[];
}

export default function Podium({ top3 }: PodiumProps) {
  if (top3.length < 1) return null;
  const [first, second, third] = top3;
  return (
    <div className="podium">
      {second && <PodiumCard emp={second} rank={2} height={150} avatarSize={88} />}
      {first && <PodiumCard emp={first} rank={1} height={200} avatarSize={120} />}
      {third && <PodiumCard emp={third} rank={3} height={115} avatarSize={88} />}
    </div>
  );
}
