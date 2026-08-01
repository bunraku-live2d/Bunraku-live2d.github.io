# Deploying this page

Fully static: no build step, no server-side code, no external requests. Copy the directory to any web
root and it works.

    rsync -a --delete ./ user@host:/var/www/bunraku/

Or as a subdirectory (`https://example.com/bunraku/`) — every path in the page is relative, so no base
href is needed.

## What it must serve correctly

| type | extension | note |
|---|---|---|
| video | `.mp4` | must be served as `video/mp4` with **range requests enabled**, or seeking the sliders will not work |
| image | `.webp` | most servers already know this; if link previews or tiles come back blank, add the MIME type |
| script/data | `.js` | `data/manifest.js` is a JS file, not JSON — it assigns a global, because the page also has to work from `file://` |

nginx, Apache and every CDN handle ranges by default. If you put it behind something that strips
`Accept-Ranges`, playback still works but scrubbing will not.

## Caching

Content is immutable per deploy except `index.html`, `assets/*` and `data/manifest.js`. A safe policy:

    location ~* \.(mp4|webp|jpg)$ { add_header Cache-Control "public, max-age=31536000, immutable"; }
    location ~* \.(html|js|css)$  { add_header Cache-Control "public, max-age=300"; }

## Live site

    https://bunraku-live2d.github.io/    (GitHub Pages, served from the repo root on `main`)

## Canonical links

    paper   https://arxiv.org/abs/2607.27348
    code    https://github.com/SparcAI-Inc/Bunraku

Both appear in the hero and again in the footer. They open in a new tab with `rel="noopener"`.

## Before going live

* `assets/og.jpg` is the link-preview image. `og:image`, `twitter:image`, `og:url` and the canonical link
  are **absolute** against `https://bunraku-live2d.github.io`. If the site ever moves, update those four.
* `.nojekyll` is present. Without it GitHub Pages runs the tree through Jekyll, which ignores paths
  beginning with `_` and adds build latency for no benefit here.
* There is no analytics, no font CDN, no third-party request of any kind. Adding one is a deliberate act.
* The page is ~42 MB, almost all of it video. Serving it behind a CDN is worthwhile.

## Size

    loops/    23 MB   276 animation clips (the animation itself)
    layers/   14 MB   the Stage-1 exploded-stack and peel cases
    track/    7.8 MB  the cursor-tracking grids
    gallery/  1.7 MB  every character at rest and posed
    the rest  <2 MB
