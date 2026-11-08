import localFont from "next/font/local";

// Archivo Narrow: condensed like a destination roll, so long town names fit a 360 px phone.
export const latin = localFont({
  src: [
    { path: "./fonts/archivo-narrow-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/archivo-narrow-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/archivo-narrow-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-latin",
  display: "swap",
});

// Noto Sans Ethiopic for Amharic (Ge'ez script). Latin glyphs fall through to Archivo Narrow first.
export const ethiopic = localFont({
  src: [
    { path: "./fonts/noto-sans-ethiopic-ethiopic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/noto-sans-ethiopic-ethiopic-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-ethiopic",
  display: "swap",
  preload: false,
});
