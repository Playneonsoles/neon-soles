/** Petit dessin animé de la page de garde : un marcheur, un téléphone qui reçoit des $WALK. Purement décoratif. */
export function WalkerLane({ className = "" }: { className?: string }) {
  return (
    <div className={`nw-lane ${className}`} aria-hidden="true">
      <div className="nw-walker">
        <div className="nw-notif n1"><i className="coin" />+25 $WALK received</div><div className="nw-notif n2">Claim</div><div className="nw-notif n3"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#FBBF24" stroke="#B45309" strokeWidth="1.5"/><circle cx="7" cy="8" r="1.3" fill="#3B2A10"/><circle cx="13" cy="8" r="1.3" fill="#3B2A10"/><path d="M5.5 11.5Q10 17 14.5 11.5" fill="none" stroke="#3B2A10" strokeWidth="1.6" strokeLinecap="round"/></svg>Sent to your wallet</div><i className="nw-tap" />
      <svg viewBox="0 0 40 64"><g className="legB"><rect x="17.5" y="40" width="5" height="17" rx="2.5" fill="#1E293B"/><path d="M16 56h11a2 2 0 010 4H16z" fill="#F43F5E"/><path d="M16 56h11a2 2 0 010 4H16z" fill="none" stroke="#fff" strokeWidth=".8"/><path d="M26 52l5-2-3 5z" fill="#FDE68A"/><path d="M14 53Q9 49 8 43Q12 46 15 48ZM14 55Q7 53 5 48Q10 49 14 51Z" fill="#F43F5E" fillOpacity=".7"/></g>
      <g className="body"><g className="legA"><rect x="17.5" y="40" width="5" height="17" rx="2.5" fill="#334155"/><path d="M16 56h11a2 2 0 010 4H16z" fill="#F43F5E"/><path d="M16 56h11a2 2 0 010 4H16z" fill="none" stroke="#fff" strokeWidth=".8"/><path d="M26 52l5-2-3 5z" fill="#FDE68A"/><path d="M14 53Q9 49 8 43Q12 46 15 48ZM14 55Q7 53 5 48Q10 49 14 51Z" fill="#F43F5E" fillOpacity=".7"/></g>
      <rect x="12" y="18" width="16" height="24" rx="6" fill="#16A34A"/><path d="M16 18l4 5 4-5" fill="none" stroke="#DCFCE7" strokeWidth="1.5"/>
      <g transform="rotate(10 20 11)"><circle cx="20" cy="11" r="7.5" fill="#F1C9A5"/><path d="M12.5 11Q12 2 20 2Q28 2 27.5 11Q25 6 20 6Q15 6 12.5 11Z" fill="#3A7BFF"/><circle cx="23.5" cy="12.5" r="1.4" fill="#16162A"/></g>
      <path d="M26 24L33 28" stroke="#16A34A" strokeWidth="4.5" strokeLinecap="round"/><rect x="31" y="21" width="7" height="12" rx="1.6" fill="#0B0F1A" stroke="#E5E7EB" strokeWidth="1"/><rect className="screen" x="32.3" y="22.8" width="4.4" height="8" rx=".8" fill="#39FF88"/>
      <path d="M14 24L19 31L27 29" stroke="#15803D" strokeWidth="4" strokeLinecap="round" fill="none"/></g></svg>
      </div>
    </div>
  );
}
