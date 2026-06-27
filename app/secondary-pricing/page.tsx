'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import {
  calculateSeller, calculateBuyer, discountAtCustomReturn,
  SOFR_ROWS, LIFE_COLS, BID_PCT_ROWS,
  type SecondaryInputs, type Sector,
} from '@/lib/calculators/secondaryPricing';
import SensitivityTable from '@/components/ui/SensitivityTable';
import ResultCard from '@/components/ui/ResultCard';

// ── Theme ──────────────────────────────────────────────────────────────────
type Theme = 'dark' | 'light';

function T(isDark: boolean) {
  return isDark ? {
    page:       'bg-navy-950 text-slate-100',
    card:       'bg-navy-800 border border-navy-700',
    section:    'bg-navy-900 border border-navy-700',
    input:      'bg-navy-900 border-navy-700 text-slate-100 focus:border-blue-500',
    label:      'text-slate-400',
    text:       'text-white',
    muted:      'text-slate-400',
    dimmed:     'text-slate-500',
    divider:    'border-navy-700',
    selectCard: 'bg-navy-800 border-navy-700 hover:border-blue-500',
    tag:        'bg-navy-700 text-slate-300',
    presetBtn:  'bg-navy-700 hover:bg-navy-600 text-slate-300 border-navy-600',
    toggleBtn:  'bg-navy-700 hover:bg-navy-600 text-slate-300',
    chartBg:    '#1e293b',
    chartGrid:  '#334155',
    chartText:  '#94a3b8',
  } : {
    page:       'bg-slate-50 text-slate-900',
    card:       'bg-white border border-slate-200 shadow-sm',
    section:    'bg-slate-100 border border-slate-200',
    input:      'bg-white border-slate-300 text-slate-800 focus:border-blue-500',
    label:      'text-slate-500',
    text:       'text-slate-900',
    muted:      'text-slate-600',
    dimmed:     'text-slate-400',
    divider:    'border-slate-200',
    selectCard: 'bg-white border-slate-200 hover:border-blue-500 shadow-sm',
    tag:        'bg-slate-200 text-slate-600',
    presetBtn:  'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300',
    toggleBtn:  'bg-slate-200 hover:bg-slate-300 text-slate-700',
    chartBg:    '#ffffff',
    chartGrid:  '#e2e8f0',
    chartText:  '#64748b',
  };
}

// ── Defaults ───────────────────────────────────────────────────────────────
const DEFAULT: SecondaryInputs = {
  nav: 150, dpi: 0.4, rvpi: 0.9, unfunded: 20,
  sector: 'software', vintageYear: 2022, fundEndYear: 2028,
  currentYear: 2026, sofr: 5.3, leverageRatio: 0.30, targetIrr: 18,
};

// Presets only override scenario-specific fields — all other inputs stay as the user left them
type PresetOverride = Partial<SecondaryInputs>;
type PresetKey = 'calm' | 'blueowl' | 'energy';
const PRESETS: Record<PresetKey, PresetOverride> = {
  calm:    { sofr: 4.0, sector: 'healthcare' },
  blueowl: { sofr: 5.3, sector: 'software'   },
  energy:  { sofr: 5.3, sector: 'energy'     },
};

// ── Formatters ─────────────────────────────────────────────────────────────
const fmtPct  = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtM    = (v: number) => `$${v.toFixed(1)}M`;
const fmtCts  = (v: number) => `${(v * 100).toFixed(0)}¢`;

function discountColor(d: number): string {
  if (d < 0.10) return 'bg-emerald-700';
  if (d < 0.20) return 'bg-yellow-700';
  if (d < 0.30) return 'bg-orange-700';
  return 'bg-red-800';
}

function irrColor(r: number): string {
  if (r >= 0.20) return 'bg-emerald-700';
  if (r >= 0.15) return 'bg-yellow-700';
  return 'bg-red-800';
}

function irrLineColor(r: number): string {
  if (r >= 0.20) return '#059669';
  if (r >= 0.15) return '#d97706';
  return '#dc2626';
}

