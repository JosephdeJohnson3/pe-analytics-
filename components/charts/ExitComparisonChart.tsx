'use client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, ReferenceArea,
} from 'recharts';

interface DataPoint {
  multiple: number;
  original: number;
  floating: number;
}

interface ExitComparisonChartProps {
  data: DataPoint[];
  mode: 'irr' | 'moic';
  floatingLabel: string;
  originalLabel: string;
  impliedMultiple?: number;
}

function formatVal(value: number, mode: 'irr' | 'moic') {
  return mode === 'irr' ? `${(value * 100).toFixed(1)}%` : `${value.toFixed(2)}x`;
}

const CustomTooltip = ({ active, payload, label, mode }: any) => {
  if (!active || !payload?.length) return null;
  const orig  = payload.find((p: any) => p.dataKey === 'original');
  const float = payload.find((p: any) => p.dataKey === 'floating');
  const erosion = orig && float ? orig.value - float.value : null;
  return (
    <div className="bg-navy-900 border border-navy-700 rounded-lg p-3 text-xs font-mono shadow-xl">
      <p className="text-slate-300 font-semibold mb-2">{label}x Exit Multiple</p>
      {orig  && <p className="text-slate-400 mb-1">Original: <span className="text-white font-bold">{formatVal(orig.value, mode)}</span></p>}
      {float && <p className="text-blue-400 mb-1">Floating: <span className="text-white font-bold">{formatVal(float.value, mode)}</span></p>}
      {erosion !== null && erosion > 0 && (
        <p className="text-red-400 border-t border-navy-700 mt-2 pt-2">
          Rate erosion: <span className="font-bold">−{formatVal(erosion, mode)}</span>
        </p>
      )}
    </div>
  );
};

const ColoredDot = ({ cx, cy, value, mode }: any) => {
  let fill = '#dc2626';
  if (mode === 'irr')  { if (value >= 0.25) fill = '#059669'; else if (value >= 0.15) fill = '#d97706'; }
  else                 { if (value >= 2.50) fill = '#059669'; else if (value >= 1.50) fill = '#d97706'; }
  return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#0f172a" strokeWidth={2} />;
};

export default function ExitComparisonChart({ data, mode, floatingLabel, originalLabel, impliedMultiple }: ExitComparisonChartProps) {
  const multiples    = data.map(d => d.multiple);
  const xMin         = multiples[0] - 1;
  const xMax         = multiples[multiples.length - 1] + 1;
  const lastMultiple = multiples[multiples.length - 1];

  const strong  = mode === 'irr' ? 0.25 : 2.5;
  const warning = mode === 'irr' ? 0.15 : 1.5;
  const title   = mode === 'irr' ? 'IRR by Exit Multiple' : 'MOIC by Exit Multiple';

  const allVals = data.flatMap(d => [d.original, d.floating]);
  const yMin = Math.max(0, Math.min(...allVals) - (mode === 'irr' ? 0.03 : 0.2));
  const yMax = Math.max(...allVals) + (mode === 'irr' ? 0.03 : 0.2);

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
      <p className="text-sm font-semibold text-white mb-0.5">{title}</p>
      <p className="text-xs text-slate-500 mb-4">
        {mode === 'irr' ? 'Green ≥ 25%  ·  Yellow 15–25%  ·  Red < 15%' : 'Green ≥ 2.5x  ·  Yellow 1.5–2.5x  ·  Red < 1.5x'}
      </p>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 40, bottom: 16, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />

          <XAxis
            dataKey="multiple"
            type="number"
            domain={[xMin, xMax]}
            ticks={multiples}
            tickFormatter={v => `${v}x`}
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            label={{ value: 'Exit Multiple', position: 'insideBottom', offset: -4, fill: '#475569', fontSize: 10 }}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={v => formatVal(v, mode)}
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />

          <Tooltip content={<CustomTooltip mode={mode} />} />

          {/* Colored background zones */}
          <ReferenceArea y1={strong}  y2={yMax}   fill="#059669" fillOpacity={0.06} />
          <ReferenceArea y1={warning} y2={strong}  fill="#d97706" fillOpacity={0.06} />
          <ReferenceArea y1={yMin}    y2={warning} fill="#dc2626" fillOpacity={0.06} />

          {/* Threshold lines */}
          <ReferenceLine y={strong}  stroke="#059669" strokeDasharray="5 3" strokeWidth={1.5}
            label={{ value: mode === 'irr' ? '25%' : '2.5x', position: 'right', fill: '#059669', fontSize: 10 }} />
          <ReferenceLine y={warning} stroke="#d97706" strokeDasharray="5 3" strokeWidth={1.5}
            label={{ value: mode === 'irr' ? '15%' : '1.5x', position: 'right', fill: '#d97706', fontSize: 10 }} />

          {/* Original rate line */}
          <Line
            dataKey="original"
            name={originalLabel}
            stroke="#475569"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={{ fill: '#475569', r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: '#475569' }}
          />

          {/* Floating rate line */}
          <Line
            dataKey="floating"
            name={floatingLabel}
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={(props: any) => <ColoredDot {...props} mode={mode} />}
            activeDot={{ r: 7, fill: '#3b82f6' }}
          />

          {/* Above-market shading — starts exactly at implied multiple */}
          {impliedMultiple && (
            <ReferenceArea
              x1={impliedMultiple}
              x2={lastMultiple + 1}
              fill="#ef4444"
              fillOpacity={0.07}
            />
          )}

          {/* Market cap line — same coordinate as area */}
          {impliedMultiple && (
            <ReferenceLine
              x={impliedMultiple}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 3"
              label={{ value: 'Market cap', position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }}
            />
          )}

          <Legend
            formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>}
            wrapperStyle={{ paddingTop: 10 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-slate-600 mt-2">
        Dashed grey = original rate · Blue line = {floatingLabel.toLowerCase()} · Colored dots = performance zone at that exit
      </p>
    </div>
  );
}
