import React, { useState } from 'react';

export default function WordleActivity({ roomId, socket, profile, publicState, privateState }) {
  const game = publicState.game;
  const attempts = game.attempts || [];
  const max = game.maxAttempts || 6;
  const [guess, setGuess] = useState('');

  const submitGuess = (e) => {
    e.preventDefault();
    if (guess.length !== 5) return;
    socket.emit('wordle:guess', { roomId, playerId: profile.id, guess: guess.toUpperCase() });
    setGuess('');
  };

  return (
    <div className="activity-board" style={{ alignItems: 'center' }}>
      <div className="title-xl mb4 text-center">WORDLE</div>
      
      <div className="wordle-grid mb8">
        {Array.from({ length: max }).map((_, rIdx) => {
          const attempt = attempts[rIdx];
          return (
            <div key={rIdx} className="wordle-row flex gap-2 mb-2">
              {Array.from({ length: 5 }).map((_, cIdx) => {
                let letter = '';
                let boxClass = 'w-14 h-14 border-2 border-[#3a3a3c] flex items-center justify-center text-2xl font-bold rounded';
                if (attempt) {
                  letter = attempt.letters[cIdx];
                  const col = attempt.colors[cIdx];
                  if (col === 'G') boxClass += ' bg-[#538d4e] border-[#538d4e]';
                  else if (col === 'Y') boxClass += ' bg-[#b59f3b] border-[#b59f3b]';
                  else boxClass += ' bg-[#3a3a3c] border-[#3a3a3c]';
                }
                return <div key={cIdx} className={boxClass}>{letter}</div>;
              })}
            </div>
          );
        })}
      </div>

      {game.finished ? (
        <div className="panel text-center">
          <div className="title-lg mb2">Oyun Bitti!</div>
          <div>{attempts[attempts.length-1]?.colors?.every(c=>c==='G') ? 'Tebrikler!' : 'Malesef bulamadın.'}</div>
        </div>
      ) : (
        <form onSubmit={submitGuess} className="flex gap-2">
          <input 
            type="text" 
            maxLength={5} 
            value={guess} 
            onChange={e => setGuess(e.target.value)} 
            placeholder="5 Harfli Kelime..."
            className="f39-input"
            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #444', background: '#222', color: 'white' }}
          />
          <button type="submit" className="f39-btn primary">Gönder</button>
        </form>
      )}
    </div>
  );
}
