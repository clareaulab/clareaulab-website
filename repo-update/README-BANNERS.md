# Banner backsplashes + light/dark mode — drop-in update

Copy these files over the matching paths in the repo. Nothing else changes.

    backsplash-engine.js      new file, repo root
    styles.css                theme tokens prepended + funder cell tokenised
    site.js                   SITE.theme controller; nav/link colours tokenised
    site-footer.dc.html       hosts the Light / Dark / Auto control
    assets/logo.svg           re-saved with its fills as attributes (see note)
    index.html
    team.html
    news.html
    research.html
    publications.html
    contact.html

## What changed in each page

1. `<script src="./backsplash-engine.js?v=20260726"></script>` added inside `<helmet>`,
   right after the `styles.css` link.
2. The hero `<img src="assets/banners/…">` and its scrim `<div>` are replaced by
   `<canvas data-backsplash="home|team|news|research|pubs|contact">`. The engine
   paints the scrim itself, so the overlay div is gone.
3. Hero height: `clamp(300px, 44vh, 460px)` -> `clamp(380px, 56vh, 540px)`.
   The phone override in team/publications goes 200px -> 320px.
4. The blue eyebrow lines ("The people", "Lab notebook", "What we do",
   "The work") are removed. Home keeps its blue subtitle under the title.

## index.html specifically

- The dark toolbar becomes the same light sticky nav as the other five pages,
  using `assets/logo.svg` instead of the inverted `logo-bw.svg`, and
  `SITE.navItems('./')` so the Home pill shows as active.
- The dark hero gradient and the cells -> bases -> bits canvas animation are
  gone; the whole `componentDidMount` animation block is deleted. `_loadContent`
  and the photo reel are untouched.
- `body` background `#eef4f9` -> `#f2f8fc`; the `.hero-cv` rule is removed.

## assets/logo.svg

The original kept its colours in a `<style>` block inside `<defs>`, which some
tools strip. This copy sets `fill`/`stroke` as attributes on each path instead —
same `#3963af` and `#00aee6`, no draw-on animation. Visually identical once the
original's 5s animation has finished.

## No longer referenced

`assets/banners/*` is now unused. Leave the files or delete them as you like;
`publications-banner.jpg` is worth keeping if you want the fanned manuscripts
as a figure lower on that page.

## Tuning

Everything lives in `backsplash-engine.js`:

- `PAGES` — the accent hue per page.
- `compose()` `subj` — which motifs each page gets, and where.
- `PASS` / `RUNS` / `PAUSE` in `render()` — the accent bead runs the strand 5
  times, then rests ~2 minutes.
- `prefers-reduced-motion` is respected automatically.

---

# Light / Dark / Auto

## How it resolves

`styles.css` opens with two token blocks — `:root[data-theme="light"]` and
`:root[data-theme="dark"]`. Every colour in the site now reads through one of
them; there are no colour literals left in the six pages (the only `#000`s are
the reel's CSS mask stops, which are not colours).

Each page carries a tiny inline script in `<head>`, before `support.js`:

    var m = localStorage.getItem('lareau-theme') || 'auto';
    var d = m === 'dark' || (m === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light');

It runs before first paint, so there is no white flash on a dark-mode device.

`site.js` adds `SITE.theme` with `.mode` ('light' | 'dark' | 'auto'),
`.resolved`, `.set(mode)` and `.init()`. It listens for the OS preference
changing (only acts when the mode is `auto`) and for `storage` events, so two
open tabs stay in sync. `SITE.onTheme(fn)` lets a component subscribe.

The banner engine watches `data-theme` on `<html>` with its own
MutationObserver, so the drawings re-render in the dark palette no matter who
flips the attribute or in what order the scripts loaded.

## The control

Three states, not a two-way toggle, so someone who taps it once isn't left out
of sync with their phone forever. It lives in `site-footer.dc.html`, so it is
on every page automatically. `Auto` is the default. Styling is the
`.theme-switch` rules in `styles.css`.

## Two deliberate exceptions

- `--logo-card` stays `#fff` in both themes. The funder logos and the journal
  cover thumbnails are dark-on-white artwork and would disappear on a dark card.
- `.reel-frame` on Home keeps its dark backdrop in both themes — it sits behind
  letterboxed photos and already read as a dark mat in light mode.

## Adding a colour later

Don't write a literal. Add a token to both blocks in `styles.css` and use
`var(--your-token)` — inline styles in the DC templates accept `var()` exactly
like a stylesheet does, including inside SVG `stroke`/`fill` attributes.

## Dark accents

Not inverted — re-picked. `backsplash-engine.js` holds them in `THEMES.dark`:
home `#4fd8ff`, team `#45e6c4`, news `#f0b24f`, research `#ff8a70`,
publications `#7fb2ff`, contact `#a99cff`, on `#0b1728` paper with `#a9c9e2`
ink. The light set is unchanged.
