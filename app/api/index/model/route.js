import { modelHistory, priceIndexEnabled } from "@/lib/priceIndex";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return Response.json({ error: true, message: "Choose a model" }, { status: 400 });
  if (!priceIndexEnabled()) return Response.json({ enabled: false });

  try {
    return Response.json({ enabled: true, ...(await modelHistory(key)) });
  } catch (err) {
    console.error(err);
    return Response.json({ error: true, message: `Couldn't read this model's history: ${err.message}` }, { status: 500 });
  }
}
