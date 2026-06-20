import { GAME_LABELS, PENALTY_TYPES } from '../lib/gameEngine';
import { cezaTotal, netScore } from '../lib/matchEngine';

function RightMarkers({ used, total, shape }) {
  return (
    <span className="rights-row">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`marker marker-${shape} ${i < used ? 'marker-filled' : ''}`} />
      ))}
    </span>
  );
}

export default function ScorePanel({ state, myId }) {
  const { players, rights, totals, handNumber } = state;

  return (
    <aside className="score-panel panel">
      <div className="score-panel-head">
        <h3>Skor Tablosu</h3>
        <span className="hand-counter">El {Math.min(handNumber, 20)}/20</span>
      </div>

      <div className="score-numbers-legend">
        <span>Koz</span>
        <span>Ceza</span>
        <span>Net</span>
      </div>

      {players.map((p) => {
        const r = rights[p.id];
        const ceza = cezaTotal(state, p.id);
        const koz = totals[p.id].koz;
        const net = netScore(state, p.id);
        return (
          <div key={p.id} className={`score-row ${p.id === myId ? 'score-row-me' : ''} ${state.declarerIndex !== undefined && players[state.declarerIndex]?.id === p.id ? 'score-row-declarer' : ''}`}>
            <div className="score-row-name">{p.name}</div>
            <div className="score-row-rights">
              <RightMarkers used={2 - r.koz} total={2} shape="circle" />
              <RightMarkers used={3 - r.ceza} total={3} shape="triangle" />
            </div>
            <div className="score-row-numbers">
              <span className="num-koz">+{koz}</span>
              <span className="num-ceza">{ceza}</span>
              <span className={`num-net ${net < 0 ? 'num-net-neg' : ''}`}>{net}</span>
            </div>
            <div className="score-row-breakdown">
              {PENALTY_TYPES.map((t) =>
                totals[p.id].breakdown[t] !== 0 ? (
                  <span key={t} className="breakdown-chip">
                    {GAME_LABELS[t]}: {totals[p.id].breakdown[t]}
                  </span>
                ) : null
              )}
            </div>
          </div>
        );
      })}

      <div className="score-legend">
        <span><span className="marker marker-circle marker-filled" /> Koz hakkı kullanıldı</span>
        <span><span className="marker marker-triangle marker-filled" /> Ceza hakkı kullanıldı</span>
      </div>
    </aside>
  );
}
