export const BIRD_COLORS = [
  "#C6F84E",
  "#FF7A5C",
  "#F7B33D",
  "#2FD98A",
  "#22D0D0",
  "#4E9BFF",
  "#FF6FA6",
  "#98A2AD",
] as const;

export function colorForIndex(index: number): string {
  return BIRD_COLORS[index % BIRD_COLORS.length]!;
}

export function isBrightBird(color: string): boolean {
  const hex = color.replace("#", "");
  if (hex.length < 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}
