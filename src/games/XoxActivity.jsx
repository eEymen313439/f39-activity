import React from 'react';

export default function XoxActivity({ roomId, socket, profile, publicState }) {
  const game = publicState.game;
  const me = profile?.id;
  const isMyTurn = publicState.currentPlayerId === me;

  const onCellClick = (idx) => {
    if (!isMyTurn || game.board[idx] !== null || game.finished) return;
    socket.emit('xox:move', { roomId, playerId: me, index: idx });
  };

  const getSymbol = (val) => {
    if (val === null) return '';
    return val === 0 ? '❌' : '⭕';
  };

  return (
    <div className="activity-board" style={{ alignItems: 'center' }}>
      <div className="title-xl mb4 text-center">TIC-TAC-TOE</div>
      
      <div className="panel mb8 text-center">
        {game.finished ? (
          <div className="title-lg">{game.winner === 'draw' ? 'Berabere!' : `${publicState.players[game.winner].username} Kazandı!`}</div>
        ) : (
          <div className="title-lg">Sıra: {publicState.players[game.turnIndex]?.username}</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 100px)', gap: '10px' }}>
        {game.board.map((val, idx) => (
          <button 
            key={idx} 
            onClick={() => onCellClick(idx)}
            className="f39-btn"
            style={{ width: '100px', height: '100px', fontSize: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            disabled={val !== null || !isMyTurn || game.finished}
          >
            {getSymbol(val)}
          </button>
        ))}
      </div>
    </div>
  );
}
