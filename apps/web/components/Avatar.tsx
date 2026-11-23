import { avatarSvg } from "@/lib/avatars";

/** Avatar préparé (SVG statique et de confiance, généré localement : aucune donnée utilisateur n'y entre). */
export function Avatar({ face, size, className = "" }: { face: number | null | undefined; size?: string; className?: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: avatarSvg(face ?? 0, size) }} />;
}
