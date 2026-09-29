// Lessons and classes are logged, but "heard" measures non-teaching encounters.
export function countsAsHeard(occasion) {
  return !!occasion && occasion.kind !== 'lesson' && occasion.kind !== 'class';
}
