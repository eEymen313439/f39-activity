import React, { useMemo } from 'react';

const COLOR_CLASS = {
  red: 'card-red',
  yellow: 'card-yellow',
  green: 'card-green',
  blue: 'card-blue',
  wild: 'card-wild',
};

function UnoCard({ card, small = false, selectable = false, disabled = false, onClick }) {
  if (!card) return null;
  const cls = COLOR_CLASS[card.color] || 'card-wild';
  return (
    <button
      className={`uno-card ${cls} ${small ? 'small' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="corner tl">{card.value.toUpperCase()}</span>
      <span className="center">{card.value.toUpperCase()}</span>
      <span className="corner br">{card.value.toUpperCase()}</span>
    </button>
  );
}

export default function UnoGame({ roomId, socket, profile, publicState, privateState }) {
  const game = publicState.game;
  const me = profile?.id;
  const hand = privateState?.game?.type === 'uno' ? privateState.game.hand : [];
  const myTurn = publicState.currentPlayerId === me;

  const players = publicState.players;
  const opponents = players.filter((p) => p.id !== me);

  const onDraw = () => socket.emit('uno:draw', { roomId, playerId: me });
  const onCallUno = () => socket.emit('uno:call', { roomId, playerId: me });
  const onPlay = (card) => {
    const chosenColor = card.color === 'wild' ? 'red' : undefined;
    socket.emit('uno:play', { roomId, playerId: me, cardId: card.id, chosenColor });
  };

  const activeColorName = useMemo(() => {
    return ({ red: 'Kırmızı', yellow: 'Sarı', green: 'Yeşil', blue: 'Mavi', wild: 'Joker' })[game.activeColor] || '—';
  }, [game.activeColor]);

  return (
    <div className="activity-board uno-board-wrap">
      <div className="board-head">
        <div>
          <div className="eyebrow">UNO MASASI</div>
          <div className="title-lg">ŞU ANDA SIRADA: {publicState.currentPlayerId === me ? 'SEN' : players.find((p) => p.id === publicState.currentPlayerId)?.username || 'BOT'}</div>
        </div>
        <div className="timer-chip">{Math.max(0, Math.ceil((game.afkDeadlineAt - Date.now()) / 1000))} sn</div>
      </div>

      <div className="uno-table">
        <div className="top-seat">
          {opponents[0] && (
            <div className="seat-card">
              <div className="seat-name">{opponents[0].username}</div>
              <div className="seat-stack">{Array.from({ length: Math.min(opponents[0].count, 8) }).map((_, i) => <div className="card-back small" key={i} />)}</div>
              <div className="seat-meta">{opponents[0].count} kart</div>
            </div>
          )}
        </div>

        <div className="side-seats">
          {opponents.slice(1).map((op) => (
            <div key={op.id} className="seat-card vertical">
              <div className="seat-name">{op.username}</div>
              <div className="seat-stack vertical">{Array.from({ length: Math.min(op.count, 6) }).map((_, i) => <div className="card-back small" key={i} />)}</div>
              <div className="seat-meta">{op.count} kart</div>
            </div>
          ))}
        </div>

        <div className="uno-center">
          <div className="draw-pile">
            <div className="card-back" />
            <div className="pile-label">Çekme Destesi</div>
          </div>
          <div className="discard-pile">
            <UnoCard card={game.topCard} />
            <div className="pile-label">Aktif Renk: {activeColorName}</div>
          </div>
        </div>
      </div>

      <div className="controls-row">
        <button className="f39-btn" disabled={!myTurn} onClick={onDraw}>Kart Çek</button>
        <button className="f39-btn danger" disabled={hand.length !== 1} onClick={onCallUno}>CALL UNO!</button>
      </div>

      <div className="player-hand panel">
        <div className="section-title">Senin Elin</div>
        <div className="hand-strip">
          {hand.map((card) => {
            const playable = myTurn && (card.color === 'wild' || card.color === game.activeColor || card.value === game.topCard?.value);
            return (
              <UnoCard
                key={card.id}
                card={card}
                selectable
                disabled={!playable}
                onClick={() => playable && onPlay(card)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
