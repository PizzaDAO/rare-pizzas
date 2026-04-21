#!/usr/bin/env node
/**
 * Convert NFT topping PNGs from ingredients-db to WebP for the site.
 *
 * Source: /c/Users/samgo/PizzaDAO Dropbox/Dread Pizza Roberts/pizza-oven-py/ingredients-db/
 * Target: public/art/{sku}.webp
 *
 * Matches quality of existing art files (~60-100KB for 1000x1000 PNGs).
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const SRC_DIR =
  "C:/Users/samgo/PizzaDAO Dropbox/Dread Pizza Roberts/pizza-oven-py/ingredients-db";
const DEST_DIR = path.resolve("public/art");

// Match all NFT topping PNGs (SKU 8700-8857)
const NFT_PATTERN = /^(8[78]\d{2})-topping-nft-.*\.png$/;

async function main() {
  // List source files
  const allFiles = fs.readdirSync(SRC_DIR);
  const nftFiles = allFiles.filter((f) => NFT_PATTERN.test(f)).sort();

  console.log(`Found ${nftFiles.length} NFT topping PNGs to convert`);

  let converted = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of nftFiles) {
    const match = file.match(NFT_PATTERN);
    if (!match) continue;

    const sku = match[1];
    const srcPath = path.join(SRC_DIR, file);
    const destPath = path.join(DEST_DIR, `${sku}.webp`);

    // Skip if already converted
    if (fs.existsSync(destPath)) {
      skipped++;
      continue;
    }

    try {
      await sharp(srcPath)
        .webp({ quality: 80, effort: 6 })
        .toFile(destPath);

      const stat = fs.statSync(destPath);
      console.log(`  ${file} -> ${sku}.webp (${Math.round(stat.size / 1024)}KB)`);
      converted++;
    } catch (err) {
      console.error(`  ERROR converting ${file}: ${err.message}`);
      errors++;
    }
  }

  console.log(
    `\nDone: ${converted} converted, ${skipped} skipped, ${errors} errors`
  );
  console.log(`Total NFT art files: ${converted + skipped}`);
}

main().catch(console.error);
