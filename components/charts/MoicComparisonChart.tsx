'use client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer, Cell, Legend,
} from 'recharts';

interface DataPoint {
  multiple: number;   // numeric — enables precise reference line/area alignment
  original: number;
  floating: number;
}

interface MoicComparisonChartProps {
  data: DataPoint[];
  floatingLabel: string;
  originalLabel: string;
  impliedMultiple?: number;
}

function moicColor(v: number): string {
  if (v >= 2.5) return '#059669';
  if (v >= 1.5) return '#d97706';
  return '#dc2626';
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const orig  = payload.find((p: any) => p.dataKey === 'original');
  const float = payload.find((p: any) => p.dataKey === 'floating');
  const erosion = orig && float ? orig.value - float.value : null;
  return (
    <div className="bg-navy-900 border border-navy-700 rounded-lg p-3 text-xs font-mono shadow-xl">
      <p className="text-slate-300 font-semibold mb-2">{label}x Exit Multiple</p>
      {orig  && <p className="text-slate-400 mb-1">Original: <span className="text-white font-bold">{orig.value.toFixed(2)}x</span></p>}
      {float && <p className="text-blue-400  mb-1">Floating: <span className="text-white font-bold">{float.value.toFixed(2)}x</span></p>}
      {erosion !== null && erosion > 0 && (
        <p className="text-red-400 border-t border-navy-700 mt-2 pt-2">
          Rate erosion: <span className="font-bold">−{erosion.toFixed(2)}x</span>
        </p>
      )}
    </div>
  );
};

export default function MoicComparisonChart({ data, floatingLabel, originalLabel, impliedMultiple }: MoicComparisonChartProps) {
  const multiples     = data.map(d => d.multiple);
  const allVals       = data.flatMap(d => [d.original, d.floating]);
  const yMax          = Math.ceil((Math.max(...allVals) + 0.3) * 2) / 2;
  const xMin          = multiples[0] - 1;
  const xMax          = multiples[multiples.length - 1] + 1;
  const lastMultiple  = multiples[multiples.length - 1];

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
      <p className="text-sm font-semibold text-white mb-0.5">MOIC by Exit Multiple</p>
      <p className="text-xs text-slate-500 mb-4">Green ≥ 2.5x  ·  Yellow 1.5–2.5x  ·  Red &lt; 1.5x</p>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barSize={22} barGap={4} margin={{ top: 8, right: 40, bottom: 16, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />

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
            domain={[0, yMax]}
            tickFormatter={v => `${v.toFixed(1)}x`}
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />

          {/* MOIC threshold lines */}
          <ReferenceLine y={2.5} stroke="#059669" strokeDasharray="5 3" strokeWidth={1.5}
            label={{ value: '2.5x', position: 'right', fill: '#059669', fontSize: 10 }} />
          <ReferenceLine y={1.5} stroke="#d97706" strokeDasharray="5 3" strokeWidth={1.5}
            label={{ value: '1.5x', position: 'right', fill: '#d97706', fontSize: 10 }} />

          {/* Original — faded */}
          <Bar dataKey="original" name={originalLabel} radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={moicColor(d.original)} fillOpacity={0.35} />
            ))}
          </Bar>

          {/* Floating — solid */}
          <Bar dataKey="floating" name={floatingLabel} radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={moicColor(d.floating)} fillOpacity={1} />
            ))}
          </Bar>

          {/* Above-market zone — starts exactly at the implied multiple */}
          {impliedMultiple && (
            <ReferenceArea
              x1={impliedMultiple}
              x2={lastMultiple + 1}
              fill="#ef4444"
              fillOpacity={0.07}
            />
          )}

          {/* Market cap line — perfectly aligned with area start */}
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
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-slate-600 mt-2">
        Faded bars = original rate · Solid bars = {floatingLabel.toLowerCase()} · Height gap = MOIC lost to rates
      </p>
    </div>
  );
}
