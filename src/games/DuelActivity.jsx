import React from 'react';

function HPBar({ hp }) {
  const percent = Math.max(0, Math.min(100, hp));
  const color = percent > 50 ? '#2ecc71' : percent > 20 ? '#f1c40f' : '#e74c3c';
  return (
    <div style={{ width: '100%', height: '20px', background: '#222', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ width: `${percent}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
    </div>
  );
}

export default function DuelActivity({ roomId, socket, profile, publicState }) {
  const game = publicState.game;
  const me = profile?.id;
  const isMyTurn = publicState.currentPlayerId === me;

  const onAction = (action) => {
    socket.emit('duel:action', { roomId, playerId: me, action });
  };

  return (
    <div className="activity-board">
      <div className="title-xl mb4 text-center">DÜELLO</div>
      
      {game.finished && (
        <div className="panel mb4 text-center" style={{ borderColor: '#e74c3c' }}>
          <div className="title-lg">{publicState.players.find(p=>p.id===game.winner)?.username} Kazandı!</div>
        </div>
      )}

      <div className="flex gap-12 justify-center mb8 w-full max-w-2xl mx-auto">
        {publicState.players.map(p => (
          <div key={p.id} className="panel flex-1 text-center" style={{ minWidth: '200px' }}>
            <img src={p.avatar} alt="" style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '10px' }} />
            <div className="title-lg">{p.username}</div>
            <div className="mb2 mt2 font-bold">{game.hp[p.id]} HP</div>
            <HPBar hp={game.hp[p.id]} />
          </div>
        ))}
      </div>

      <div className="controls-row justify-center mb8">
        <button className="f39-btn danger" style={{ fontSize: '1.2rem', padding: '12px 24px' }} onClick={() => onAction('attack')} disabled={!isMyTurn || game.finished}>⚔️ VUR</button>
        <button className="f39-btn secondary" onClick={() => onAction('flee')} disabled={!isMyTurn || game.finished}>🏳️ KAÇ</button>
      </div>
      
      <div className="panel w-full max-w-2xl mx-auto logs" style={{ maxHeight: '200px' }}>
        <div className="section-title">Savaş Kayıtları</div>
        <div className="log-list mt2">
          {game.log.map((l, i) => <div key={i} className="log-item">{l}</div>)}
        </div>
      </div>
    </div>
  );
}
