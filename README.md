# Creative Studio: AI Brand Kit & Creative Generator

A web app for building brand kits and generating Meta ad creatives from them. It is one Next.js app: the pages and its own backend (API routes) live together. The backend calls Claude directly, can make images with OpenAI (optional), and stores everything in Supabase. No n8n.

```
Browser  ──(password cookie)──▶  Next.js API routes  ──▶  Supabase (Postgres + image storage)
                                        ├──────────────▶  Claude API (writes each creative)
                                        └──────────────▶  OpenAI images (optional: calendars, icons, illustrations, photos)
```

The Anthropic, OpenAI and Supabase keys are only ever read on the server. The browser never sees them.

## What it does

- **Brands tab**: create and edit brand kits. Basics (name, website, industry, location, description, managing agency), audience and offer (ideal customer, services, differentiators, offer/pricing, verified proof points, guarantees, default CTA), voice and rules (tone, banned phrases, compliance notes), social links, and the kit itself: logo, five colours, heading and body fonts, brand photos, with a live preview card. **Auto-fill from website** has Claude read the brand's site and fill the empty fields.
- **Creatives tab**: every creative for every brand, with sub-tabs **All / Agency creatives / Owner creatives**, filters by brand and status, a detail view with the Meta ad copy (primary text, headline, description, button), the concept behind it, text editing, and PNG download.
- **Generate** (a step-by-step builder). It first asks who the creative is for (**Owner** or **Agency**).
  - **Random**: Setup → **Angle** (5 professional angles; pick one, ask for more, or write your own) → **Hook** (about 15 hooks for that angle; pick one or type your own) → **Content** (the words on the creative: headline, support line, bullets, extra line, button, plus the Meta ad copy, all editable) → **Assets** → **Generate**.
  - **With a prompt**: Setup with your direction → **Hook** (about 15 hooks for your prompt) → then the same Content, Assets and Generate steps.
  - Every suggestion step has a direction box ("aim at new agency owners", "shorter, questions only") and a **Suggest again** button, so Claude re-suggests with your direction.
  - **Assets**: choose **Photo + AI image** (a brand photo in the background with the AI image on top), **AI image only**, or **Photo only**. AI image ideas are suggested as text (for example "Phone showing 3 missed calls"); pick one, edit the description, or write your own. The image is made once, when the creative is generated. Photos come from the brand kit or an upload. The logo is always added.
  - Setup also has the method (**Pre-Sold** or **$100M Offers**), format (1:1, 4:5, 9:16), awareness stage, design (**Free design** or **Classic card**) and how many layouts. Going Back keeps what was already suggested.

### How a creative is made

1. The server saves a placeholder row per creative and answers at once. The app shows "Generating…" and refreshes until it is done.
2. In the background the server sends Claude the brand kit, the brand's photos and the request. Claude writes the creative with the chosen method:
   - **Pre-Sold**: Perfect Client Clone, psychographic layer, one awareness stage per ad, Totem Pole tier, Specificity Ladder, pain line / status line, don't lead with the tool.
   - **$100M Offers**: starving-crowd check, one value-equation term per ad, the stack built from what the brand actually delivers, enhancers only with a basis in the kit, MAGIC naming.
   Both keep the house rules: only claims that are in the brand kit, the emoji primary-text format, and anything unverified listed under "Check before running".
