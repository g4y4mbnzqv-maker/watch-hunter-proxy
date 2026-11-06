// When auctions end with the best prices: each recorded result against the
// usual result for the same model, grouped by UK day and time of day. A
// model's results only count once it has a few, so one dear watch can't
// make Tuesday look good.

// Results needed overall before anything is shown, and in a group before
// that group is
export const MIN_RESULTS = 30;
export const MIN_GROUP = 8;
// Results a model needs before its own are compared
const MIN_PER_MODEL = 3;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const TIMES = [
  { key: "morning", label: "Morning (6am to noon)", from: 6, to: 12 },
  { key: "afternoon", label: "Afternoon (noon to 5pm)", from: 12, to: 17 },
  { key: "evening", label: "Evening (5pm to 10pm)", from: 17, to: 22 },
  { key: "late", label: "Late (10pm to 6am)", from: 22, to: 30 },
];

const ukParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
});

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function timeOf(hour) {
  const h = hour < 6 ? hour + 24 : hour;
  return TIMES.find((time) => h >= time.from && h < time.to).key;
}

// rows: { model, price, endsAt } with endsAt in milliseconds or an ISO date.
// Returns { ready, count, days, times, best } where days and times list
// { key, label, count, percent } (percent above or below the usual price,
// null when the group has too few results), and best names the best day
// and time when there's enough to say.
export function sellingTimes(rows) {
  const byModel = {};
  for (const row of rows) if (row.price > 0 && row.endsAt) (byModel[row.model] ??= []).push(row);

  const ratios = [];
  for (const list of Object.values(byModel)) {
    if (list.length < MIN_PER_MODEL) continue;
    const usual = median(list.map((row) => row.price));
    for (const row of list) {
      const parts = Object.fromEntries(ukParts.formatToParts(new Date(row.endsAt)).map((part) => [part.type, part.value]));
      ratios.push({ day: parts.weekday, time: timeOf(Number(parts.hour)), ratio: row.price / usual });
    }
  }

  const group = (keyOf, options) =>
    options.map(({ key, label }) => {
      const list = ratios.filter((row) => keyOf(row) === key).map((row) => row.ratio);
      return {
        key,
        label,
        count: list.length,
        percent: list.length >= MIN_GROUP ? Math.round((median(list) - 1) * 100) : null,
      };
    });

  const days = group((row) => row.day, DAYS.map((day) => ({ key: day, label: DAY_NAMES[day] })));
  const times = group((row) => row.time, TIMES);
  const top = (list) => list.filter((row) => row.percent !== null).sort((a, b) => b.percent - a.percent)[0] ?? null;
  const ready = ratios.length >= MIN_RESULTS;

  return { ready, count: ratios.length, days, times, best: ready ? { day: top(days), time: top(times) } : null };
}
