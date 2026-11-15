import { DomUtil, type Map as LeafletMap } from "leaflet";
import type { Map as VectorMap } from "maplibre-gl";

type Layer = {
  _map?: LeafletMap;
  _glMap?: VectorMap & { _actualCanvas: HTMLElement };
  _transitionEnd: () => void;
  _resizeContainer: () => void;
  _zoomEnd: () => void;
  onRemove: (map: LeafletMap) => unknown;
};

/** The 0.1.4 adapter queues an untracked resize frame which dereferences _map
 * after removal. Keep the same transition with a cancellable, instance-bound frame. */
export function guardMapLayerFrames(layer: Layer) {
  let frame: number | null = null;
  layer._transitionEnd = function () {
    if (frame !== null) cancelAnimationFrame(frame);
    const map = this._map, gl = this._glMap;
    if (!map || !gl) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (this._map !== map || this._glMap !== gl) return;
      const center = map.getCenter(), zoom = map.getZoom();
      const offset = map.latLngToContainerPoint(map.getBounds().getNorthWest());
      this._resizeContainer();
      DomUtil.setTransform(gl._actualCanvas, offset, 1);
      gl.once("moveend", () => { if (this._map === map && this._glMap === gl) this._zoomEnd(); });
      gl.jumpTo({ center, zoom: zoom - 1 });
    });
  };
  const remove = layer.onRemove;
  layer.onRemove = function (map) {
    if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
    return remove.call(this, map);
  };
}
