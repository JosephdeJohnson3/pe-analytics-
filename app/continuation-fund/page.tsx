'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import {
  calculateContinuation, DISCOUNT_ROWS, GROWTH_COLS,
  type ContinuationInputs,
} from '@/lib/calculators/continuationFund';
import SensitivityTable from '@/components/ui/SensitivityTable';
import ResultCard from '@/components/ui/ResultCard';

// ── Theme ──────────────────────────────────────────────────────────────────
function T(isDark: boolean) {
  return isDark ? {
    page:      'bg-navy-950 text-slate-100',
    card:      'bg-navy-800 border border-navy-700',
    section:   'bg-navy-900 border border-navy-700',
    input:     'bg-navy-900 border-navy-700 text-slate-100 focus:border-blue-500',
    label:     'text-slate-400',
    text:      'text-white',
    muted:     'text-slate-400',
    dimmed:    'text-slate-500',
    divider:   'border-navy-700',
    presetBtn: 'bg-navy-700 hover:bg-navy-600 text-slate-300 border-navy-600',
    toggleBtn: 'bg-navy-700 hover:bg-navy-600 text-slate-300',
    chartBg:   '#1e293b',
    chartGrid: '#334155',
    chartText: '#94a3b8',
  } : {
    page:      'bg-slate-50 text-slate-900',
    card:      'bg-white border border-slate-200 shadow-sm',
    section:   'bg-slate-100 border border-slate-200',
    input:     'bg-white border-slate-300 text-slate-800 focus:border-blue-500',
    label:     'text-slate-500',
    text:      'text-slate-900',
    muted:     'text-slate-600',
    dimmed:    'text-slate-400',
    divider:   'border-slate-200',
    presetBtn: 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300',
    toggleBtn: 'bg-slate-200 hover:bg-slate-300 text-slate-700',
    chartBg:   '#ffffff',
    chartGrid: '#e2e8f0',
    chartText: '#64748b',
  };
}

// ── Defaults ───────────────────────────────────────────────────────────────
const DEFAULT: ContinuationInputs = {
  originalNav:          200,
  entryCost:            80,
  yearsHeld:            5,
  originalCarry:        20,
  originalHurdle:       8,
  continuationDiscount: 10,
  newCarry:             20,
  newHurdle:            8,
  newFundLife:          4,
  bullGrowth:           35,
  baseGrowth:           20,
  bearGrowth:           5,
};

type PresetKey = 'strong' | 'borderline' | 'lpsqueeze';
const PRESETS: Record<PresetKey, Partial<ContinuationInputs>> = {
  strong: {
    originalNav: 200, entryCost: 80, yearsHeld: 5,
    continuationDiscount: 8, newCarry: 20, newFundLife: 4,
    bullGrowth: 40, baseGrowth: 25, bearGrowth: 10,
  },
  borderline: {
    originalNav: 150, entryCost: 100, yearsHeld: 6,
    continuationDiscount: 15, newCarry: 20, newFundLife: 3,
    bullGrowth: 20, baseGrowth: 10, bearGrowth: 0,
  },
  lpsqueeze: {
    originalNav: 180, entryCost: 90, yearsHeld: 5,
    continuationDiscount: 5, newCarry: 25, newFundLife: 5,
    bullGrowth: 25, baseGrowth: 15, bearGrowth: 3,
  },
};

// ── Formatters ─────────────────────────────────────────────────────────────
const fmtPct  = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtM    = (v: number) => `$${v.toFixed(1)}M`;
const fmtMoic = (v: number) => `${v.toFixed(2)}x`;

function irrColor(r: number): string {
  if (r >= 0.20) return 'bg-emerald-700';
  if (r >= 0.12) return 'bg-yellow-700';
  return 'bg-red-800';
}

function rollBetterColor(cell: { rollIsBetter: boolean }): string {
  return cell.rollIsBetter ? 'bg-emerald-700' : 'bg-red-800';
}

