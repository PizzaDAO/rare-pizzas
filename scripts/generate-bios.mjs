/**
 * generate-bios.mjs
 *
 * Reads toppings.json and artist-bios.json, applies researched bios to every
 * topping entry for each artist, and writes the updated data back.
 *
 * artist-bios.json format: { "Name": { "bio": "...", "sourced": true/false } }
 *
 * Usage:  node scripts/generate-bios.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "src", "data", "toppings.json");
const BIOS_PATH = join(__dirname, "artist-bios.json");

// ── main ───────────────────────────────────────────────────────────────

const toppings = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
const bios = JSON.parse(readFileSync(BIOS_PATH, "utf-8"));

// Group by artist to report stats
const artistMap = {};
for (const t of toppings) {
  const key = t.artist;
  if (!artistMap[key]) artistMap[key] = [];
  artistMap[key].push(t);
}

const artists = Object.keys(artistMap);
const biosKeys = Object.keys(bios);
console.log(`Found ${artists.length} unique artists across ${toppings.length} toppings`);
console.log(`Loaded ${biosKeys.length} artist bios from artist-bios.json`);

// Check for missing bios
const missing = artists.filter((a) => !bios[a]);
if (missing.length > 0) {
  console.log(`\nMissing bios for ${missing.length} artists:`);
  for (const m of missing) {
    console.log(`  - "${m}" (${artistMap[m].length} topping(s))`);
  }
}

// Write bios back
let updated = 0;
let skipped = 0;
let sourced = 0;
let generated = 0;
for (const t of toppings) {
  const entry = bios[t.artist];
  if (entry) {
    t.artistBio = entry.bio;
    t.artistBioGenerated = !entry.sourced;
    updated++;
    if (entry.sourced) sourced++;
    else generated++;
  } else {
    // Fallback: generic bio
    t.artistBio = "Contributing artist to the Rare Pizzas collection.";
    t.artistBioGenerated = true;
    skipped++;
    generated++;
  }
}

writeFileSync(DATA_PATH, JSON.stringify(toppings, null, 2) + "\n", "utf-8");
console.log(`\nUpdated ${updated} toppings with bios (${sourced} sourced, ${generated} generated)`);
console.log(`Applied fallback bio to ${skipped} toppings`);
console.log("Done!");
