import { prepareListing } from "@/lib/ebaySell";
import { failure } from "../_respond";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Saves the listing on eBay without putting it live
export async function POST(req) {
  try {
    return Response.json(await prepareListing(await req.json()));
  } catch (err) {
    return failure(err);
  }
}
