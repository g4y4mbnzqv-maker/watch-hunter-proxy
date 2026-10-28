// eBay picture URLs carry their size, as in .../s-l225.jpg. Search results
// return small thumbnails, so ask for a bigger copy of the same picture.
const SIZED_EBAY_IMAGE = /^(https:\/\/i\.ebayimg\.com\/)(thumbs\/)?(.*\/s-l)\d+(\.\w+)(\?.*)?$/;

// Returns the URL for the same picture at the given width, or the URL
// unchanged when it isn't a sized eBay picture
export function ebayImage(url, width) {
  if (!url) return url;
  const match = url.match(SIZED_EBAY_IMAGE);
  if (!match) return url;
  const [, host, , path, extension] = match;
  return `${host}${path}${width}${extension}`;
}
