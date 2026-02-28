export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand") || "seiko";

  const ebayUrl = `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(
    brand
  )}&LH_Auction=1&_sop=1`;

  try {
    const res = await fetch(ebayUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    const html = await res.text();

    const items = [];

    const blocks = html.split('class="s-item"');

    for (let block of blocks.slice(1, 25)) {
      const titleMatch = block.match(
        /class="s-item__title">([^<]+)</
      );
      const priceMatch = block.match(
        /class="s-item__price">£?([\d,.]+)</
      );
      const bidsMatch = block.match(
        /class="s-item__bids">([^<]+)</
      );
      const timeMatch = block.match(
        /class="s-item__time-left">([^<]+)</
      );
      const linkMatch = block.match(
        /class="s-item__link" href="([^"]+)"/
      );
      const imageMatch = block.match(
        /class="s-item__image-img"[^>]+src="([^"]+)"/
      );

      if (!titleMatch || !priceMatch) continue;

      const currentBid = parseFloat(
        priceMatch[1].replace(/,/g, "")
      );

      const bidCount = bidsMatch
        ? parseInt(bidsMatch[1].replace(/[^\d]/g, "")) || 0
        : 0;

      const { daysLeft, hoursLeft } = parseTimeLeft(
        timeMatch ? timeMatch[1] : ""
      );

      items.push({
        title: titleMatch[1],
        currentBid,
        bidCount,
        daysLeft,
        hoursLeft,
        url: linkMatch ? linkMatch[1] : "",
        image: imageMatch ? imageMatch[1] : "",
      });
    }

    return Response.json({
      brand,
      count: items.length,
      results: items,
    });
  } catch (err) {
    return Response.json({
      error: true,
      message: err.message,
    });
  }
}

function parseTimeLeft(text) {
  let days = 0;
  let hours = 0;

  const dayMatch = text.match(/(\d+)d/);
  const hourMatch = text.match(/(\d+)h/);

  if (dayMatch) days = parseInt(dayMatch[1]);
  if (hourMatch) hours = parseInt(hourMatch[1]);

  return { daysLeft: days, hoursLeft: hours };
}