import { irr } from './irr';

export interface ExitIrrInputs {
  entryMultiple: number;
  entryEbitda: number;
  leverage: number;
  ebitdaGrowth: number;
  originalRate: number;      // starting rate / locked rate if hedged
  currentRate: number;       // ending rate for unhedged ramp
  isHedged: boolean;
  hedgeCostPct: number;      // annual hedge cost as % of original debt
  capexPct: number;
  taxRate: number;
  buyerTargetIRR: number;    // buyer's minimum required return (e.g. 0.20)
  buyerHoldYears: number;    // years buyer expects to hold (e.g. 5)
  buyerGrowthRate: number;   // buyer's EBITDA growth assumption
  exitMultiples: number[];
  holdYears: number[];
}

export interface ScenarioResult {
  irr: number;
  moic: number;
}

export interface BuyerLBOScenario {
  impliedMultiple: number;
  sellerIRR: number;
  sellerMOIC: number;
}

export interface BuyerLBOResult {
  holdYear: number;
  exitEbitda: number;
  bull: BuyerLBOScenario;   // full buyer LBO price
  base: BuyerLBOScenario;   // 12% discount
  bear: BuyerLBOScenario;   // 25% discount
  maxLeverageAvailable: number;
}

export interface ExitIrrOutput {
  entryEV: number;
  entryDebt: number;
  entryEquity: number;
  grid: ScenarioResult[][];        // [exitMultipleIndex][holdYearIndex] — uses floating/hedged rate
  originalGrid: ScenarioResult[][]; // fixed at original rate for comparison
  buyerLBO: BuyerLBOResult[];
  exitMultiples: number[];
  holdYears: number[];
}

// Linear rate ramp from startRate (yr 1) to endRate (final yr)
function buildRateSchedule(startRate: number, endRate: number, years: number, isHedged: boolean): number[] {
  if (isHedged) return Array(years).fill(startRate);
  if (years === 1) return [endRate];
  return Array.from({ length: years }, (_, t) =>
    startRate + (endRate - startRate) * (t / (years - 1))
  );
}

function buildEbitdaPath(entryEbitda: number, growth: number, years: number): number[] {
  return Array.from({ length: years }, (_, t) => entryEbitda * (1 + growth) ** (t + 1));
}

function runDebtSchedule(
  debt0: number,
  ebitdaPath: number[],
  rateSchedule: number[],
  capexPct: number,
  taxRate: number,
  hedgeCostPct: number = 0,
  originalDebt: number = 0
): number[] {
  let debt = debt0;
  const schedule = [debt0];
  const mandatoryAmort = debt0 * 0.05;
  const annualHedgeCost = originalDebt * hedgeCostPct; // fixed annual cost on original notional

  for (let i = 0; i < ebitdaPath.length; i++) {
    const rate = rateSchedule[i];
    const ebitda = ebitdaPath[i];
    const interest = debt * rate;
    const ebt = ebitda - interest;
    const tax = Math.max(0, ebt * taxRate);
    const fcf = ebitda - interest - tax - ebitda * capexPct - annualHedgeCost;
    const sweep = Math.max(0, fcf - mandatoryAmort);
    debt = Math.max(0, debt - mandatoryAmort - sweep);
    schedule.push(debt);
  }
  return schedule;
}

function calcScenario(
  entryEquity: number,
  entryDebt: number,
  entryEbitda: number,
  ebitdaGrowth: number,
  rateSchedule: number[],
  capexPct: number,
  taxRate: number,
  hedgeCostPct: number,
  exitMultiple: number,
  holdYears: number
): ScenarioResult {
  const ebitdaPath = buildEbitdaPath(entryEbitda, ebitdaGrowth, holdYears);
  const rates = rateSchedule.slice(0, holdYears);
  const debtSchedule = runDebtSchedule(entryDebt, ebitdaPath, rates, capexPct, taxRate, hedgeCostPct, entryDebt);
  const exitEbitda = ebitdaPath[holdYears - 1];
  const exitEV = exitMultiple * exitEbitda;
  const exitDebt = debtSchedule[holdYears];
  const exitEquity = Math.max(0, exitEV - exitDebt);
  const moic = exitEquity / entryEquity;
  const cashflows = [-entryEquity, ...Array(holdYears - 1).fill(0), exitEquity];
  const annualIRR = irr(cashflows);
  return { irr: annualIRR, moic };
}

// Max leverage a buyer can get given current rates
function maxBuyerLeverage(rate: number): number {
  if (rate < 0.05) return 6.0;
  if (rate < 0.07) return 5.0;
  if (rate < 0.09) return 4.5;
  return 4.0;
}

// Binary search: find max EV a buyer can pay and still hit targetIRR
function solveMaxBuyerEV(
  ebitdaAtExit: number,
  currentRate: number,
  targetIRR: number,
  buyerHoldYears: number,
  buyerGrowthRate: number,
  capexPct: number,
  taxRate: number
): number {
  const maxLev = maxBuyerLeverage(currentRate);
  const buyerDebt = maxLev * ebitdaAtExit;

  let lo = buyerDebt * 1.01; // equity must be positive
  let hi = ebitdaAtExit * 30;

  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    const buyerEquity = mid - buyerDebt;
    if (buyerEquity <= 0) { lo = mid; continue; }

    const buyerMultiple = mid / ebitdaAtExit;
    const ebitdaPath = buildEbitdaPath(ebitdaAtExit, buyerGrowthRate, buyerHoldYears);
    const rates = Array(buyerHoldYears).fill(currentRate);
    const debtSchedule = runDebtSchedule(buyerDebt, ebitdaPath, rates, capexPct, taxRate);
    const buyerExitEbitda = ebitdaPath[buyerHoldYears - 1];
    const buyerExitEV = buyerMultiple * buyerExitEbitda; // exits at same multiple they paid
    const buyerExitEquity = Math.max(0, buyerExitEV - debtSchedule[buyerHoldYears]);

    const cfs = [-buyerEquity, ...Array(buyerHoldYears - 1).fill(0), buyerExitEquity];
    const buyerIRR = irr(cfs);

    if (buyerIRR > targetIRR) {
      lo = mid; // buyer can afford to pay more
    } else {
      hi = mid;
    }
  }

  return (lo + hi) / 2;
}

