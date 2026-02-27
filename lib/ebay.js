

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand") || "seiko";

  const sold = await search({
    q: brand,
    limit: 5,
    filter: "soldItems:true",
  });

  const live = await search({
    q: brand,
    limit: 5,
  });

  return Response.json({
    brand,
    soldRaw: sold,
    liveRaw: live,
  });
}