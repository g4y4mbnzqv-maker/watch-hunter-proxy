import { EbayError, similarByPhoto } from "@/lib/ebay";

export const dynamic = "force-dynamic";

// Listings that look like a photo: /api/similar?image=<eBay photo>&exclude=<itemId>
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const image = searchParams.get("image") || "";
  try {
    const items = await similarByPhoto(image, { excludeId: searchParams.get("exclude") || undefined });
    return Response.json({ items });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: true, message: err.message, limitReached: Boolean(err.limitReached) },
      { status: err instanceof EbayError ? err.status : 500 }
    );
  }
}
