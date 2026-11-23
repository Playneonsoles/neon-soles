import { BACKDROP_SVG } from "@/lib/backdrop";

/** Arrière-plan du site : ville néon au coucher du soleil, palmiers et grille (décor original, purement décoratif). */
export function CityBackdrop() {
  return <div className="vc-bg" aria-hidden dangerouslySetInnerHTML={{ __html: BACKDROP_SVG }} />;
}
