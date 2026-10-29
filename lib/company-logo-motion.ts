export const COMPANY_LOGO_DEMO_KEY = "cinegenius:home-company-logo-demo:v3";

export function isLogoDragClick(detail: number, blockedUntil: number, now: number) {
  return detail > 0 && now < blockedUntil;
}

export function logoGestureAxis(dx: number, dy: number, pointerType: string): "pending" | "horizontal" | "vertical" {
  const threshold = pointerType === "mouse" ? 4 : 6;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return "pending";
  if (Math.abs(dx) > Math.abs(dy) * 1.35) return "horizontal";
  // Ambiguous diagonal intent keeps scrolling available rather than becoming
  // a delayed spin or an accidental click on release.
  return "vertical";
}

/** A swipe across one logo width turns it once, on phones and desktops alike. */
export function logoDragAngle(origin: number, distance: number, width: number) {
  return origin + distance * 360 / Math.max(120, width);
}

/** Time-based smoothing keeps release momentum independent of event frequency. */
export function logoDragVelocity(previous: number, angleDelta: number, elapsed: number) {
  if (elapsed <= 0) return previous;
  const sample = Math.max(-4, Math.min(4, angleDelta / elapsed));
  const weight = 1 - Math.exp(-elapsed / 24);
  return Math.max(-4, Math.min(4, previous + (sample - previous) * weight));
}

export function logoSpinPlan(angle: number, velocity: number, direction: number) {
  const speed = Math.min(4, Math.max(-4, velocity));
  const sign = Math.abs(speed) > 0.04 ? Math.sign(speed) : Math.sign(direction) || 1;
  const projected = angle + sign * Math.abs(speed) * 220;
  const target = (sign > 0 ? Math.ceil(projected / 360) : Math.floor(projected / 360)) * 360;
  const distance = Math.abs(target - angle);
  return {
    target,
    // Cubic easing starts at 3 * distance / duration: faster gestures must
    // actually move faster, rather than merely run for a longer fixed turn.
    duration: Math.max(650, Math.min(2400, 3 * distance / Math.max(0.25, Math.abs(speed)))),
  };
}

export function logoSpinAngle(from: number, to: number, elapsed: number, duration: number) {
  const progress = Math.max(0, Math.min(1, elapsed / duration));
  return from + (to - from) * (1 - Math.pow(1 - progress, 3));
}
