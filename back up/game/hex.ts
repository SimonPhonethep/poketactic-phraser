export const HEX_SIZE = 24;
export const COLS = 8;
export const ROWS = 8;
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
export const ROW_SPACING = HEX_SIZE * 1.5;
export function hexPosition(row: number, col: number) {
  return { x: 90 + col * HEX_WIDTH + (row % 2) * (HEX_WIDTH / 2), y: 166 + row * ROW_SPACING };
}
export function nearestFriendlyHex(x: number, y: number) {
  let nearest = { row: 4, col: 0, distance: Infinity };
  for (let row = 4; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const p = hexPosition(row, col);
      const distance = Math.hypot(x - p.x, y - p.y);
      if (distance < nearest.distance) nearest = { row, col, distance };
    }
  }
  return nearest;
}
