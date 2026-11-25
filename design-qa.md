# Hero SVG alignment QA — 2026-11-20

**Findings**

No remaining actionable P0/P1/P2 differences in the requested hero scope.

**Source and capture**

- Visual truth: supplied SVG at `/Users/nikitasmolkov/.codex/attachments/ce2157cd-82e5-4a73-80d0-b868ca6adf66/Вставленный текст.txt`.
- Local-only copy: `assets/sources/generated/hero-layout/reference.svg`; its embedded rasters are excluded from production.
- Reference capture: `assets/sources/generated/hero-layout/qa/reference.jpg`.
- Final implementation: `assets/sources/generated/hero-layout/qa/implementation-final.jpg`.
- Same viewport: 1920×873 CSS px, device scale factor 1. Both compared hero captures are 1920×783 pixels; the site's 90 px header is excluded from the implementation crop. No density scaling was needed.
- State: English homepage, scroll at top, fully loaded fonts and photo.
- Full-view comparison: `assets/sources/generated/hero-layout/qa/comparison-final.jpg`, source above implementation.
- Focused comparison: `assets/sources/generated/hero-layout/qa/focused-final.jpg`, source left and implementation right; checks the roof/letter overlap, caption, arrow and image detail.
- Final Serbian homepage with header: `assets/sources/generated/hero-layout/qa/preview-final.jpg`.

**Comparison history**

1. P2: the first capture placed EVOLUTION over the roof rather than behind it. Evidence: `comparison-first.jpg`. Fixed with the supplied foreground alpha, cropped to the wordmark overlap and encoded as a 994-byte mask. No extra foreground photograph is loaded. The final focused comparison confirms the roof covers the lettering at the supplied boundary.
2. P1: exactly 768 px matched both legacy `max-width:767.99px` and desktop media rules in the preview browser. This combined a full-size mobile photo with the desktop transform. Replaced the hero's fractional mobile query with the strict range `width < 768px` and removed size transitions on the desktop circle. Final 768 px capture and measured center error of 0 px confirm the fix.
3. Caption/arrow alignment: applied the local Manrope button font, 16/24 desktop metrics, corrected the text baseline and restored the supplied 13×24 SVG arrow box. Final focused capture confirms matching size and placement.

**Required fidelity surfaces**

- Fonts/typography: EVOLUTION and RESIDENCE reuse the supplied exact vector contours; no font approximation for the wordmark. Circle caption uses local Manrope. At smaller tablet sizes its font stops shrinking at 11 px for readability. Mobile retains its existing text heading.
- Spacing/layout: image is 1099×783 at x700, wordmark is 1127×355 at x136/y172, and circle is 150×150 at x625/y397 in the 1920×783 composition. All scale proportionally and center vertically inside the hero. No horizontal overflow.
- Colors/tokens: background #161D2D, white headline and #42B0F9 residence contour agree with the supplied SVG; no palette changes.
- Image quality: same supplied aerial composition and crop. Full render is 983,698 bytes at 1099×783, with RGB changes bounded to 1/255 per channel (PSNR 50.73 dB). Raster plus roof mask is 984,692 bytes; including the wordmark SVG the desktop hero assets total 991,304 bytes, below the 1,000,000-byte budget. No stretched photo or opaque mask halo is visible in the focused comparison.
- Copy/content: existing Serbian/English translations and accessible heading/link text are preserved. English caption matches the SVG's two-line ABOUT PROJECT.

**Responsive evidence**

| Viewport | Photo center error | Wordmark coordinate error | Horizontal overflow |
| --- | --- | --- | --- |
| 768×1024 | 0.000 px | 0.007 px | 0 px |
| 1024×768 | 0.000 px | 0.007 px | 0 px |
| 1280×720 | 0.000 px | 0.007 px | 0 px |
| 1920×873 | 0.000 px | 0 px | 0 px |
| 2560×1440 | 0.000 px | 0 px | 0 px |
| 3440×1600 | 0.000 px | 0 px | 0 px |
| 390×844 | 0.000 px | mobile text | 0 px |

`responsive-measurements.json` contains the actual bounding rectangles. Screenshots are `viewport-WIDTH.jpg` in the QA folder. All captures use CSS pixels at scale factor 1. The 390 px mobile photograph fills its parent exactly; the desktop wordmark is hidden there as intended.

**Interactions and console**

- The circle opens `/en/about-project/` and brings About into the viewport; the header logo returns to `/en/`.
- English and Serbian homepage routes render the updated hero.
- First-party console errors: none observed. Existing third-party Yandex SmartCaptcha React hydration errors remain outside this visual change.
- Unit suite: 61 passed. Production dependency validation and generated route validation passed. Browser checks used the in-app browser.

**Open Questions**

None for the requested scope.

**Implementation Checklist**

- [x] Keep render below 1 MB.
- [x] Center the image vertically from 768 px through wide desktop.
- [x] Match supplied SVG wordmark geometry and roof overlap.
- [x] Preserve the mobile layout and working About navigation.
- [x] Validate approved production assets and rebuild deployment files.

**Follow-up Polish**

P3: normal subpixel antialiasing differences between browser text and outlined SVG caption; no layout correction required.

final result: passed

## Homepage building cards · 2026-11-25

Compared the English homepage with the six supplied SVGs. The two 1920 exports match. Each card uses the photograph of its building at all breakpoints, including the intermediate widths where the reference repeats the street view. The compact street photograph uses the crop embedded in the mobile design.

| Content width | Columns | Photo size in CSS pixels | Hero height below navigation |
| --- | --- | --- | --- |
| 1920 | 2 | 827 × 500 | 976 |
| 1400 | 2 | 640 × 386.9 | 734.9 |
| 1280 | 2 | 580 × 350.7 | 698.7 |
| 768 | 2 | 340 × 212.7 | 548.7 |
| 390 | 1 | 358 × 224 | 971.5 |

Local captures and measurements are in `assets/sources/generated/residence-hero/qa/`. The comparison images put the supplied design on the left and the rendered homepage on the right. Photo placement, card spacing and button positions agree within one CSS pixel at the measured widths.

Verified localized catalog links, headline exit on downward scroll, re-entry when returning, and static text with reduced motion. The photographs remain visible throughout. The production image manifest and generated route checks passed. All 61 Node tests and 13 targeted browser checks passed. The geometry sweep runs once in Chromium, accounting for the five skipped duplicate runs.

final result: passed

## Gallery before the footer · 2026-11-25

The ten frames follow the supplied 22320 × 1330 SVG from left to right. Frames 1–6 use the six new photographs. Frames 7–10 use the existing renders 03, 08, 09 and 02. The Serbian and English homepage routes contain the same sequence.

Browser checks covered forward and reverse scrolling, trackpad momentum, the animated Skip transition to the form, and touch controls from 1 / 10 through 10 / 10. All 12 applicable checks passed across Chromium, Firefox and WebKit.

The catalog uses the same ten frames immediately before its footer. Desktop Chromium and mobile WebKit checks on the local site covered Tchaikovsky and Vivaldi in grid and floor-plan views. All eight checks measured a zero-pixel gap to the footer, advanced to frame two, and observed Skip animate to the footer contacts while preserving the selected house and view.

## Shared header · 2026-11-25

At 1920 CSS pixels, the English homepage and both catalogs have an 88-pixel header. The Apartments button begins at x = 471.58 and measures 181.63 × 56 pixels on all three pages, within one CSS pixel of the supplied SVG. The navigation and gallery browser suite passed all 51 applicable checks.
