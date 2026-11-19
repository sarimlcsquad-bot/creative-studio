import 'server-only';
import { PANEL_TYPES, THEME_NAMES, THEMES, DEVICES, SCREENS, LAYOUTS } from '../panelTemplate.js';

// The diagram panel Claude fills in for the "headline + diagram" card, shared by the builder and the generator.

const str = { type: 'string' };
export const PANEL_SCHEMA_PROPS = {
  type: { type: 'string', enum: Object.keys(PANEL_TYPES) },
  heading: str,
  left_label: str,
  right_label: str,
  rows: {
    type: 'array',
    items: { type: 'object', additionalProperties: false, required: ['a', 'b'], properties: { a: str, b: str } },
  },
  center: str,
  result: str,
  result_detail: str,
  footnote: str,
  device: { type: 'string', enum: ['none', ...DEVICES] },
  screen: { type: 'string', enum: ['none', ...Object.keys(SCREENS)] },
  layout: { type: 'string', enum: LAYOUTS },
  font: { type: 'string', enum: ['brand', 'condensed'] },
};
export const PANEL_OBJECT = { type: 'object', additionalProperties: false, required: Object.keys(PANEL_SCHEMA_PROPS), properties: PANEL_SCHEMA_PROPS };
export const THEME_ENUM = { type: 'string', enum: THEME_NAMES };

const themeLine = (solid) => Object.entries(THEMES).filter(([, t]) => !!t.solid === solid).map(([k, t]) => `${k} (${t.dark ? 'dark' : 'light'})`).join(', ');

/** How each panel type uses the fields. Every field is always returned; unused ones are empty strings or an empty rows list. */
export const PANEL_GUIDE = `## The diagram panel
One diagram under the headline makes the problem and the fix visible in one glance. Pick the type that fits this hook best, then fill only the fields it uses (others: empty string; rows: empty list when unused). Keep every text short: labels 1 to 3 words, row texts about 2 to 6 words, never a full sentence unless noted. Write in the audience's words; no prices, counts, ratings or claims that the brand kit does not support.
Types:
${Object.entries(PANEL_TYPES).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
Fields by type:
- timeline: rows 3 items {a: day or time label like "Monday" / "Friday night" / "Week 4", b: what happens, the last one is the pain and is shown crossed out}; footnote: a short kicker like "Sound familiar?".
- checklist: heading (the card title); rows 3 to 5 {a: item, b: ""}.
- steps: heading (one line, like "Your pipeline, as you actually sell"); rows 3 or 4 {a: step title, b: short detail}.
- compare_table: left_label (like "What you inherited"), right_label (like "What we do"); rows 3 {a: the problem, b: your fix}.
- compare_cards: left_label (like "Today"), right_label (like "Connected"); rows 3 {a: what goes wrong today, b: what happens with you}.
- flow: rows 2 or 3 {a: input, b: ""}; center: the hub, 2 to 4 words (like "Mapped into GoHighLevel"); result: the finished outcome, 2 to 4 words; result_detail: one short detail line.
- calendar: left_label (like "Phone tag"), right_label (like "Online booking"); result: caption under the messy week; result_detail: caption under the full week.
- path: left_label "Today", right_label (like "After we build it"); rows 3 {a: step name, 1 or 2 words, b: ""}; result: where it breaks today (like "no page, no form"); result_detail: what is true after (like "page wired to your pipeline").
- tiles: heading (like "One system. Every location."); rows 4 {a: short label, b: short detail}.
- columns: heading (small caps line, like "Their website, your name on it"); rows 3 {a: title, b: detail}.
- clock: heading (like "Tonight, 9:00 pm"); center: the time shown on the clock (like "9:00"); rows 3 {a: reminder text, b: ""}; footnote: one line under it.
- seesaw: left_label: the heavy side (your fix, like "Automation"), right_label: the light side (like "A new hire"); rows 3 {a: what the heavy side does, b: ""}; center: the light side's one thing; footnote: one line under it.
- funnel: left_label "Today", right_label (like "With us"); rows 3 {a: stage names, 1 or 2 words}; result: caption for the leaky funnel; result_detail: caption for the working one.
- device: a phone, tablet or laptop (device) showing one simple app screen (screen). heading is the app title. Screens:
  - list: rows 3 to 5 {a: name, b: status}. A status like "Ready to deploy", "Covered" or "Assigned" shows as a ticked status; "New" or "Open" as a small pill; a missing thing ("no snapshot yet", "not built") as a dashed highlighted row; start a name with ~ to show it crossed out (like "~Sales call" with b "Blocked by a build").
  - calendar: heading the month ("November 2026"); center the day number circled ("26"); result the day label ("Thu, Nov 26"); rows 2 {a: the event, then the booked item}.
  - notifications: heading the date ("Monday, November 23"); center the time ("9:41"); rows 3 {a: sender, b: the message, a few words}.
  - board: left_label and right_label the two column names ("New deals", "Build queue"); rows 1 {a: the highlighted card, b: its status}.
  - roster: heading the team name; rows 3 to 5 {a: role, b: "Covered" or "Assigned"; start b with "x " for the one that loses, like "x One skill set"}; optional right_label for a crossed-out alternative box ("Hiring: job post"), center the crossed-out thing ("GHL specialist"), result its fate ("Discarded").
  For other diagram types set device and screen to "none".
- layout: "stack" (headline, line and diagram centred under each other) for every type; "split_right" or "split_left" (text on one side, the device on the other) only for a phone or tablet device. Laptops always stack.
- font: "condensed" (a tall, narrow bold headline that fits more words per line, good for longer hooks and device cards) or "brand" (the brand's heading font).

## Less is more
Keep the card quiet so it reads in two seconds: the headline, one short line, the diagram, the button. Short rows, no extra labels, plenty of empty space. Never fill a field just because it exists.

## The theme
One ground per ad. Bold gradients: ${themeLine(false)}. Solid colours (calm, pair well with device diagrams and the condensed font): ${themeLine(true)}. Pick one that suits the mood and that is not in the list of themes already used for this brand. On solid grounds the accent words take the brand's button colour.`;

