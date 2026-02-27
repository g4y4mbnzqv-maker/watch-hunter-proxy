import { searchAuctions } from "../../../lib/ebay";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand") || "seiko";

  const result = await searchAuctions(brand);

  return Response.json(result);
}