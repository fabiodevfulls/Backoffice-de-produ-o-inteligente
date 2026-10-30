export type PointerPosition = { x: number; y: number };

export function displaceFromPointer(
  point: PointerPosition,
  pointer: PointerPosition | null,
  radius: number,
  strength: number,
): PointerPosition {
  if (!pointer || radius <= 0 || strength <= 0) return point;

  let dx = point.x - pointer.x;
  let dy = point.y - pointer.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return point;
  if (distance < 0.001) {
    dx = 1;
    dy = 0;
  }

  const directionLength = distance < 0.001 ? 1 : distance;
  const displacement = (1 - distance / radius) * strength;
  return {
    x: point.x + (dx / directionLength) * displacement,
    y: point.y + (dy / directionLength) * displacement,
  };
}
