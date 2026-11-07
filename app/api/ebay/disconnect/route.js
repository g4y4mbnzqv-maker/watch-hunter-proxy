import { disconnect } from "@/lib/ebaySell";
import { failure } from "../_respond";

export const dynamic = "force-dynamic";

// Forgets your eBay sign-in
export async function POST() {
  try {
    await disconnect();
    return Response.json({ ok: true });
  } catch (err) {
    return failure(err);
  }
}
