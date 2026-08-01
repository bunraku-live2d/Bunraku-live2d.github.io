Bunraku — Turning a Single Illustration into an Editable Live2D Character
========================================================================
Interactive results page (public web build). See DEPLOY.md for hosting notes.

HOW TO VIEW

  Served from a web root, open the site.  Locally, open index.html directly in any modern browser --
  every path is relative and there is no build step, no server-side code and no external request.

  One difference between the two: dragging a slider SEEKS the animation clip, which over HTTP needs the
  server to honour range requests. Every normal web server does; see DEPLOY.md.


WHAT IS IN IT

  01  Drive a generated rig      switch between the two input groups -- A-POSE standing figures and
                                 DYNAMIC illustrations -- and drag the slider (or use the arrow keys).
                                 24 rigs x 10 axes: head turn / nod / tilt, body turn / lean / sway, gaze,
                                 eyes closing, mouth, hair sway. PLAY ALL walks all 240 animations in turn
                                 on its own; any manual input cancels it. Moving the pointer across the
                                 stage scrubs the current axis.
  02  The easy case: A-pose      twelve standing front-facing inputs looping at full amplitude. Kept as
                                 its own group because it is the in-distribution case and measurably the
                                 reliable one; hover a tile to change axis, click to open it above.
  03  Move your mouse            the character looks wherever the pointer is: head turn, head nod and
                                 both eye axes, four parameters driven at once. 6 rigs, a 13x7 grid of
                                 rendered poses each. The two A-pose entries are framed to head-and-torso
                                 -- see the note below on why.
  04  What Stage 1 produces      an EXPLODED view of the layer stack -- the sheets pushed apart in depth,
                                 turning on their own, draggable -- and below it a peel that adds one layer
                                 at a time, with the added layer shown alone including the hidden region it
                                 had to complete.
  05  Why not a human parser     the same illustration decomposed two ways and animated by the SAME
                                 frozen Stage-2 checkpoint, so every visible difference is decomposition
                                 error, not animation error -- plus why the gap is structural: See-through
                                 rests on human semantic segmentation and so has no category for layered
                                 clothing, carried objects, non-A-pose limbs, long hair/skirts or back
                                 views, whereas Stage 1 predicts an ordered stack of completed sheets that
                                 need not correspond to body parts at all.
  06  Re-texture without
      re-animating               an edited rig replaying the original predicted displacement frames.
  07  Every character            the full gallery; the pointer's position across a tile picks the pose,
                                 click to enlarge. "A-pose only"
                                 filters it down to the whole standing group, which is larger than the
                                 twelve in section 02.
  08  Where the numbers
      come from                  the two tables the page's claims rest on.


