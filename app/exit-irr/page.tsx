'use client';
import { useState, useMemo } from 'react';
import ToolShell from '@/components/layout/ToolShell';
import InputField from '@/components/ui/InputField';
import ResultCard from '@/components/ui/ResultCard';
import SensitivityTable from '@/components/ui/SensitivityTable';
import { calculateExitIrr, BuyerLBOResult } from '@/lib/calculators/exitIrr';
import ExitComparisonChart from '@/components/charts/ExitComparisonChart';
import MoicComparisonChart from '@/components/charts/MoicComparisonChart';

const EXIT_MULTIPLES = [8, 10, 12, 14, 16];
const HOLD_YEARS = [3, 4, 5, 6, 7];

const DEFAULT = {
  entryMultiple: 12,
  entryEbitda: 40,
  leverage: 6,
  ebitdaGrowth: 12,
  originalRate: 4.5,
  currentRate: 9.5,
  isHedged: false,
  hedgeCostPct: 0.75,
  capexPct: 3,
  taxRate: 25,
  buyerTargetIRR: 20,
  buyerHoldYears: 5,
  buyerGrowthRate: 8,
};

function irrColor(v: number): string {
  if (v >= 0.25) return 'bg-emerald-800';
  if (v >= 0.15) return 'bg-yellow-800';
  if (v >= 0)    return 'bg-red-900';
  return 'bg-red-950';
}
function moicColor(v: number): string {
  if (v >= 2.5) return 'bg-emerald-800';
  if (v >= 1.5) return 'bg-yellow-800';
  if (v >= 1.0) return 'bg-red-900';
  return 'bg-red-950';
}
function multipleColor(v: number): string {
  if (v >= 12)  return 'bg-emerald-800';
  if (v >= 9)   return 'bg-yellow-800';
  return 'bg-red-900';
}

function fmtPct(v: number)  { return `${(v * 100).toFixed(1)}%`; }
function fmtMoic(v: number) { return `${v.toFixed(2)}x`; }
function fmtMult(v: number) { return `${v.toFixed(1)}x`; }
function fmtM(v: number)    { return `$${v.toFixed(0)}M`; }

type GridMode  = 'irr' | 'moic';
type GridEnv   = 'floating' | 'original';

