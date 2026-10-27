# Watch Hunter

Scans eBay UK auctions for a watch brand and ranks them by estimated margin and time left.

## Setup

1. Create a Production keyset at https://developer.ebay.com/my/keys.
2. Copy `.env.example` to `.env.local` and fill in `EBAY_CLIENT_ID` (App ID) and `EBAY_CLIENT_SECRET` (Cert ID). On Vercel, add the same two variables under Project Settings > Environment Variables.
3. Install and run:

```bash
npm install
npm run dev
```

## How it works

- `lib/ebay.js` gets an application token from eBay (client credentials, cached until it expires) and calls the Browse API for auctions on EBAY_GB, sorted by ending soonest. Only watches located in the UK are included, for both auctions and the Buy It Now prices used to estimate resale (`itemLocationCountry:GB`).
- Listings whose titles mention parts, repairs, straps, empty boxes and similar are dropped unless "Include parts and repairs" is ticked.
- Replicas and lookalikes ("homage", "replica", "fake", "clone", "1:1", "Rolex style", "Submariner-inspired" and similar) are always dropped, from auctions and from the prices used for resale estimates.
- `lib/models.js` pulls a model reference (SKX007, 6139-6002, CA0695-84E and so on) out of each title. For each reference, the app looks up current Buy It Now listings in the same condition as the auction (new or pre-owned) and takes the median asking price. If fewer than 3 listings match the condition, it falls back to listings in any condition, and the card says which it used. A reference needs at least 3 matching listings to get an estimate. These lookups are cached for an hour.
- `lib/profit.js` turns that into a resale value, profit and the most you can bid. The defaults are a resale value of 85% of the median asking price, 13% selling fees, £5 postage to your buyer and a £30 target profit. You can change all of them under Settings.
- `lib/seller.js` checks each seller's eBay feedback. Fewer than 50 ratings or under 98% positive gets a caution flag (both editable in Settings). Fewer than 10 ratings or under 95% positive is marked risky, and risky sellers are hidden unless you untick "Hide risky sellers".
- "Top deals" scans the popular brands (Seiko, Citizen, Orient, Casio, Swatch, Tissot, Hamilton, Omega, Rolex), three at a time, and shows the combined deals with the highest profit first. Each card is tagged with its brand. If a brand fails, the others still show with a note.
- The bookmark on each card saves the auction to your watchlist. Opening the watchlist refreshes saved auctions from eBay (one call per auction, at most once a minute unless you press "Refresh bids"). Auctions eBay no longer returns are marked as ended and can be cleared in one go.
- "Check prices" links on each live card open Chrono24 and Vinted searches for the model reference (or the main words of the title) in a new tab. Nothing is fetched from those sites; use what you find to set your own resale value.
- On any card you can type your own resale value. On a card with a model reference, the value is saved for that model and used for every listing of it from then on; without a reference, it applies to that listing only. Your values override the estimate, and your settings, resale values and watchlist are saved in your browser, so they don't carry over to another device or browser.
- Prices include the cheapest listed postage option. When eBay doesn't list a postage cost (collection only or calculated postage), the card shows "postage unknown" and postage counts as zero.

## API usage

Each scan makes 1 search call, plus 1 call for each new model reference found (up to about 50, usually far fewer). Top deals runs one scan per popular brand, so it uses roughly nine times as many calls, less whatever the hour-long resale cache already holds. eBay's Browse API is free, with a default limit of 5,000 calls a day.

## Known limits

- Resale estimates come from asking prices, which usually sit above what watches sell for. Adjust "Expected sale price" to suit, or use your own resale value when you know the market.
- Titles without a model reference get no estimate until you add a value yourself.
- The seller check uses the feedback score eBay returns in search results. That score includes feedback from buying as well as selling, and the Browse API doesn't give account age, so open the seller's profile before bidding on anything flagged.
- Profit is worked out at the current bid. "Bid up to" is the figure to act on, because bids rise towards the end of an auction.