HONEST NOTES ABOUT WHAT YOU ARE LOOKING AT

  * Every frame is raw model output from the released rigs. Nothing was hand-corrected, retouched or
    cherry-picked frame by frame.

  * The frames are PRE-RENDERED rather than produced by a live renderer in the page. This is a
    limitation of file:// rather than a choice about honesty: a browser refuses to upload a local PNG
    into a WebGL texture from a file:// document, so a live renderer cannot work from an unzipped
    folder. Each frame was rendered by the same WebGL viewer used for every figure in the paper, driven
    to an absolute parameter value through the same code path. So each individual frame is exactly what
    the Live2D runtime produces at that parameter value.

  * Between frames the page CROSS-FADES. A sweep is 33 rendered frames, which over a 60-degree range is
    one frame every 1.9 degrees, and a discrete sequence steps visibly no matter how fine it is. So the
    page blends the two frames bracketing the current position by opacity. This is a display
    convenience, not a claim: the blend of two poses 1.9 degrees apart is not literally the render of
    the pose between them, though at that spacing the two are indistinguishable. If you want to see
    only true rendered output with no blending, drag the slider to a stop -- at rest the blend weight
    is 0 or 1 and you are looking at a single unmodified frame.

  * Frames are WebP, chosen over JPEG because these renders are flat shading with hard edges: at equal
    file size WebP was 1.8 dB better on our own frames, which halved the download.

  * Ten of the rig's twenty-four parameters are shipped per character. The first version shipped three,
    which made the page look as though the model could only sway a head -- ParamAngleX, the head TURN, was
    not rendered at all. We measured all 24 by RENDERED pixels (the share of frame pixels that change
    between rest and the axis extreme, averaged over three characters) and every one is strongly visible,
    from 6.5% to 18.3%, so the three-axis build was leaving the other twenty-one unused for no reason. The
    ten here span the pose axes, gaze, blink, mouth and hair; the fourteen omitted are mostly further brow
    and eye-shape controls that duplicate what these already show.

  * Frame resolution is matched to the display size rather than halved. The first build saved 460 px wide
    (explorer) and 300 px (A-pose) while the stage shows them 350-500 px wide, which on a 2x display is a
    2-4x upscale, and it looked blurry. Measured before changing it: at 900 px a frame costs 30.1 KB against
    12.0 KB at 460, i.e. 2.5x the bytes for 2x the linear resolution, because flat anime shading compresses
    well. Frames are now 528-900 px wide and the tracking grids 674-840 px, up from 420.

  * In sections 01-02 and 04-07 the frames are pre-rendered per axis, so only one axis moves at a time.
    Section 03 is different and is the honest demonstration of simultaneous drive: each of its cells is
    one render of the rig at FOUR parameters at once (head turn, head nod, both eye axes). That is not a
    compositing trick in the page -- the Live2D runtime resolves a simultaneous drive by summing the
    stored per-parameter displacement fields, so a four-parameter pose needs no extra prediction.

  * We first built section 03 driving SIX parameters at the full 30-unit range, adding a tilt coupling
    and a body lean, and it looked worse than the rest of the page: summing that many fields put the peak
    per-layer displacement at 47-77 px with a 9-18 px SPREAD between layers, and a spread that large is
    layers coming apart -- on one character a tail separated from the body with a visible gap and the
    torso ballooned. Measured across the four characters, dropping the tilt coupling and the body lean
    and going to 20 units halves the spread to 4.2-8.8 px. We report this because it is a real property
    of the model, not a rendering artefact: composing many predicted fields at full amplitude exceeds
    what the prediction supports, which is the same amplitude limitation the paper discusses.

  * Section 03 blends the FOUR grid cells surrounding the pointer, so both axes are continuous rather
    than one of them stepping. Alpha compositing is a nested interpolation, so four stacked images
    reproduce an exact bilinear sample at opacities fx, fy(1-fx)/(1-fy*fx) and fy*fx; an earlier version
    cross-faded horizontally and snapped to the nearest row, which stepped visibly every 6.67 degrees of
    nod. The displayed pose also eases toward the cursor rather than snapping to it, so a flick of the
    mouse looks like a head catching up, and leaving the panel eases back to rest.

  * Section 06 is an alpha-preserving recolour, not a prompt-driven edit. It is included because it
    isolates the mechanism: the mesh and every predicted keypose are byte-identical between the two
    rigs, so the posed columns are the original prediction replayed on new texture. The prompt-driven
    edits across ten layer categories are in the paper, not here.

  * The 12 interactive rigs are a chosen subset, and they are chosen against TWO measured bars. The
    first version of this page used only the first bar and the result visibly tore, so the second one
    matters:

      presentation  aspect ratio, interior holes from a missing or mis-ordered layer, detached fragments
      coherence     the SPREAD of per-layer mean displacement at each axis extreme, as a percentage of
                    character span. This is the tearing measure: tearing is layers separating, not layers
                    moving a lot. The 3% bound is calibrated by rendering, not assumed -- at 1.5-2.4% the
                    figure is clean, and at 4.2-9.1% the head or hair visibly detaches from the body.

    The first version picked purely by motion magnitude, which selected exactly the characters that tear:
    the top pick scored 9.1% and its head came off at AngleZ -30. 38 of the 58 eligible characters clear
    the 3% bar; the twelve here are those of them that also present well, confirmed by looking. All
    twelve stay under 2.5% at every extreme, so they are shown at the artist's FULL keypose amplitude
    with nothing scaled down.

  * The gallery in section 07 shows all 58, including the ones that tear, because it is meant to be the
    complete set. Its two posed tiles are rendered at each character's own largest coherent amplitude
    rather than one global value: 27 of the 116 posed tiles are below full amplitude for that reason, and
    the amplitude actually used is recorded per tile in data/manifest.js. Nothing is hidden -- the paper's
    failure gallery shows the torn cases deliberately.

  * Section 03 shows its A-pose entries FULL BODY, and there is a measured trade-off behind that. The
    section drives head turn, head nod and the eyes only, so how much of the picture moves depends on how
    much of the picture is head. As a share of frame pixels that change between the grid's centre cell and
    its four extremes, the dynamic illustrations -- already bust or half-body crops -- score 9.2 to 20.4%,
    while a standing full-body figure scored 3.6 to 13.9% at the old resolution. Most of that gap was
    resolution rather than framing: the grids were 420 px wide and upscaled about 2x on screen, so the head,
    which is the part that moves, was soft. At 674-760 px the same full-body framing is legible. The section
    opens on the most responsive A-pose grid of the set.

  * The A-pose group in section 02 is not cherry-picking dressed up as a category, and the difference it
    shows is measured rather than asserted. Over the 13 A-pose inputs in the corpus the coherence spread
    averages 2.20%, with a median of 2.50% and a maximum of 3.41%, and 2 of 13 sit above the 3% bound.
    Over the 45 dynamic illustrations it averages 3.00%, with a median of 2.75% and a maximum of 9.14%,
    and 18 of 45 sit above the bound. Every case in which a head or a hair mass visibly detaches is a
    dynamic illustration; the A-pose group contains none. We read that as a property of the training
    corpus rather than of the renderer -- hand-authored Live2D rigs are built from a front-facing standing
    base pose, so an A-pose input is close to what Stage 2 saw during training and a foreshortened or
    seated one is not. What it does NOT show is that the method is limited to A-pose input: the dynamic
    group animates too, and section 01 lets you compare them directly on the same axes.

  * The twelve in section 02 are the STANDING subset of that group, not the whole of it. Dropped after
    looking: one faces away from the camera, so a head turn reads as no motion at all; four are seated or
    cross-legged and so are not A-pose in the first place, and two of those four are also the only members
    of the group above the 3% bound. Two of the twelve began as text-to-image generations rather than
    existing artwork and are marked "from text" on the tile; the pipeline does not treat them differently.

  * EVERY character on the page reacts to the pointer, but with two different mechanisms, and the
    difference is worth knowing. Section 03's six rigs have a full 13x7 grid of renders, which is two
    simultaneous degrees of freedom -- 91 renders each. Everywhere else the reaction uses the 33-frame
    per-axis sweeps that are already on disk: the pointer's HORIZONTAL position maps to a position along
    the current sweep, which is one honest degree of freedom rather than two. Either way the frame under
    the pointer is a render of the rig at that parameter value, not a warp of a still, and moving off the
    element restores whatever was playing.

  * "Play all" advances after two whole periods OF THE LOOP IT IS SHOWING, not on a round number of
    seconds and not on one global constant. The pose axes are 25 rendered frames (48 after the ping-pong)
    and the expression axes 17 (32), so no single duration describes a loop; each loop's frame count and
    rate are recorded in data/manifest.js and the page reads them. Ending on a partial pass would make the
    motion appear to jump backwards at the moment of the switch.

  * The A-pose tiles in section 02 hold one video PER AXIS, switched by opacity. Assigning a new src to a
    single video element tears down its pipeline and starts a fresh load, so the tile went blank for a frame
    or two every time the axis cycled -- that was the flicker. Nothing reloads now.

  * The exploded stack in section 04 is CSS transforms over the same solo layer images the peel uses, so it
    costs no extra assets and is continuous at any explode amount and angle. Two things had to be right:
    the solo layers are saved WITH ALPHA (composited on white they hid each other completely, and the first
    attempt rendered as a pile of blank cards), and the sheets are pushed apart along Z under a perspective
    transform rather than offset in 2D -- with 21 layers on one canvas, a 2D index offset put neighbouring
    sheets 14 px apart and read as a character nudged sideways rather than a stack taken apart.

  * A small number of characters are withheld from every figure and from this page under a content
    filter, so the gallery is smaller than the corpus.

  * Section 05's third-party decomposer is used as published, with no tuning by us, and was not
    designed for rigging. The comparison is evidence that decomposition quality dominates the
    end-to-end result, not a claim about that method's own task.


