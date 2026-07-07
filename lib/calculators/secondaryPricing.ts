import { irr } from './irr';

export type Sector = 'software' | 'healthcare' | 'energy';

const SECTOR_SPREAD: Record<Sector, number> = {
  software:   0.0200,  // +200bps — high multiple compression risk
  healthcare: 0.0125,  // +125bps
  energy:     0.0175,  // +175bps
};

const BASE_PREMIUM = 0.015; // 150bps illiquidity/complexity premium

export interface SecondaryInputs {
  nav:           number;  // $M
  dpi:           number;  // x e.g. 0.4
  rvpi:          number;  // x e.g. 0.9
  unfunded:      number;  // $M unfunded commitments
  sector:        Sector;
  vintageYear:   number;  // e.g. 2022
  fundEndYear:   number;  // e.g. 2028
  currentYear:   number;  // e.g. 2026
  sofr:          number;  // as % e.g. 5.3
  leverageRatio: number;  // D/NAV e.g. 0.30
  targetIrr?:    number;  // buyer tool, as % e.g. 18
  bidPrice?:     number;  // buyer tool, $M
}

export interface SellerOutput {
  impliedDiscount:    number;  // 0.20 = 20%
  impliedPrice:       number;  // $M
  pricePerDollarNAV:  number;  // 0.80 = 80¢ per $1 NAV
  requiredReturn:     number;  // buyer's annualized required return
  // grid[sofrIdx][lifeIdx]
  gridDiscounts:      number[][];
  sofrRows:           number[];
  lifeCols:           number[];
  chartData:          { sofr: number; discount: number }[];
}

