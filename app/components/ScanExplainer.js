"use client";

// Explains an empty brand scan from the counts the server sends back
export default function ScanExplainer({ brand, stats, includeJunk, includesBuyItNow }) {
  const binUrl = `https://www.ebay.co.uk/sch/i.html?${new URLSearchParams({
    _nkw: brand,
    LH_BIN: "1",
    LH_PrefLoc: "1",
  })}`;

  const dropped = [
    stats.notWatches > 0 && `${stats.notWatches} weren't watches`,
    stats.replicas > 0 && `${stats.replicas} looked like replicas or homages`,
    stats.junk > 0 && `${stats.junk} were parts, repairs or accessories`,
    stats.outsideUk > 0 && `${stats.outsideUk} weren't in the UK`,
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-10 text-center">
      {includesBuyItNow ? (
        <BothTypes brand={brand} stats={stats} dropped={dropped} includeJunk={includeJunk} />
      ) : stats.auctionsOnEbay === 0 ? (
        <>
          <p className="text-sm text-zinc-200">
            eBay has no UK auctions for “{brand}” right now.
          </p>
          {stats.buyItNowOnEbay > 0 ? (
            <>
              <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
                It does have {stats.buyItNowOnEbay.toLocaleString("en-GB")} Buy It
                Now listings, so this brand mostly sells that way on eBay.
              </p>
              <a
                href={binUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-xl px-4 py-2 text-sm text-zinc-200 ring-1 ring-zinc-700 hover:ring-zinc-500"
              >
                See the Buy It Now listings ↗
              </a>
            </>
          ) : (
            <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
              {stats.buyItNowOnEbay === 0
                ? "There are no Buy It Now listings either. Check the spelling, or try a shorter search such as just the brand name."
                : "Try again later, or check the spelling."}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-zinc-200">
            eBay found {stats.auctionsOnEbay.toLocaleString("en-GB")} UK auctions
            for “{brand}”, but none passed the filters.
          </p>
          {dropped.length > 0 && (
            <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
              Of the {stats.checked} checked, {dropped.join(", ")}.
              {!includeJunk && stats.junk > 0 &&
                " Tick “Include parts and repairs” to see those."}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// When Buy It Now was searched too, its count is a result, not a hint
function BothTypes({ brand, stats, dropped, includeJunk }) {
  const found = (stats.auctionsOnEbay ?? 0) + (stats.buyItNowOnEbay ?? 0);

  if (!found) {
    return (
      <>
        <p className="text-sm text-zinc-200">eBay has no UK listings for “{brand}” right now.</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
          Check the spelling, or try a shorter search such as just the brand name.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="text-sm text-zinc-200">
        eBay found {found.toLocaleString("en-GB")} UK listings for “{brand}”, but none
        {stats.checked > 0 ? ` of the newest ${stats.checked}` : ""} passed the filters.
      </p>
      {dropped.length > 0 && (
        <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
          Of those, {dropped.join(", ")}.
          {!includeJunk && stats.junk > 0 && " Tick “Include parts and repairs” to see those."}
        </p>
      )}
    </>
  );
}
