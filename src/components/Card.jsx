import { SUIT_INFO, rankLabel } from '../lib/cards';

export default function Card({ card, onClick, disabled, small, faceDown }) {
  if (faceDown) {
    return <div className={`card card-back ${small ? 'card-sm' : ''}`} />;
  }
  const info = SUIT_INFO[card.suit];
  return (
    <button
      type="button"
      className={`card ${info.color === 'red' ? 'card-red' : 'card-black'} ${small ? 'card-sm' : ''} ${disabled ? 'card-disabled' : ''}`}
      onClick={onClick ? () => onClick(card) : undefined}
      disabled={disabled || !onClick}
    >
      <span className="card-rank">{rankLabel(card.rank)}</span>
      <span className="card-suit">{info.symbol}</span>
    </button>
  );
}
