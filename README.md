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

- `lib/ebay.js` gets an application token from eBay (client credentials, cached until it expires) and calls the Browse API for auctions on EBAY_GB, sorted by ending soonest.
- Listings whose titles mention parts, repairs, straps, empty boxes and similar are dropped unless "Include parts, repairs and accessories" is ticked.
- Prices include the cheapest listed postage option. When eBay doesn't list a postage cost (collection only or calculated postage), the card shows "postage unknown" and postage is treated as zero.

## Known limits

Fair value is still a placeholder (`currentBid × 2.5`), so the edge and max bid figures are rough until sold price data is added.
