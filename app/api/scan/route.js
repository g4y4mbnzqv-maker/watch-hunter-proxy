import { searchAuctions, EbayError } from "@/lib/ebay";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const brand = (searchParams.get("brand") || "seiko").trim();
  const includeJunk = searchParams.get("includeJunk") === "1";

  if (!brand) {
    return Response.json(
      { error: true, message: "Enter a brand to search" },
      { status: 400 }
    );
  }

  try {
    const results = await searchAuctions(brand, { includeJunk });

    return Response.json({
      brand,
      count: results.length,
      results,
    });
  } catch (err) {
    console.error(err);

    return Response.json(
      { error: true, message: err.message },
      { status: err instanceof EbayError ? err.status : 500 }
    );
  }
}