LAYOUT

  index.html            the page
  assets/style.css      styling (no webfonts, no CDN)
  assets/app.js         interaction (vanilla JS, no framework, no build step)
  data/manifest.js      what to show, assigned to a global — a file:// page cannot fetch() a sibling
                        JSON because the browser gives every local file an opaque origin
  frames/<char>/        parameter sweeps as stills, 25 per pose axis and 17 per expression axis; the
                        slider and the pointer scrub these. The A-pose
                        characters live here too, cropped tightly to the figure -- a standing full-body
                        frame is 2 to 3.3 times taller than it is wide, and the explorer's own 460x660
                        frame would waste half of itself on empty canvas
  loops/<char>__<axis>.mp4  the same sweep as a small looping video; PLAYBACK uses these, because
                        swapping <img> src is at the mercy of decode timing and micro-stutters while a
                        video element runs on the browser's own pipeline. 240 loops, 48 or 32 frames at
                        30 fps, mean 125 KB.
  track/<char>/         the 13x7 cursor-tracking grid, named <col>_<row>.webp. One crop box per
                        character, shared by all 91 cells -- a per-cell box would track the motion and the
                        figure would jitter as the pointer moved
  layers/<char>/        cumulative composites (white-backed) and solo layers (alpha preserved, for the
                        exploded stack)
  compare/              ours vs the third-party decomposer, same frozen animation model
  edit/                 the before/after pair
  gallery/              every character at rest and two poses
