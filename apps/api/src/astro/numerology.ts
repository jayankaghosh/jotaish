const MASTER = new Set([11, 22, 33]);

function reduce(n: number, keepMaster = true): number {
  while (n > 9 && !(keepMaster && MASTER.has(n))) {
    n = String(n).split('').reduce((s, d) => s + Number(d), 0);
  }
  return n;
}

const pythagorean = (ch: string) => ((ch.charCodeAt(0) - 65) % 9) + 1;

// Chaldean values, the system most Indian numerologists use for names.
const CHALDEAN: Record<string, number> = {
  A: 1, I: 1, J: 1, Q: 1, Y: 1, B: 2, K: 2, R: 2, C: 3, G: 3, L: 3, S: 3,
  D: 4, M: 4, T: 4, E: 5, H: 5, N: 5, X: 5, U: 6, V: 6, W: 6, O: 7, Z: 7, F: 8, P: 8,
};

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

const PLANETS = ['', 'Sun', 'Moon', 'Jupiter', 'Rahu', 'Mercury', 'Venus', 'Ketu', 'Saturn', 'Mars'];

export function computeNumerology(fullName: string, birthDate: string, today = new Date()) {
  const letters = fullName.toUpperCase().replace(/[^A-Z]/g, '').split('');
  const [y, m, d] = birthDate.split('-').map(Number);
  const sum = (arr: string[], fn: (c: string) => number) => arr.reduce((s, c) => s + fn(c), 0);

  const lifePath = reduce(reduce(y) + reduce(m) + reduce(d));
  const mulank = reduce(d, false);
  const bhagyank = reduce(`${y}${m}${d}`.split('').reduce((s, c) => s + Number(c), 0), false);
  const personalYear = reduce(reduce(today.getFullYear()) + reduce(m) + reduce(d), false);

  return {
    fullName,
    birthDate,
    lifePath,
    expression: reduce(sum(letters, pythagorean)),
    soulUrge: reduce(sum(letters.filter((c) => VOWELS.has(c)), pythagorean)),
    personality: reduce(sum(letters.filter((c) => !VOWELS.has(c)), pythagorean)),
    birthday: reduce(d),
    personalYear,
    personalYearFor: today.getFullYear(),
    chaldeanNameNumber: reduce(sum(letters, (c) => CHALDEAN[c] ?? 0), false),
    chaldeanCompound: sum(letters, (c) => CHALDEAN[c] ?? 0),
    mulank,
    mulankPlanet: PLANETS[mulank],
    bhagyank,
    bhagyankPlanet: PLANETS[bhagyank],
  };
}
