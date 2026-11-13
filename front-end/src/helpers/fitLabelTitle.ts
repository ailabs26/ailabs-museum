/** Fit a title to a canvas plaque using the caller's font measurement. */
export function fitLabelTitle(title: string, measureWidth: (text: string) => number, maxWidth: number): string {
  if (measureWidth(title) <= maxWidth) return title;
  if (measureWidth('…') > maxWidth) return '';
  const characters = Array.from(title);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measureWidth(`${characters.slice(0, middle).join('')}…`) <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return `${characters.slice(0, low).join('')}…`;
}
