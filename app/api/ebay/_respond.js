import { SellError } from "@/lib/ebaySell";

// A JSON reply for a failed eBay selling request
export function failure(err) {
  console.error(err);
  return Response.json({ error: true, message: err.message }, { status: err instanceof SellError ? err.status : 500 });
}
