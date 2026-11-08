import { EbayError, similarToUpload } from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Listings that look like a photo you took: form data with "photo"
export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("photo");
    if (!file || typeof file === "string") return Response.json({ error: true, message: "Take or choose a photo" }, { status: 400 });
    const items = await similarToUpload(Buffer.from(await file.arrayBuffer()));
    return Response.json({ items });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: true, message: err.message, limitReached: Boolean(err.limitReached) },
      { status: err instanceof EbayError ? err.status : 500 }
    );
  }
}
