"use client";

import Image from "next/image";
import { useState, useMemo } from "react";
import { getImageUrl, getWoodTileUrl } from "@/lib/constants";

interface AltArtItem {
  image: string;
  artist: string;
  label: string;
}

interface GalleryItem {
  image: string;
  label: string;
  isAltArt: boolean;
}

interface ToppingImageProps {
  image: string;
  name: string;
  sku?: number;
  variants?: string[];
  altArt?: AltArtItem[];
}

export default function ToppingImage({
  image,
  name,
  sku = 0,
  variants = [],
  altArt = [],
}: ToppingImageProps) {
  const galleryItems = useMemo(() => {
    const items: GalleryItem[] = [];

    // Base image is always first
    items.push({ image, label: "Original", isAltArt: false });

    // Add variants
    variants.forEach((v, i) => {
      // Skip if the variant is the same as the base image
      if (v !== image) {
        items.push({
          image: v,
          label: `Variant ${i + 1}`,
          isAltArt: false,
        });
      }
    });

    // Add alt art
    altArt.forEach((a) => {
      items.push({
        image: a.image,
        label: a.label,
        isAltArt: true,
      });
    });

    return items;
  }, [image, variants, altArt]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mainError, setMainError] = useState(false);
  const [thumbErrors, setThumbErrors] = useState<Set<number>>(new Set());

  const hasGallery = galleryItems.length > 1;
  const currentItem = galleryItems[selectedIndex];

  const handleThumbError = (index: number) => {
    setThumbErrors((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    setMainError(false);
  };

  return (
    <div className="w-full max-w-[600px]">
      {/* Main Image */}
      <div
        className="relative aspect-square w-full overflow-hidden rounded-xl bg-cover bg-center"
        style={{ backgroundImage: `url(${getWoodTileUrl(sku)})` }}
      >
        {mainError ? (
          <div className="flex h-full w-full items-center justify-center text-8xl">
            🍕
          </div>
        ) : (
          <Image
            src={getImageUrl(currentItem.image)}
            alt={`${name} - ${currentItem.label}`}
            width={600}
            height={600}
            className="h-full w-full object-cover"
            priority
            onError={() => setMainError(true)}
          />
        )}
      </div>

      {/* Version Label */}
      {hasGallery && (
        <div className="mt-3 text-center">
          <p className="text-sm font-medium text-[#7DD3E8]">
            Version {selectedIndex + 1} of {galleryItems.length}
            {currentItem.isAltArt && (
              <span className="ml-2 text-[#FFE135]">
                {currentItem.label}
              </span>
            )}
            {!currentItem.isAltArt && selectedIndex > 0 && (
              <span className="ml-2 text-[#7DD3E8]/70">
                {currentItem.label}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Thumbnail Strip */}
      {hasGallery && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {galleryItems.map((item, i) => (
            <button
              key={`${item.image}-${i}`}
              onClick={() => handleSelect(i)}
              className={`relative flex-shrink-0 rounded-lg transition-all duration-150 ${
                i === selectedIndex
                  ? "ring-2 ring-[#FFE135] ring-offset-2 ring-offset-black"
                  : "opacity-60 hover:opacity-100"
              }`}
              title={item.label}
            >
              <div className="h-16 w-16 bg-[#111]">
                {thumbErrors.has(i) ? (
                  <div className="flex h-full w-full items-center justify-center text-xl">
                    🍕
                  </div>
                ) : (
                  <Image
                    src={getImageUrl(item.image)}
                    alt={`${name} - ${item.label}`}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                    onError={() => handleThumbError(i)}
                  />
                )}
              </div>
              {item.isAltArt && (
                <div className="absolute bottom-0 left-0 right-0 bg-[#FFE135]/80 px-1 py-0.5 text-center text-[8px] font-bold text-black">
                  ALT
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
