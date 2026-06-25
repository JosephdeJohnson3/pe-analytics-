// Newton-Raphson IRR solver — used by all tools
export function irr(cashflows: number[], guess = 0.1): number {
  let r = guess;
  for (let i = 0; i < 1000; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      npv += cashflows[t] / (1 + r) ** t;
      dnpv -= (t * cashflows[t]) / (1 + r) ** (t + 1);
    }
    if (Math.abs(dnpv) < 1e-12) break;
    const r_new = r - npv / dnpv;
    if (Math.abs(r_new - r) < 1e-7) return r_new;
    r = r_new;
  }
  return r;
}

// Annualize a periodic (quarterly) IRR
export function annualizeIRR(periodicRate: number, periodsPerYear = 4): number {
  return (1 + periodicRate) ** periodsPerYear - 1;
}
