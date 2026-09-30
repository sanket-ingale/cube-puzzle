# 3x3 Cube Puzzle

A 3D 3x3 cube puzzle in React, TypeScript and React Three Fiber. This covers phases 1–8 of the plan: a rendered cube with orbit controls, a pure and tested cube model, animated turns, the core game loop (scramble, undo/redo, solve detection, animated reset), drag-to-turn, an intersecting-circles 2D view that shares the same state, a timer with solve history and stats, and extras: hints, an automatic solver, solve replays and competition inspection.

## Getting started

```bash
npm install
npm run dev
```

Other scripts: `npm test` runs the model tests, `npm run build` type-checks and builds for production.

## Controls

Everything is explained in the in-app help (the ? button, or the ? key), which opens on the first visit. The gear opens Settings.

- The dock at the bottom holds the actions: Scramble in the middle, undo, redo and reset beside it, and hint, solve and guided solve in a tray (behind one button on phones). The 2D view switch sits top right, next to help and settings. With a mouse each icon has a tooltip with its shortcut.
- Turn layers by dragging stickers in either view (both views move together, including part-way through a turn), or with the turn keys. On the 3D cube a dragged layer follows your finger and settles on the nearest quarter turn when you let go; a quick flick completes the turn.
- Guided solve walks a first-timer through a solve one move at a time, with an arrow on the layer to turn, the matching circle marked in the 2D view, and the move in words. A different move gets a new route from wherever the cube is. Guided solves are saved with the hint tag.
- The status card shows the timer (with the 15-second inspection toggle), the cube's state, a collapsible scramble and move list, and your stats. New personal bests (single, Ao5, Ao12) are celebrated with a message, confetti and a chime.
- Settings: sounds (synthesised with Web Audio), vibration where the device supports it, sticker letters and high-contrast colours for colour-blind players, and the theme (Automatic follows the device, or choose Light or Dark).
- The turn keys are laid out for the corner view the cube starts in, and are named by position, never by colour, since colours move as layers turn. Q W E turn the left face's left, middle and right columns down (L, M, R'), I O P do the same on the right face (F, S, B'), and F G H turn the top, middle and bottom rows to the right (U', E, D); hold Space, or tap Reverse on a touch screen, to turn the other way. Keys are read by position, so they work on any keyboard layout. The key guide is always on screen: keys light up as they're typed, they're the buttons on touch screens, and hints and the guided solve mark the key to press. Look around by dragging the space around the cube; any turn key, Esc or the Reset view button brings the corner view back. Enter scrambles, N gives a hint, Ctrl/Cmd+Z undoes.
- Phones get a single column with the turn keys and the dock at the bottom, and the switch over the cube swaps between the 3D cube and the 2D circles. Wide screens open with the 2D view beside the cube, phones with the 3D cube.

## Look and feel

The style is called Toybox: warm paper in the light theme and a warm dark stage with a spotlight in the dark one, where the ink turns to chalk so the outlines and hard shadows still show; ink outlines on everything, and buttons that sit on a hard shadow and sink when pressed. Scramble is the one orange, labelled button; undo, redo and reset are plain keys beside it; the solver helpers share a lighter tray (one menu on phones); the view switches sit top right; help and settings are the quietest buttons of all. The typeface is Bricolage Grotesque (SIL Open Font License, bundled in `src/assets/fonts` with its licence), with tabular figures so the timer's digits don't jump.

## How it fits together

