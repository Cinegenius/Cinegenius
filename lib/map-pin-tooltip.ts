import type { Marker } from "leaflet";

/** Use only the already-visible map projection; never fetch identities on hover. */
export function bindMapPinTooltip(marker: Marker, title: string, lines: string[]) {
  const content = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  content.append(heading);
  for (const text of [...new Set(lines.filter(Boolean))]) {
    const line = document.createElement("span");
    line.textContent = text;
    content.append(line);
  }
  marker.bindTooltip(content, {
    className: "location-map-tooltip", direction: "auto", offset: [12, 0],
    opacity: 1, interactive: true,
  });
  // The styled tooltip replaces the browser's delayed duplicate title.
  const element = marker.getElement();
  element?.removeAttribute("title");
  element?.setAttribute("aria-label", title);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { clearTimeout(timer); };
  const leave = () => {
    cancel();
    timer = setTimeout(() => {
      if (document.activeElement !== element) marker.closeTooltip();
    }, 180);
  };
  // Let the pointer cross from the pin to the info without making it disappear.
  marker.off("mouseout", marker.closeTooltip);
  marker.on("mouseout", leave).on("mouseover", cancel);
  const tooltip = marker.getTooltip()!;
  tooltip.on("mouseover", cancel).on("mouseout", leave);
  return () => { cancel(); marker.off("mouseout", leave).off("mouseover", cancel); tooltip.off("mouseover", cancel).off("mouseout", leave); marker.unbindTooltip(); };
}