export interface BuyerOutput {
  fairBid:          number;  // $M
  fairBidDiscount:  number;  // % discount at fair bid
  irrAtAsk:         number;  // IRR if buyer pays full NAV
  irrAtFairBid:     number;
  // grid[bidPctIdx][lifeIdx]
  gridIRRs:         number[][];
  bidPctRows:       number[];
  lifeCols:         number[];
  chartData:        { bidPct: number; irr: number }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function calcRequiredReturn(inputs: SecondaryInputs, sofrOverride?: number): number {
  const sofr         = (sofrOverride ?? inputs.sofr) / 100;
  const sectorSpread = SECTOR_SPREAD[inputs.sector];
  // +50bps per 0.1x leverage above 0.3x
  const leverageAdj  = Math.max(0, inputs.leverageRatio - 0.3) * 0.50;
  // +50bps if unfunded > 20% of NAV
  const unfundedAdj  = inputs.unfunded / inputs.nav > 0.2 ? 0.005 : 0;
  return sofr + BASE_PREMIUM + sectorSpread + leverageAdj + unfundedAdj;
}

/**
 * Quality adjustment based on DPI and RVPI.
 *
 * Cashflows are fixed at NAV (the stake value being purchased). RVPI and DPI
 * only affect the buyer's required return — the risk-adjusted rate they discount
 * those cashflows at.
 *
 * DPI (distributed to paid-in): proven, realized capital returned to LPs.
 * Higher DPI → less risk → lower required return → discount narrows.
 *
 * RVPI (residual value to paid-in): still locked up and unrealized.
 * Higher RVPI → more uncertain value → higher required return → discount widens.
 * This matches real market behavior: buyers pay less for funds with high unrealized value.
 */
function calcQualityAdj(dpi: number, rvpi: number): number {
  let dpiAdj: number;
  if      (dpi >= 1.0)  dpiAdj = -0.040;  // -400bps: most capital back, low risk
  else if (dpi >= 0.7)  dpiAdj = -0.020;  // -200bps
  else if (dpi >= 0.4)  dpiAdj = -0.005;  //  -50bps
  else if (dpi >= 0.2)  dpiAdj =  0.010;  // +100bps
  else                  dpiAdj =  0.025;  // +250bps: little proven, high uncertainty

  let rvpiAdj: number;
  if      (rvpi >= 1.5) rvpiAdj =  0.020;  // +200bps: very high unrealized risk
  else if (rvpi >= 1.0) rvpiAdj =  0.010;  // +100bps
  else if (rvpi >= 0.7) rvpiAdj =  0.005;  //  +50bps
  else if (rvpi >= 0.4) rvpiAdj =  0.000;
  else                  rvpiAdj = -0.005;  //  -50bps: fund nearly wound down

  return dpiAdj + rvpiAdj;
}

/**
 * Cashflows based on NAV only — total future distributions equal the current
 * NAV (what the buyer is purchasing). Distribution timing: 60% interim spread
 * evenly over remaining life, 40% as terminal proceeds.
 */
function buildCashflows(nav: number, remainingYears: number): number[] {
  const quarters = Math.max(1, Math.round(remainingYears * 4));
  const totalInterim  = nav * 0.6;
  const terminal      = nav * 0.4;
  const quarterlyDist = totalInterim / quarters;

  const flows = new Array(quarters + 1).fill(0) as number[];
  for (let q = 1; q <= quarters; q++) flows[q] = quarterlyDist;
  flows[quarters] += terminal;
  return flows;
}

function pvFlows(flows: number[], annualRate: number): number {
  const qRate = (1 + annualRate) ** (1 / 4) - 1;
  let pv = 0;
  for (let t = 1; t < flows.length; t++) {
    pv += flows[t] / (1 + qRate) ** t;
  }
  return pv;
}

function discountAt(
  inputs: SecondaryInputs,
  sofrOverride?: number,
  lifeOverride?: number,
): number {
  const life   = lifeOverride ?? (inputs.fundEndYear - inputs.currentYear);
  const reqRet = calcRequiredReturn(inputs, sofrOverride) + calcQualityAdj(inputs.dpi, inputs.rvpi);
  const flows  = buildCashflows(inputs.nav, life);
  const pv     = pvFlows(flows, reqRet);
  return Math.max(0.01, Math.min(0.65, 1 - pv / inputs.nav));
}

function annualIRR(quarterlyRate: number): number {
  return (1 + quarterlyRate) ** 4 - 1;
}

// ── Main exports ───────────────────────────────────────────────────────────

export function discountAtCustomReturn(inputs: SecondaryInputs, annualReturn: number): { discount: number; price: number } {
  const remainingYears = inputs.fundEndYear - inputs.currentYear;
  const flows  = buildCashflows(inputs.nav, remainingYears);
  const qRate  = (1 + annualReturn) ** (1 / 4) - 1;
  let pv = 0;
  for (let t = 1; t < flows.length; t++) pv += flows[t] / (1 + qRate) ** t;
  const discount = Math.max(0.01, Math.min(0.65, 1 - pv / inputs.nav));
  return { discount, price: inputs.nav * (1 - discount) };
}

export const SOFR_ROWS  = [3, 4, 5, 5.3, 6, 7, 8, 9];
export const LIFE_COLS  = [1, 2, 3, 4, 5, 6];
export const BID_PCT_ROWS = [0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00];

export function calculateSeller(inputs: SecondaryInputs): SellerOutput {
  const remainingYears = inputs.fundEndYear - inputs.currentYear;
  const discount       = discountAt(inputs);
  const reqReturn      = calcRequiredReturn(inputs) + calcQualityAdj(inputs.dpi, inputs.rvpi);

  const gridDiscounts = SOFR_ROWS.map(s =>
    LIFE_COLS.map(l => discountAt(inputs, s, l))
  );

  const chartData = SOFR_ROWS.map(s => ({
    sofr:     s,
    discount: discountAt(inputs, s, remainingYears),
  }));

  return {
    impliedDiscount:   discount,
    impliedPrice:      inputs.nav * (1 - discount),
    pricePerDollarNAV: 1 - discount,
    requiredReturn:    reqReturn,
    gridDiscounts,
    sofrRows:   SOFR_ROWS,
    lifeCols:   LIFE_COLS,
    chartData,
  };
}

export function calculateBuyer(inputs: SecondaryInputs): BuyerOutput {
  const targetIrr      = (inputs.targetIrr ?? 18) / 100;
  const remainingYears = inputs.fundEndYear - inputs.currentYear;
  const flows          = buildCashflows(inputs.nav, remainingYears);

  function irrAtPrice(price: number): number {
    const cf = [-price, ...flows.slice(1)];
    const q  = irr(cf);
    return annualIRR(q);
  }

  function irrAtBidAndLife(bidPct: number, life: number): number {
    const price = inputs.nav * bidPct;
    const f     = buildCashflows(inputs.nav, life);
    const cf    = [-price, ...f.slice(1)];
    const q     = irr(cf);
    return annualIRR(q);
  }

  // Binary search for fair bid
  let lo = inputs.nav * 0.30, hi = inputs.nav * 1.10;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (irrAtPrice(mid) > targetIrr) lo = mid;
    else hi = mid;
  }
  const fairBid = (lo + hi) / 2;

  const gridIRRs = BID_PCT_ROWS.map(b =>
    LIFE_COLS.map(l => irrAtBidAndLife(b, l))
  );

  const chartData = BID_PCT_ROWS.map(b => ({
    bidPct: b * 100,
    irr:    irrAtPrice(inputs.nav * b),
  }));

  return {
    fairBid,
    fairBidDiscount: 1 - fairBid / inputs.nav,
    irrAtAsk:        irrAtPrice(inputs.nav),
    irrAtFairBid:    irrAtPrice(fairBid),
    gridIRRs,
    bidPctRows: BID_PCT_ROWS,
    lifeCols:   LIFE_COLS,
    chartData,
  };
}
