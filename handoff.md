# Toppings Site Handoff

## Live URL
https://rarepizzas.com

## What Was Built

### Mint Page (Homepage `/`)
- **Buy a Pizza Box** — quantity selector, 0.08 ETH per box via `multiPurchase()`, shows available supply (X / 10,000)
- **Order Pizza (Redeem)** — select an unredeemed box + recipe, calls `redeemRarePizzasBox()`
- **Check Redeemed** — enter a token ID to check if a box has been redeemed, links to the pizza on OpenSea if so
- Starfield space background, GIFs from the original rarepizzas.com/mint, Rare Pizzas logo + project description
- Transaction status feedback with Etherscan links

### Toppings Page (`/toppings`)
- Browse topping classes (was the old homepage)
- Integrated search bar and filters (class, rarity) from the former Browse All page
- Shows class cards by default, switches to filtered topping grid when searching
- Tagline: "314 unique artist toppings across 17 classes, 16 NFTs, and 7 crusts"

### My Collection (`/my-toppings`)
- **Pizza Boxes** — shows all owned boxes with redeemed/unredeemed status
- **Rare Pizzas** — grid of owned pizza thumbnails linking to OpenSea
- **Toppings** — all toppings found across owned pizzas, with rarity breakdown, filters, and flip cards showing which pizzas have each topping

### Topping Detail Pages (`/topping/[sku]`)
- "My Rare Pizzas with this topping" section (wallet-aware, gold heading)
- "Rare Pizzas with this topping" section (all pizzas)
- Removed % probability display
- Fixed ring border clipping on variant thumbnails

### Marketplace (`/marketplace`)
- **Live OpenSea listings** — pulls active listings from OpenSea API for all 3 collections, merged with any local DB listings (local takes precedence on duplicates)
- **NFT images & names** — fetches metadata from OpenSea; shows actual NFT art instead of placeholders
- **Box redemption badges** — "Opened" (amber) / "Unopened" (green) for Rare Pizzas Box via on-chain `isRedeemed()` multicall
- **Topping enrichment** — Rare Pizzas listings auto-matched to toppings via NFT traits, enabling topping-based filtering on OpenSea data
- **Browse listings** — grid with collection tabs (All / Rare Pizzas Box / Rare Pizzas / Pizza Sticks & Sauce), filters (class, rarity, chain, topping search with autocomplete), sort (price low-to-high default, price desc, newest)
- **Buy on OpenSea** — primary CTA for OpenSea-sourced listings links to the item page; "Buy Now" for local listings with Seaport order data
- **Make Offer** — links to OpenSea for OpenSea-sourced listings; on-site WETH-based offers via Seaport for local listings (requires DATABASE_URL)
- **List an NFT** (`/marketplace/list`) — 3-step wizard: select owned NFT → set price + expiration with fee breakdown → gasless EIP-712 sign
- **My Listings & Offers** (`/marketplace/my-listings`) — 3 tabs: active listings (cancel/edit), incoming offers (accept/decline), outgoing offers (cancel)
- **Floor Prices** (`/marketplace/floors`) — collection floors, rarity tier floors, per-topping floors grouped by class with expandable accordions; computed from merged OpenSea + local data
- **Floor badge** — dynamic indicator on browse page reacting to active filters
- **Fee structure**: 1% marketplace fee + 6.25% creator royalty → `dreadpizzaroberts.eth` (7.25% total, enforced via Seaport consideration items)
- **Caching**: OpenSea listings cached 5 min, NFT metadata 1 hour, box redemption status forever (one-way). All in-memory, clears on cold start
- **Deduplication**: Same token with multiple OpenSea orders → keeps cheapest. Local listings take precedence over OpenSea
- URL-driven filters (shareable/bookmarkable)
- Graceful empty state when no database configured

### Tweet Composer (`/compose`)
- **Pizza PFP mode** — generate tweets featuring a random or specific Rare Pizza, crediting the owner
- **Topping Spotlight mode** — generate tweets highlighting a random topping and its artist
- **"Mark Posted" button** — records tweeted pizza in Vercel Blob to avoid re-suggesting for 30 days
- "Random" button calls `/api/random-pizza` which filters out recently-posted pizzas
- "Post on X" button opens pre-filled tweet
- Character count with 280-char warning

