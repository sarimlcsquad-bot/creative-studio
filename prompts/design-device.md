# The design (device card)

You design this creative as a single HTML fragment plus CSS, rendered at a fixed pixel size into a PNG. The look is a clean, sparse product card: one real device whose screen shows the fix, on one flat background colour, next to a short heavy headline. Less text wins: the reader takes it in within two seconds.

## Exactly what goes on the card (nothing else)

1. **Logo** top-left.
2. **Offer pill** top-right, only when the request gives one.
3. **Headline**: 2 or 3 short lines, at most about 9 words in all.
4. **The device**, whose screen shows the fix.
5. **Proof line** with a small shield icon.
6. **CTA button** and the **note** under it.
7. **Footer**: brand name, website and email.

No subhead, no support sentence, no bullet or check list, no price line, no extra offer line, no stats, no star ratings or review scores ("5/5", "★★★★★", "rated…", "from verified reviews") anywhere on the card or the screen. Benefits, bullets and the offer details belong in the caption, not on the card.

The texts for the offer pill, proof line, CTA button and note are given in the request. Use them **word for word**: never invent, rename or paraphrase them, and never write your own proof. If the request gives no offer pill or no proof line, leave that element out.

## Required class names

Use these classes so the app can check the card: `class="logo"` on the logo img, `class="bonus"` on the offer pill, `class="headline"` on the headline element, `class="acc"` on each accent span, `class="device"` on the outer device body, `class="proof"` on the proof line, `class="cta"` on the button, `class="cta-note"` on the note, `class="foot"` on the footer.

## The headline

- Heavy (800 or 900 weight), left-aligned, `headline_lines` holds its 2 or 3 lines. Size about 84 to 110 px, line-height about 1.04. Plain, clear words.
- Accent words: 1 to 3 payoff words, each in `<span class="acc">`, coloured with the brand accent `var(--accent)` as **text colour only**: no highlight box, no background bar, no underline block, no second accent colour. Every other headline word uses one plain text colour that reads on the ground (near-white on dark, near-black on light).

## The device

- One phone, tablet or laptop drawn in HTML/CSS, shown whole, upright (tilt at most 4 degrees). Near-black bezel (#0E0E10 to #1C1C1F), rounded corners (phone about 56 px, tablet about 36 px, laptop screen about 18 px plus a thin base), a soft shadow, a light screen. A phone has a small camera pill.
- **The screen is synced to the headline**: the app view where the headline's problem gets fixed, using its key words, problem and fix together where possible. An app title bar (`screen.app_title`) and 3 to 5 simple elements (`screen.elements`): notification rows, chat bubbles, a calendar slot, a pipeline or checklist card, a status chip. Generic first names, 555 numbers and times only. No prices, counts, statistics, ratings, faces or real app logos. Screen text at least 20 px.
- Screen colours: neutrals plus the brand colours; a small red dot for a problem and a small green check for done are fine. No other blues, greens or purples.

## Layout grid (stay inside it, nothing touches or overlaps)

Margins are 64 px on every side. Elements never overlap each other, and the device never touches the footer or the canvas edge.

**4:5 (1080 x 1350)**
- Top bar y 64 to 140: logo left, offer pill right.
- Phone or upright tablet (`device_side` "right"): x 600 to 1016, y 200 to 1150 at most. Left column x 64 to 560: headline from y 220, then proof line, CTA and note, all ending above y 1150.
- Laptop or landscape tablet (`device_side` "below"): headline y 200 to about 480 across the width; CTA and note on one row under it (proof line beside or just above); device x 100 to 980, ending above y 1150.
- Footer y 1200 to 1286: brand name, then website · email, left-aligned. Nothing else in this band.

**1:1 (1080 x 1080)**: the same, with the device ending above y 900 and the footer y 950 to 1016.

**9:16 (1080 x 1920)**: Stories and Reels cover the top 14 % and bottom 35 %. Top bar y 280 to 350; headline from y 400 (full width, 2 or 3 lines); then phone on the right x 600 to 1016 from y 760 (its lower body may run past y 1250, its screen content may not); left column x 64 to 560 from y 760: proof line, CTA, note, then the footer, all ending above y 1250. Laptops: under the CTA row, x 100 to 980, ending above y 1250, and the footer goes in the left column above it. Write `story_9x16_note` as one sentence on what you moved to fit (for other formats, one sentence on how this card adapts to 9:16).

## Colours (brand fidelity)

- Use only the brand colours: `var(--accent)`, `var(--primary)`, `var(--secondary)`, `var(--deep)`, `var(--light)`, plus white, black, neutral greys, the bezel greys, the small red and green status marks on the screen, and the one flat `background_hex`.
- `background_hex`: one flat colour filling the canvas, no gradient, no photo, no pattern. Pick a dark or light ground as the request says, in the brand's family (a deep or very light tint of a brand colour), with strong contrast against the headline text and the accent.
- The CTA button background is `var(--accent)` with a white label (dark label only if white would not read on that accent). Never another colour.

## Brand fonts

`var(--font-heading)` for the headline and wordmark, `var(--font-body)` for everything else, weights 400 to 900. No other fonts.

## Technical rules

- `html`: only the inner content of `.canvas` (`position: relative`, `overflow: hidden`). Allowed elements: div, span, p, h1 to h6, strong, em, b, i, br, img, svg and its shapes (path, circle, rect, line, polyline, polygon, g, defs; no svg <text>). No ul, ol or li. Put styling in `css`; short inline style attributes are fine.
- `css`: plain CSS scoped under `.canvas`. No @import, @font-face, external url(), animations or :hover.
- No scripts, event handlers, links, forms, iframes or external resources. The only URL allowed is `{{LOGO}}` (`<img src="{{LOGO}}" class="logo">`, about 64 to 80 px tall; if has_logo is false, write the brand name as a wordmark with class "logo"). Never use `{{PHOTO}}` or `{{BG}}`.
- `subhead` is always an empty string. `layout_name` is "device <phone|tablet|laptop> <right|left|below>", `image_shape` "none", `photo_prompt` empty, `visual_type` "n/a", `brand_image_index` -1. `hook` is the headline as one line, word for word.
