// A full UK postcode, such as CB1 2AB or SW1A 1AA, with or without the space
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;

export function isUkPostcode(value) {
  return UK_POSTCODE.test(String(value ?? "").trim());
}

// Collection search details for eBay, or null when there's no usable postcode
// or no distance
export function pickupFor(postcode, miles) {
  const radius = Math.round(Number(miles));
  if (!isUkPostcode(postcode) || !(radius > 0) || radius > 500) return null;
  return { postcode: String(postcode).trim().toUpperCase().replace(/\s+/g, ""), miles: radius };
}
