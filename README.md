# Watch Hunter

Scans eBay UK auctions and Buy It Now listings for a watch brand and shows which ones you could resell at a profit.

## Setup

1. Create a Production keyset at https://developer.ebay.com/my/keys.
2. Copy `.env.example` to `.env.local` and fill in `EBAY_CLIENT_ID` (App ID) and `EBAY_CLIENT_SECRET` (Cert ID). On Vercel, add the same two variables under Project Settings > Environment Variables.
3. Optional: set `APP_PASSCODE` to lock the app. Visitors then need the passcode before they can see anything or call the API, and a browser stays unlocked for 90 days. Changing the passcode signs everyone out. Leave it unset to keep the app open.
4. Optional, for the price index: in Vercel, open Storage, choose Create Database, pick Neon (free) and connect it to this project, which sets `DATABASE_URL`. Then add `CRON_SECRET` (any long random string) under Environment Variables and redeploy. Without a database the Prices tab shows these steps and nothing is recorded.
5. Install and run:

```bash
npm install
npm run dev
```

Run the tests with `npm test`.

## On your phone

- **iPhone:** open the site in Safari, tap Share, then "Add to Home Screen".
- **Android:** open it in Chrome, open the menu, then "Install app" or "Add to Home screen".

It then opens full screen from its own icon.

## How it works

- `lib/ebay.js` gets an application token from eBay (client credentials, cached until it expires) and calls the Browse API for auctions on EBAY_GB, sorted by ending soonest. Only watches located in the UK are included, for both auctions and the Buy It Now prices used to estimate resale (`itemLocationCountry:GB`).
- "Show" picks auctions, Buy It Now listings or both (both by default). Buy It Now results are newest first, since underpriced ones rarely last, and profit is worked out at the listed price. Where the seller accepts offers and the price is too high, the card says the most to offer. Buy It Now listings have no countdown, sit in their own view, and stay out of "Ending in 6h" and ending-soon alerts. Searching both uses one extra search call per scan, plus resale lookups for any new models it finds.
- Every search is limited to eBay UK's Wristwatches category, so "Omega" doesn't bring up Vauxhall Omega parts and "Casio" doesn't bring up keyboards. The category ID is looked up through eBay's Taxonomy API (cached for a day) rather than hard-coded. As a backup, any listing eBay files under no watch category at all is dropped. Pocket watches sit in a different category and don't appear.
- Listings whose titles mention parts, repairs, straps, empty boxes and similar are dropped unless "Include parts and repairs" is ticked.
- Replicas and lookalikes ("homage", "replica", "fake", "clone", "1:1", "Rolex style", "Submariner-inspired" and similar) are always dropped, from auctions and from the prices used for resale estimates.
- When a title has no reference, `lib/nicknames.js` looks for a well-known model name with its brand, such as "Seiko Turtle", "Casio Royal Oak", "Omega Moonwatch" or "Tudor Black Bay", and resale is estimated from other listings known by the same name alone. The card says when prices were matched by name. Values you type on these cards are saved for the model name.
- `lib/models.js` pulls a model reference (SKX007, 6139-6002, CA0695-84E and so on) out of each title. For each reference, the app looks up current Buy It Now listings in the same condition as the auction (new or pre-owned) and takes the median asking price. If fewer than 3 listings match the condition, it falls back to listings in any condition, and the card says which it used. A reference needs at least 3 matching listings to get an estimate. These lookups are cached for an hour.
- Estimates match case details where the title gives them (`lib/caseDetails.js`): a 40mm watch is priced from listings within 2mm of 40mm, and solid gold or platinum only from the same metal (plated and gold-tone count as steel). If fewer than 3 listings match that closely, the model alone is used. The card says when size or metal was matched. This uses the same eBay searches, so it costs no extra calls.
- Once the price index has history for a model, the card shows which way its asking prices have moved over about 30 days.
- `lib/profit.js` turns that into a resale value, profit and the most you can bid. The defaults are a resale value of 85% of the median asking price, 13% selling fees, £5 postage to your buyer and a £30 target profit. You can change all of them under Settings.
- Each card also shows the profit if sold on Vinted instead, where UK sellers pay no fee and the buyer pays postage (the fee is adjustable in Settings in case that changes).
- On auctions with room under your limit, "Snipe with Gixen" shows the eBay item number and your "Bid up to" figure with copy buttons, and a link to Gixen to paste them in. Nothing is sent to Gixen from the app.
- `lib/wording.js` spots title phrases such as "untested", "sold as seen", "no returns", "needs a service" or "loses time", and the card shows a note to read the listing first.
- Each card shows the lowest and highest Buy It Now asking prices behind its estimate. Prices more than 2.5 times above or below the median are ignored before the median is taken, and the card says how many.
- An estimate is marked rough when it rests on fewer than 4 listings, when the dearest listing costs more than 2.5 times the cheapest, or when the title looks like a special or limited edition ("x Bamford", "limited edition", "1 of 500"). A rough estimate shows "Check value" in place of "Deal", hides the bid limit, stays out of the Deals view and the best profit figure, and asks you to check Chrono24 and set your own value. Your own values are never marked rough.
- The Condition buttons filter auctions to New, Excellent, Good, Fair or Not graded, and "Good or better only" sets the first three in one tap. `lib/condition.js` uses eBay's own grade where the seller gave one (for example "Pre-owned - Excellent"). Many watches are listed as plain "Pre-owned", which says nothing about quality, so for those it looks for title wording such as "mint" or "very good condition", and the card says the grade came from the title. Anything else counts as Not graded. The filter applies to brand scans and Top deals, not the watchlist.
- "Maximum spend" in Settings hides listings already costing more than your limit, including postage, in brand scans and Top deals. It also caps "Bid up to" everywhere, the watchlist included, so a suggested bid plus postage never goes over the limit, and the card says when the limit set the figure.
- Fake checks (`lib/fakes.js`):
  - Listings in eBay's Authenticity Guarantee programme get a badge, read from the `qualifiedPrograms` field eBay returns. "Authenticity Guarantee only" hides the rest.
  - Brands that are often faked (Rolex, Omega, Cartier, TAG Heuer, Breitling, Tudor and other luxury names) get a note listing the photos to ask for, unless eBay authenticates the listing.
  - A Buy It Now price under half the cheapest comparable listing is marked "Too cheap to trust": it shows "Check value" in place of "Deal", hides the price limit and explains why. Auctions are left out, because a low bid hours before the end is normal.