function calcSellerReturn(
  entryEquity: number,
  entryDebt: number,
  entryEbitda: number,
  ebitdaGrowth: number,
  rateSchedule: number[],
  capexPct: number,
  taxRate: number,
  hedgeCostPct: number,
  exitEV: number,
  holdYears: number
): { irr: number; moic: number } {
  const ebitdaPath = buildEbitdaPath(entryEbitda, ebitdaGrowth, holdYears);
  const rates = rateSchedule.slice(0, holdYears);
  const debtSchedule = runDebtSchedule(entryDebt, ebitdaPath, rates, capexPct, taxRate, hedgeCostPct, entryDebt);
  const exitDebt = debtSchedule[holdYears];
  const exitEquity = Math.max(0, exitEV - exitDebt);
  const moic = exitEquity / entryEquity;
  const cashflows = [-entryEquity, ...Array(holdYears - 1).fill(0), exitEquity];
  return { irr: irr(cashflows), moic };
}

export function calculateExitIrr(inputs: ExitIrrInputs): ExitIrrOutput {
  const {
    entryMultiple, entryEbitda, leverage,
    ebitdaGrowth, originalRate, currentRate,
    isHedged, hedgeCostPct, capexPct, taxRate,
    buyerTargetIRR, buyerHoldYears, buyerGrowthRate,
    exitMultiples, holdYears,
  } = inputs;

  const entryEV = entryMultiple * entryEbitda;
  const entryDebt = leverage * entryEbitda;
  const entryEquity = entryEV - entryDebt;

  const maxHold = Math.max(...holdYears);

  // Rate schedule for the full max hold period
  const floatingRates = buildRateSchedule(originalRate, currentRate, maxHold, isHedged);
  const fixedRates = Array(maxHold).fill(originalRate);

  // Main grid: floating/hedged rates
  const grid: ScenarioResult[][] = exitMultiples.map(em =>
    holdYears.map(hy =>
      calcScenario(entryEquity, entryDebt, entryEbitda, ebitdaGrowth,
        floatingRates, capexPct, taxRate, isHedged ? hedgeCostPct : 0, em, hy)
    )
  );

  // Comparison grid: original fixed rate (no floating, no hedge cost)
  const originalGrid: ScenarioResult[][] = exitMultiples.map(em =>
    holdYears.map(hy =>
      calcScenario(entryEquity, entryDebt, entryEbitda, ebitdaGrowth,
        fixedRates, capexPct, taxRate, 0, em, hy)
    )
  );

  // Buyer's LBO for each hold year
  const buyerLBO: BuyerLBOResult[] = holdYears.map(hy => {
    const ebitdaPath = buildEbitdaPath(entryEbitda, ebitdaGrowth, hy);
    const exitEbitda = ebitdaPath[hy - 1];
    const rates = floatingRates.slice(0, hy);
    const rateAtExit = rates[hy - 1]; // rate in the exit year

    const bullEV = solveMaxBuyerEV(exitEbitda, rateAtExit, buyerTargetIRR, buyerHoldYears, buyerGrowthRate, capexPct, taxRate);
    const baseEV = bullEV * (1 - 0.12);
    const bearEV = bullEV * (1 - 0.25);

    const bullMultiple = bullEV / exitEbitda;
    const baseMultiple = baseEV / exitEbitda;
    const bearMultiple = bearEV / exitEbitda;

    const bullReturns = calcSellerReturn(entryEquity, entryDebt, entryEbitda, ebitdaGrowth, floatingRates, capexPct, taxRate, isHedged ? hedgeCostPct : 0, bullEV, hy);
    const baseReturns = calcSellerReturn(entryEquity, entryDebt, entryEbitda, ebitdaGrowth, floatingRates, capexPct, taxRate, isHedged ? hedgeCostPct : 0, baseEV, hy);
    const bearReturns = calcSellerReturn(entryEquity, entryDebt, entryEbitda, ebitdaGrowth, floatingRates, capexPct, taxRate, isHedged ? hedgeCostPct : 0, bearEV, hy);

    return {
      holdYear: hy,
      exitEbitda,
      maxLeverageAvailable: maxBuyerLeverage(rateAtExit),
      bull: { impliedMultiple: bullMultiple, sellerIRR: bullReturns.irr, sellerMOIC: bullReturns.moic },
      base: { impliedMultiple: baseMultiple, sellerIRR: baseReturns.irr, sellerMOIC: baseReturns.moic },
      bear: { impliedMultiple: bearMultiple, sellerIRR: bearReturns.irr, sellerMOIC: bearReturns.moic },
    };
  });

  return { entryEV, entryDebt, entryEquity, grid, originalGrid, buyerLBO, exitMultiples, holdYears };
}
