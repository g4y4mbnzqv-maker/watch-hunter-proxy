import { searchAuctions } from "../../../lib/ebay";

export const dynamic = "force-dynamic";

function timeLeftParts(endIso) {
  const end = new Date(endIso).getTime();
  const now = Date.now();
  const ms = Math.max(0, end - now);

  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  return { daysLeft: days, hoursLeft: hours };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand") || "seiko";

  const items = await searchAuctions(brand);

  return Response.json({
    brand,
    count: items.length,
    results: items.map((item) => {
      const { daysLeft, hoursLeft } = timeLeftParts(item.endTime);

      return {
        ...item,
        daysLeft,
        hoursLeft,
      };
    }),
  });
}