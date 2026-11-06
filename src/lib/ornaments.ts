/** The year a decoration joined the tree until someone says otherwise. */
export const DEFAULT_YEAR = 2016;
export const MIN_YEAR = 1900;
export const MAX_DESCRIPTION = 500;

export type Ornament = {
  /** What it is called on its bookmark and in its story. */
  name: string;
  /** Its glass colour, for the bookmark's ribbon and the placeholder before its picture is taken. */
  color: string;
  /** Its story until someone writes their own. */
  description: string;
  /** It clips onto a branch rather than hanging on a string. */
  clipped?: boolean;
};

/** Every decoration on the fir, keyed by its id in `BAUBLES`. */
export const ORNAMENTS: Record<string, Ornament> = {
  'lime-jj': {
    name: 'J+J bauble',
    color: '#9cc44a',
    description:
      'Satin lime glass dabbed by hand with silver glitter: "<2" on one side, "J+J" on the other, and little glitter snowflakes all the way round.',
  },
  'burgundy-swirls': {
    name: 'Burgundy swirls bauble',
    color: '#8c2338',
    description:
      'Matte wine-red glass with thin white glitter lines falling in pairs from the cap, twisting harder towards the bottom until they cross into a lattice.',
  },
  'grey-streaks': {
    name: 'Silver streaks bauble',
    color: '#8a9099',
    description:
      'Matte grey glass ringed with broken strokes of silver glitter, and tiny pearls stacked into little triangles along some of them.',
  },
  gold: {
    name: 'Glass songbird',
    color: '#c9a961',
    description:
      'A frosted glass songbird gripping a little brown branch, tail up, as if it had just landed on the fir to sing.',
  },
  'copper-winter': {
    name: 'Copper winter bauble',
    color: '#c4602d',
    description:
      'Glossy burnt-orange glass deepening to red underneath, with a winter scene in silver glitter: four lone firs on a snowy hill while the snow keeps falling.',
  },
  'cream-stripes': {
    clipped: true,
    name: 'Emerald glass swan',
    color: '#1f7a55',
    description:
      'A clip-on swan of emerald glass with a long curved neck and a soft feather tail that ruffles whenever the branches move.',
  },
  'teal-flakes': {
    name: 'Frosted glass heart',
    color: '#7fb3ad',
    description:
      'A puffy heart of white satin glass with a pearly sheen, and on each face a grey snowflake of eight fir sprigs flecked with glitter.',
  },
  'pink-bands': {
    clipped: true,
    name: 'Golden glass songbird',
    color: '#d9a63a',
    description:
      'A clip-on songbird of golden glass with a fluffy feather tail, perched low on the branches where it can watch the presents.',
  },
  'navy-meridians': {
    name: 'Plum glitter snowflake',
    color: '#7d3f72',
    description:
      'Six faceted arms coated in plum glitter, ridged like little roofs so they catch the light, hanging on a mauve cord.',
  },
  'red-stars': {
    clipped: true,
    name: 'Ruby glass songbird',
    color: '#b3203a',
    description:
      'A clip-on songbird of deep ruby glass with a feather tail, the brightest red on the whole tree.',
  },
};
