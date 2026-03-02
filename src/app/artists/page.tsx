"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { getAllArtists, getNotableArtists } from "@/lib/toppings";
import { getImageUrl, getWoodTileUrl } from "@/lib/constants";
import type { ArtistInfo } from "@/lib/toppings";

function ArtistCard({
  artist,
  index,
  featured,
}: {
  artist: ArtistInfo;
  index: number;
  featured?: boolean;
}) {
  const sampleImage = artist.toppings[0]?.image;

  return (
    <Link href={`/artists/${artist.slug}`}>
      <div
        className="group rounded-xl bg-cover bg-center p-4 transition-all duration-200 hover:scale-[1.02] hover:brightness-110"
        style={{ backgroundImage: `url(${getWoodTileUrl(index)})` }}
      >
        {sampleImage && (
          <div className="relative mx-auto mb-3 aspect-square w-full max-w-[200px] overflow-hidden rounded-lg">
            <Image
              src={getImageUrl(sampleImage)}
              alt={artist.name}
              width={200}
              height={200}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          </div>
        )}
        <h3 className="truncate text-sm font-semibold text-white">
          {artist.name}
        </h3>
        <p className="text-xs text-[#7DD3E8]">
          {artist.toppings.length} topping{artist.toppings.length !== 1 ? "s" : ""}
        </p>
        {featured && artist.bio && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#ccc]">
            {artist.bio}
          </p>
        )}
      </div>
    </Link>
  );
}

export default function ArtistsPage() {
  const [search, setSearch] = useState("");

  const notableArtists = getNotableArtists();
  const allArtists = getAllArtists();

  const filtered = useMemo(() => {
    if (!search) return allArtists;
    const query = search.toLowerCase();
    return allArtists.filter((a) => a.name.toLowerCase().includes(query));
  }, [allArtists, search]);

  return (
    <div>
      <section className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Artists
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-[#7DD3E8]">
          Meet the {allArtists.length} artists behind the Rare Pizzas collection.
        </p>
      </section>

      {/* Featured / Notable Artists */}
      {notableArtists.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#FFE135]">
            Featured Artists
          </h2>
          <p className="mb-4 text-sm text-[#7DD3E8]">
            {notableArtists.length} artists with researched bios
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {notableArtists.map((artist, i) => (
              <ArtistCard
                key={artist.slug}
                artist={artist}
                index={i}
                featured
              />
            ))}
          </div>
        </section>
      )}

      {/* All Artists */}
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#FFE135]">
          All Artists
        </h2>
        <div className="mb-4 flex items-center gap-4">
          <input
            type="text"
            placeholder="Search artists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-[#333] bg-[#111] px-4 py-2 text-sm text-white placeholder-[#555] outline-none focus:border-[#FFE135]"
          />
          <span className="text-sm text-[#7DD3E8]">
            {filtered.length} artist{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((artist, i) => (
            <ArtistCard key={artist.slug} artist={artist} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
