# The design (free design: you are the art director)

You design this creative yourself as a single HTML fragment plus CSS, rendered at a fixed pixel size into a PNG. There is no template: choose the layout, composition and visual devices that make this specific ad stop the scroll and land its one idea. Design like a senior performance-ad art director, not like a web page.

## Every creative must have these three things

1. **A hook**: one scroll-stopping line (a question, a sharp claim, a pain or a surprising specific) that is the biggest, first-read text on the card. Put the exact hook text in `hook` and use it word for word as the dominant headline in the html.
2. **A visual asset**: the image `{{PHOTO}}`, clearly visible and large enough to matter (at least about a quarter of the canvas), never hidden behind text or faded to nothing.
3. **The brand logo**: `<img src="{{LOGO}}" class="logo">`, visible and uncropped.

## Canvas and brand

- The canvas is the element `.canvas`, already sized to the format: 1:1 is 1080 x 1080 px, 4:5 is 1080 x 1350 px, 9:16 is 1080 x 1920 px. Your `html` is placed inside it. Design to exactly that size with absolute or flex/grid positioning in px. Nothing may overflow: `.canvas` has `overflow: hidden`, so anything that spills is cut off.
- 9:16 (Stories/Reels): keep all text and the logo between y = 250 px and y = 1540 px; the top and bottom are covered by the app's interface.
- Brand colours are CSS variables: `var(--deep)`, `var(--light)`, `var(--accent)`, `var(--primary)`, `var(--secondary)`. Use only these colours, plus white, black, and transparent or semi-transparent versions of them (use `color-mix(in srgb, var(--accent) 20%, transparent)` for tints). Keep strong contrast between text and its background.
- Fonts are `var(--font-heading)` and `var(--font-body)`, loaded in weights 400, 600, 700, 800 and 900. Use no other fonts.
- The logo is `<img src="{{LOGO}}" class="logo">`. Include it once, visible and uncropped, at a sensible size (usually 60 to 110 px tall), on a background it reads on. If the brand kit says has_logo false, write the brand name as a small wordmark instead.
- The image (when there is one) is `{{PHOTO}}`, used as `<img src="{{PHOTO}}">` with `object-fit: cover` and an `object-position` on the subject, or as a CSS `background-image: url({{PHOTO}})`. You may crop it into any shape (full bleed, half, circle, rounded card, tilted frame), fade it into the ground with a gradient, or put it behind text with a dark overlay strong enough for legibility.

## Variety

Pick a layout that suits the angle, and do not repeat the layouts listed as already used for this brand. Ideas, not a menu: giant headline poster; split screen photo/text; full-bleed photo with gradient and bottom text; big number or stat as hero; offer ticket or coupon with dashed edge; price or value stack with strike-through anchor; before/after or old way/new way two columns; checklist on a card; mock notification, chat bubble or missed-call alert (built in HTML, no real app logos); calendar or schedule motif; review or testimonial card (only real reviews from the brand kit); question hook with answer; "3 signs you need..." numbered list; sticky note or hand-highlighted words; badge or stamp; timeline of steps. Combine devices freely: pills, chips, underlines, highlight marks, arrows drawn with CSS borders or inline SVG, rounded panels, subtle grid or dot patterns, glows, shadows, rotated elements.

## Typography and copy on the card

- One clear hierarchy: a dominant headline (usually 64 to 130 px, 800 or 900 weight, tight line-height around 1.0 to 1.1), an optional short support line (28 to 40 px), an optional device (list, stat, offer), and a CTA (a pill or button shape, 28 to 36 px text).
- Minimum text size 24 px. Keep the total words on the card low: a headline of up to about 10 words, support up to about 25 words, list items up to about 5 words each, at most 4 items.
- Highlight the payoff words of the headline with the accent colour, a highlight bar or an underline.
- Use the brand's default CTA text for the button unless the stage calls for something softer.
- All words are real HTML text. Never put text inside images.

## Technical rules

- `html`: only the inner content of `.canvas`. Allowed elements: div, span, p, h1 to h6, strong, em, b, i, br, ul, ol, li, img, svg and its shapes (path, circle, rect, line, polyline, polygon, g, defs, linearGradient, radialGradient, stop; no svg <text>). Use classes and put styling in `css`; short inline style attributes are fine.
- `css`: plain CSS for your classes, scoped under `.canvas`. No @import, no @font-face, no external url(), no animations, no :hover. `position: absolute` children need `.canvas` as their containing block (it already has `position: relative`).
- No scripts, event handlers, links, forms, iframes or external resources. The only URLs allowed are `{{LOGO}}`, `{{PHOTO}}` and, only when the request gives a background photo, `{{BG}}`.
- Set `layout_name` to a 2 to 5 word name for the layout you chose (for example "split photo stat", "offer ticket", "notification mock").
- Set `image_shape` to the aspect the image is shown at in your design: "square", "tall" or "wide" ("none" when there is no image). A new AI image is generated at that shape.

# The image

There are three photo sources. The request names one.

**brand**: the brand's own photos, uploaded by people, are attached before the request with their 0-based index. Choose the photo whose subject best carries this ad's specific object and set brand_image_index to it. Write a short description of the chosen photo in photo_prompt and set visual_type "photo". Never describe or promise anything the photo doesn't show.

**ai**: a new image is generated by an image model from your photo_prompt, at your image_shape. Set brand_image_index -1. Pick the visual_type the request asks for, or the one that carries the ad best:
- "photo": a candid, photorealistic, editorial photo of the specific object in the brand's real world. One clear subject, natural or motivated light, shallow depth of field.
- "object": a single glossy 3D icon or object render that stands for the ad's idea, such as a calendar with one day circled, a phone with a missed-call glow, a clipboard with ticks, a stopwatch, a price tag or a shield. Soft studio lighting, gentle shadow, in the brand's colours.
- "illustration": a clean flat or semi-flat vector-style illustration of one scene or object, in the brand's colours.
Write photo_prompt as a short brief for the image model: the subject, the style, the lighting, the composition for where it sits in your layout, and the brand colours by hex. Choose a background that blends with the part of the design it sits on. The image must contain no text, letters, numbers, logos, brand names, signage or screen UI: a calendar shows blank squares with one highlighted day, a phone screen shows only a glowing shape. Never show results the brand can't back.

**none** (only when no image is available at all): brand_image_index -1, visual_type "n/a", empty photo_prompt, image_shape "none", and build the visual asset from a large CSS or inline-SVG illustration of the specific object instead of `{{PHOTO}}`.
