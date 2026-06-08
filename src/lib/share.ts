/**
 * Compact, URL-safe encoding for the set of starred (favorited) NFTs that an
 * owner shares via `/collection/<address>?stars=…`.
 *
 * Only boxes and pizzas can be starred. Favorite keys look like
 * `rare-pizzas-box:<id>` and `rare-pizzas:<id>`; we map those to the short forms
 * `b<id>` / `p<id>` and join with `.` to keep shared URLs small.
 *
 * Both `/my-toppings` (encode) and `/collection/[address]` (decode) import these
 * so the two representations can never drift apart.
 */

const BOX_PREFIX = "rare-pizzas-box:";
const PIZZA_PREFIX = "rare-pizzas:";

/** Encode a favorites Set into a compact `?stars=` value (boxes + pizzas only). */
export function encodeStars(favorites: Set<string>): string {
  const tokens: string[] = [];
  for (const key of favorites) {
    if (key.startsWith(BOX_PREFIX)) {
      const id = key.slice(BOX_PREFIX.length);
      if (/^\d+$/.test(id)) tokens.push(`b${id}`);
    } else if (key.startsWith(PIZZA_PREFIX)) {
      const id = key.slice(PIZZA_PREFIX.length);
      if (/^\d+$/.test(id)) tokens.push(`p${id}`);
    }
  }
  return tokens.join(".");
}

/** Decode a `?stars=` value back into favorite keys. Tolerant of junk tokens. */
export function decodeStars(param: string | null): Set<string> {
  const keys = new Set<string>();
  if (!param) return keys;
  for (const raw of param.split(".")) {
    const token = raw.trim();
    if (!token) continue;
    const kind = token[0];
    const id = token.slice(1);
    if (!/^\d+$/.test(id)) continue;
    if (kind === "b") {
      keys.add(`${BOX_PREFIX}${id}`);
    } else if (kind === "p") {
      keys.add(`${PIZZA_PREFIX}${id}`);
    }
  }
  return keys;
}