### Header & Navigation
- Active tab highlights yellow based on current route
- Nav: Mint | Toppings | Marketplace | Global Pizza Party
- Social links: Discord, OpenSea, X (self-hosted SVGs)
- Mobile hamburger accordion menu
- Wallet balance hidden in connect button

### Footer
- PizzaDAO logo linking to pizzadao.org

### Styling
- Inter font (body), Naiche ExtraBlack (display headings)
- Pizza emoji favicon
- All external CDN images downloaded to `public/images/`

## Key Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Homepage (mint page) |
| `src/app/toppings/page.tsx` | Toppings browse with search |
| `src/app/my-toppings/page.tsx` | My Collection (boxes, pizzas, toppings) |
| `src/app/compose/page.tsx` | Tweet composer (Pizza PFP + Topping Spotlight) |
| `src/app/topping/[sku]/page.tsx` | Topping detail page |
| `src/app/topping/[sku]/MyPizzas.tsx` | Wallet-aware "my pizzas" section |
| `src/app/marketplace/page.tsx` | Marketplace browse + Buy Now + Make Offer |
| `src/app/marketplace/list/page.tsx` | Create listing wizard |
| `src/app/marketplace/my-listings/page.tsx` | Manage listings & offers |
| `src/app/marketplace/floors/page.tsx` | Floor prices by collection/rarity/topping |
| `src/lib/contracts.ts` | Contract ABIs, addresses, recipes |
| `src/lib/collections.ts` | Supported marketplace collections config (includes `openseaSlug`) |
| `src/lib/opensea-api.ts` | OpenSea API client with in-memory caching (5min listings, 1hr metadata) |
| `src/lib/normalize-listings.ts` | Transforms OpenSea listings → NormalizedListing with topping enrichment |
| `src/lib/box-redemption.ts` | On-chain `isRedeemed()` multicall for Rare Pizzas Box tokens |
| `src/lib/viem-client.ts` | Server-side viem public client factory (mainnet + optimism) |
| `src/lib/seaport.ts` | Seaport client: create/fulfill listings & offers, approval mgmt |
| `src/lib/marketplace-config.ts` | Fee constants (1% + 6.25%) and calculation helpers |
| `src/lib/toppings.ts` | Topping data helpers, NFT metadata matching |
| `src/lib/topping-emojis.ts` | Emoji mappings per topping class |
| `src/lib/wagmi.ts` | Wagmi config (Ethereum + Optimism, public RPCs) |
| `src/hooks/useWalletToppings.ts` | On-chain metadata fetch + topping matching |
| `src/components/Header.tsx` | Nav with active tab, social links, mobile menu |
| `src/components/BuyModal.tsx` | Purchase confirmation with Seaport fulfillment |
| `src/components/OfferModal.tsx` | Make offer modal with WETH flow |
| `src/components/TxStatus.tsx` | Transaction state feedback component |
| `src/db/schema.ts` | Drizzle ORM schema (listings, listing_toppings, offers) |
| `src/db/index.ts` | Neon Postgres client with lazy init |
| `drizzle.config.ts` | Drizzle Kit migration config |
| `src/app/layout.tsx` | Root layout with footer |
| `api/random-pizza.ts` | Vercel Serverless: random pizza with tweet-dedup filtering |
| `api/mark-posted.ts` | Vercel Serverless: record posted pizzas in Vercel Blob |
| `api/opensea-owner.ts` | Vercel Serverless: fetch NFT owner + twitter from OpenSea |

### Marketplace API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/marketplace/listings` | GET | Query listings with filters (collection, topping, rarity, price, chain, sort) |
| `/api/marketplace/list` | POST | Store signed Seaport listing order |
| `/api/marketplace/cancel` | POST | Cancel a listing |
| `/api/marketplace/fulfill` | POST | Mark listing as filled after purchase |
| `/api/marketplace/floor` | GET | Floor price by collection/topping/rarity/class |
| `/api/marketplace/offers` | GET | Query offers with filters |
| `/api/marketplace/offer` | POST | Store signed Seaport offer order |
| `/api/marketplace/offer/accept` | POST | Mark offer as accepted |
| `/api/marketplace/offer/cancel` | POST | Cancel an offer |

