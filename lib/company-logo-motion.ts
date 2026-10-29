export const COMPANY_LOGO_DEMO_KEY = "cinegenius:home-company-logo-demo:v1";

export function isLogoDragClick(detail: number, blockedUntil: number, now: number) {
  return detail > 0 && now < blockedUntil;
}

export function logoGestureAxis(dx: number, dy: number, pointerType: string): "pending" | "horizontal" | "vertical" {
  const threshold = pointerType === "mouse" ? 8 : 12;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return "pending";
  if (Math.abs(dx) > Math.abs(dy) * 1.35) return "horizontal";
  // Ambiguous diagonal intent keeps scrolling available rather than becoming
  // a delayed spin or an accidental click on release.
  return "vertical";
}

export function logoSpinPlan(angle: number, velocity: number, direction: number) {
  const speed = Math.min(1.6, Math.max(-1.6, velocity));
  const sign = Math.abs(speed) > 0.04 ? Math.sign(speed) : Math.sign(direction) || 1;
  const turns = Math.abs(speed) > 0.65 ? 2 : 1;
  const boundary = sign > 0 ? Math.ceil(angle / 360) : Math.floor(angle / 360);
  return {
    target: (boundary + sign * (turns - 1)) * 360,
    duration: Math.min(2300, 1100 + Math.abs(speed) * 650),
  };
}

export function logoSpinAngle(from: number, to: number, elapsed: number, duration: number) {
  const progress = Math.max(0, Math.min(1, elapsed / duration));
  return from + (to - from) * (1 - Math.pow(1 - progress, 3));
}
