# Bunraku — project page

Live at **https://bunraku-live2d.github.io/**

Interactive results page for *Bunraku: Turning a Single Illustration into an Editable Live2D Character*.

- Paper: https://arxiv.org/abs/2607.27348
- Code: https://github.com/SparcAI-Inc/Bunraku

## What this repository is

A fully static site: no build step, no server-side code, and no external request of any kind — no font CDN,
no analytics. `index.html` plus `assets/`, `data/manifest.js` and the media directories. See `DEPLOY.md`
for hosting notes, and `README.txt` for what each section shows and how the frames were produced.

One hosting requirement worth knowing: the sliders **seek** the animation clips, so the server must honour
HTTP range requests. GitHub Pages does.

## Contents

| path | what |
| --- | --- |
| `loops/` | 276 animation clips — 30 rigs across 10 parameter axes |
| `layers/` | Stage-1 layer stacks for 14 characters (exploded view + peel) |
| `track/` | cursor-tracking grids, 13×7 rendered poses per rig |
| `cmploops/` | ours vs. See-through, animated, same frozen Stage-2 checkpoint |
| `galloops/` | one looping clip per gallery character |
| `gallery/`, `compare/`, `edit/`, `frames/` | stills |

Every frame is raw model output from the generated rigs, rendered by the same viewer used for the paper's
figures. Source illustrations are used for research demonstration; rights remain with their creators.