export default function ExitIrrPage() {
  const [inp, setInp] = useState(DEFAULT);
  const [gridMode,         setGridMode]         = useState<GridMode>('irr');
  const [gridEnv,          setGridEnv]          = useState<GridEnv>('floating');
  const [chartHoldYearIdx, setChartHoldYearIdx] = useState(2); // default 5yr
  const [lboScenario,      setLboScenario]      = useState<'bull' | 'base' | 'bear'>('base');

  const set = (key: keyof typeof DEFAULT) => (v: number | boolean) =>
    setInp(prev => ({ ...prev, [key]: v }));

  const result = useMemo(() => calculateExitIrr({
    ...inp,
    ebitdaGrowth:   inp.ebitdaGrowth   / 100,
    originalRate:   inp.originalRate   / 100,
    currentRate:    inp.currentRate    / 100,
    hedgeCostPct:   inp.hedgeCostPct   / 100,
    capexPct:       inp.capexPct       / 100,
    taxRate:        inp.taxRate        / 100,
    buyerTargetIRR: inp.buyerTargetIRR / 100,
    buyerGrowthRate:inp.buyerGrowthRate/ 100,
    exitMultiples: EXIT_MULTIPLES,
    holdYears:     HOLD_YEARS,
  }), [inp]);

  // Chart data — one point per exit multiple for the selected hold year
  const chartData = EXIT_MULTIPLES.map((em, emIdx) => ({
    multiple: em,
    original: result.originalGrid[emIdx][chartHoldYearIdx].irr,
    floating: result.grid[emIdx][chartHoldYearIdx].irr,
  }));
  const chartDataMoic = EXIT_MULTIPLES.map((em, emIdx) => ({
    multiple: em,
    original: result.originalGrid[emIdx][chartHoldYearIdx].moic,
    floating: result.grid[emIdx][chartHoldYearIdx].moic,
  }));

  const floatingLabel = inp.isHedged ? `Hedged (${inp.originalRate}%)` : `Floating (${inp.originalRate}%→${inp.currentRate}%)`;
  const originalLabel = `Original (${inp.originalRate}% fixed)`;
  const impliedMultiple = result.buyerLBO[chartHoldYearIdx]?.[lboScenario]?.impliedMultiple;

  const activeGrid = gridEnv === 'floating' ? result.grid : result.originalGrid;
  const tableData  = activeGrid.map(row => row.map(c => gridMode === 'irr' ? c.irr : c.moic));

  // Base case: 5yr hold, entry multiple exit
  const baseEMIdx = Math.min(
    EXIT_MULTIPLES.findIndex(m => m >= inp.entryMultiple) !== -1
      ? EXIT_MULTIPLES.findIndex(m => m >= inp.entryMultiple)
      : 2,
    EXIT_MULTIPLES.length - 1
  );
  const baseHYIdx  = 2; // 5yr
  const baseFloat  = result.grid[baseEMIdx]?.[baseHYIdx];
  const baseOrig   = result.originalGrid[baseEMIdx]?.[baseHYIdx];
  const irrVar     = (v: number) => v >= 0.25 ? 'positive' : v >= 0.15 ? 'warning' : 'danger';

  const Legend = ({ mode }: { mode: GridMode }) => (
    <div className="flex gap-4 mt-3 text-xs text-slate-500">
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-800 inline-block" />{mode === 'irr' ? '≥ 25% IRR' : '≥ 2.5x'}</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-800 inline-block" />{mode === 'irr' ? '15–25%'    : '1.5–2.5x'}</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-900   inline-block" />{mode === 'irr' ? '< 15%'     : '< 1.5x'}</span>
    </div>
  );

  return (
    <ToolShell
      title="Exit IRR / MOIC Sensitivity"
      description="LBO return model with floating-rate debt and buyer's LBO exit pricing. Compare your returns against what the market will realistically clear."
    >
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">

        {/* ── Input Panel ── */}
        <div className="space-y-6">
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Deal Parameters</p>
            <InputField label="Entry EV/EBITDA Multiple"      value={inp.entryMultiple}  onChange={set('entryMultiple')}  unit="x"  step={0.5} tooltip="Price paid as a multiple of annual profit" />
            <InputField label="Entry EBITDA"                  value={inp.entryEbitda}    onChange={set('entryEbitda')}    unit="$M" step={5}   tooltip="Company's annual operating profit at purchase" />
            <InputField label="Entry Leverage (Debt/EBITDA)"  value={inp.leverage}       onChange={set('leverage')}       unit="x"  step={0.5} tooltip="Borrowed amount as multiple of EBITDA" />
            <InputField label="EBITDA Growth Rate"            value={inp.ebitdaGrowth}   onChange={set('ebitdaGrowth')}   unit="%"  step={1}   tooltip="Annual projected profit growth during hold" />
            <InputField label="Capex (% of EBITDA)"          value={inp.capexPct}        onChange={set('capexPct')}       unit="%"  step={0.5} tooltip="Annual reinvestment cost as % of EBITDA" />
            <InputField label="Tax Rate"                      value={inp.taxRate}         onChange={set('taxRate')}        unit="%"  step={1} />
          </div>

          {/* Floating Rate */}
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Interest Rate</p>
            <InputField label="Original Rate (Entry)" value={inp.originalRate} onChange={set('originalRate')} unit="%" step={0.25} tooltip="Borrowing rate when the deal was originated" />

            {/* Hedged toggle */}
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Rate Structure</p>
              <div className="flex rounded-lg overflow-hidden border border-navy-700 w-fit">
                {[false, true].map(h => (
                  <button
                    key={String(h)}
                    onClick={() => set('isHedged')(h)}
                    className={`px-4 py-2 text-xs font-medium transition-colors ${
                      inp.isHedged === h ? 'bg-brand text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {h ? 'Hedged' : 'Unhedged (Floating)'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                {inp.isHedged
                  ? 'Rate locked at original — hedge cost subtracted from FCF each year.'
                  : 'Rate ramps linearly from original to current over the hold period.'}
              </p>
            </div>

            {inp.isHedged ? (
              <InputField label="Annual Hedge Cost (% of debt)" value={inp.hedgeCostPct} onChange={set('hedgeCostPct')} unit="%" step={0.1} tooltip="Cost of the interest rate cap/swap per year, as % of original debt" />
            ) : (
              <InputField label="Current Rate (Rate at Exit)" value={inp.currentRate} onChange={set('currentRate')} unit="%" step={0.25} tooltip="Rate at end of hold — ramp endpoint for floating debt" />
            )}
          </div>

          {/* Buyer's LBO */}
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Buyer's LBO Parameters</p>
            <p className="text-xs text-slate-500">Used to derive a market-constrained exit price rather than assuming a multiple freely.</p>
            <InputField label="Buyer's Target IRR"         value={inp.buyerTargetIRR}  onChange={set('buyerTargetIRR')}  unit="%" step={1}   tooltip="Minimum return the next buyer needs to do the deal" />
            <InputField label="Buyer's Assumed Hold (yrs)" value={inp.buyerHoldYears}  onChange={set('buyerHoldYears')}  unit="yr" step={1}   tooltip="How long the buyer expects to own the company" />
            <InputField label="Buyer's EBITDA Growth"      value={inp.buyerGrowthRate} onChange={set('buyerGrowthRate')} unit="%" step={1}   tooltip="Growth rate the buyer underwrites in their model" />
          </div>
        </div>

        {/* ── Results Panel ── */}
        <div className="space-y-6">

          {/* Headline cards */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">
              Base Case — {inp.entryMultiple}x Exit / 5-Year Hold
              {inp.isHedged ? ` · Hedged at ${inp.originalRate}%` : ` · Floating ${inp.originalRate}% → ${inp.currentRate}%`}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <ResultCard label="Entry EV"     value={fmtM(result.entryEV)} />
              <ResultCard label="Entry Equity" value={fmtM(result.entryEquity)} sub={`${fmtM(result.entryDebt)} debt`} />
              {baseFloat && (
                <ResultCard
                  label={inp.isHedged ? 'IRR (Hedged)' : 'IRR (Floating Rate)'}
                  value={fmtPct(baseFloat.irr)}
                  variant={irrVar(baseFloat.irr)}
                />
              )}
              {baseFloat && baseOrig && (
                <ResultCard
                  label="Rate Erosion vs Original"
                  value={`-${((baseOrig.irr - baseFloat.irr) * 100).toFixed(1)}pp`}
                  sub="IRR lost to rate environment"
                  variant="danger"
                />
              )}
            </div>
          </div>

          {/* Sensitivity Grid */}
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-sm font-semibold text-white">Sensitivity Grid</p>
              <div className="flex gap-2 flex-wrap">
                <div className="flex rounded-lg overflow-hidden border border-navy-700">
                  {(['irr', 'moic'] as GridMode[]).map(m => (
                    <button key={m} onClick={() => setGridMode(m)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${gridMode === m ? 'bg-brand text-white' : 'text-slate-400 hover:text-white'}`}>
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="flex rounded-lg overflow-hidden border border-navy-700">
                  {([['floating', inp.isHedged ? `Hedged (${inp.originalRate}%)` : `Floating Rate`], ['original', `Original (${inp.originalRate}%)`]] as [GridEnv, string][]).map(([env, label]) => (
                    <button key={env} onClick={() => setGridEnv(env)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${gridEnv === env ? 'bg-brand text-white' : 'text-slate-400 hover:text-white'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <SensitivityTable
              rowHeaders={EXIT_MULTIPLES.map(m => `${m}x Exit`)}
              colHeaders={HOLD_YEARS.map(y => `${y}yr`)}
              data={tableData}
              formatValue={gridMode === 'irr' ? fmtPct : fmtMoic}
              colorFn={gridMode === 'irr' ? irrColor : moicColor}
              rowLabel="Exit Multiple"
              colLabel="Hold Period"
            />
            <Legend mode={gridMode} />
          </div>

          {/* Charts */}
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-semibold text-white">Rate Erosion — Visual Comparison</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Faded = original rate · Solid = {inp.isHedged ? 'hedged' : 'floating'} rate · Red zone = above {lboScenario} case market cap ({impliedMultiple ? `${impliedMultiple.toFixed(1)}x` : '—'})
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1.5 text-right">Hold Period</p>
                <div className="flex rounded-lg overflow-hidden border border-navy-700">
                  {HOLD_YEARS.map((y, i) => (
                    <button
                      key={y}
                      onClick={() => setChartHoldYearIdx(i)}
                      className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors ${
                        chartHoldYearIdx === i ? 'bg-brand text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {y}yr
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ExitComparisonChart
                data={chartData}
                mode="irr"
                floatingLabel={floatingLabel}
                originalLabel={originalLabel}
                impliedMultiple={impliedMultiple}
              />
              <MoicComparisonChart
                data={chartDataMoic}
                floatingLabel={floatingLabel}
                originalLabel={originalLabel}
                impliedMultiple={impliedMultiple}
              />
            </div>
          </div>

          {/* Buyer's LBO Table */}
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
            <div className="grid grid-cols-[1fr_auto] gap-4 mb-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white mb-1">Buyer's LBO — Market-Constrained Exit Pricing</p>
                <p className="text-xs text-slate-500">
                  {lboScenario === 'bull' && 'Bull — competitive auction, full leverage available, buyer pays their model maximum.'}
                  {lboScenario === 'base' && 'Base — normal process, −12% discount to theoretical maximum reflecting negotiation friction.'}
                  {lboScenario === 'bear' && 'Bear — stressed market, few bidders, lender conservatism, −25% discount to theoretical maximum.'}
                </p>
              </div>
              <div className="flex rounded-lg overflow-hidden border border-navy-700 h-fit">
                {(['bull', 'base', 'bear'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setLboScenario(s)}
                    className={`w-24 py-2 text-xs font-semibold text-center transition-colors ${
                      lboScenario === s
                        ? s === 'bull' ? 'bg-emerald-700 text-white'
                        : s === 'base' ? 'bg-yellow-700 text-white'
                        : 'bg-red-800 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s === 'bull' ? 'Bull (0%)' : s === 'base' ? 'Base (−12%)' : 'Bear (−25%)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-navy-700">
                    <th className="text-left text-xs text-slate-500 py-2 pr-6">Hold Year</th>
                    <th className="text-left text-xs text-slate-500 py-2 pr-6">Exit EBITDA</th>
                    <th className="text-left text-xs text-slate-500 py-2 pr-6">Max Lev</th>
                    <th className="text-center text-xs text-slate-500 py-2 px-4">Implied Multiple</th>
                    <th className="text-center text-xs text-slate-500 py-2 px-4">Seller IRR</th>
                    <th className="text-center text-xs text-slate-500 py-2 px-4">Seller MOIC</th>
                  </tr>
                </thead>
                <tbody>
                  {result.buyerLBO.map((row: BuyerLBOResult) => {
                    const s = row[lboScenario];
                    return (
                      <tr key={row.holdYear} className="border-b border-navy-700/40">
                        <td className="py-3 pr-6 text-slate-200 font-semibold">{row.holdYear}yr</td>
                        <td className="py-3 pr-6 text-slate-300">{fmtM(row.exitEbitda)}</td>
                        <td className="py-3 pr-6 text-slate-400">{row.maxLeverageAvailable}x</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded ${multipleColor(s.impliedMultiple)} text-white font-bold`}>
                            {fmtMult(s.impliedMultiple)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded ${irrColor(s.sellerIRR)} text-white font-bold`}>
                            {fmtPct(s.sellerIRR)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded ${moicColor(s.sellerMOIC)} text-white font-bold`}>
                            {fmtMoic(s.sellerMOIC)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-600 mt-3">
              Max leverage available to buyer decreases as rates rise: &lt;5% → 6x · 5–7% → 5x · 7–9% → 4.5x · &gt;9% → 4x
            </p>
          </div>

        </div>
      </div>
    </ToolShell>
  );
}
