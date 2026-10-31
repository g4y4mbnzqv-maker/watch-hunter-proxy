import { dealProfit, isSold } from "./dealLog";

// Figures to keep an eye on for tax. This is a guide, not tax advice.
//
// The trading allowance: if your trading income (what buyers paid, before
// costs) in a UK tax year is £1,000 or less, you don't need to tell HMRC
// about it. Above that, you register for Self Assessment.
//
// Platform reporting: since 2024, eBay, Vinted and similar sites report a
// seller to HMRC once they make 30 or more sales, or about £1,700 (€2,000),
// in a calendar year on that site.

export const TRADING_ALLOWANCE = 1000;
export const REPORTING_SALES = 30;
export const REPORTING_AMOUNT = 1700;

// The tax year a date falls in, which runs from 6 April to 5 April.
// Returns { label, start, end } with ISO dates, such as 2026/27.
export function taxYear(date) {
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00Z`);
  const year = d.getUTCFullYear();
  const startYear = d.getUTCMonth() > 3 || (d.getUTCMonth() === 3 && d.getUTCDate() >= 6) ? year : year - 1;
  return {
    label: `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`,
    start: `${startYear}-04-06`,
    end: `${startYear + 1}-04-05`,
  };
}

export function inTaxYear(deal, year) {
  return isSold(deal) && Boolean(deal.soldOn) && deal.soldOn >= year.start && deal.soldOn <= year.end;
}

// Sales, takings and profit in the tax year containing now
export function taxYearSummary(deals, settings, now = new Date()) {
  const year = taxYear(now.toISOString());
  const sold = deals.filter((deal) => inTaxYear(deal, year));
  const takings = Math.round(sold.reduce((total, deal) => total + Number(deal.soldFor), 0));
  const profit = Math.round(sold.reduce((total, deal) => total + dealProfit(deal, settings), 0));
  return { year, sales: sold.length, takings, profit, overAllowance: takings > TRADING_ALLOWANCE };
}

// Sales and takings per selling site in the current calendar year, and
// whether each has reached the point where the site reports you
export function platformReporting(deals, now = new Date()) {
  const calendarYear = String(now.getUTCFullYear());
  const sites = {};
  for (const deal of deals) {
    if (!isSold(deal) || !String(deal.soldOn).startsWith(calendarYear)) continue;
    const site = (sites[deal.platform || "other"] ??= { platform: deal.platform || "other", sales: 0, takings: 0 });
    site.sales += 1;
    site.takings += Number(deal.soldFor);
  }
  return Object.values(sites).map((site) => ({
    ...site,
    takings: Math.round(site.takings),
    reported: site.sales >= REPORTING_SALES || site.takings >= REPORTING_AMOUNT,
  }));
}

// The tax years your sales fall in, newest first, for the CSV download
export function salesTaxYears(deals) {
  const years = new Map();
  for (const deal of deals) {
    if (!isSold(deal) || !deal.soldOn) continue;
    const year = taxYear(deal.soldOn);
    years.set(year.label, year);
  }
  return [...years.values()].sort((a, b) => b.start.localeCompare(a.start));
}