All API routes gracefully return empty data when `DATABASE_URL` is not configured.

Listings and floor routes fetch live OpenSea data regardless of `DATABASE_URL` — the database is only needed for on-site listings and offers.

## Contracts

| Contract | Chain | Address | Standard |
|----------|-------|---------|----------|
| Pizza Box (EIP-1967 Proxy) | Ethereum | `0x4ae57798AEF4aF99eD03818f83d2d8AcA89952c7` | ERC721 |
| Rare Pizzas (EIP-1967 Proxy) | Ethereum | `0xe6616436ff001fe827e37c7fad100f531d0935f0` | ERC721 |
| Pizza Sticks & Sauce | Optimism | `0x0c7fca14b968476c223db3ee0fda9da62e0e9106` | ERC1155 |
| Seaport 1.5 | All chains | `0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC` | — |
| Seaport 1.6 | All chains | `0x0000000000000068F116a894984e2DB1123eB395` | — |

## Data Files

- `src/data/toppings.json` — 337 toppings (314 artist + 16 NFT + 7 crust) with metadata
- `src/data/pizza-index.json` — mapping of topping SKU → pizza token IDs (including NFT toppings)
- `public/pizzas/*.webp` — pizza thumbnail images
- `public/art/*.webp` — topping art images (including 132 NFT topping art files)

## Topping Classes (19 total)

| Class | Count | Notes |
|-------|-------|-------|
| Crust | 7 | |
| Sauce | 8 | |
| Cheese | 17 | |
| Meat | 40 | |
| Snacks | 31 | |
| Fruit | 32 | |
| Peppers | 9 | |
| Fungi | 7 | |
| Nuts | 3 | |
| Vegetable | 31 | |
| Seafood | 18 | |
| Bugs | 11 | |
| Flowers | 7 | |
| Herbs & Spices | 10 | |
| Eggs | 5 | |
| Space | 12 | |
| Drizzle | 9 | |
| Rare | 64 | Misc/special toppings |
| NFT | 16 | POAP, BAYC, DeadHeads, etc. — added Apr 2026 |

## Deployment

- **Vercel project**: `prj_QLeRbAuPBCtmYnlt06kEHUNK4pN1` (team `team_HBL8aUIfzRD6fUtoJZhK9guU`)
- **GitHub Actions** workflow exists at `.github/workflows/vercel.yml` but the `VERCEL_TOKEN` secret is invalid — deploys work via the native Vercel GitHub integration instead
- **Manual deploy**: `vercel --yes --prod` from the repo root
- **WalletConnect Project ID**: `e9ca605a49fa9cc49ccb2fa65cd286d0` (set in Vercel env vars)
- **Vercel Blob**: Used by mark-posted API. Needs `BLOB_READ_WRITE_TOKEN` env var
- **OpenSea API**: `OPENSEA_API_KEY` configured in Vercel (all environments). Used by `api/opensea-owner.ts` and `src/lib/opensea-api.ts`
- **Database**: Neon Postgres via `DATABASE_URL` env var — needed for on-site marketplace listings/offers. Not yet provisioned. OpenSea listings work without it.

## Redirects
- `/mint` redirects to `/` (mint is now the homepage)
- `/browse` redirects to `/toppings`

## Tech Stack
- Next.js 16.1.6, React 19, Tailwind v4
- wagmi v2 + viem for contract reads/writes (Ethereum + Optimism)
- RainbowKit for wallet connection
- @opensea/seaport-js + ethers v6 for marketplace order creation/fulfillment
- drizzle-orm + @neondatabase/serverless for marketplace database
- @vercel/blob for tweet dedup storage
- Deployed on Vercel

## Scripts (in `/scripts/`)
- `snapshot-spend.mjs` — reconstructs box holder snapshot at a historical block with ETH spend tracking
- `snapshot-may8-2022.csv` — output: 764 holders, 1547 boxes, 259.05 ETH total paid
- `convert-nft-art.mjs` — converts NFT topping PNGs from Dropbox to WebP
- `build-nft-pizza-index.mjs` — scans all 432 minted pizzas for NFT traits, builds pizza-index entries
- `find-x-owners.mjs` — finds pizza owners with X/Twitter linked on OpenSea
- `update-sheet-handle.mjs` — updates a Twitter handle in the Google Sheet
- `check-x-handles-browser.mjs` — browser-based X handle validation using playwright-core

