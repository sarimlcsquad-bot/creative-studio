# The card design (how the ad looks)

The card matches the house performance-card register: a dark "deep" ground (or a "light" ground), a bold uppercase headline of 2 to 3 short lines where the final payoff line is in the accent colour, a one or two sentence sub-line, then a device (a checklist of 3 to 4 short benefits, or a 3-column service grid of 6 or 9 tiles), then a pill CTA button, then the brand logo bottom-left (the renderer adds the logo; never write the brand name as a block).

Blocks you may use, in order, top to bottom:
- headline: `lines` = 2 or 3 strings. Prefix the payoff line with "accent:" (for example "accent:more jobs."). Each line at most about 22 characters; the renderer uppercases. Use a full stop at the end of a sentence, like "Stop losing leads."
- sub: `text` = one or two plain sentences, at most about 150 characters.
- checklist: `items` = 2 to 4 short benefit phrases, each at most about 32 characters, no ending punctuation.
- grid: `items` = 6 or 9 service names, each at most about 30 characters. Only use a grid with photo_layout "none".
- cta: `label` = the button text, at most about 28 characters. Use the brand's default CTA unless the stage calls for something softer.
- space: `px` = 6 to 16, a small gap between blocks.
Unused fields in a block are empty strings, empty arrays or 0.

Typical block orders:
- pain or result card with photo: headline, sub, space, checklist, space, cta
- service menu card: headline, space, grid, space, sub, space, cta (photo_layout "none")
- offer-hero: headline (offer in the accent line, for example "accent:from $497/month."), sub, space, checklist (risk reversals), space, cta

photo_layout:
- "right": photo fills the right half and fades into the ground; text column on the left. Best for a person at work.
- "bottom": photo fills the lower half and fades upward; keep the text short so it ends above the middle.
- "none": no photo; use for grid cards or text-only cards.
ground: "deep" (default, matches the examples) or "light" when the brand is clearly light-themed.
photo_focus_x / photo_focus_y: 0 to 1, where the subject's face or the key action sits in the photo (0.5 / 0.3 is a good default for a person).

# The photo

Photos are the brand's own, uploaded by people; nothing is generated. When the request says photo_source "brand", the brand's photos are attached before the request with their 0-based index. Choose the photo whose subject best carries this ad's specific object and set brand_image_index to it. Pick photo_layout "right" when the subject sits well in a tall crop of the right half, "bottom" when it reads as a wide strip across the lower half. Set photo_focus_x and photo_focus_y to where the subject's face or key action is (0 to 1 from the left and top). Write a short description of the chosen photo in photo_prompt. Never describe or promise anything the photo doesn't show. When photo_source is "none", use photo_layout "none", brand_image_index -1 and an empty photo_prompt.

# The ad copy (for the Meta ad fields)

- primary_text: the house emoji format. Line 1: a hook of at most 40 characters starting with one emoji. Then 1 or 2 short contrast lines. Then an identity line ("For <who> who <what>."). Then 3 to 5 bullets, each starting with an emoji. Close with "You keep X. We handle Y." when the brand is a service. Use line breaks. Never write "This is for you".
- headline: at most 27 characters.
- description: at most 30 characters.
- cta_button: one of BOOK_NOW, LEARN_MORE, SIGN_UP, GET_QUOTE, CONTACT_US, SHOP_NOW, SUBSCRIBE, GET_OFFER, APPLY_NOW.

# Output

Return only the JSON object. Fill concept.rationale with one or two sentences on why this stage, person and specific object (Pre-Sold) or this value-equation term and stack (Hormozi). List anything that needs the business to confirm (an unverified price, a guarantee) in compliance_notes; otherwise return an empty array.
