import { getUsage, EbayError } from "@/lib/ebay";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ usage: await getUsage() });
  } catch (err) {
    console.error(err);

    return Response.json(
      { error: true, message: err.message },
      { status: err instanceof EbayError ? err.status : 500 }
    );
  }
}