// ── InputRow helper ────────────────────────────────────────────────────────
function InputRow({
  label, value, onChange, unit, min, max, step = 0.1, th,
}: {
  label: string; value: number; onChange: (v: number) => void;
  unit?: string; min?: number; max?: number; step?: number; th: ReturnType<typeof T>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={`text-xs font-medium uppercase tracking-wide ${th.label}`}>{label}</label>
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

// ── Selector screen ────────────────────────────────────────────────────────
function SelectorScreen({
  onSelect, isDark, onToggleTheme,
}: {
  onSelect: (v: 'seller' | 'buyer') => void;
  isDark: boolean;
  onToggleTheme: () => void;
}) {
  const th = T(isDark);
  return (
    <div className={`min-h-screen ${th.page} flex flex-col`}>
      {/* Top bar */}
      <div className={`flex items-center justify-between px-8 py-4 border-b ${th.divider}`}>
        <div>
          <span className="text-xs font-mono text-blue-500 uppercase tracking-widest">Tool 2</span>
          <h1 className={`text-2xl font-bold ${th.text}`}>Secondary Transaction Pricing</h1>
          <p className={`text-sm ${th.muted}`}>LP liquidity in stressed markets — buyer or seller perspective</p>
        </div>
        <button
          onClick={onToggleTheme}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${th.toggleBtn}`}
        >
          {isDark ? '☀ Light' : '☾ Dark'}
        </button>
      </div>

      {/* Two cards */}
      <div className="flex-1 flex items-center justify-center px-8 py-16">
        <div className="w-full max-w-3xl">
          <p className={`text-center text-sm mb-10 ${th.muted}`}>
            Who are you in this transaction?
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Seller card */}
            <button
              onClick={() => onSelect('seller')}
              className={`group rounded-2xl p-8 border-2 text-left transition-all duration-200 cursor-pointer ${th.selectCard}`}
            >
              <div className="text-4xl mb-4">📤</div>
              <h2 className={`text-xl font-bold mb-2 ${th.text}`}>I'm the Seller</h2>
              <p className={`text-sm leading-relaxed ${th.muted}`}>
                I'm an LP holding a fund stake and need liquidity. I want to know what discount
                I'll face and what my stake will realistically fetch in today's market.
              </p>
              <div className="mt-6 flex items-center gap-2 text-blue-500 text-sm font-medium">
                What will I get? <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </button>

            {/* Buyer card */}
            <button
              onClick={() => onSelect('buyer')}
              className={`group rounded-2xl p-8 border-2 text-left transition-all duration-200 cursor-pointer ${th.selectCard}`}
            >
              <div className="text-4xl mb-4">📥</div>
              <h2 className={`text-xl font-bold mb-2 ${th.text}`}>I'm the Buyer</h2>
              <p className={`text-sm leading-relaxed ${th.muted}`}>
                I'm a secondary fund or investor evaluating a stake. I want to know the right bid
                price to hit my target IRR given current rates and fund quality.
              </p>
              <div className="mt-6 flex items-center gap-2 text-blue-500 text-sm font-medium">
                What should I bid? <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </button>
          </div>

          {/* Context note */}
          <div className={`mt-10 rounded-xl p-5 border ${th.section}`}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-2 text-blue-500`}>
              Market Context
            </p>
            <p className={`text-sm leading-relaxed ${th.muted}`}>
              This tool is built for stressed markets — when LPs need liquidity and buyers are scarce.
              Discounts widen automatically as rates rise. Default scenario: 2022-vintage software fund
              targeting a 2028 wind-down, modeled on current rate and valuation conditions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Seller Tool ────────────────────────────────────────────────────────────
function SellerTool({
  onBack, isDark, onToggleTheme,
}: {
  onBack: () => void; isDark: boolean; onToggleTheme: () => void;
}) {
  const th = T(isDark);
  const [inp, setInp] = useState<SecondaryInputs>(DEFAULT);
  const [minBuyerReturn, setMinBuyerReturn] = useState<number | null>(null);

  function set<K extends keyof SecondaryInputs>(k: K, v: SecondaryInputs[K]) {
    setInp(prev => ({ ...prev, [k]: v }));
  }

  function applyPreset(p: Partial<SecondaryInputs>) { setInp(prev => ({ ...prev, ...p })); }

  const result = useMemo(() => calculateSeller(inp), [inp]);

  const tvpi = inp.dpi + inp.rvpi;
  const discountVariant = result.impliedDiscount >= 0.30 ? 'danger'
    : result.impliedDiscount >= 0.20 ? 'warning' : 'positive';

  // Optional: implied price if seller accepts a buyer requiring minBuyerReturn
  const worstCaseResult = useMemo(() => {
    if (minBuyerReturn === null) return null;
    return discountAtCustomReturn(inp, minBuyerReturn / 100);
  }, [inp, minBuyerReturn]);

  return (
    <div className={`min-h-screen ${th.page}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-3 border-b ${th.divider} sticky top-0 z-10 ${isDark ? 'bg-navy-950' : 'bg-slate-50'}`}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={`text-sm ${th.muted} hover:text-blue-500 transition-colors`}>
            ← Back
          </button>
          <div className={`w-px h-5 ${isDark ? 'bg-navy-700' : 'bg-slate-300'}`} />
          <div>
            <span className="text-xs font-mono text-blue-500">SELLER VIEW</span>
            <p className={`text-sm font-semibold ${th.text}`}>What will I get for my stake?</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${th.dimmed}`}>Presets:</span>
          {(['calm','blueowl','energy'] as PresetKey[]).map((k, i) => (
            <button key={k} onClick={() => applyPreset(PRESETS[k]!)}
              className={`text-xs px-3 py-1 rounded-lg border transition-colors ${th.presetBtn}`}>
              {['Calm Market','Blue Owl Stress','Energy Dislocation'][i]}
            </button>
          ))}
          <div className={`w-px h-5 ${isDark ? 'bg-navy-700' : 'bg-slate-300'}`} />
          <button onClick={onToggleTheme} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${th.toggleBtn}`}>
            {isDark ? '☀ Light' : '☾ Dark'}
          </button>
        </div>
      </div>

      <div className="flex gap-0 h-[calc(100vh-57px)]">
        {/* ── Left: Inputs ── */}
        <div className={`w-80 shrink-0 border-r ${th.divider} overflow-y-auto p-5 flex flex-col gap-5`}>

          {/* Fund Parameters */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${th.dimmed}`}>Fund Parameters</p>
            <div className="flex flex-col gap-3">
              <InputRow label="Current NAV" value={inp.nav} onChange={v => set('nav', v)} unit="$M" min={1} step={5} th={th} />
              <InputRow label="DPI" value={inp.dpi} onChange={v => set('dpi', v)} unit="x" min={0} max={3} step={0.05} th={th} />
              <InputRow label="RVPI" value={inp.rvpi} onChange={v => set('rvpi', v)} unit="x" min={0} max={3} step={0.05} th={th} />
              <div className={`rounded-lg px-3 py-2 ${th.section} flex items-center justify-between`}>
                <span className={`text-xs ${th.label}`}>TVPI (auto)</span>
                <span className={`text-sm font-mono font-bold ${th.text}`}>{tvpi.toFixed(2)}x</span>
              </div>
              <InputRow label="Unfunded Commitments" value={inp.unfunded} onChange={v => set('unfunded', v)} unit="$M" min={0} step={5} th={th} />
            </div>
          </div>

          <div className={`border-t ${th.divider}`} />

          {/* Sector */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${th.dimmed}`}>Sector</p>
            <div className="flex flex-col gap-2">
              {(['software','healthcare','energy'] as Sector[]).map(s => (
                <button key={s} onClick={() => set('sector', s)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border text-left transition-colors ${
                    inp.sector === s
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : `${th.presetBtn}`
                  }`}>
                  {s === 'software' ? '💻 Software (+200bps)' : s === 'healthcare' ? '🏥 Healthcare (+125bps)' : '⚡ Energy (+175bps)'}
                </button>
              ))}
            </div>
          </div>

          <div className={`border-t ${th.divider}`} />

          {/* Fund Timeline */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${th.dimmed}`}>Fund Timeline</p>
            <div className="flex flex-col gap-3">
              <InputRow label="Vintage Year" value={inp.vintageYear} onChange={v => set('vintageYear', v)} min={2010} max={2025} step={1} th={th} />
              <InputRow label="Fund End Year" value={inp.fundEndYear} onChange={v => set('fundEndYear', v)} min={2025} max={2040} step={1} th={th} />
              <div className={`rounded-lg px-3 py-2 ${th.section} flex items-center justify-between`}>
                <span className={`text-xs ${th.label}`}>Remaining Life</span>
                <span className={`text-sm font-mono font-bold ${th.text}`}>{Math.max(0, inp.fundEndYear - inp.currentYear)} yrs</span>
              </div>
            </div>
          </div>

          <div className={`border-t ${th.divider}`} />

          {/* Rate & Leverage */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${th.dimmed}`}>Rate & Leverage</p>
            <div className="flex flex-col gap-3">
              <InputRow label="Current SOFR" value={inp.sofr} onChange={v => set('sofr', v)} unit="%" min={0} max={15} step={0.1} th={th} />
              <InputRow label="Portfolio Leverage" value={inp.leverageRatio} onChange={v => set('leverageRatio', v)} unit="x" min={0} max={2} step={0.05} th={th} />
            </div>
          </div>

          <div className={`border-t ${th.divider}`} />

          {/* Optional: worst-case buyer return */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${th.dimmed}`}>Seller's Floor <span className={`normal-case font-normal ${th.dimmed}`}>(optional)</span></p>
            <p className={`text-xs leading-relaxed mb-3 ${th.dimmed}`}>
              "The worst buyer I'd accept requires this return." Leave blank to use market rate only.
            </p>
            <div className="flex flex-col gap-1">
              <label className={`text-xs font-medium uppercase tracking-wide ${th.label}`}>
                Min. Buyer's Required Return
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="e.g. 13.8"
                  value={minBuyerReturn ?? ''}
                  min={1} max={40} step={0.1}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    setMinBuyerReturn(isNaN(v) ? null : v);
                  }}
                  className={`w-full border rounded px-3 py-2 text-sm font-mono focus:outline-none ${th.input} placeholder:text-slate-600`}
                />
                <span className={`text-sm font-mono w-8 shrink-0 ${th.dimmed}`}>%</span>
              </div>
            </div>
            {minBuyerReturn !== null && (
              <button
                onClick={() => setMinBuyerReturn(null)}
                className={`mt-2 text-xs ${th.dimmed} hover:text-red-400 transition-colors`}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Right: Results ── */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* Headline cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ResultCard
              label="Implied Discount"
              value={fmtPct(result.impliedDiscount)}
              sub="to NAV"
              variant={discountVariant}
            />
            <ResultCard
              label="Implied Bid Price"
              value={fmtM(result.impliedPrice)}
              sub={`vs. NAV ${fmtM(inp.nav)}`}
              variant="neutral"
            />
            <ResultCard
              label="Price per $1 NAV"
              value={fmtCts(result.pricePerDollarNAV)}
              sub="on the dollar"
              variant={discountVariant}
            />
            <ResultCard
              label="Buyer's Required Return"
              value={fmtPct(result.requiredReturn)}
              sub="annualized"
              variant="neutral"
            />
          </div>

          {/* Optional: worst-case floor card */}
          {worstCaseResult && minBuyerReturn !== null && (
            <div className={`rounded-xl p-4 border-2 border-blue-500/40 ${isDark ? 'bg-blue-950/30' : 'bg-blue-50'}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-500 mb-3">
                If your worst buyer requires {minBuyerReturn}% return
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-lg px-3 py-3 ${th.section}`}>
                  <p className={`text-xs ${th.dimmed} mb-1`}>Discount You'd Face</p>
                  <p className={`text-lg font-mono font-bold ${worstCaseResult.discount >= 0.25 ? 'text-red-400' : worstCaseResult.discount >= 0.15 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                    {fmtPct(worstCaseResult.discount)}
                  </p>
                </div>
                <div className={`rounded-lg px-3 py-3 ${th.section}`}>
                  <p className={`text-xs ${th.dimmed} mb-1`}>Price You'd Receive</p>
                  <p className={`text-lg font-mono font-bold ${th.text}`}>{fmtM(worstCaseResult.price)}</p>
                </div>
                <div className={`rounded-lg px-3 py-3 ${th.section}`}>
                  <p className={`text-xs ${th.dimmed} mb-1`}>vs. Market Price</p>
                  <p className={`text-lg font-mono font-bold ${worstCaseResult.price >= result.impliedPrice ? 'text-emerald-400' : 'text-red-400'}`}>
                    {worstCaseResult.price >= result.impliedPrice ? '+' : ''}{fmtM(worstCaseResult.price - result.impliedPrice)}
                  </p>
                </div>
              </div>
              <p className={`text-xs mt-3 ${th.dimmed}`}>
                {worstCaseResult.price >= result.impliedPrice
                  ? `A buyer requiring ${minBuyerReturn}% is less demanding than the market — you'd receive more than the market price.`
                  : `A buyer requiring ${minBuyerReturn}% is more demanding than the market — you'd receive less than the market price.`}
              </p>
            </div>
          )}

          {/* Discount driver breakdown */}
          <div className={`rounded-xl p-5 ${th.card}`}>
            <p className={`text-sm font-semibold mb-4 ${th.text}`}>Discount Drivers</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Base Rate (SOFR)', `${inp.sofr.toFixed(1)}%`],
                ['Illiquidity Premium', '1.50%'],
                ['Sector Spread', inp.sector === 'software' ? '2.00%' : inp.sector === 'healthcare' ? '1.25%' : '1.75%'],
                ['Quality Adj (DPI)', inp.dpi >= 0.5 ? `−${((inp.dpi >= 0.8 ? 3 : 1.5)).toFixed(2)}%` : inp.dpi < 0.3 ? `+${(inp.dpi < 0.15 ? 3 : 1.5).toFixed(2)}%` : '0.00%'],
              ].map(([label, val]) => (
                <div key={label} className={`rounded-lg px-3 py-3 ${th.section}`}>
                  <p className={`text-xs ${th.dimmed} mb-1`}>{label}</p>
                  <p className={`text-sm font-mono font-bold ${th.text}`}>{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Discount vs Rate chart */}
          <div className={`rounded-xl p-5 ${th.card}`}>
            <p className={`text-sm font-semibold ${th.text} mb-0.5`}>Discount vs. Rate Environment</p>
            <p className={`text-xs ${th.dimmed} mb-4`}>
              Discount widens as SOFR rises — buyer's required return rises, so they pay less for the same cashflows
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={result.chartData} margin={{ top: 8, right: 24, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={th.chartGrid} />
                <XAxis dataKey="sofr" tickFormatter={v => `${v}%`}
                  tick={{ fill: th.chartText, fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={{ stroke: th.chartGrid }} tickLine={false}
                  label={{ value: 'SOFR', position: 'insideBottom', offset: -4, fill: th.chartText, fontSize: 10 }} />
                <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: th.chartText, fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  formatter={(v: unknown) => [`${((v as number) * 100).toFixed(1)}% discount`, 'Discount to NAV']}
                  labelFormatter={v => `SOFR: ${v}%`}
                  contentStyle={{ background: th.chartBg, border: `1px solid ${th.chartGrid}`, borderRadius: 8, fontSize: 12 }}
                />
                <ReferenceLine x={inp.sofr} stroke="#3b82f6" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: 'Current', position: 'top', fill: '#3b82f6', fontSize: 10 }} />
                <Line dataKey="discount" stroke="#ef4444" strokeWidth={2.5}
                  dot={(props: any) => {
                    const color = irrLineColor(0.22 - props.payload.discount);
                    return <circle cx={props.cx} cy={props.cy} r={5} fill={color} stroke={th.chartBg} strokeWidth={2} />;
                  }}
                  activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Sensitivity Grid */}
          <div className={`rounded-xl p-5 ${th.card}`}>
            <p className={`text-sm font-semibold ${th.text} mb-0.5`}>Discount Sensitivity Grid</p>
            <p className={`text-xs ${th.dimmed} mb-4`}>
              Green &lt;10% · Yellow 10–20% · Orange 20–30% · Red &gt;30%
            </p>
            <SensitivityTable
              rowHeaders={SOFR_ROWS.map(s => `${s}%`)}
              colHeaders={LIFE_COLS.map(l => `${l}yr`)}
              data={result.gridDiscounts}
              formatValue={fmtPct}
              colorFn={discountColor}
              rowLabel="SOFR"
              colLabel="Remaining Life"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Buyer Tool ─────────────────────────────────────────────────────────────
function BuyerTool({
  onBack, isDark, onToggleTheme,
}: {
  onBack: () => void; isDark: boolean; onToggleTheme: () => void;
}) {
  const th = T(isDark);
  const [inp, setInp] = useState<SecondaryInputs>({ ...DEFAULT, targetIrr: 18 });

  function set<K extends keyof SecondaryInputs>(k: K, v: SecondaryInputs[K]) {
    setInp(prev => ({ ...prev, [k]: v }));
  }

  function applyPreset(p: Partial<SecondaryInputs>) { setInp(prev => ({ ...prev, ...p })); }

  const result = useMemo(() => calculateBuyer(inp), [inp]);
  const tvpi   = inp.dpi + inp.rvpi;

  const fairBidPct = result.fairBid / inp.nav;
  const fairVariant = result.fairBidDiscount >= 0.30 ? 'danger'
    : result.fairBidDiscount >= 0.20 ? 'warning' : 'positive';

  return (
    <div className={`min-h-screen ${th.page}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-3 border-b ${th.divider} sticky top-0 z-10 ${isDark ? 'bg-navy-950' : 'bg-slate-50'}`}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={`text-sm ${th.muted} hover:text-blue-500 transition-colors`}>
            ← Back
          </button>
          <div className={`w-px h-5 ${isDark ? 'bg-navy-700' : 'bg-slate-300'}`} />
          <div>
            <span className="text-xs font-mono text-blue-500">BUYER VIEW</span>
            <p className={`text-sm font-semibold ${th.text}`}>What should I bid to hit my target IRR?</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${th.dimmed}`}>Presets:</span>
          {(['calm','blueowl','energy'] as PresetKey[]).map((k, i) => (
            <button key={k} onClick={() => applyPreset(PRESETS[k]!)}
              className={`text-xs px-3 py-1 rounded-lg border transition-colors ${th.presetBtn}`}>
              {['Calm Market','Blue Owl Stress','Energy Dislocation'][i]}
            </button>
          ))}
          <div className={`w-px h-5 ${isDark ? 'bg-navy-700' : 'bg-slate-300'}`} />
          <button onClick={onToggleTheme} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${th.toggleBtn}`}>
            {isDark ? '☀ Light' : '☾ Dark'}
          </button>
        </div>
      </div>

      <div className="flex gap-0 h-[calc(100vh-57px)]">
        {/* ── Left: Inputs ── */}
        <div className={`w-80 shrink-0 border-r ${th.divider} overflow-y-auto p-5 flex flex-col gap-5`}>

          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${th.dimmed}`}>Fund Parameters</p>
            <div className="flex flex-col gap-3">
              <InputRow label="NAV" value={inp.nav} onChange={v => set('nav', v)} unit="$M" min={1} step={5} th={th} />
              <InputRow label="DPI" value={inp.dpi} onChange={v => set('dpi', v)} unit="x" min={0} max={3} step={0.05} th={th} />
              <InputRow label="RVPI" value={inp.rvpi} onChange={v => set('rvpi', v)} unit="x" min={0} max={3} step={0.05} th={th} />
              <div className={`rounded-lg px-3 py-2 ${th.section} flex items-center justify-between`}>
                <span className={`text-xs ${th.label}`}>TVPI (auto)</span>
                <span className={`text-sm font-mono font-bold ${th.text}`}>{tvpi.toFixed(2)}x</span>
              </div>
              <InputRow label="Unfunded Commitments" value={inp.unfunded} onChange={v => set('unfunded', v)} unit="$M" min={0} step={5} th={th} />
            </div>
          </div>

          <div className={`border-t ${th.divider}`} />

          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${th.dimmed}`}>Sector</p>
            <div className="flex flex-col gap-2">
              {(['software','healthcare','energy'] as Sector[]).map(s => (
                <button key={s} onClick={() => set('sector', s)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border text-left transition-colors ${
                    inp.sector === s ? 'bg-blue-600 border-blue-500 text-white' : th.presetBtn
                  }`}>
                  {s === 'software' ? '💻 Software' : s === 'healthcare' ? '🏥 Healthcare' : '⚡ Energy'}
                </button>
              ))}
            </div>
          </div>

          <div className={`border-t ${th.divider}`} />

          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${th.dimmed}`}>Fund Timeline</p>
            <div className="flex flex-col gap-3">
              <InputRow label="Vintage Year" value={inp.vintageYear} onChange={v => set('vintageYear', v)} min={2010} max={2025} step={1} th={th} />
              <InputRow label="Fund End Year" value={inp.fundEndYear} onChange={v => set('fundEndYear', v)} min={2025} max={2040} step={1} th={th} />
              <div className={`rounded-lg px-3 py-2 ${th.section} flex items-center justify-between`}>
                <span className={`text-xs ${th.label}`}>Remaining Life</span>
                <span className={`text-sm font-mono font-bold ${th.text}`}>{Math.max(0, inp.fundEndYear - inp.currentYear)} yrs</span>
              </div>
            </div>
          </div>

          <div className={`border-t ${th.divider}`} />

          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${th.dimmed}`}>Rate & Leverage</p>
            <div className="flex flex-col gap-3">
              <InputRow label="Current SOFR" value={inp.sofr} onChange={v => set('sofr', v)} unit="%" min={0} max={15} step={0.1} th={th} />
              <InputRow label="Portfolio Leverage" value={inp.leverageRatio} onChange={v => set('leverageRatio', v)} unit="x" min={0} max={2} step={0.05} th={th} />
            </div>
          </div>

          <div className={`border-t ${th.divider}`} />

          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${th.dimmed}`}>Buyer Target</p>
            <InputRow label="Target IRR" value={inp.targetIrr ?? 18} onChange={v => set('targetIrr', v)} unit="%" min={5} max={40} step={0.5} th={th} />
          </div>
        </div>

        {/* ── Right: Results ── */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* Headline cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ResultCard
              label="Fair Bid Price"
              value={fmtM(result.fairBid)}
              sub={`${(fairBidPct * 100).toFixed(1)}% of NAV`}
              variant={fairVariant}
            />
            <ResultCard
              label="Discount at Fair Bid"
              value={fmtPct(result.fairBidDiscount)}
              sub="to NAV"
              variant={fairVariant}
            />
            <ResultCard
              label="IRR at Full NAV Ask"
              value={fmtPct(result.irrAtAsk)}
              sub="if you pay full NAV"
              variant={result.irrAtAsk >= 0.15 ? 'positive' : result.irrAtAsk >= 0.10 ? 'warning' : 'danger'}
            />
            <ResultCard
              label="IRR at Fair Bid"
              value={fmtPct(result.irrAtFairBid)}
              sub={`target: ${inp.targetIrr}%`}
              variant="positive"
            />
          </div>

          {/* Bid vs IRR bar chart */}
          <div className={`rounded-xl p-5 ${th.card}`}>
            <p className={`text-sm font-semibold ${th.text} mb-0.5`}>Buyer IRR at Different Bid Prices</p>
            <p className={`text-xs ${th.dimmed} mb-4`}>
              Green ≥ 20% · Yellow 15–20% · Red &lt; 15% · Dashed line = your target IRR
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={result.chartData} margin={{ top: 8, right: 24, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={th.chartGrid} vertical={false} />
                <XAxis dataKey="bidPct" tickFormatter={v => `${v}%`}
                  tick={{ fill: th.chartText, fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={{ stroke: th.chartGrid }} tickLine={false}
                  label={{ value: 'Bid (% of NAV)', position: 'insideBottom', offset: -4, fill: th.chartText, fontSize: 10 }} />
                <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: th.chartText, fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  formatter={(v: unknown) => [`${((v as number) * 100).toFixed(1)}%`, 'Buyer IRR']}
                  labelFormatter={v => `Bid: ${v}% of NAV`}
                  contentStyle={{ background: th.chartBg, border: `1px solid ${th.chartGrid}`, borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={(inp.targetIrr ?? 18) / 100} stroke="#3b82f6" strokeDasharray="5 3" strokeWidth={2}
                  label={{ value: 'Target', position: 'insideTopRight', fill: '#3b82f6', fontSize: 10 }} />
                <Bar dataKey="irr" radius={[4, 4, 0, 0]}>
                  {result.chartData.map((d, i) => (
                    <Cell key={i} fill={irrLineColor(d.irr)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sensitivity Grid */}
          <div className={`rounded-xl p-5 ${th.card}`}>
            <p className={`text-sm font-semibold ${th.text} mb-0.5`}>Buyer IRR Sensitivity Grid</p>
            <p className={`text-xs ${th.dimmed} mb-4`}>
              Bid price (% of NAV) × remaining fund life · Green ≥ 20% · Yellow 15–20% · Red &lt; 15%
            </p>
            <SensitivityTable
              rowHeaders={BID_PCT_ROWS.map(b => `${(b * 100).toFixed(0)}%`)}
              colHeaders={[1, 2, 3, 4, 5, 6].map(l => `${l}yr`)}
              data={result.gridIRRs}
              formatValue={fmtPct}
              colorFn={irrColor}
              rowLabel="Bid % of NAV"
              colLabel="Remaining Life"
            />
          </div>

          {/* Interpretation note */}
          <div className={`rounded-xl p-5 border ${th.section}`}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-2 text-blue-500`}>How to Read This</p>
            <p className={`text-sm leading-relaxed ${th.muted}`}>
              The fair bid is the maximum you can pay and still hit your {inp.targetIrr}% IRR target.
              The bar chart shows that as you bid closer to full NAV, your return compresses — the
              "price of liquidity" the seller pays becomes the "yield" you earn as a buyer.
              In stressed markets, disciplined buyers set firm bid floors and let distressed sellers come to them.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function SecondaryPricingPage() {
  const [view, setView]     = useState<'select' | 'seller' | 'buyer'>('select');
  const [isDark, setIsDark] = useState(true);

  const toggle = () => setIsDark(d => !d);

  if (view === 'seller') return <SellerTool onBack={() => setView('select')} isDark={isDark} onToggleTheme={toggle} />;
  if (view === 'buyer')  return <BuyerTool  onBack={() => setView('select')} isDark={isDark} onToggleTheme={toggle} />;
  return <SelectorScreen onSelect={setView} isDark={isDark} onToggleTheme={toggle} />;
}