const clip = (v, n) => String(v ?? '').slice(0, n);

/** Cleans a panel from the builder or from Claude. */
export function parsePanel(p) {
  if (!p || typeof p !== 'object' || !PANEL_TYPES[p.type]) return null;
  return {
    type: p.type,
    theme: THEME_NAMES.includes(p.theme) ? p.theme : '',
    idea: clip(p.idea, 120),
    heading: clip(p.heading, 80), left_label: clip(p.left_label, 40), right_label: clip(p.right_label, 40),
    rows: (Array.isArray(p.rows) ? p.rows : []).map((r) => ({ a: clip(r?.a, 80), b: clip(r?.b, 80) })).filter((r) => r.a.trim() || r.b.trim()).slice(0, 6),
    center: clip(p.center, 60), result: clip(p.result, 60), result_detail: clip(p.result_detail, 90), footnote: clip(p.footnote, 90),
    device: DEVICES.includes(p.device) ? p.device : (p.type === 'device' ? 'phone' : 'none'),
    screen: SCREENS[p.screen] ? p.screen : (p.type === 'device' ? 'list' : 'none'),
    layout: LAYOUTS.includes(p.layout) ? p.layout : 'stack',
    font: p.font === 'condensed' ? 'condensed' : 'brand',
    // Background photo uploaded in the builder; the request parser checks it comes from this app's storage.
    bg_url: /^https?:\/\//.test(String(p.bg_url || '')) ? clip(p.bg_url, 1000) : '',
    bg_shade: Number.isFinite(+p.bg_shade) ? Math.max(0, Math.min(0.9, +p.bg_shade)) : 0.5,
  };
}
