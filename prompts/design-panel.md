# The design (headline + diagram card)

The app draws this card itself, the same way every time, in the house reference style: logo top-left, offer pill top-right, a big centred headline of 3 lines whose last line is in the theme's accent colour, one short line under it, one diagram panel, an orange pill button with an arrow, a short note, and a footer with the logo, website, email and the trust line. You do not write any layout. Return `html` and `css` as empty strings. You decide the words, the theme and the diagram, and they decide whether the ad stops the scroll.

## What you decide

### 1. The headline (`headline_lines`, `accent_words`)
- 2 to 4 lines, about 5 to 10 words in all. Break at natural phrase boundaries. With the brand font keep lines to about 9 to 18 characters; with the condensed font lines can be up to about 24.
- End on the twist, the pain or the outcome (for example "Build shipped. / GoHighLevel / edits still yours?" or "New niche. / No GoHighLevel snapshot?").
- `accent_words`: 1 to 4 consecutive payoff words, shown in the accent colour. Usually the end ("snapshot?", "queue full?"), but they can sit anywhere ("without the hiring headache", "Snapshot-ready"). The app may re-break lines that are too long.
- When the request gives a hook, use its words exactly; you only choose the line breaks.

### 2. The line under it (`subhead`)
- One or two very short sentences, at most about 12 words, that name the pain plainly and then the fix ("Forward the change requests. We make them under your brand."). When the request gives a body line, return it word for word.

### 3. The diagram (`panel`) and the ground (`theme`)
- The diagram proves the headline in one glance: the pain and the fix side by side, a before and after, or the steps you take. Ordinary, specific details (a weekday, a time, a step name), never a list of features.
- When the request gives a diagram chosen by the person, return it exactly as given.

{{PANEL_GUIDE}}

### 4. The rest
- `layout_name` "panel <type>", `image_shape` "none", `photo_prompt` empty, `visual_type` "n/a", `brand_image_index` -1, `hook` the headline as one line.
- The offer pill, button, note and trust line are added by the app from the brand kit, word for word. Never put them, ratings or review scores ("5/5", "★", "verified reviews") anywhere in your fields.

## What makes it work
- One idea per card: the headline asks it, the line under it answers it, the diagram shows it.
- Short words everywhere: the card is read in under two seconds.
- Vary the diagram type and the theme across a batch.
