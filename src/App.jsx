import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import UnoGame from './games/UnoGame';
import Okey101 from './games/Okey101';
import Okey4lu from './games/Okey4lu';
import WordleActivity from './games/WordleActivity';
import XoxActivity from './games/XoxActivity';
import DuelActivity from './games/DuelActivity';

const isDiscord = /discord/.test(window.location.ancestorOrigins?.[0] || '') || window.location.pathname.includes('activities');

function ProfileCard({ profile }) {
  if (!profile) return null;
  return (
    <div className="panel profile-card">
      <img className="avatar" src={profile.avatarUrl} alt={profile.username} />
      <div>
        <div className="eyebrow">F39 Activity</div>
        <div className="title-lg">{profile.username}</div>
        <div className="muted">Odaya Bağlısın</div>
      </div>
    </div>
  );
}

export default function App() {
  const [sdkReady, setSdkReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('local:demo-room');
  const [publicState, setPublicState] = useState(null);
  const [privateState, setPrivateState] = useState(null);
  const [status, setStatus] = useState('Yükleniyor...');
  const [selectedGame, setSelectedGame] = useState('uno');

  useEffect(() => {
    let active = true;
    let localSocket;
    async function boot() {
      try {
        const confRes = await fetch('/api/config');
        const conf = await confRes.json();
        const clientId = conf.clientId || import.meta.env.VITE_DISCORD_CLIENT_ID;
        let me; let resolvedRoomId = 'local:demo-room';

        if (isDiscord && clientId) {
          const discordSdk = new DiscordSDK(clientId);
          await discordSdk.ready();
          setSdkReady(true);
          const { code } = await discordSdk.commands.authorize({ client_id: clientId, response_type: 'code', state: '', prompt: 'none', scope: ['identify', 'guilds'] });
          const tokenRes = await fetch('/.proxy/api/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
          const token = await tokenRes.json();
          await discordSdk.commands.authenticate({ access_token: token.access_token });
          const meRes = await fetch('/.proxy/api/me', { headers: { Authorization: `Bearer ${token.access_token}` } });
          me = await meRes.json();
          resolvedRoomId = `${discordSdk.guildId || 'guild'}:${discordSdk.channelId || discordSdk.instanceId || 'activity'}`;
        } else {
          me = { id: `local-${Math.random().toString(36).slice(2,8)}`, username: 'Dev User', avatar: null };
          resolvedRoomId = 'local:demo-room';
          setSdkReady(true);
        }
        if (!active) return;

        const avatarUrl = me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=256` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        setProfile({ id: me.id, username: me.username, avatarUrl });
        setRoomId(resolvedRoomId);
        setStatus('Bağlanılıyor...');

        localSocket = io(window.location.origin, { transports: ['websocket'] });
        setSocket(localSocket);

        localSocket.on('connect', () => {
          setStatus('Masaya oturuldu.');
          localSocket.emit('room:join', { roomId: resolvedRoomId, player: { id: me.id, username: me.username, avatar: avatarUrl, bot: false } });
        });

        localSocket.on('room:state:public', (state) => setPublicState(state));
        localSocket.on('room:state:private', (state) => setPrivateState(state));
      } catch (err) { setStatus(`Hata: ${err.message}`); }
    }
    boot();
    return () => { active = false; localSocket?.disconnect(); };
  }, []);

  const canManage = useMemo(() => profile && publicState && publicState.hostId === profile.id, [profile, publicState]);

  if (!publicState?.game) {
    return (
      <div className="shell">
        <ProfileCard profile={profile} />
        <div className="panel mt12">
          <div className="section-title">Lobi Kontrolleri - {status}</div>
          <div className="button-grid mt8">
            <button className={`f39-btn ${selectedGame === 'uno' ? 'primary' : ''}`} onClick={() => setSelectedGame('uno')}>UNO</button>
            <button className={`f39-btn ${selectedGame === 'okey' ? 'primary' : ''}`} onClick={() => setSelectedGame('okey')}>101 Okey</button>
            <button className={`f39-btn ${selectedGame === 'okey4' ? 'primary' : ''}`} onClick={() => setSelectedGame('okey4')}>Normal Okey</button>
            <button className={`f39-btn ${selectedGame === 'wordle' ? 'primary' : ''}`} onClick={() => setSelectedGame('wordle')}>Wordle</button>
            <button className={`f39-btn ${selectedGame === 'xox' ? 'primary' : ''}`} onClick={() => setSelectedGame('xox')}>XOX</button>
            <button className={`f39-btn ${selectedGame === 'duel' ? 'primary' : ''}`} onClick={() => setSelectedGame('duel')}>Düello</button>
          </div>
          <div className="button-grid mt12">
            <button className="f39-btn primary" onClick={() => socket.emit('game:create', { roomId, gameType: selectedGame, requesterId: profile.id })} disabled={!canManage}>Lobi Kur</button>
          </div>
        </div>
      </div>
    );
  }

  if (publicState.game.phase === 'lobby') {
    return (
      <div className="shell">
        <div className="panel empty-state">
          <div className="title-lg">{publicState.game.type.toUpperCase()} LOBİSİ</div>
          <div className="muted mt8">Oyuncular bekleniyor... ({publicState.players.length} Kişi)</div>
          <div className="button-grid mt12" style={{ justifyContent: 'center' }}>
            <button className="f39-btn" onClick={() => socket.emit('game:addBot', { roomId, requesterId: profile.id })} disabled={!canManage}>Bot Ekle</button>
            <button className="f39-btn success" onClick={() => socket.emit('game:start', { roomId, gameType: publicState.game.type, requesterId: profile.id })} disabled={!canManage}>Başlat</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      {publicState.game.type === 'uno' && <UnoGame roomId={roomId} socket={socket} profile={profile} publicState={publicState} privateState={privateState} />}
      {publicState.game.type === 'okey' && <Okey101 roomId={roomId} socket={socket} profile={profile} publicState={publicState} privateState={privateState} />}
      {publicState.game.type === 'okey4' && <Okey4lu roomId={roomId} socket={socket} profile={profile} publicState={publicState} privateState={privateState} />}
      {publicState.game.type === 'wordle' && <WordleActivity roomId={roomId} socket={socket} profile={profile} publicState={publicState} privateState={privateState} />}
      {publicState.game.type === 'xox' && <XoxActivity roomId={roomId} socket={socket} profile={profile} publicState={publicState} privateState={privateState} />}
      {publicState.game.type === 'duel' && <DuelActivity roomId={roomId} socket={socket} profile={profile} publicState={publicState} privateState={privateState} />}
    </div>
  );
}