// ── InputRow ────────────────────────────────────────────────────────────────
function InputRow({
  label, value, onChange, unit, min, max, step = 0.5, th, sub,
}: {
  label: string; value: number; onChange: (v: number) => void;
  unit?: string; min?: number; max?: number; step?: number;
  th: ReturnType<typeof T>; sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={`text-xs font-medium uppercase tracking-wide ${th.label}`}>{label}</label>
      {sub && <p className={`text-xs ${th.dimmed} -mt-0.5`}>{sub}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className={`w-full border rounded px-3 py-2 text-sm font-mono focus:outline-none ${th.input}`}
        />
        {unit && <span className={`text-sm font-mono w-8 shrink-0 ${th.dimmed}`}>{unit}</span>}
      </div>
    </div>
  );
}

// ── Scenario card ───────────────────────────────────────────────────────────
function ScenarioCard({
  label, color, result, cashOutProceeds, th,
}: {
  label: string; color: string;
  result: { exitNAV: number; rollNetProceeds: number; rollMOIC: number; rollIRR: number;
            cashOutMOIC: number; cashOutIRR: number; rollCarryPaid: number;
            rollIsBetter: boolean; upliftVsCashOut: number; cashOutProceeds: number };
  cashOutProceeds: number;
  th: ReturnType<typeof T>;
}) {
  const better = result.rollIsBetter;
  return (
    <div className={`rounded-xl p-5 border-2 ${better ? 'border-emerald-600/40' : 'border-red-600/40'} ${th.card}`}>
      <div className="flex items-center justify-between mb-4">
        <span className={`text-xs font-bold uppercase tracking-widest`} style={{ color }}>{label}</span>
        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${better ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>
          {better ? '✓ Roll wins' : '✕ Cash out wins'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className={`rounded-lg p-3 ${th.section}`}>
          <p className={`text-xs ${th.dimmed} mb-1`}>Exit NAV</p>
          <p className={`text-base font-mono font-bold ${th.text}`}>{fmtM(result.exitNAV)}</p>
        </div>
        <div className={`rounded-lg p-3 ${th.section}`}>
          <p className={`text-xs ${th.dimmed} mb-1`}>GP Carry Paid</p>
          <p className="text-base font-mono font-bold text-yellow-400">{fmtM(result.rollCarryPaid)}</p>
        </div>
      </div>
      <div className={`rounded-lg p-3 mb-3 ${th.section}`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`text-xs font-semibold ${th.muted}`}>If you ROLL</p>
          <p className={`text-xs font-semibold ${th.muted}`}>If you CASH OUT</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-lg font-mono font-bold ${better ? 'text-emerald-400' : th.text}`}>{fmtM(result.rollNetProceeds)}</p>
            <p className={`text-xs ${th.dimmed}`}>{fmtMoic(result.rollMOIC)} · {fmtPct(result.rollIRR)}</p>
          </div>
          <div className={`text-xs font-mono px-2 py-1 rounded ${better ? 'text-emerald-400' : 'text-red-400'}`}>
            {better ? '+' : ''}{fmtM(result.upliftVsCashOut)}
          </div>
          <div>
            <p className={`text-lg font-mono font-bold text-right ${!better ? 'text-emerald-400' : th.text}`}>{fmtM(result.cashOutProceeds)}</p>
            <p className={`text-xs ${th.dimmed} text-right`}>{fmtMoic(result.cashOutMOIC)} · {fmtPct(result.cashOutIRR)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function ContinuationFundPage() {
  const [inp, setInp]     = useState<ContinuationInputs>(DEFAULT);
  const [isDark, setIsDark] = useState(true);
  const th = T(isDark);

  function set<K extends keyof ContinuationInputs>(k: K, v: ContinuationInputs[K]) {
    setInp(prev => ({ ...prev, [k]: v }));
  }

  function applyPreset(p: Partial<ContinuationInputs>) {
    setInp(prev => ({ ...prev, ...p }));
  }

  const result = useMemo(() => calculateContinuation(inp), [inp]);

  // Chart data — roll vs cash-out across scenarios
  const chartData = [
    { name: 'Bear', rollNet: result.bear.rollNetProceeds, cashOut: result.bear.cashOutProceeds, fill: '#dc2626' },
    { name: 'Base', rollNet: result.base.rollNetProceeds, cashOut: result.base.cashOutProceeds, fill: '#d97706' },
    { name: 'Bull', rollNet: result.bull.rollNetProceeds, cashOut: result.bull.cashOutProceeds, fill: '#059669' },
  ];

  // IRR comparison chart
  const irrChartData = [
    { name: 'Bear — Roll',    irr: result.bear.rollIRR,    fill: '#dc2626' },
    { name: 'Bear — Cash',    irr: result.bear.cashOutIRR, fill: '#ef4444' },
    { name: 'Base — Roll',    irr: result.base.rollIRR,    fill: '#d97706' },
    { name: 'Base — Cash',    irr: result.base.cashOutIRR, fill: '#fbbf24' },
    { name: 'Bull — Roll',    irr: result.bull.rollIRR,    fill: '#059669' },
    { name: 'Bull — Cash',    irr: result.bull.cashOutIRR, fill: '#34d399' },
  ];

  // Sensitivity grid — roll IRR
  const rollIRRGrid = result.sensitivity.map(row => row.map(c => c.rollIRR));
  // Decision grid — 1 = roll better, 0 = cash out better
  const decisionGrid = result.sensitivity.map(row => row.map(c => c.rollIsBetter ? 1 : 0));

  return (
    <div className={`min-h-screen ${th.page}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-3 border-b ${th.divider} sticky top-0 z-10 ${isDark ? 'bg-navy-950' : 'bg-slate-50'}`}>
        <div>
          <span className="text-xs font-mono text-blue-500 uppercase tracking-widest">Tool 3</span>
          <h1 className={`text-xl font-bold ${th.text}`}>GP-Led Secondary / Continuation Fund Analyzer</h1>
          <p className={`text-xs ${th.muted}`}>Should the LP roll into the continuation fund or cash out? How does the GP's carry reset change the math?</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${th.dimmed}`}>Presets:</span>
          {(['strong','borderline','lpsqueeze'] as PresetKey[]).map((k, i) => (
            <button key={k} onClick={() => applyPreset(PRESETS[k]!)}
              className={`text-xs px-3 py-1 rounded-lg border transition-colors ${th.presetBtn}`}>
              {['Strong Asset','Borderline Case','LP Squeeze'][i]}
            </button>
          ))}
          <div className={`w-px h-5 ${isDark ? 'bg-navy-700' : 'bg-slate-300'}`} />
          <button onClick={() => setIsDark(d => !d)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${th.toggleBtn}`}>
            {isDark ? '☀ Light' : '☾ Dark'}
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)]">
        {/* ── Left: Inputs ── */}
        <div className={`w-80 shrink-0 border-r ${th.divider} overflow-y-auto p-5 flex flex-col gap-5`}>

          {/* Original Fund */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${th.dimmed}`}>Original Fund</p>
            <div className="flex flex-col gap-3">
              <InputRow label="Current NAV" value={inp.originalNav} onChange={v => set('originalNav', v)} unit="$M" min={1} step={5} th={th} sub="Value of the asset being moved" />
              <InputRow label="LP's Cost Basis" value={inp.entryCost} onChange={v => set('entryCost', v)} unit="$M" min={1} step={5} th={th} sub="What LP originally invested" />
              <InputRow label="Years Held So Far" value={inp.yearsHeld} onChange={v => set('yearsHeld', v)} unit="yrs" min={1} max={15} step={1} th={th} />
              <div className={`rounded-lg px-3 py-2 ${th.section} flex items-center justify-between`}>
                <span className={`text-xs ${th.label}`}>Paper MOIC so far</span>
                <span className={`text-sm font-mono font-bold ${th.text}`}>{(inp.originalNav / inp.entryCost).toFixed(2)}x</span>
              </div>
              <InputRow label="Original Carry" value={inp.originalCarry} onChange={v => set('originalCarry', v)} unit="%" min={0} max={30} step={1} th={th} />
              <InputRow label="Original Hurdle" value={inp.originalHurdle} onChange={v => set('originalHurdle', v)} unit="%" min={0} max={15} step={0.5} th={th} />
            </div>
          </div>

          <div className={`border-t ${th.divider}`} />

          {/* Continuation Fund Terms */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${th.dimmed}`}>Continuation Fund Terms</p>
            <div className="flex flex-col gap-3">
              <InputRow label="Cash-Out Discount" value={inp.continuationDiscount} onChange={v => set('continuationDiscount', v)} unit="%" min={0} max={40} step={1} th={th} sub="Haircut if LP takes liquidity now" />
              <InputRow label="New Carry" value={inp.newCarry} onChange={v => set('newCarry', v)} unit="%" min={0} max={30} step={1} th={th} sub="GP carry resets on new fund" />
              <InputRow label="New Hurdle" value={inp.newHurdle} onChange={v => set('newHurdle', v)} unit="%" min={0} max={15} step={0.5} th={th} />
              <InputRow label="New Fund Life" value={inp.newFundLife} onChange={v => set('newFundLife', v)} unit="yrs" min={1} max={10} step={1} th={th} sub="Additional years in continuation fund" />
            </div>
          </div>

          <div className={`border-t ${th.divider}`} />

          {/* Exit Scenarios */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${th.dimmed}`}>Exit Scenarios</p>
            <p className={`text-xs ${th.dimmed} mb-3`}>Annual NAV growth over new fund life</p>
            <div className="flex flex-col gap-3">
              <InputRow label="Bull Growth" value={inp.bullGrowth} onChange={v => set('bullGrowth', v)} unit="%" min={0} max={100} step={1} th={th} />
              <InputRow label="Base Growth" value={inp.baseGrowth} onChange={v => set('baseGrowth', v)} unit="%" min={0} max={100} step={1} th={th} />
              <InputRow label="Bear Growth" value={inp.bearGrowth} onChange={v => set('bearGrowth', v)} unit="%" min={-20} max={50} step={1} th={th} />
            </div>
          </div>
        </div>

        {/* ── Right: Results ── */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* LP Summary cards */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${th.dimmed}`}>LP Decision Summary</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ResultCard
                label="Cash-Out Proceeds"
                value={fmtM(result.base.cashOutProceeds)}
                sub={`${inp.continuationDiscount}% discount to NAV`}
                variant="neutral"
              />
              <ResultCard
                label="Break-Even Growth"
                value={`${result.gp.breakEvenGrowth.toFixed(1)}%/yr`}
                sub="Roll = cash-out at this rate"
                variant={result.gp.breakEvenGrowth <= inp.baseGrowth ? 'positive' : 'warning'}
              />
              <ResultCard
                label="Base Roll IRR"
                value={fmtPct(result.base.rollIRR)}
                sub="if you roll, base case"
                variant={result.base.rollIRR >= 0.20 ? 'positive' : result.base.rollIRR >= 0.12 ? 'warning' : 'danger'}
              />
              <ResultCard
                label="Base Cash-Out IRR"
                value={fmtPct(result.base.cashOutIRR)}
                sub="if you exit now"
                variant={result.base.cashOutIRR >= 0.20 ? 'positive' : result.base.cashOutIRR >= 0.12 ? 'warning' : 'danger'}
              />
            </div>
          </div>

          {/* Three scenario cards */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${th.dimmed}`}>Scenario Analysis — Roll vs. Cash Out</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ScenarioCard label={`Bear  (${inp.bearGrowth}%/yr)`} color="#dc2626" result={result.bear} cashOutProceeds={result.bear.cashOutProceeds} th={th} />
              <ScenarioCard label={`Base  (${inp.baseGrowth}%/yr)`} color="#d97706" result={result.base} cashOutProceeds={result.base.cashOutProceeds} th={th} />
              <ScenarioCard label={`Bull  (${inp.bullGrowth}%/yr)`} color="#059669" result={result.bull} cashOutProceeds={result.bull.cashOutProceeds} th={th} />
            </div>
          </div>

          {/* Proceeds comparison chart */}
          <div className={`rounded-xl p-5 ${th.card}`}>
            <p className={`text-sm font-semibold ${th.text} mb-0.5`}>Net Proceeds: Roll vs. Cash Out</p>
            <p className={`text-xs ${th.dimmed} mb-4`}>After GP carry reset. Cash-out proceeds are fixed — roll upside depends entirely on asset performance.</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={th.chartGrid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: th.chartText, fontSize: 11 }} axisLine={{ stroke: th.chartGrid }} tickLine={false} />
                <YAxis tickFormatter={v => `$${v}M`} tick={{ fill: th.chartText, fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => [`$${(v as number).toFixed(1)}M`, name === 'rollNet' ? 'Roll (net of carry)' : 'Cash Out']}
                  contentStyle={{ background: th.chartBg, border: `1px solid ${th.chartGrid}`, borderRadius: 8, fontSize: 12 }}
                />
                <Legend formatter={v => <span style={{ color: th.chartText, fontSize: 11 }}>{v === 'rollNet' ? 'Roll (net of carry)' : 'Cash Out'}</span>} wrapperStyle={{ paddingTop: 8 }} />
                <Bar dataKey="cashOut" name="cashOut" radius={[3,3,0,0]} fill="#475569" />
                <Bar dataKey="rollNet" name="rollNet" radius={[3,3,0,0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* IRR comparison chart */}
          <div className={`rounded-xl p-5 ${th.card}`}>
            <p className={`text-sm font-semibold ${th.text} mb-0.5`}>IRR Comparison Across Scenarios</p>
            <p className={`text-xs ${th.dimmed} mb-4`}>Solid = roll IRR · Faded = cash-out IRR · Darker bars = roll outperforms</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={irrChartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={th.chartGrid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: th.chartText, fontSize: 9 }} axisLine={{ stroke: th.chartGrid }} tickLine={false} />
                <YAxis tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={{ fill: th.chartText, fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  formatter={(v: unknown) => [`${((v as number)*100).toFixed(1)}%`, 'IRR']}
                  contentStyle={{ background: th.chartBg, border: `1px solid ${th.chartGrid}`, borderRadius: 8, fontSize: 12 }}
                />
                <ReferenceLine y={0.20} stroke="#3b82f6" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: '20%', position: 'right', fill: '#3b82f6', fontSize: 10 }} />
                <Bar dataKey="irr" radius={[3,3,0,0]}>
                  {irrChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Two grids side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Roll IRR sensitivity */}
            <div className={`rounded-xl p-5 ${th.card}`}>
              <p className={`text-sm font-semibold ${th.text} mb-0.5`}>Roll IRR Sensitivity</p>
              <p className={`text-xs ${th.dimmed} mb-4`}>Cash-out discount × asset growth rate · Green ≥20% · Yellow ≥12% · Red &lt;12%</p>
              <SensitivityTable
                rowHeaders={DISCOUNT_ROWS.map(d => `${d}% disc`)}
                colHeaders={GROWTH_COLS.map(g => `${g}%`)}
                data={rollIRRGrid}
                formatValue={fmtPct}
                colorFn={irrColor}
                rowLabel="Cash-Out Discount"
                colLabel="Asset Growth/yr"
              />
            </div>

            {/* Decision grid */}
            <div className={`rounded-xl p-5 ${th.card}`}>
              <p className={`text-sm font-semibold ${th.text} mb-0.5`}>Roll vs. Cash Out — Decision Grid</p>
              <p className={`text-xs ${th.dimmed} mb-4`}>Green = roll wins · Red = cash out wins · at each discount × growth combination</p>
              <SensitivityTable
                rowHeaders={DISCOUNT_ROWS.map(d => `${d}% disc`)}
                colHeaders={GROWTH_COLS.map(g => `${g}%`)}
                data={decisionGrid}
                formatValue={v => v === 1 ? 'Roll ✓' : 'Cash ✕'}
                colorFn={v => v === 1 ? 'bg-emerald-700' : 'bg-red-800'}
                rowLabel="Cash-Out Discount"
                colLabel="Asset Growth/yr"
              />
            </div>
          </div>

          {/* GP Analysis */}
          <div className={`rounded-xl p-5 ${th.card}`}>
            <p className={`text-sm font-semibold ${th.text} mb-1`}>GP Carry Optionality</p>
            <p className={`text-xs ${th.dimmed} mb-4`}>
              The GP's carry resets at the continuation fund NAV. This is the GP's financial incentive to launch the vehicle — they earn new carry on gains they already helped create.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={`rounded-lg px-3 py-3 ${th.section}`}>
                <p className={`text-xs ${th.dimmed} mb-1`}>Carry at Bull</p>
                <p className="text-base font-mono font-bold text-emerald-400">{fmtM(result.gp.carryAtBull)}</p>
              </div>
              <div className={`rounded-lg px-3 py-3 ${th.section}`}>
                <p className={`text-xs ${th.dimmed} mb-1`}>Carry at Base</p>
                <p className="text-base font-mono font-bold text-yellow-400">{fmtM(result.gp.carryAtBase)}</p>
              </div>
              <div className={`rounded-lg px-3 py-3 ${th.section}`}>
                <p className={`text-xs ${th.dimmed} mb-1`}>Carry at Bear</p>
                <p className="text-base font-mono font-bold text-red-400">{fmtM(result.gp.carryAtBear)}</p>
              </div>
              <div className={`rounded-lg px-3 py-3 ${th.section}`}>
                <p className={`text-xs ${th.dimmed} mb-1`}>Break-Even Growth</p>
                <p className={`text-base font-mono font-bold ${th.text}`}>{result.gp.breakEvenGrowth.toFixed(1)}%/yr</p>
                <p className={`text-xs ${th.dimmed} mt-0.5`}>LP indifferent above this</p>
              </div>
            </div>
            <p className={`text-xs mt-4 leading-relaxed ${th.dimmed}`}>
              The GP earns ${result.gp.carryAtBase.toFixed(1)}M in new carry at base case — on gains above a NAV they already helped build. The LP rolling in accepts this carry reset in exchange for continued upside participation. Whether that tradeoff is worthwhile depends on conviction in the asset's remaining growth and whether the base growth ({inp.baseGrowth}%/yr) exceeds the break-even rate ({result.gp.breakEvenGrowth.toFixed(1)}%/yr).
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
