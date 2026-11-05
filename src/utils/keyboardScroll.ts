// All positions are measured in window coordinates, after the keyboard/layout settles.
export function keyboardScrollTarget({ offset, fieldTop, fieldBottom, viewportTop, viewportBottom, keyboardTop }: {
  offset: number; fieldTop: number; fieldBottom: number;
  viewportTop: number; viewportBottom: number; keyboardTop: number;
}) {
  const top = viewportTop + 16;
  const bottom = Math.min(viewportBottom, keyboardTop) - 16;
  if (bottom <= top) return offset;
  if (fieldBottom > bottom) return Math.max(0, offset + fieldBottom - bottom);
  if (fieldTop < top) return Math.max(0, offset + fieldTop - top);
  return offset;
}
