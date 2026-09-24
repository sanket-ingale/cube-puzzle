/**
 * Motion shared between the 3D and 2D views, outside React: these change every frame, and
 * updating React state that often would re-render the whole app.
 */

/**
 * The angle of the layer the 3D view is turning right now: a move animating, a layer held by a
 * drag, or one springing back. Radians about the layer's positive axis, exactly as drawn in 3D.
 * `id` is the move's or grab's id, so the 2D view only follows motion for what it's showing.
 */
export const layerMotion = {
  id: -1,
  angle: 0,
};

/**
 * The angle a drag has turned its layer to, written on every pointer move by whichever view is
 * being dragged. The 3D animator applies it (and publishes it as layerMotion).
 */
export const liveDrag = {
  angle: 0,
  /** Set when the finger lets go short of a turn: the layer eases back to rest. */
  springBack: false,
};
