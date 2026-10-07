const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const ALPHABET = `${LETTERS}${DIGITS}`;

function randomIndex(max: number): number {
  const values = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  do {
    crypto.getRandomValues(values);
  } while ((values[0] ?? 0) >= limit);
  return (values[0] ?? 0) % max;
}

/** 16 characters, unambiguous alphabet, always containing a letter and a digit (meets the shared password policy). */
export function generateTemporaryPassword(length = 16): string {
  const chars = Array.from({ length }, () => ALPHABET.charAt(randomIndex(ALPHABET.length)));
  chars[0] = LETTERS.charAt(randomIndex(LETTERS.length));
  chars[1] = DIGITS.charAt(randomIndex(DIGITS.length));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  return chars.join('');
}
