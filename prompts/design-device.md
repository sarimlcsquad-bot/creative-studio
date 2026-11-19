# The design (device card)

The app lays this card out itself, on a fixed professional grid: logo top-left, offer pill top-right, the headline across the full width, then a column with the body line, proof line, button and note beside (or above) one hero visual, and the footer at the bottom. You do not write the layout. You make the design decisions that the layout shows, and they decide whether the ad looks premium or generic. Return `html` and `css` as empty strings.

## What you decide

### 1. The headline (`headline_lines`, `accent_words`)

- The headline is the hook, split into 2 or 3 lines (`headline_lines`), at most about 9 words in all. Break at natural phrase boundaries, never mid-phrase, and keep the lines close in length: each line about 10 to 18 characters is ideal, never over 22. Shorter lines mean a bigger, bolder headline.
- `accent_words`: 1 to 3 consecutive payoff words that appear exactly in the headline (the outcome, the pain, or the twist). They are shown in the brand accent colour. Never accent a whole line or filler words.
- When the request gives a hook, use its words exactly; you only choose the line breaks and the accent words.

### 2. The body line (`subhead`)

- One or two short sentences under the headline, at most about 22 words, that carry the hook to the fix or offer in plain words. When the request gives a body line, return it word for word.
- It adds information the headline does not have. No repeating the headline, no hype, no ratings, no numbers the brand kit does not support.

### 3. The hero visual

- **A device** (`device`: phone, tablet or laptop) whose screen shows the moment the headline's problem gets fixed: `screen.app_title` (2 or 3 words, like "Inbox", "Today's jobs", "Build tracker") and `screen.elements`, 3 to 5 lines, top to bottom. Write each line as "Label: detail" with a short label (2 to 4 words) and a short detail (under about 40 characters), for example "Missed call: Sam, 7:40pm" then "Texted back: in 4 seconds" then "Booked: Tue 9:00am". The first line is the key moment and gets highlighted. Words like missed, lost or overdue get a red mark; booked, done, sent, built, signed or paid get a green check; use them so the screen tells the before-and-after story at a glance. Generic first names, 555 numbers and times only; no prices, counts, statistics, ratings, faces or real app names.
- Phones and tablets sit beside the column (`device_side` "right" or "left"); laptops sit below it (`device_side` "below").
- **An object**, when the request says the visual is an object (it must be specific to the hook, never a generic box, package or abstract shape): it is made as an image with a see-through background (or, when the request says no image is generated, drawn by you in `object_svg`). Keep `device` "phone" and `screen` empty for objects.
- `object_svg`: only for an object with no generated image. One `<svg viewBox="0 0 400 400">` drawing of the object: bold, simple flat shapes (rect, circle, path, polygon), centred, the brand colours plus white and neutral greys, a soft ellipse shadow under it. No text, no gradients over half the shape, no strokes thinner than 4. Otherwise an empty string.

### 4. The background (`background_hex`)

- One flat colour filling the card, in the brand's family: a deep shade of a brand colour (near-black navy, charcoal, deep green…) or a very light warm tint (off-white, cream, pale grey). Follow the ground the request asks for (dark or light).
- The accent colour must stand out on it strongly, and the headline text (white on dark, near-black on light) must read easily. Never a saturated mid-tone background.
- When the person picked a background in the builder, use it.

### 5. The rest

- `device_side`, `story_9x16_note` (one sentence on how the card adapts to 9:16; the app handles the layout), `layout_name` "device <phone|tablet|laptop|object> <right|left|below>", `image_shape` "none", `photo_prompt` empty, `visual_type` "n/a", `brand_image_index` -1, `hook` the headline as one line.
- The offer pill, proof line, button and note under it are added by the app from the brand kit, word for word. Never put them, ratings or review scores ("5/5", "★", "verified reviews") anywhere in your fields.

## What makes it look professional

- One idea per card: the headline states it, the body line explains it, the visual proves it.
- Contrast and restraint: one accent colour used only on the accent words, the button and small marks.
- A screen that tells a story in one glance (problem row, then the fix, then the result), not a list of features.
- Real, specific, ordinary details (a time, a first name, a job type) instead of vague claims.
