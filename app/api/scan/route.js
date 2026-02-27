const MIN_DISCOUNT = 0.20;       // 20% undervalued
const MAX_BID_FACTOR = 0.75;     // 75% ceiling
const MIN_AVG_PRICE = 120;       // ignore cheap junk

const results = summaries
  .map((s) => {
    const it = itemsById.get(s.itemId) || {};

    const endDate = it.itemEndDate || s.itemEndDate;
    const { daysLeft, hoursLeft } = endDate
      ? timeLeftParts(endDate)
      : { daysLeft: null, hoursLeft: null };

    const currentBid =
      parseFloat(
        it.currentBidPrice?.value ||
        s.currentBidPrice?.value ||
        it.price?.value ||
        s.price?.value ||
        0
      );

    const bidCount = it.bidCount ?? s.bidCount ?? 0;
    const bidderCount = it.uniqueBidderCount ?? null;

    const discount = 1 - currentBid / avgSold;
    const maxBid = avgSold * MAX_BID_FACTOR;

    return {
      title: s.title,
      image: s.image?.imageUrl,
      url: s.itemWebUrl,
      avgSold,
      discount,
      maxBid,
      currentBid,
      bidCount,
      bidderCount,
      daysLeft,
      hoursLeft,
    };
  })
  .filter(
    (x) =>
      x.avgSold > MIN_AVG_PRICE &&
      x.discount >= MIN_DISCOUNT &&
      x.currentBid <= x.maxBid
  )
  .sort((a, b) => b.discount - a.discount);