- `lib/seller.js` checks each seller's eBay feedback. Fewer than 50 ratings or under 98% positive gets a caution flag (both editable in Settings). Fewer than 10 ratings or under 95% positive is marked risky, and risky sellers are hidden unless you untick "Hide risky sellers".
- "Top deals" scans your Top deals brands, three at a time, and shows the combined deals with the highest profit first. It starts with the popular brands (Seiko, Citizen, Orient, Casio, Swatch, Tissot, Hamilton, Omega, Rolex). "Edit Top deals" opens a tray: drag brands into or out of it, then "Save and find deals" runs Top deals on the new list ("Close" keeps it without scanning); drag to reorder, tap a brand to add or remove it, or type one that isn't listed. Up to 15 brands; each adds roughly one scan's worth of eBay calls. A finger has to hold a brand for a moment before it drags, so swiping still scrolls, and dragging near the top or bottom of the screen scrolls the page. The list is saved in this browser, and the brand chips under the search box follow it. The daily price run still uses the popular brands. Each card is tagged with its brand. If a brand fails, the others still show with a note.
- **Hidden gems** (under the search box) runs eight searches for cheap watches whose titles name no brand, such as "old gents watch", up to £80 (`lib/gems.js`). There's no model to price them by, so they show without an estimate for you to judge from the photos. About 8 to 16 eBay calls, with no resale lookups.
- **Wanted list** (top of the Watchlist tab): models you're after and the most you'd pay, postage included, up to 15 (`lib/wanted.js`). "Search now" lists current UK listings at or under your price. With deal alerts on, the hourly check notifies you of new ones: Buy It Now at any time, auctions in their last 3 hours if the bid is still under. Each listing alerts once. About two eBay calls per model per check.
- The bookmark on each card saves the auction to your watchlist. Opening the watchlist refreshes saved auctions from eBay (one call per auction, at most once a minute unless you press "Refresh bids"). Auctions eBay no longer returns are marked as ended and can be cleared in one go.
- Saved auctions with 10 minutes or less left appear in a banner at the top of the page; in the last 2 minutes the row turns to "Bid now", and with alerts on you get a second, last-call notification. "Alert me 10 min before" on the watchlist also sends a notification for each one, once. Alerts only fire while the app is open, because there is no server sending them; a phone that has put the app to sleep won't get them. `public/sw.js` exists only so Android can show notifications and caches nothing.
- The meter in the header shows how many Browse API calls this app has used against eBay's limit, read from eBay's Developer Analytics API. It turns amber at 80% and red at 95%.
- If eBay refuses a call because the allowance is used up (HTTP 429), the page shows a banner with the reset time and pauses scans, Top deals and watchlist refreshes until then. Top deals stops scanning further brands once one is refused. Results already on screen, and saved auctions with their last bids, stay visible. If the reset time isn't known, the banner offers "Try again".
- "Swipe" (next to the sort menu) shows the current view one listing at a time. Swipe right, tap the bookmark button or press → to save it to your watchlist. Swipe left, tap ✕ or press ← to skip it. Undo (or Z) takes back the last swipe. Skipped listings stay out of the deck for 14 days, and still show in Cards. The app remembers which layout you used last.
- Tap a card's photo to open every photo in the listing full screen, with arrows, swiping, thumbnails and Esc to close.
- Each scan also searches for common misspellings of the brand ("Sieko", "Omgea", "Rollex" and so on, listed in `lib/overlooked.js`), as one extra eBay search per listing type. Fewer buyers find misspelt listings, so they often go cheap. eBay sometimes corrects the search, so only listings whose title really has a misspelling are added.
- "Overlooked" shows listings fewer buyers may spot: a misspelt brand, an auction ending between midnight and 7am UK time, one photo or none, or a title under 30 characters. The card says which.
- "Check prices" links on each live card open eBay's sold listings, Chrono24 and Vinted searches for the model reference (or the main words of the title) in a new tab. Nothing is fetched from those sites; use what you find to set your own resale value.
- On any card you can type your own resale value. On a card with a model reference, the value is saved for that model and used for every listing of it from then on; without a reference, it applies to that listing only. Your values override the estimate. Your settings, resale values and watchlist are saved in your browser, and synced to your other devices when syncing is on (see below).
- When a brand scan finds nothing, the page says why: either eBay has no UK auctions for it (with a count of UK Buy It Now listings and a link to them, from one extra call), or eBay found auctions that the replica, parts or UK filters removed, with how many of each.
- Prices include the cheapest listed postage option. When eBay doesn't list a postage cost (collection only or calculated postage), the card shows "postage unknown" and postage counts as zero.

