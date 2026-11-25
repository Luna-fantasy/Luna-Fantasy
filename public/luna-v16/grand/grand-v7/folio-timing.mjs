// The first spread settles after the book rises into view. Each leaf then has
// its own turning interval, leaving both prints readable between turns.
export const folioTurns = [
  { start: .30, end: .45, first: 6, last: 19 },
  { start: .53, end: .68, first: 12, last: 24 },
  { start: .76, end: .91, first: 18, last: 29 },
];

export function folioSpreadAt(time) {
  const turning = folioTurns.findIndex(turn => time < turn.end);
  if (turning < 0) return { spread: folioTurns.length, fraction: 0 };
  const {start, end} = folioTurns[turning];
  return { spread: turning, fraction: Math.max(0, (time - start) / (end - start)) };
}