## Google Sheet Integration
- **Sheet ID**: `1xN149zkgSXPfJhDwQrIzlMzcU9gB--ihdoO_XJXCqf0`
- **Tab**: "Topping Assignment" — Col C = Topping Name, Col H = Twitter
- **Service account**: `clod-307@clod-485916.iam.gserviceaccount.com` (Editor access)
- When updating artist handles, update BOTH `toppings.json` AND the sheet

## NFT Topping Art Source
- Original PNGs: `/c/Users/samgo/PizzaDAO Dropbox/Dread Pizza Roberts/pizza-oven-py/ingredients-db/`
- Named as `{sku}-topping-nft-{slug}.png` (e.g., `8820-topping-nft-poap.png`)
- Converted to WebP in `public/art/{sku}.webp`

## Plans

| Plan | File | Status |
|------|------|--------|
| Marketplace (Seaport) | `plans/marketplace.md` | Phases 1-3 merged, floor prices shipped |
| Wallet Toppings | `plans/wallet-toppings.md` | Open |
| Leaderboard (top holders + ENS) | `plans/leaderboard.md` | Planned, not started |

### Archived Plans (in `plans/done/`)
- NFT Toppings Metadata — completed
- Tweet Dedup Compose — completed

## Known Issues / TODO
- **DATABASE_URL not provisioned** — need to create a Neon Postgres database and add `DATABASE_URL` to Vercel env vars for marketplace listings/offers to persist
- GitHub Actions `VERCEL_TOKEN` secret is invalid — native Vercel GitHub integration works as fallback
- VRF costs ~$2.21/mint via Chainlink VRF v2 — consider `block.prevrandao` or Pyth Entropy for future minting
- `BLOB_READ_WRITE_TOKEN` needs to be configured in Vercel for the Mark Posted feature to work
- ~86 pizzas in the X-linked random pool (out of 432 total) — could be expanded by re-running `find-x-owners.mjs`
- Pizza Pop collection contract address still TBD — deferred for later addition to marketplace
- Marketplace Phase 4 remaining items: price history charts, cheapest-topping alerts, trait rarity pricing insights

## Session Changes (Apr 2026)

### Merged
1. **PR #8 — NFT toppings**: Added 16 missing NFT class toppings (POAP, BAYC, DeadHeads, etc.) with 132 art files and pizza-index mappings for all 432 minted pizzas
2. **PR #9 — Tweet dedup**: Added "Mark Posted" button to `/compose` with Vercel Blob storage, random pizza endpoint filters out recently-posted pizzas for 30 days
3. **PR #10 — Marketplace**: Full marketplace with browse, buy (Seaport), list, offers, and floor prices across 3 collections (Rare Pizzas Box, Rare Pizzas, Pizza Sticks & Sauce on Optimism)
4. **PR #11 — OpenSea listings + box redemption**: Live OpenSea listings for all 3 collections, NFT images/names, box opened/unopened badges via on-chain multicall, topping enrichment from traits

### Direct commits
5. **Tagline update**: Changed toppings page tagline to "314 unique artist toppings across 17 classes, 16 NFTs, and 7 crusts"
6. **Dropdown padding fix**: Added right padding to home page select dropdowns so chevron arrows aren't clipped
7. **API resilience fix**: All marketplace API routes handle missing `DATABASE_URL` gracefully; `matchTopping()` coerces NFT attributes to string
8. **Listing dedup**: Same-token duplicate OpenSea orders deduplicated (keep cheapest); token ID shown alongside NFT name on cards
9. **Cache-busting**: Client-side fetch uses timestamp param; API returns `no-store` headers; `_meta` debug field on listings response
10. **Default sort**: Marketplace defaults to price low-to-high
11. **Offer routing**: OpenSea-sourced listings link to OpenSea for offers; on-site offer flow reserved for local listings
12. **Dead handles**: Excluded @ysgjay and @rubenalexand3r from compose tweet generation (DEAD_HANDLES set)
