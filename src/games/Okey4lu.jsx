import React, { useMemo, useState } from 'react';

const TILE_COLOR = {
  red: 'tile-red',
  blue: 'tile-blue',
  yellow: 'tile-yellow',
  black: 'tile-black',
  joker: 'tile-joker',
};

function OkeyTile({ tile, selected = false, onClick }) {
  const cls = TILE_COLOR[tile?.color] || 'tile-joker';
  return (
    <button className={`okey-tile ${cls} ${selected ? 'selected' : ''}`} onClick={onClick}>
      <span className="tile-num">{tile?.joker ? '*' : tile?.value}</span>
    </button>
  );
}

export default function Okey4lu({ roomId, socket, profile, publicState, privateState }) {
  const game = publicState.game;
  const me = profile?.id;
  const rack = privateState?.game?.type === 'okey4' ? privateState.game.rack : [];
  const myTurn = publicState.currentPlayerId === me;
  const [selectedIds, setSelectedIds] = useState([]);

  const onSortColor = () => socket.emit('okey:sort', { roomId, playerId: me, mode: 'color' });
  const onSortNumber = () => socket.emit('okey:sort', { roomId, playerId: me, mode: 'number' });
  const onDrawStock = () => socket.emit('okey:draw-stock', { roomId, playerId: me });
  const onDrawDiscard = () => socket.emit('okey:draw-discard', { roomId, playerId: me });
  const onDiscard = () => {
    if (selectedIds.length !== 1) return;
    socket.emit('okey:discard', { roomId, playerId: me, tileId: selectedIds[0] });
    setSelectedIds([]);
  };

  return (
    <div className="activity-board okey-board-wrap">
      <div className="board-head">
        <div>
          <div className="eyebrow">NORMAL OKEY (4'LÜ)</div>
          <div className="title-lg">ŞU ANDA SIRADA: {publicState.currentPlayerId === me ? 'SEN' : publicState.players.find((p) => p.id === publicState.currentPlayerId)?.username || 'BOT'}</div>
        </div>
        <div className="timer-chip">{Math.max(0, Math.ceil((game.afkDeadlineAt - Date.now()) / 1000))} sn</div>
      </div>

      <div className="okey-meta panel compact">
        <div><strong>Gösterge:</strong> {game.indicator ? `${game.indicator.color} ${game.indicator.value}` : '—'}</div>
        <div><strong>Okey:</strong> {game.okey ? `${game.okey.color} ${game.okey.value}` : '—'}</div>
        <div><strong>Iskarta:</strong> {game.discardTop ? `${game.discardTop.color} ${game.discardTop.value}` : 'Yok'}</div>
      </div>

      <div className="okey-table panel">
        <div className="opponents-grid">
          {publicState.players.filter((p) => p.id !== me).map((p) => (
            <div key={p.id} className="op-seat">
              <div className="seat-name">{p.username}</div>
              <div className="seat-meta">{p.count} taş</div>
            </div>
          ))}
        </div>
      </div>

      <div className="controls-row wrap">
        <button className="f39-btn primary" onClick={onDrawStock} disabled={!myTurn}>Taş Çek</button>
        <button className="f39-btn" onClick={onDrawDiscard} disabled={!myTurn}>Yandan Al</button>
        <button className="f39-btn danger" onClick={onDiscard} disabled={!myTurn || selectedIds.length !== 1}>Taş At / Bitir</button>
        <button className="f39-btn" onClick={onSortColor}>Renge Göre</button>
        <button className="f39-btn" onClick={onSortNumber}>Sayıya Göre</button>
      </div>

      <div className="player-rack panel">
        <div className="section-title">Senin Istakan</div>
        <div className="rack-strip">
          {rack.map((tile) => {
            const selected = selectedIds.includes(tile.id);
            return (
              <OkeyTile
                key={tile.id}
                tile={tile}
                selected={selected}
                onClick={() => {
                  setSelectedIds((prev) => selected ? prev.filter((x) => x !== tile.id) : [...prev, tile.id]);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
