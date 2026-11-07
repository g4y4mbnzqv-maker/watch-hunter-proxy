import { uploadPhoto } from "@/lib/ebaySell";
import { failure } from "../_respond";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One of your photos, sent as form data ("photo"), uploaded to eBay
export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("photo");
    if (!file || typeof file === "string") return Response.json({ error: true, message: "Choose a photo" }, { status: 400 });
    const url = await uploadPhoto(Buffer.from(await file.arrayBuffer()), { filename: file.name || "watch.jpg", type: file.type || "image/jpeg" });
    return Response.json({ url });
  } catch (err) {
    return failure(err);
  }
}
