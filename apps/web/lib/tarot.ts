const MAJORS = [
  'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor', 'The Hierophant', 'The Lovers',
  'The Chariot', 'Strength', 'The Hermit', 'Wheel of Fortune', 'Justice', 'The Hanged Man', 'Death', 'Temperance',
  'The Devil', 'The Tower', 'The Star', 'The Moon', 'The Sun', 'Judgement', 'The World',
];
const RANKS = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King'];

// Scans of the 1909 Rider-Waite-Smith deck (public domain), in /public/tarot.
export function cardImage(card: string): string | null {
  const major = MAJORS.indexOf(card);
  if (major >= 0) return `/tarot/major-${String(major).padStart(2, '0')}.jpg`;
  const minor = card.match(/^(\w+) of (\w+)$/);
  if (!minor) return null;
  const rank = RANKS.indexOf(minor[1]);
  return rank >= 0 ? `/tarot/${minor[2].toLowerCase()}-${String(rank + 1).padStart(2, '0')}.jpg` : null;
}
