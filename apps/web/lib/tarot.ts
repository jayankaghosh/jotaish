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

// Card of the day: one of the Major Arcana, the same all day for a person.
export function dailyCard(seed: string, date = new Date()) {
  const key = `${seed}:${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const index = h % MAJORS.length;
  return { index, card: MAJORS[index] };
}
