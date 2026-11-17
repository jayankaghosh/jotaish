import { randomInt } from 'node:crypto';

export interface TarotCard {
  name: string;
  arcana: 'major' | 'minor';
  suit?: string;
  upright: string;
  reversed: string;
}

const MAJOR: [string, string, string][] = [
  ['The Fool', 'new beginnings, spontaneity, trust', 'recklessness, hesitation, naivety'],
  ['The Magician', 'willpower, skill, manifestation', 'manipulation, untapped talent'],
  ['The High Priestess', 'intuition, inner knowing, mystery', 'secrets, disconnected intuition'],
  ['The Empress', 'abundance, nurturing, creativity', 'dependence, creative block'],
  ['The Emperor', 'structure, authority, stability', 'rigidity, domination'],
  ['The Hierophant', 'tradition, guidance, belief', 'rebellion, new approaches'],
  ['The Lovers', 'love, union, aligned choices', 'imbalance, misalignment'],
  ['The Chariot', 'determination, victory, control', 'lack of direction, aggression'],
  ['Strength', 'courage, compassion, inner strength', 'self-doubt, low energy'],
  ['The Hermit', 'reflection, solitude, inner guidance', 'isolation, withdrawal'],
  ['Wheel of Fortune', 'cycles, destiny, turning point', 'bad luck, resisting change'],
  ['Justice', 'fairness, truth, cause and effect', 'unfairness, avoiding accountability'],
  ['The Hanged Man', 'surrender, pause, new perspective', 'stalling, resistance'],
  ['Death', 'endings, transformation, transition', 'fear of change, stagnation'],
  ['Temperance', 'balance, patience, moderation', 'excess, imbalance'],
  ['The Devil', 'attachment, temptation, shadow', 'release, breaking free'],
  ['The Tower', 'sudden change, upheaval, revelation', 'averted disaster, fear of change'],
  ['The Star', 'hope, renewal, inspiration', 'despair, lost faith'],
  ['The Moon', 'illusion, intuition, the unconscious', 'clarity returning, released fear'],
  ['The Sun', 'joy, success, vitality', 'temporary gloom, overconfidence'],
  ['Judgement', 'awakening, reckoning, calling', 'self-doubt, ignoring the call'],
  ['The World', 'completion, fulfilment, wholeness', 'loose ends, delays'],
];

const SUITS: Record<string, string> = {
  Wands: 'energy, ambition, creativity and action',
  Cups: 'emotions, love, relationships and intuition',
  Swords: 'thoughts, conflict, truth and decisions',
  Pentacles: 'money, work, the body and material security',
};

const RANKS: [string, string, string][] = [
  ['Ace', 'a fresh start', 'a delayed or blocked start'],
  ['Two', 'balance and choices', 'indecision'],
  ['Three', 'growth and collaboration', 'setbacks in growth'],
  ['Four', 'stability and rest', 'restlessness or stagnation'],
  ['Five', 'conflict and challenge', 'recovery after conflict'],
  ['Six', 'harmony and progress', 'being stuck in the past'],
  ['Seven', 'assessment and perseverance', 'lack of focus'],
  ['Eight', 'movement and mastery', 'feeling trapped'],
  ['Nine', 'near-fulfilment', 'anxiety before completion'],
  ['Ten', 'completion of a cycle', 'burden or excess'],
  ['Page', 'curiosity and messages', 'immaturity'],
  ['Knight', 'pursuit and momentum', 'haste or inertia'],
  ['Queen', 'nurturing mastery', 'insecurity'],
  ['King', 'command and leadership', 'misuse of control'],
];

export const DECK: TarotCard[] = [
  ...MAJOR.map(([name, upright, reversed]) => ({ name, arcana: 'major' as const, upright, reversed })),
  ...Object.entries(SUITS).flatMap(([suit, theme]) =>
    RANKS.map(([rank, up, rev]) => ({
      name: `${rank} of ${suit}`,
      arcana: 'minor' as const,
      suit,
      upright: `${up} in ${theme}`,
      reversed: `${rev} in ${theme}`,
    })),
  ),
];

export const SPREADS: Record<string, { label: string; positions: string[] }> = {
  single: { label: 'One card', positions: ['Guidance'] },
  three: { label: 'Past, present, future', positions: ['Past', 'Present', 'Future'] },
  relationship: { label: 'Relationship', positions: ['You', 'The other person', 'The connection', 'Challenge', 'Outcome'] },
  celtic: {
    label: 'Celtic cross',
    positions: [
      'Present situation', 'Challenge', 'Root cause', 'Recent past', 'Best outcome',
      'Near future', 'Your attitude', 'Environment', 'Hopes and fears', 'Final outcome',
    ],
  },
};

// The deck is shuffled here; when the person picks cards from the face-down
// spread, `picks` are the places they tapped (0 to 77), in order.
export function drawSpread(spread: string, picks?: number[] | null) {
  const layout = SPREADS[spread] ?? SPREADS.three;
  const deck = [...DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const valid =
    picks?.length === layout.positions.length &&
    new Set(picks).size === picks.length &&
    picks.every((n) => Number.isInteger(n) && n >= 0 && n < deck.length);
  const order = valid ? picks! : layout.positions.map((_, i) => i);
  return layout.positions.map((position, i) => {
    const card = deck[order[i]];
    const reversed = randomInt(4) === 0;
    return { position, card: card.name, arcana: card.arcana, reversed, meaning: reversed ? card.reversed : card.upright };
  });
}
