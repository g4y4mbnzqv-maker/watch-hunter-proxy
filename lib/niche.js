import bikes from "./niches/bikes";
import clothes from "./niches/clothes";
import watches from "./niches/watches";

// Which app this deployment is: set NEXT_PUBLIC_NICHE in Vercel to choose.
// Each app reads its brands, categories and rules from its own file in
// lib/niches/, and everything else is shared.
const NICHES = { watches, clothes, bikes };

export const niche = NICHES[process.env.NEXT_PUBLIC_NICHE] ?? watches;
