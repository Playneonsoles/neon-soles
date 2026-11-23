/** Petits drapeaux dessinés en SVG (les emojis de drapeaux ne s'affichent pas sous Windows). */
export function Flag({ code, className = "h-4 w-6" }: { code: string; className?: string }) {
  const body = (() => {
    switch (code) {
      case "fr": return <><rect width="8" height="16" fill="#1F3FA8" /><rect x="8" width="8" height="16" fill="#fff" /><rect x="16" width="8" height="16" fill="#E1283C" /></>;
      case "it": return <><rect width="8" height="16" fill="#1F9D4B" /><rect x="8" width="8" height="16" fill="#fff" /><rect x="16" width="8" height="16" fill="#D8282F" /></>;
      case "es": return <><rect width="24" height="16" fill="#C8202F" /><rect y="4" width="24" height="8" fill="#F8C721" /></>;
      case "pt": return <><rect width="24" height="16" fill="#D8282F" /><rect width="9.6" height="16" fill="#0E7A3B" /><circle cx="9.6" cy="8" r="3.4" fill="#F8C721" /><circle cx="9.6" cy="8" r="1.9" fill="#fff" /></>;
      case "zh": return <><rect width="24" height="16" fill="#DE2910" /><path d="M5 2l1.1 3.3h3.4L6.7 7.4l1 3.2L5 8.6l-2.7 2 1-3.2L.5 5.3h3.4z" fill="#FFDE00" /><circle cx="10.5" cy="2.6" r=".9" fill="#FFDE00" /><circle cx="12.3" cy="4.8" r=".9" fill="#FFDE00" /><circle cx="12.3" cy="7.4" r=".9" fill="#FFDE00" /><circle cx="10.5" cy="9.4" r=".9" fill="#FFDE00" /></>;
      default: return <><rect width="24" height="16" fill="#1F3A7D" /><path d="M0 0L24 16M24 0L0 16" stroke="#fff" strokeWidth="3.2" /><path d="M0 0L24 16M24 0L0 16" stroke="#C8202F" strokeWidth="1.2" /><path d="M12 0V16M0 8H24" stroke="#fff" strokeWidth="5.2" /><path d="M12 0V16M0 8H24" stroke="#C8202F" strokeWidth="3" /></>;
    }
  })();
  return (
    <svg viewBox="0 0 24 16" className={`${className} shrink-0 rounded-[3px] ring-1 ring-white/30`} aria-hidden="true" focusable="false">{body}</svg>
  );
}
