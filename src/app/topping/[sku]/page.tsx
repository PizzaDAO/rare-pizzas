import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllToppings, getToppingBySku, slugify } from "@/lib/toppings";
import { getImageUrl, getWoodTileUrl } from "@/lib/constants";
import RarityBadge from "@/components/RarityBadge";
import NutritionLabel from "@/components/NutritionLabel";
import ToppingImage from "./ToppingImage";

interface ToppingPageProps {
  params: Promise<{ sku: string }>;
}

export async function generateStaticParams() {
  const toppings = getAllToppings();
  return toppings.map((t) => ({ sku: String(t.sku) }));
}

function formatTwitterUrl(handle: string): string | null {
  if (!handle || handle === "n/a" || handle === "N/A") return null;
  const clean = handle.startsWith("@") ? handle.slice(1) : handle;
  return `https://twitter.com/${clean}`;
}

function formatInstagramUrl(handle: string): string | null {
  if (!handle) return null;
  // Handle full URLs like "instagram.com/m.sparber.art"
  if (handle.includes("instagram.com/")) {
    const username = handle.split("instagram.com/")[1];
    return `https://instagram.com/${username}`;
  }
  const clean = handle.startsWith("@") ? handle.slice(1) : handle;
  return `https://instagram.com/${clean}`;
}

export default async function ToppingPage({ params }: ToppingPageProps) {
  const { sku } = await params;
  const skuNum = parseInt(sku, 10);
  const topping = getToppingBySku(skuNum);

  if (!topping) {
    notFound();
  }

  const classSlug = slugify(topping.class);
  const twitterUrl = topping.artistTwitter
    ? formatTwitterUrl(topping.artistTwitter)
    : null;
  const instagramUrl = topping.artistIG
    ? formatInstagramUrl(topping.artistIG)
    : null;

  const hasNutrition =
    topping.nutrition &&
    Object.values(topping.nutrition).some(
      (v) => v !== undefined && v !== null
    );

  return (
    <div>
      <nav className="mb-6 text-sm text-[#7DD3E8]">
        <Link href="/" className="transition-colors hover:text-[#FFE135]">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/class/${classSlug}`}
          className="transition-colors hover:text-[#FFE135]"
        >
          {topping.class}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-white">{topping.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image */}
        <div className="flex justify-center">
          <ToppingImage
            image={topping.image}
            name={topping.name}
            sku={topping.sku}
            variants={topping.variants}
            altArt={topping.altArt}
          />
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-white">
              {topping.name}
            </h1>
            <div className="mb-3 flex items-center gap-3">
              <RarityBadge rarity={topping.rarity} />
              {topping.probability > 0 && (
                <span className="text-sm text-[#7DD3E8]">
                  {topping.probability}% probability
                </span>
              )}
            </div>
          </div>

          {topping.description && (
            <div>
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#7DD3E8]">
                Description
              </h2>
              <p className="text-white">{topping.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#7DD3E8]">
                Class
              </h2>
              <Link
                href={`/class/${classSlug}`}
                className="text-[#FFE135] transition-colors hover:text-[#FFE135]/80"
              >
                {topping.class}
              </Link>
            </div>
            <div>
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#7DD3E8]">
                SKU
              </h2>
              <p className="text-white">{topping.sku}</p>
            </div>
          </div>

          {/* Artist Section */}
          <div
            className="rounded-xl bg-cover bg-center p-4"
            style={{ backgroundImage: `url(${getWoodTileUrl(skuNum)})` }}
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#7DD3E8]">
              Artist
            </h2>
            <p className="mb-2 text-lg font-medium text-white">
              {topping.artist}
            </p>
            {topping.artistBio && (
              <p className="mb-1 text-sm leading-relaxed text-[#ccc]">
                {topping.artistBio}
              </p>
            )}
            {topping.artistBioGenerated && (
              <span className="text-xs text-[#555] italic">Auto-generated bio</span>
            )}
            <div className="flex flex-wrap gap-3">
              {twitterUrl && (
                <a
                  href={twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#111] px-3 py-1.5 text-sm text-[#7DD3E8] transition-colors hover:bg-[#333] hover:text-white"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  @{topping.artistTwitter?.replace("@", "")}
                </a>
              )}
              {topping.artistDiscord && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#111] px-3 py-1.5 text-sm text-[#7DD3E8]">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                  </svg>
                  {topping.artistDiscord}
                </span>
              )}
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#111] px-3 py-1.5 text-sm text-[#7DD3E8] transition-colors hover:bg-[#333] hover:text-white"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                  Instagram
                </a>
              )}
            </div>
          </div>

          {/* Nutrition Label */}
          {hasNutrition && (
            <NutritionLabel
              nutrition={topping.nutrition}
              toppingName={topping.name}
            />
          )}
        </div>
      </div>
    </div>
  );
}
