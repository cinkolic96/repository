import { useState } from 'react';
import type { MonthRow } from '../lib/calc';
import { useMoney } from './ui';

const W = 720;
const H = 260;
const PAD = { l: 56, r: 8, t: 12, b: 26 };

/** Bar sa zaobljenim gornjim krajem (4px), ravan na osnovici. */
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function niceMax(v: number) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export default function MonthChart({ rows }: { rows: MonthRow[] }) {
  const money = useMoney();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...rows.map((r) => Math.max(r.revenue, r.expenses))));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const slot = iw / rows.length;
  const bw = Math.min(18, (slot - 10) / 2);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  return (
    <div style={{ position: 'relative' }}>
      <div className="legend" style={{ marginBottom: 8 }}>
        <span><i style={{ background: 'var(--series-1)' }} />Prihodi</span>
        <span><i style={{ background: 'var(--series-2)' }} />Troškovi</span>
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Prihodi i troškovi po mjesecima" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
            <text className="axis-label" x={PAD.l - 6} y={y(t) + 4} textAnchor="end">{Math.round(t).toLocaleString('sr-Latn-ME')}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = PAD.l + slot * i + slot / 2;
          return (
            <g key={r.key}>
              {hover === i && <rect x={PAD.l + slot * i} y={PAD.t} width={slot} height={ih} fill="var(--surface-2)" />}
              <path className="s1" d={barPath(cx - bw - 1, y(r.revenue), bw, PAD.t + ih - y(r.revenue))} />
              <path className="s2" d={barPath(cx + 1, y(r.expenses), bw, PAD.t + ih - y(r.expenses))} />
              <text className="axis-label" x={cx} y={H - 8} textAnchor="middle">{r.label}</text>
              <rect x={PAD.l + slot * i} y={PAD.t} width={slot} height={ih + PAD.b} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="chart-tooltip" style={{ left: `${((PAD.l + slot * hover + slot / 2) / W) * 100}%`, top: 30, transform: hover > 8 ? 'translateX(-100%)' : undefined }}>
          <strong>{rows[hover].label}</strong>
          <div><span className="swatch" style={{ background: 'var(--series-1)' }} />Prihodi: {money(rows[hover].revenue)}</div>
          <div><span className="swatch" style={{ background: 'var(--series-2)' }} />Troškovi: {money(rows[hover].expenses)}</div>
          <div>Dobit: <strong>{money(rows[hover].profit)}</strong></div>
        </div>
      )}
    </div>
  );
}
