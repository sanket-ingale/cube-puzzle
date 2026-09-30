import type { FaceletColor } from '../cube/facelets';
import type { Algorithm, Step } from './lbl';
import type { LessonId, Rung } from './learn';

/** Colour names for the solved-face letters stickers are recorded with. */
const NAMES: Record<FaceletColor, string> = { U: 'white', D: 'yellow', F: 'green', B: 'blue', R: 'red', L: 'orange' };
export const colourName = (c: FaceletColor) => NAMES[c];

export interface Lesson {
  id: LessonId;
  title: string;
  /** What the stage looks like when it's done. */
  goal: string;
  /** The idea behind it, in a sentence or two. */
  idea: string;
  /** Algorithms this lesson introduces. */
  tools: Algorithm['id'][];
}

export const LESSONS: Lesson[] = [
  {
    id: 'cross',
    title: 'The white cross',
    goal: 'A white cross on the bottom, with each white edge’s other colour matching the centre next to it.',
    idea:
      'Two parts. First make a “daisy”: all four white edges up around the yellow centre, white facing up. Then take each petal down: turn the top until its other colour sits over the matching centre, and turn that face twice.',
    tools: [],
  },
  {
    id: 'corners',
    title: 'The first layer',
    goal: 'The whole bottom layer done: the white cross plus the four white corners, each matching the centres on both sides.',
    idea:
      'Find a white corner on top and turn the top until it sits right above its spot. Hold that spot at the front-right and repeat one short algorithm until the corner drops in, white side down.',
    tools: ['sexy'],
  },
  {
    id: 'middle',
    title: 'The middle layer',
    goal: 'The first two layers done: the four middle edges in place between their centres.',
    idea:
      'Find an edge on top with no yellow. Turn the top until its side colour matches the centre below it; then it either goes down to the right or down to the left, and each way has its algorithm.',
    tools: ['edgeRight', 'edgeLeft'],
  },
  {
    id: 'yellowCross',
    title: 'The yellow cross',
    goal: 'A yellow cross on top. The corners don’t matter yet.',
    idea:
      'Look at the yellow edges on top: a dot (none), an L (two side by side) or a line (two opposite). One algorithm moves you along, dot to L to line to cross, as long as the cube is held the right way.',
    tools: ['cross'],
  },
  {
    id: 'yellowEdges',
    title: 'Yellow edges lined up',
    goal: 'Each yellow edge’s side colour matches the centre below it.',
    idea:
      'Turn the top until two edges match their centres. If the two are side by side, hold them at the back and on the right; if they’re opposite, hold the cube any way. Then one algorithm swaps the others.',
    tools: ['sune'],
  },
  {
    id: 'cornerPlace',
    title: 'Yellow corners in place',
    goal: 'Every top corner in its right spot, between the three centres of its colours. Twisted is fine.',
    idea:
      'Find a corner that’s already in its spot, even if it’s twisted, and hold it at the front-right of the top. The algorithm moves the other three around; do it once or twice. If no corner is in its spot, do it once from anywhere first.',
    tools: ['niklas'],
  },
  {
    id: 'cornerTwist',
    title: 'Twist the last corners',
    goal: 'A solved cube.',
    idea:
      'Hold a corner that needs twisting at the front-right of the top and repeat an algorithm until its yellow faces up. The lower layers will look scrambled: that’s expected. Keep holding the cube the same way, turn only the top to bring the next corner in, and everything comes back at the end.',
    tools: ['twist'],
  },
];

export const lessonFor = (id: LessonId) => LESSONS.find((l) => l.id === id)!;

export const ALGORITHM_INFO: Record<Algorithm['id'], { name: string; what: string }> = {
  sexy: { name: 'The corner algorithm', what: 'Lifts the front-right bottom corner out and puts it back, twisted. Repeat it until the corner sits right.' },
  edgeRight: { name: 'Edge down to the right', what: 'Sends the edge at the front of the top down into the middle, on the right.' },
  edgeLeft: { name: 'Edge down to the left', what: 'Sends the edge on the right of the top down into the middle, towards the front.' },
  cross: { name: 'The cross algorithm', what: 'Flips top edges so more of them show yellow.' },
  sune: { name: 'The edge swap', what: 'Swaps top edges around while keeping the yellow cross.' },
  niklas: { name: 'The corner cycle', what: 'Moves three top corners around, leaving the front-right one where it is.' },
  twist: { name: 'The twist', what: 'Twists the front-right top corner. It mixes up the bottom for a while; repeating it puts everything back.' },
};