3. The image is one of three things:
   - **New AI image**: Claude writes an image brief (for example a 3D calendar with one day circled, in the brand's colours) and OpenAI generates it. The brief always forbids text, numbers and logos, because the card draws the words. The image is saved to the `creatives` bucket. If OpenAI fails, the creative is kept as a text card and the detail view says why.
   - **Brand photo**: one of the brand's uploaded photos, picked by Claude to fit the ad.
   - **No photo**: a text-only card.
4. **Design**: with **Free design** (the default), Claude art-directs each creative itself: it writes the layout as HTML and CSS for the exact canvas size (1080 x 1080, 1080 x 1350 or 1080 x 1920), using only the brand's colours, fonts, logo and the chosen image, and picks a different layout from the ones already used for that brand. Every free design has a hook as its biggest text, a visual asset (AI image or brand photo) and the logo; if Claude leaves the logo or image out, the server adds them. The HTML is cleaned of scripts and outside links, and the browser turns it into the PNG. Click **Edit text** on a free design to change any word directly on it. With **Classic card**, the browser draws the fixed performance-card template (headline, sub-line, checklist or grid, CTA pill, logo). Either way the text is real text, never painted by the image model, so it is always spelled exactly. The finished PNG is saved to storage automatically.

## Setup

You need three things: a Supabase project, an Anthropic API key, and somewhere to host the app (Vercel is the easiest).

### 1. Supabase

1. Open your project at supabase.com (yours is `https://rwdpjjnivobwhfeibbzj.supabase.co`).
2. **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, click **Run**. This creates the `brands` and `creatives` tables and two public storage buckets (`brand-assets`, `creatives`). Running it again is safe.
3. **Project Settings → API Keys**: copy the **service_role** key (or create a secret key that starts with `sb_secret_`). This is `SUPABASE_SERVICE_KEY` below. Never put it in browser code.

### 2. Anthropic API key

console.anthropic.com → **API Keys → Create Key**. Add some credit under **Billing**. This is `ANTHROPIC_API_KEY`.

### 3. Environment variables

| Variable | What it is |
|---|---|
| `SUPABASE_URL` | `https://rwdpjjnivobwhfeibbzj.supabase.co` |
| `SUPABASE_SERVICE_KEY` | the service_role / secret key from step 1 |
| `ANTHROPIC_API_KEY` | the key from step 2 |
| `APP_PASSWORD` | a password you make up; everyone who uses the app signs in with it |
| `OPENAI_API_KEY` | optional: turns on **New AI image**. From platform.openai.com → API keys. Without it the option is greyed out and brand photos still work. |
| `IMAGE_MODEL` | optional, default `gpt-image-2` |
| `IMAGE_QUALITY` | optional, default `medium` (`low` is cheaper, `high` is sharper) |
| `CLAUDE_MODEL` | optional, default `claude-opus-5-5` |
| `CLAUDE_EFFORT` | optional, default `high` (`medium` is faster and cheaper) |

`.env.example` lists them all.

### 4a. Run it on your computer

Needs Node.js 20 or newer.

```
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                     # http://localhost:3000
```

### 4b. Put it online with Vercel

1. Push this folder to a GitHub repository.
2. vercel.com → **Add New → Project** → import the repository. Framework is detected as Next.js; leave the build settings as they are.
3. Under **Environment Variables**, add the variables from step 3.
4. Click **Deploy**. Open the URL, sign in with `APP_PASSWORD`.

Generating one creative takes about one to two minutes, and runs after the request has answered. The generate route asks for up to 300 seconds (`maxDuration`). Vercel allows that with Fluid Compute, which is on by default for new projects. On another host, run it as a normal Node server (`npm run build && npm start`), which has no time limit.

## API (used by the app)

All routes need the sign-in cookie. Errors come back as `{"error": "…"}`.

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/config` | | `{ai_images}` (whether OPENAI_API_KEY is set) |
| GET | `/api/brands` | | `{brands}` |
| POST | `/api/brands` | brand object (with `id` to update) | `{brand}` |
| POST | `/api/brands/delete` | `{id}` (also deletes its creatives) | `{ok}` |
| POST | `/api/upload` | multipart `file`, `folder` | `{url}` |
| POST | `/api/analyze-website` | `{url}` | `{suggestions}` |
| GET | `/api/creatives` | `?brand_id=&source=agency\|owner&status=` | `{creatives}` |
| POST | `/api/creatives/update` | `{id, spec?, ad_copy?, concept?, rendered_url?}` | `{creative}` |
| POST | `/api/creatives/delete` | `{id}` | `{ok}` |
| POST | `/api/wizard` | `{step: angles\|hooks\|content\|assets, brand_id, method, stage, angle?, prompt?, hook?, copy?, format?, visual?, direction?, avoid?}` | `{angles}`, `{hooks}`, `{content}` or `{ideas}` |
| POST | `/api/generate` | `{brand_id, mode: random\|prompt, prompt, count 1-4, format, photo_source: ai\|brand\|none, image_style: auto\|object\|illustration\|photo, stage, method: presold\|100m\|mix, source: agency\|owner, created_by, brief?}` (brief: the angle, hook, copy, ad copy, `visual: both\|ai\|photo`, photo and image idea from the builder) | `{creatives}` (the placeholder rows) |

## Changing things

- **The methods and the design/copy rules**: `prompts/` (`00-intro.md`, `method-presold.md`, `method-100m-offers.md`, `design-free.md`, `design-classic.md`, `copy-and-output.md`). They are bundled at build time, so restart `npm run dev` or redeploy after editing.
- **Model and effort**: the `CLAUDE_MODEL` and `CLAUDE_EFFORT` variables.
- **Card look**: `lib/client/renderHtml.js` (free designs) and `lib/client/renderCard.js` (classic card).
- **Claude call**: `lib/server/claude.js`. It uses structured outputs, so Claude's answer always matches the creative schema in `lib/server/generate.js`, and server-side refusal fallbacks, so a request the safety filter declines is retried on a fallback model instead of failing.

## Cost per creative (rough)

One Claude call: a few thousand tokens in (more with brand photos attached), one to two thousand out. A New AI image adds one OpenAI image at the chosen quality. Auto-fill from website is one more Claude call. The builder adds three or four quick Claude calls (angles, hooks, content, at medium effort), plus one for each Suggest again or asset-ideas request.

## Files

```
app/                    pages (/, /login) and API routes (app/api/*)
components/             the React UI
lib/server/             Claude, Supabase, generation, auth (server only)
lib/client/             browser API calls, settings, card renderer
prompts/                Pre-Sold and $100M Offers methods, card and copy rules
supabase/schema.sql     tables and buckets
middleware.js           password protection for every page and API route
```
