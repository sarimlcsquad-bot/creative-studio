# The design (device card)

You design this creative as a single HTML fragment plus CSS, rendered at a fixed pixel size into a PNG. The look is a clean product card: one real device whose screen shows the fix, on one flat background colour, next to a heavy headline.

## The card

- **One device**, drawn by you in HTML/CSS: a phone, a tablet or a laptop, shown whole (never cropped by the canvas edge), straight on or with a slight tilt of at most 6 degrees. Build it from divs: a body with a near-black bezel (#0E0E10 to #1C1C1F), rounded corners (phone about 56 px, tablet about 36 px, laptop screen about 18 px plus a thin base), a soft drop shadow, and a light screen inside. A phone has a small camera pill at the top of the screen.
- **The screen is synced to the headline.** It shows the app view where the headline's problem gets fixed, using the headline's key words: if the headline says missed calls, the screen shows a missed call followed by the instant text-back; if it says quotes, the screen shows the quote being sent. Show problem and fix in the same view where you can (a red missed-call row, then a green "Texted back" row).
- **Screen content is factual and generic**: an app title bar (`screen.app_title`), then 3 to 6 elements such as notification rows, chat bubbles, a calendar slot, a pipeline card, a form, a checklist or a status chip (`screen.elements`, one short line each describing what you drew). Use generic first names (Sam, Jordan, Priya), 555 phone numbers (such as (555) 014-2290), and times. No prices, no counts or statistics, no star ratings, no faces or photos, no real app logos. Screen text is at least 20 px so it reads at feed size.
- **One flat background colour** filling the canvas (`background_hex`), no gradients, no photos, no patterns. Pick it to suit the brand colours; the request says whether this ad uses a dark or a light ground. Text on it must have strong contrast.

## The headline

- Heavy (800 or 900 weight), left-aligned, 2 to 4 lines (`headline_lines`), large (usually 76 to 120 px, line-height about 1.02).
- Accent words: 1 to 3 payoff words (`accent_words`) shown in the brand accent colour (or on an accent highlight bar on a light ground). Everything else in the headline uses the ground's text colour.
- An optional short subhead under it (at most about 14 words, 30 to 38 px).

## The furniture (always in the same places)

- **Logo mark** top-left: `<img src="{{LOGO}}" class="logo">`, about 64 to 90 px tall. If has_logo is false, write the brand name as a small wordmark there instead.
- **Bonus pill** top-right: a rounded pill with the bonus_pill text exactly as given (skip it when there is none).
- **Proof line** with a small shield icon (inline SVG), near the headline or above the CTA, using the proof_line exactly as given.
- **CTA button** in the brand accent colour (`var(--accent)`) with a white label (use dark text only if white would not read on that accent), then the `cta_note` in small text right under it.
- **Footer** bottom-left: the brand name as a wordmark, with the website and the email (if the brand kit has one) in small text beside or under it.

## Layout

- Phones and upright tablets sit beside the headline (`device_side` "right" or "left"; usually right), taking about 38 to 46 percent of the width.
- Laptops and landscape tablets sit under the headline (`device_side` "below"), roughly 70 to 85 percent of the width.
- 4:5 is 1080 x 1350 px; 1:1 is 1080 x 1080 px; 9:16 is 1080 x 1920 px.
- **9:16 (Stories and Reels):** keep every word, the logo, the CTA and the device's screen content out of the top 14 percent (above y = 270 px) and the bottom 35 percent (below y = 1250 px), because the app covers them. Only the flat background and the lower body of the device may extend there. Write `story_9x16_note` as one sentence on what you moved or dropped to fit (for other formats, one sentence on how this card would adapt to 9:16).

## Brand

- Colours are CSS variables: `var(--deep)`, `var(--light)`, `var(--accent)`, `var(--primary)`, `var(--secondary)`, plus white, black, the bezel greys above and the flat `background_hex` you chose. Status colours on the screen (a red missed-call dot, a green check) are fine.
- Fonts are `var(--font-heading)` and `var(--font-body)` in weights 400, 600, 700, 800 and 900. Use no other fonts.

## Technical rules

- `html`: only the inner content of `.canvas` (which has `position: relative` and `overflow: hidden`). Allowed elements: div, span, p, h1 to h6, strong, em, b, i, br, ul, ol, li, img, svg and its shapes (path, circle, rect, line, polyline, polygon, g, defs, linearGradient, radialGradient, stop; no svg <text>). Put styling in `css`; short inline style attributes are fine.
- `css`: plain CSS scoped under `.canvas`. No @import, no @font-face, no external url(), no animations, no :hover.
- No scripts, event handlers, links, forms, iframes or external resources. The only URL allowed is `{{LOGO}}`. There is no photo and no AI image in this design: never use `{{PHOTO}}` or `{{BG}}`.
- Set `layout_name` to "device <phone|tablet|laptop> <right|left|below>", `image_shape` to "none", `photo_prompt` to an empty string, `visual_type` "n/a" and `brand_image_index` -1.
- `hook` is the headline as one line, word for word.
