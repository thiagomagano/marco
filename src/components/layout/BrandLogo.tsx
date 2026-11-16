"use client";

import Image from "next/image";
import { useState } from "react";
import {
  BRAND_LOGO_FALLBACK_PATH,
  BRAND_LOGO_PATH,
  BRAND_NAME,
} from "@/lib/brand.ts";

interface BrandLogoProps {
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export function BrandLogo({
  className = "h-9 w-auto object-contain rounded-lg",
  alt = BRAND_NAME,
  width = 180,
  height = 100,
}: BrandLogoProps) {
  const [src, setSrc] = useState(BRAND_LOGO_PATH);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0"
        aria-label={alt}
      >
        M
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      loading="eager"
      onError={() => {
        if (src !== BRAND_LOGO_FALLBACK_PATH) {
          setSrc(BRAND_LOGO_FALLBACK_PATH);
        } else {
          setFailed(true);
        }
      }}
      className={className}
    />
  );
}
