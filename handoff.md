# Toppings Site Handoff

## Live URL
https://toppings-two.vercel.app

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

### My Collection (`/my-toppings`)
- **Pizza Boxes** — shows all owned boxes with redeemed/unredeemed status
- **Rare Pizzas** — grid of owned pizza thumbnails linking to OpenSea
- **Toppings** — all toppings found across owned pizzas, with rarity breakdown, filters, and flip cards showing which pizzas have each topping

### Topping Detail Pages (`/topping/[sku]`)
- "My Rare Pizzas with this topping" section (wallet-aware, gold heading)
- "Rare Pizzas with this topping" section (all pizzas)
- Removed % probability display
- Fixed ring border clipping on variant thumbnails

### Header & Navigation
- Active tab highlights yellow based on current route
- Social links: Discord, OpenSea, X (self-hosted SVGs)
- "Global Pizza Party" nav link to globalpizza.party
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
| `src/app/topping/[sku]/page.tsx` | Topping detail page |
| `src/app/topping/[sku]/MyPizzas.tsx` | Wallet-aware "my pizzas" section |
| `src/lib/contracts.ts` | Contract ABIs, addresses, recipes |
| `src/components/Header.tsx` | Nav with active tab, social links, mobile menu |
| `src/components/TxStatus.tsx` | Transaction state feedback component |
| `src/app/layout.tsx` | Root layout with footer |
| `.github/workflows/vercel.yml` | Auto-deploy on push (needs valid Vercel API token) |

## Contracts

| Contract | Address |
|----------|---------|
| Pizza Box (EIP-1967 Proxy) | `0x4ae57798AEF4aF99eD03818f83d2d8AcA89952c7` |
| Rare Pizzas (EIP-1967 Proxy) | `0xe6616436ff001fe827e37c7fad100f531d0935f0` |

## Data Files

- `src/data/toppings.json` — 321 toppings with metadata
- `src/data/pizza-index.json` — mapping of topping SKU to pizza token IDs
- `public/pizzas/*.webp` — pizza thumbnail images
- `public/art/*.webp` — topping art images

## Deployment

- **Vercel project**: `prj_QLeRbAuPBCtmYnlt06kEHUNK4pN1` (team `team_HBL8aUIfzRD6fUtoJZhK9guU`)
- **GitHub Actions** workflow exists at `.github/workflows/vercel.yml` but the token secret needs a proper Vercel API token (create at https://vercel.com/account/tokens)
- **Manual deploy**: `vercel --yes --prod` from the repo root
- **WalletConnect Project ID**: `e9ca605a49fa9cc49ccb2fa65cd286d0` (set in Vercel env vars)

## Redirects
- `/mint` redirects to `/` (mint is now the homepage)
- `/browse` redirects to `/toppings`

## Tech Stack
- Next.js 16.1.6, React 19, Tailwind v4
- wagmi v2 + viem for contract reads/writes
- RainbowKit for wallet connection
- Deployed on Vercel

## Scripts (in `/scripts/`)
- `snapshot-spend.mjs` — reconstructs box holder snapshot at a historical block with ETH spend tracking
- `snapshot-may8-2022.csv` — output: 764 holders, 1547 boxes, 259.05 ETH total paid

## Known Issues / TODO
- GitHub Actions auto-deploy needs a proper Vercel API token (CLI session token doesn't work for CI)
- VRF costs ~$2.21/mint via Chainlink VRF v2 — consider `block.prevrandao` or Pyth Entropy for future minting