## Price index

The Prices tab tracks asking prices per model over time.

- Every scan saves a daily figure for each model it finds: the median, lowest and highest Buy It Now asking price and the number of listings, split by condition. Saving runs alongside the scan and gives up after 2.5 seconds, so it never slows a scan down.
- Auctions with bids and an hour or less left are saved as "closes" at their current bid. These are the nearest thing to sold prices the free Browse API gives, since eBay's sold-price data needs a licensed API.
- Once a day (`vercel.json`, 05:17 UTC) Vercel calls `/api/harvest`, which scans auctions for the popular brands and saves the same figures, so history builds even on days you don't scan. The route only runs with `Authorization: Bearer <CRON_SECRET>`, which Vercel sends itself. On the free Hobby plan Vercel only promises the run happens within the hour.
- The list shows each model's latest median, its change over 30 days and a 90-day sparkline, with sorting by rising, falling, listings, recent or name. Opening a model shows a chart of the asking range and closes over 30, 90 or 365 days, and a table of the figures.
- Only daily totals are stored. Listing titles, photos, sellers and links are never saved, and a close is stored against a one-way hash of the item ID so the same auction isn't counted twice. Rows older than about 13 months are deleted on each daily run. This is meant to stay within eBay's rules on keeping listing data, but it hasn't been checked by a lawyer, so read eBay's API License Agreement if you plan to rely on it.
- History starts from the day the database is connected. Nothing is backfilled.