```
src/
  cube/    model.ts    cubies, applyTurn, isSolved (pure, no React or Three.js)
           moves.ts    notation: parse, format, invert, simplify, move -> turn
           scramble.ts random-move scramble generator
           drag.ts     drag geometry: hit face, drag direction, turn (pure)
           facelets.ts 54-sticker Kociemba string, sticker positions, turn permutations (pure)
           colors.ts   colour dictionary shared by 3D and 2D
  solver/  client.ts, solver.worker.ts  Kociemba two-phase solver (cubejs) in a Web Worker
           search.ts   shortest-first search for exact short hints
           facelets.ts centre-aware solver input
           assist.ts   hint and solve requests
           guide.ts    the guided solve: plans, follows the player, re-plans on detours
  circular/ layout.ts  9 layer circles and the 54 sticker crossing points
           CircularView.tsx  presentational SVG (cubeState, onMoveDispatch)
           CircularPanel.tsx connects the view to the store
           animation.ts      per-sticker paths for a turn (pure)
           cube.test.ts
  game/    store.ts    Zustand store: cube state, move queue, modes, history, undo/redo, timer, solves
           solves.ts   saved solve history (localStorage)
           stats.ts    best, averages, time formatting (pure)
           turnProgress.ts  the moving layer's angle and the live drag angle, shared outside React
           liveTurn.ts grabbing, turning and letting go of a layer by hand (both views)
           feedback.ts sounds (Web Audio) and vibration
           personalBest.ts  new-record celebrations
           useKeyboardControls.ts
  scene/   Cube.tsx    turn animator (pivot group + commit on finish)
           Cubie.tsx   one cubie: rounded body + stickers
           useDragToTurn.ts  pointer handling and camera projection for drags
  ui/      Toolbar.tsx, StatusCard.tsx, Timer.tsx  the controls
           HelpDialog.tsx, HistoryDialog.tsx, Dialog.tsx           dialogs on the native <dialog>
           SettingsDialog.tsx, GuidePanel.tsx, Celebration.tsx
           IconButton.tsx, BrandMark.tsx, uiStore.ts, prefs.ts, theme.ts, useMediaQuery.ts
  keys/    keymap.ts   turn keys <-> moves (pure, tested against the corner view)
           press.ts    one key press, typed or tapped
           TurnKeys.tsx  the on-screen keys: guide, touch buttons and hint marker
```

The model stores each cubie as an integer grid position plus stickers whose normals are world-space directions. Because stickers already point in world space, the renderer never needs per-cubie rotations.

During a turn, the cubies in the moving layer render inside a pivot group that `useFrame` rotates. When the animation reaches its final angle, the move is committed to the model and the layer re-renders at its new integer positions with no rotation. Those two frames look identical, so the hand-off is seamless and floating-point error never reaches the model.

A drag works out the face and cubie you grabbed from the hit point in the cube's own coordinates, projects that face's two directions onto the screen, and picks the one your drag follows. The layer then turns around `faceNormal × dragDirection`, which becomes an ordinary move in the queue. Orbit controls are paused from the moment you grab a sticker until you let go.

The 2D view never stores its own copy of the cube. It converts the per-cubie model into the 54-sticker Kociemba string whenever a move is committed, and sends notation back through the same `enqueue` as the keyboard. Its geometry has three families of concentric circles, one family per axis and one circle per layer. A sticker is moved by exactly two layers, so it is drawn where those two circles cross, which means a layer turn slides the 12 stickers on its circle three places along it. The face patches come out as U, F and R in the inner triangle with L, B and D outside, and tests check every one of the nine circles against the cube model.

The two views share one motion, every frame, outside React. Whatever layer the 3D view is turning (a move animating, a layer held by a finger, or one springing back) is published as an angle in `game/turnProgress.ts`, and the 2D view draws that layer's dots at exactly that angle with `layerPositionsAt`: whole quarter turns land exactly on sticker places, and anything in between follows the same arcs a completed turn uses, so holding a layer part-way or wiggling it back and forth shows identically in both views. Dragging works the same from either side: both views call the shared live-turn helper in `game/liveTurn.ts`, a 2D drag keeps the grabbed dot under the pointer along its circle (`quartersForDrag`) while the 3D layer turns with it, and letting go settles on the nearest quarter turn, completes a quick flick, or springs back. When a move commits, a layout effect clears the dots' offsets in the same frame the new colours are drawn, so nothing jumps.

The solver is Kociemba's two-phase algorithm from the `cubejs` package, running in an inline Web Worker because building its tables takes a couple of seconds (it starts warming up as soon as you scramble). Two-phase search is fast but not optimal, so depths 1 to 6 are tried first; that makes hints exact near the end of a solve, and anything further away still gets a solution of 22 moves or fewer. Slice moves move the centres, so the cube is relabelled by its current centres before being handed to the solver.

Moves that arrive during an animation are queued and play faster. The move history is updated when a move is scheduled, not when it finishes animating, so pressing Undo three times quickly undoes three different moves. While a scramble or reset is playing, the store is in a locked mode and ignores input.

## Next steps

- Later, if wanted: other cube sizes, a beginner tutorial, an online leaderboard.
