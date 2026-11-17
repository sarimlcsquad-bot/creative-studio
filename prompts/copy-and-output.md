# The ad copy (for the Meta ad fields)

- primary_text: the house emoji format. Line 1: a hook of at most 40 characters starting with one emoji. Then 1 or 2 short contrast lines. Then an identity line ("For <who> who <what>."). Then 3 to 5 bullets, each starting with an emoji. Close with "You keep X. We handle Y." when the brand is a service. Use line breaks. Never write "This is for you".
- headline: at most 27 characters.
- description: at most 30 characters.
- cta_button: one of BOOK_NOW, LEARN_MORE, SIGN_UP, GET_QUOTE, CONTACT_US, SHOP_NOW, SUBSCRIBE, GET_OFFER, APPLY_NOW.

# Output

Return only the JSON object. Fill concept.rationale with one or two sentences on why this stage, person and specific object (Pre-Sold) or this value-equation term and stack (Hormozi). List anything that needs the business to confirm (an unverified price, a guarantee) in compliance_notes; otherwise return an empty array.