## Sales log

The Sales tab records watches you buy and sell.

- On a watchlist card, "I bought this" adds the watch with its price, today's date and the median asking price the estimate came from. "Add a watch" adds one by hand.
- Add the sale price, date and where it sold. eBay fees default to the percentage in Settings and Vinted to none; type your own to override.
- The tab shows profit so far, sales, stock still unsold and the median days to sell.
- After 3 sales of watches that had an estimate, it shows what yours sold for as a share of the asking median (by brand too, once a brand has 3), and offers to use that as "Expected sale price". Brands with 3 or more sales can each get their own figure ("Use my figure for Seiko"), which estimates for that brand then use, and the card says so. This replaces the 85% guess with your own results.
- **Review** at the top of the tab: profit, sales, buys and spend over the last 7 and 30 days, the brands earning most and least per watch (2 or more sales each), and the models whose asking prices moved most in the price index.
- **Stock reminders:** a watch bought a week ago and not listed gets a nudge. Add "Listed on" and "Listed at" to an unsold watch, and if it hasn't sold after three weeks the app suggests 10% off, ending in 9, never below the price that gets your money back after eBay fees. "Drop to £X" records the new price; change the eBay listing too (`lib/stock.js`).
- **Photo checklist** on an unsold watch: the twelve shots buyers want to see, ticked off as you take them.
- **Stock value** values your unsold watches at today's asking prices (after your expected sale price) against what you paid, through `/api/comps` (`lib/priceCheck.js`), which shares the saved resale lookups.
- **Tax year** panel: sales, takings and profit for the current UK tax year (6 April to 5 April), takings against the £1,000 trading allowance, sales per site this calendar year against the reporting thresholds (30 sales or about £1,700), and a CSV of any tax year's sales (`lib/tax.js`). A guide, not tax advice.
- **Draft a listing** on an unsold watch writes a title (tidied, within eBay's 80 characters) and a description with the brand, model, reference and case size filled in and [brackets] for the rest, for eBay or Vinted, with copy buttons. "Check now" fetches today's asking prices for the model, which the suggested prices then use, and lists your own past sales of the same model. It suggests an eBay price at the asking median with offers on and the lowest offer to accept, and a Vinted price about 5% lower, since Vinted buyers pay a protection fee (`lib/listingDraft.js`). Nothing is posted anywhere.
- "Download CSV" saves a copy for backups and tax records.

## Deal alerts while the app is closed

Settings, then Deal alerts, signs a phone or computer up for push notifications. About once an hour from 7am to 11pm UK time, `/api/alerts/run` checks the newest Buy It Now listings for your Top deals brands, works out profit with your synced settings and resale values, and notifies you of each new deal: a confident "Deal" (not "Check value" or "Too cheap to trust"), within your Maximum spend, from a seller who isn't risky. Up to 5 alerts per run, with a summary for more. The first check of each brand only notes what's already listed, so you aren't sent old listings.

Setup:
1. Alerts need the database and `APP_PASSCODE`, like syncing. The push keys are made automatically and kept in the database.
2. The schedule is a GitHub Actions workflow (`.github/workflows/deal-alerts.yml`), since Vercel's free plan only runs jobs once a day. In GitHub, open the repository's Settings, then Secrets and variables, then Actions, and add `APP_URL` (the app's address, such as `https://watch-hunter-proxy.vercel.app`) and `CRON_SECRET` (the same value as in Vercel). Until both are there, the workflow does nothing. GitHub can run scheduled jobs late, or skip some when busy.
3. On iPhone, add the app to the home screen first and turn alerts on from there (iOS 16.4 or later).

Each run costs about two eBay searches per brand, plus resale lookups for new listings only: a few hundred calls a day with nine brands.

## Syncing between devices

With a database connected and `APP_PASSCODE` set, your watchlist, settings, resale values, sales log, Top deals brands, filters and skipped listings are saved to the database (`lib/userState.js`, `/api/state`) as well as the browser, so your phone and computer show the same. Each item is saved whole with the time it changed, and the newest change wins. The app catches up when it comes back into view. Data saved on two devices before syncing was switched on is combined for the watchlist, resale values, skipped listings and sales log; for settings and filters the first device to sync wins. Alerts and the cards or swipe layout stay per device. Without a passcode, syncing stays off so nobody else can read your data, and Settings says why.

## Code layout

- `lib/overlooked.js` holds the misspellings and the overlooked checks, and `lib/dealLog.js` the sales log sums.
- `lib/priceIndex.js` reads and writes the price history (Neon Postgres), and `lib/harvest.js` runs the daily collection.
- `lib/`: eBay calls and the rules behind every card (profit, models, nicknames, sellers, conditions, wording, images). No React.
- `app/client/`: browser-side hooks and helpers. `useScanner` runs brand scans and Top deals, `useWatchlist` keeps saved listings and alerts, `useUsage` tracks the eBay allowance, and `listings.js` holds sorting and filtering helpers.
- `app/components/`: the pieces of the page. `page.js` holds the shared state and wires them together.

Speed and eBay calls:

- Resale lookups (the comparable Buy It Now listings for each model) are saved in the database for 6 hours (`lib/compsStore.js`) and shared by every scan, alert check and the daily run. On Vercel each new server instance used to look every model up again; now a repeat Top deals scan costs about 18 eBay calls where it took about 290. Without a database the app falls back to remembering lookups in memory, as before.
- The service worker keeps the app's own files (`public/sw.js`), so the app opens straight away, and still opens with no signal. Pages are fetched fresh when there's a connection. eBay data and the API are never cached.
- Your last scan is kept in the browser for 12 hours and shown when you reopen the app, marked with its age.
- The Roboto font is served with the app (`next/font`) instead of from Google on every visit.
- Watchlist refreshes skip auctions that ended over 6 hours ago.

Results are drawn 24 cards at a time, with more added as you scroll. Cards are memoised, profit is worked out separately from the 30-second clock, and the search box keeps its own text, so typing doesn't redraw the results.

## API usage

Each scan makes 1 search call per listing type (2 for brands with known misspellings), plus 1 call for each new model found (up to about 50, usually far fewer), six at a time. Overlapping requests for the same token, category or model share one eBay call. Top deals runs one scan per popular brand, so it uses roughly nine times as many calls, less whatever the 6-hour resale cache already holds (shared through the database). The daily price harvest costs roughly one Top deals run (auctions only), so leave some allowance for it. Deal alerts add a few hundred calls a day. eBay's Browse API is free, with a default limit of 5,000 calls a day.

## Tests

`tests/` covers the profit maths, condition grading, model reference matching, seller ratings, the replica, junk and wording filters, the eBay comparables and usage logic against a fake eBay, and the price index against an in-memory Postgres (PGlite). They run with Vitest and don't call eBay.

## Known limits

- Resale estimates come from asking prices, which usually sit above what watches sell for. Adjust "Expected sale price" to suit, or use your own resale value when you know the market.
- Titles without a model reference get no estimate until you add a value yourself.
- The seller check uses the feedback score eBay returns in search results. That score includes feedback from buying as well as selling, and the Browse API doesn't give account age, so open the seller's profile before bidding on anything flagged.
- Profit is worked out at the current bid. "Bid up to" is the figure to act on, because bids rise towards the end of an auction.
