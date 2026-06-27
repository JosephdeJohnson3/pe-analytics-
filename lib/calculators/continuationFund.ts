import { irr } from './irr';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ContinuationInputs {
  // Fund history
  originalNav:      number;  // NAV at continuation fund close ($M)
  entryCost:        number;  // LP's original cost basis ($M)
  yearsHeld:        number;  // years held in original fund so far
  originalCarry:    number;  // original fund carry % (e.g. 20)
  originalHurdle:   number;  // original fund hurdle % (e.g. 8)

  // Continuation fund terms
  continuationDiscount: number; // cash-out discount % (e.g. 10 = 10% below NAV)
  newCarry:         number;  // carry on continuation fund (e.g. 20)
  newHurdle:        number;  // hurdle on continuation fund (e.g. 8)
  newFundLife:      number;  // additional years in continuation fund (e.g. 4)

  // Exit scenarios — annual NAV growth rates
  bullGrowth:       number;  // e.g. 35
  baseGrowth:       number;  // e.g. 20
  bearGrowth:       number;  // e.g. 5
}

export interface ScenarioResult {
  exitNAV:          number;   // gross exit value
  // Cash-out path
  cashOutProceeds:  number;   // NAV × (1 - discount)
  cashOutMOIC:      number;
  cashOutIRR:       number;
  // Roll path
  rollGrossProceeds: number;  // exit NAV
  rollCarryPaid:    number;   // GP carry on gains above continuation NAV
  rollNetProceeds:  number;   // after new carry
  rollMOIC:         number;
  rollIRR:          number;
  // Decision
  rollIsBetter:     boolean;
  upliftVsCashOut:  number;   // $ difference (roll net - cashout proceeds)
}

export interface GPAnalysis {
  // GP's carry optionality value: carry earned on bull vs bear
  carryAtBull:      number;
  carryAtBase:      number;
  carryAtBear:      number;
  breakEvenGrowth:  number;   // annual growth rate where roll = cash-out for LP
}

export interface SensitivityCell {
  discount: number;
  growth:   number;
  rollIRR:  number;
  cashOutIRR: number;
  rollIsBetter: boolean;
}

export interface ContinuationOutput {
  bull:         ScenarioResult;
  base:         ScenarioResult;
  bear:         ScenarioResult;
  gp:           GPAnalysis;
  sensitivity:  SensitivityCell[][];  // [discountIdx][growthIdx]
  discountRows: number[];
  growthCols:   number[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function calcCarry(gain: number, carryPct: number, hurdle: number, basis: number): number {
  // Preferred return first, then carry on excess
  const preferredReturn = basis * ((1 + hurdle / 100) ** 1 - 1); // simple annual hurdle
  const excessAboveHurdle = Math.max(0, gain - preferredReturn);
  return excessAboveHurdle * (carryPct / 100);
}

function calcScenario(
  inputs: ContinuationInputs,
  annualGrowth: number,
): ScenarioResult {
  const { originalNav, entryCost, yearsHeld, continuationDiscount,
          newCarry, newHurdle, newFundLife } = inputs;

  const exitNAV = originalNav * (1 + annualGrowth / 100) ** newFundLife;

  // ── Cash-out path ──
  const cashOutProceeds = originalNav * (1 - continuationDiscount / 100);
  const totalYears = yearsHeld; // already held this long
  const cashOutMOIC = cashOutProceeds / entryCost;
  // IRR from time zero to now (yearsHeld) then cash out
  const cashOutCF = [-entryCost, ...Array(yearsHeld - 1).fill(0), cashOutProceeds];
  const cashOutIRR = irr(cashOutCF);

  // ── Roll path ──
  const gain = exitNAV - originalNav;
  const rollCarryPaid = gain > 0
    ? calcCarry(gain, newCarry, newHurdle, originalNav)
    : 0;
  const rollNetProceeds = exitNAV - rollCarryPaid;
  const rollMOIC = rollNetProceeds / entryCost;
  // IRR from time zero through original hold + new fund life
  const totalHold = yearsHeld + newFundLife;
  const rollCF = [-entryCost, ...Array(totalHold - 1).fill(0), rollNetProceeds];
  const rollIRR = irr(rollCF);

  return {
    exitNAV,
    cashOutProceeds,
    cashOutMOIC,
    cashOutIRR,
    rollGrossProceeds: exitNAV,
    rollCarryPaid,
    rollNetProceeds,
    rollMOIC,
    rollIRR,
    rollIsBetter: rollNetProceeds > cashOutProceeds,
    upliftVsCashOut: rollNetProceeds - cashOutProceeds,
  };
}

// ── Main export ────────────────────────────────────────────────────────────

export const DISCOUNT_ROWS = [0, 5, 10, 15, 20, 25];
export const GROWTH_COLS   = [5, 10, 15, 20, 25, 30, 35];

export function calculateContinuation(inputs: ContinuationInputs): ContinuationOutput {
  const bull = calcScenario(inputs, inputs.bullGrowth);
  const base = calcScenario(inputs, inputs.baseGrowth);
  const bear = calcScenario(inputs, inputs.bearGrowth);

  // GP carry optionality
  const gp: GPAnalysis = {
    carryAtBull: bull.rollCarryPaid,
    carryAtBase: base.rollCarryPaid,
    carryAtBear: bear.rollCarryPaid,
    breakEvenGrowth: findBreakEven(inputs),
  };

  // Sensitivity grid
  const sensitivity: SensitivityCell[][] = DISCOUNT_ROWS.map(discount => {
    const tweaked = { ...inputs, continuationDiscount: discount };
    return GROWTH_COLS.map(growth => {
      const s = calcScenario(tweaked, growth);
      return {
        discount,
        growth,
        rollIRR: s.rollIRR,
        cashOutIRR: s.cashOutIRR,
        rollIsBetter: s.rollIsBetter,
      };
    });
  });

  return { bull, base, bear, gp, sensitivity, discountRows: DISCOUNT_ROWS, growthCols: GROWTH_COLS };
}

function findBreakEven(inputs: ContinuationInputs): number {
  // Binary search for annual growth where rollNet ≈ cashOut proceeds
  const cashOut = inputs.originalNav * (1 - inputs.continuationDiscount / 100);
  let lo = 0, hi = 100;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const exitNAV = inputs.originalNav * (1 + mid / 100) ** inputs.newFundLife;
    const gain = exitNAV - inputs.originalNav;
    const carry = gain > 0 ? calcCarry(gain, inputs.newCarry, inputs.newHurdle, inputs.originalNav) : 0;
    const rollNet = exitNAV - carry;
    if (rollNet < cashOut) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
