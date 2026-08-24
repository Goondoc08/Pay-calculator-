/**
 * Regenerates every PWA/favicon icon from scratch (public/*.png). Text is
 * rendered via opentype.js as vector paths — not left as live SVG <text>
 * with a @font-face — so the final SVG has no font-loading dependency at
 * all and sharp/librsvg rasterizes it identically everywhere, regardless
 * of what fonts happen to be installed on the machine running this.
 *
 * The two font files aren't committed (scripts/.icon-fonts/ is
 * gitignored) — they're easy to re-fetch and there's no reason to carry
 * font binaries in the repo history. Re-run `node scripts/generate-icons.cjs`
 * after re-downloading them:
 *   curl -sL -o scripts/.icon-fonts/ArchivoBlack.ttf \
 *     https://github.com/google/fonts/raw/main/ofl/archivoblack/ArchivoBlack-Regular.ttf
 *   curl -sL -o scripts/.icon-fonts/JetBrainsMono-Bold.ttf \
 *     https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Bold.ttf
 */
const opentype = require("opentype.js");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const FONT_DIR = path.join(__dirname, ".icon-fonts");
const payFont = opentype.parse(
  fs.readFileSync(path.join(FONT_DIR, "ArchivoBlack.ttf")).buffer,
);
const checkFont = opentype.parse(
  fs.readFileSync(path.join(FONT_DIR, "JetBrainsMono-Bold.ttf")).buffer,
);

function textPath(font, text, fontSize, centerX, baselineY, letterSpacing = 0) {
  // opentype.js doesn't support letter-spacing natively; walk glyphs by hand
  // when we want it (CHECK, for a mono-caps badge feel), plain getPath when
  // we don't (PAY, already heavy/wide enough on its own).
  if (!letterSpacing) {
    const width = font.getAdvanceWidth(text, fontSize);
    const p = font.getPath(text, centerX - width / 2, baselineY, fontSize);
    return p.toPathData(2);
  }
  const scale = fontSize / font.unitsPerEm;
  let totalWidth = 0;
  const glyphs = font.stringToGlyphs(text);
  for (const g of glyphs) totalWidth += g.advanceWidth * scale + letterSpacing;
  totalWidth -= letterSpacing;
  let x = centerX - totalWidth / 2;
  let d = "";
  for (const g of glyphs) {
    const gp = g.getPath(x, baselineY, fontSize);
    d += gp.toPathData(2) + " ";
    x += g.advanceWidth * scale + letterSpacing;
  }
  return d.trim();
}

// Deep Alpine & Slate palette, matching the live app.
const C = {
  bg: "#1B3B36", // Deep Alpine
  calcBody: "#3D6B63", // Alpine Teal
  screen: "#111923", // Slate Ink
  screenBorder: "#0B0F14",
  buttonLight: "#E2E8E8", // Fog Gray
  buttonDim: "#2C3E50", // Slate Navy
  white: "#FFFFFF",
  lavender: "#A98EF0", // Holiday Lavender
};

/**
 * Full icon: calculator body with "PAY" lit up on its screen (like a
 * readout) and "CHECK" in mono type as a caption underneath, echoing
 * PFD Link's dark-badge-with-bold-lettering icon while staying in Pay
 * Check's own palette rather than borrowing PFD's amber/red.
 *
 * `scale`/`offsetY` let the same composition be re-centered into a
 * smaller safe zone for the maskable variant without redrawing it.
 */
function buildIconSvg({ size, maskable = false, minimal = false }) {
  const s = maskable ? 0.72 : 1; // shrink into Android's ~80% safe circle
  const cx = size / 2;
  const cy = size / 2 + (maskable ? 0 : -size * 0.02);

  const bodyW = size * 0.62 * s;
  const bodyH = size * 0.56 * s;
  const bodyX = cx - bodyW / 2;
  const bodyY = cy - bodyH / 2 - size * 0.06 * s;
  const bodyR = size * 0.055 * s;

  const screenW = bodyW * 0.82;
  const screenH = bodyH * 0.28;
  const screenX = cx - screenW / 2;
  const screenY = bodyY + bodyH * 0.1;
  const screenR = size * 0.02 * s;

  let buttons = "";
  if (!minimal) {
    const cols = 3;
    const rows = 3;
    const gridTop = screenY + screenH + bodyH * 0.1;
    const gridBottom = bodyY + bodyH - bodyH * 0.08;
    const gridH = gridBottom - gridTop;
    const btnGap = bodyW * 0.045;
    const btnW = (bodyW * 0.8 - btnGap * (cols - 1)) / cols;
    const btnH = (gridH - btnGap * (rows - 1)) / rows;
    const gridLeft = cx - (btnW * cols + btnGap * (cols - 1)) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = gridLeft + c * (btnW + btnGap);
        const by = gridTop + r * (btnH + btnGap);
        // Bottom-right button (the "=" position) picked out in lavender —
        // a small deliberate accent, same role the holiday-lavender fill
        // plays throughout the live app.
        const isEquals = r === rows - 1 && c === cols - 1;
        buttons += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${btnW.toFixed(1)}" height="${btnH.toFixed(1)}" rx="${(btnW * 0.22).toFixed(1)}" fill="${isEquals ? C.lavender : C.buttonLight}" />`;
      }
    }
  }

  const payFontSize = screenH * 0.62;
  const payPath = textPath(
    payFont,
    "PAY",
    payFontSize,
    cx,
    screenY + screenH * 0.72,
  );

  const checkFontSize = size * 0.09 * s;
  const checkY = bodyY + bodyH + size * (minimal ? 0 : 0.11) * s;
  const checkPath = minimal
    ? ""
    : textPath(
        checkFont,
        "CHECK",
        checkFontSize,
        cx,
        checkY,
        checkFontSize * 0.14,
      );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${C.bg}" />
    <rect x="${bodyX.toFixed(1)}" y="${bodyY.toFixed(1)}" width="${bodyW.toFixed(1)}" height="${bodyH.toFixed(1)}" rx="${bodyR.toFixed(1)}" fill="${C.calcBody}" stroke="${C.white}" stroke-width="${(size * 0.012 * s).toFixed(1)}" />
    <rect x="${screenX.toFixed(1)}" y="${screenY.toFixed(1)}" width="${screenW.toFixed(1)}" height="${screenH.toFixed(1)}" rx="${screenR.toFixed(1)}" fill="${C.screen}" stroke="${C.screenBorder}" stroke-width="2" />
    <path d="${payPath}" fill="${C.white}" />
    ${buttons}
    ${checkPath ? `<path d="${checkPath}" fill="${C.lavender}" />` : ""}
  </svg>`;
}

async function render(svg, outPath, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log("wrote", outPath, size);
}

async function main() {
  const pub = path.join(__dirname, "..", "public");
  fs.mkdirSync(pub, { recursive: true });

  const full512 = buildIconSvg({ size: 512 });
  await render(full512, path.join(pub, "pwa-512x512.png"), 512);
  await render(full512, path.join(pub, "pwa-192x192.png"), 192);
  await render(full512, path.join(pub, "apple-touch-icon.png"), 180);

  const maskable512 = buildIconSvg({ size: 512, maskable: true });
  await render(maskable512, path.join(pub, "pwa-maskable-512x512.png"), 512);

  const favicon = buildIconSvg({ size: 256, minimal: true });
  await render(favicon, path.join(pub, "favicon-32.png"), 32);
  await render(favicon, path.join(pub, "favicon-16.png"), 16);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
