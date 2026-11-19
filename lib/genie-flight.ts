export type GeniePoint = { x: number; y: number };
export type GenieBounds = { left: number; right: number; top: number; bottom: number };
export type GenieFlight = { origin: GeniePoint; velocity: GeniePoint; startedAt: number; bounds: GenieBounds };

export const GENIE_FLIGHT_MS = 1300;
const FRICTION = 4;
const RESTITUTION = .30;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Workspace's exponential impulse, in CSS pixels/second. No timers or browser state. */
export function launchGenieFlight(origin: GeniePoint, velocity: GeniePoint, startedAt: number, bounds: GenieBounds): GenieFlight | null {
  if (![origin.x, origin.y, velocity.x, velocity.y, startedAt, ...Object.values(bounds)].every(Number.isFinite)
    || bounds.left > bounds.right || bounds.top > bounds.bottom) return null;
  let x = bounds.left === bounds.right ? 0 : velocity.x;
  let y = bounds.top === bounds.bottom ? 0 : velocity.y;
  const speed = Math.hypot(x, y);
  if (!Number.isFinite(speed) || speed < 65) return null;
  if (speed > 1600) { x *= 1600 / speed; y *= 1600 / speed; }
  return { origin: { x: clamp(origin.x, bounds.left, bounds.right), y: clamp(origin.y, bounds.top, bounds.bottom) }, velocity: { x, y }, startedAt, bounds: { ...bounds } };
}

function axis(start: number, initialVelocity: number, elapsed: number, low: number, high: number): number {
  if (low === high) return low;
  let point = clamp(start, low, high), velocity = initialVelocity, remaining = elapsed;
  for (let collision = 0; collision < 12; collision++) {
    if (remaining <= 0 || Math.abs(velocity) <= .01) return point;
    const wall = velocity > 0 ? high : low;
    const fraction = FRICTION * (wall - point) / velocity;
    if (fraction >= 0 && fraction < 1) {
      const hit = -Math.log1p(-fraction) / FRICTION;
      if (hit <= remaining) {
        point = wall;
        velocity = -velocity * Math.exp(-FRICTION * hit) * RESTITUTION;
        remaining -= hit;
        continue;
      }
    }
    return clamp(point + velocity / FRICTION * -Math.expm1(-FRICTION * remaining), low, high);
  }
  return clamp(point, low, high);
}

export function genieFlightPosition(flight: GenieFlight, at: number): GeniePoint {
  const elapsed = Number.isFinite(at) ? clamp((at - flight.startedAt) / 1000, 0, GENIE_FLIGHT_MS / 1000) : GENIE_FLIGHT_MS / 1000;
  return {
    x: axis(flight.origin.x, flight.velocity.x, elapsed, flight.bounds.left, flight.bounds.right),
    y: axis(flight.origin.y, flight.velocity.y, elapsed, flight.bounds.top, flight.bounds.bottom),
  };
}
