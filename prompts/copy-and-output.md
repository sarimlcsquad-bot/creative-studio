# The caption (Meta primary text)

About 85 words in six short blocks, separated by blank lines:
1. A hook line that starts with 🚀 and restates the card's headline in caption form.
2. A contrast line: the old way versus what changes (one or two sentences).
3. An identity line with proof: who this is for and the proof line from the brand kit ("For <who> who <situation>. <proof>").
4. Three bullets, each on its own line and starting with one of 📥 📝 🛠️ ✅ 👀, each a concrete thing they get or that happens.
5. The offer: 🎁 followed by the bonus text exactly as given in the brand kit (skip this block when there is no bonus).
6. "You keep X. We handle Y." in the reader's own words.

No link, no URL and no call-to-action sentence (the Meta button does that). No hashtags.

- headline (Meta headline): at most 27 characters.
- description (Meta description): at most 30 characters.
- cta_button: one of BOOK_NOW, LEARN_MORE, SIGN_UP, GET_QUOTE, CONTACT_US, SHOP_NOW, SUBSCRIBE, GET_OFFER, APPLY_NOW.

# Output

Return only the JSON object. Fill concept.rationale with one or two sentences on why this angle, moment and visual (and the method's terms: stage and person for Pre-Sold, value-equation term and stack for $100M Offers). claims_used lists each brand-kit claim you used, word for word. flags lists what the business must confirm before running (an unsupported claim in the person's own copy, a price that is not in the kit); compliance_notes repeats anything else the business must check. Both are empty arrays when nothing needs checking.
