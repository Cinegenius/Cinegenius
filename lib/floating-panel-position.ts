type Bounds = { left: number; right: number; top: number; bottom: number; width: number };
type Viewport = { left: number; top: number; width: number; height: number; bottomInset?: number };

/** Keep the panel inside the usable viewport; never force a minimum height beyond it. */
export function floatingPanelPosition(anchor: Bounds, viewport: Viewport, desiredWidth: number, contentHeight: number, align: "left" | "right" = "right") {
  const margin = 12, gap = 8;
  const minLeft = viewport.left + margin;
  const maxRight = viewport.left + viewport.width - margin;
  const minTop = viewport.top + margin;
  const maxBottom = Math.max(minTop, viewport.top + viewport.height - (viewport.bottomInset ?? margin));
  const width = Math.max(0, Math.min(desiredWidth, maxRight - minLeft));
  const below = Math.max(0, maxBottom - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - minTop - gap);
  const placement = below >= Math.min(contentHeight, 320) || below >= above ? "bottom" : "top";
  const maxHeight = Math.min(maxBottom - minTop, placement === "bottom" ? below : above);
  const height = Math.min(contentHeight, maxHeight);
  const preferredLeft = align === "left" ? anchor.left : anchor.right - width;
  const preferredTop = placement === "bottom" ? anchor.bottom + gap : anchor.top - gap - height;
  return {
    left: Math.max(minLeft, Math.min(preferredLeft, maxRight - width)),
    top: Math.max(minTop, Math.min(preferredTop, maxBottom - height)),
    width, maxHeight, placement,
  };
}
