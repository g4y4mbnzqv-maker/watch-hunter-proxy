const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const gbpPence = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

// Whole pounds for headline figures, pence where they matter
export function formatGbp(value, { pence = false } = {}) {
  if (value === null || value === undefined) return "–";
  return (pence ? gbpPence : gbp).format(value);
}

export function formatTimeLeft(endTime, now) {
  if (!endTime) return "–";

  const totalMinutes = Math.floor((new Date(endTime).getTime() - now) / 60_000);
  if (totalMinutes <= 0) return "Ended";

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function hoursLeft(endTime, now) {
  if (!endTime) return 0;
  return Math.max(new Date(endTime).getTime() - now, 0) / 3_600_000;
}