const pieceWords = (colours: FaceletColor[]) => colours.map(colourName).join('-');
const others = (step: Step) => step.colours.filter((c) => c !== 'U').map(colourName);

export interface Help {
  /** What to look at, always shown once the rung allows. */
  piece: string;
  where: string;
  how: string;
}

/** The words for each rung of help on a step. */
export function helpFor(step: Step): Help {
  const [a, b] = others(step);
  switch (step.kind) {
    case 'petal':
      return {
        piece: `Work on the white-${a} edge (glowing).`,
        where: 'Bring it up beside the yellow centre, white side up (its spot is outlined). If a petal is already there, turn the top first so you don’t knock it off.',
        how: 'These moves do it:',
      };
    case 'turnDown':
      return {
        piece: `Take the white-${a} petal.`,
        where: `Turn the top until its ${a} side sits over the ${a} centre. Then turn that face twice, and it lands in the cross.`,
        how: 'Holding that face on the left:',
      };
    case 'corner':
      return {
        piece: `Work on the white-${a}-${b} corner.`,
        where: `Its spot is in the bottom, between the ${a} and ${b} centres. Turn the top until the corner sits right above it.`,
        how: `Hold the spot at the front-right, then do the corner algorithm ${step.times === 1 ? 'once' : `${step.times} times`}:`,
      };
    case 'cornerOut':
      return {
        piece: `The white-${a}-${b} corner is in the bottom, but not right.`,
        where: 'Take it out to the top first, then put it in properly.',
        how: 'Hold it at the front-right, and do the corner algorithm once:',
      };
    case 'edgeRight':
    case 'edgeLeft':
      return {
        piece: `Work on the ${pieceWords(step.colours)} edge.`,
        where: `It goes in the middle layer, between the ${colourName(step.colours[0])} and ${colourName(step.colours[1])} centres. Turn the top until its side colour matches the centre below it.`,
        how: step.kind === 'edgeRight' ? 'It goes down to the right:' : 'It goes down to the left:',
      };
    case 'edgeOut':
      return {
        piece: `The ${pieceWords(step.colours)} edge is in the middle layer, but in the wrong spot or flipped.`,
        where: 'Take it out to the top first, then put it back properly.',
        how: 'Hold it at the front-right, and do the right-hand edge algorithm once:',
      };
    case 'yellowCross':
      return {
        piece: 'Look at the yellow edges on top (glowing).',
        where: 'An L goes at the back-left; a line runs from left to right; a dot can be held any way.',
        how: 'Holding it like that, do the cross algorithm:',
      };
    case 'yellowEdges':
      return {
        piece: 'Turn the top until two edges match the centres below them.',
        where: 'Side by side? Hold them at the back and on the right. Opposite? Hold the cube any way.',
        how: 'Then the edge swap, and a turn of the top if that finishes it:',
      };
    case 'cornerPlace':
      return {
        piece: 'Find a top corner that’s in its spot, between the centres of its three colours. Twisted is fine.',
        where: 'Hold it at the front-right of the top. If none is in its spot, hold the cube any way.',
        how: `Do the corner cycle ${step.times === 1 ? 'once' : 'twice'}:`,
      };
    case 'twist':
      return {
        piece: 'This top corner needs its yellow side up (glowing).',
        where: 'Bring it to the front-right of the top by turning only the top. Keep holding the cube the same way from now on.',
        how: `Do the twist ${step.times === 1 ? 'once' : `${step.times} times`}, until yellow faces up (the bottom will look mixed up: that’s fine):`,
      };
    case 'alignTop':
      return {
        piece: 'Every corner is done.',
        where: 'One turn of the top lines everything up.',
        how: 'Finish with:',
      };
  }
}

/** The button that asks for the next rung. */
export const NEXT_RUNG_LABEL: Record<Rung, string> = {
  0: 'Which piece?',
  1: 'Where does it go?',
  2: 'How?',
  3: 'How?',
};
