'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PORT = Number(process.env.PORT || 3000);
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
  console.error('❌ .env içinde DISCORD_CLIENT_ID ve DISCORD_CLIENT_SECRET zorunlu.');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const rooms = new Map(); // roomId => roomState

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function createRoom(roomId) {
  return {
    id: roomId,
    createdAt: Date.now(),
    players: [], // { id, username, avatar, socketId, bot }
    hostId: null,
    game: null,  // { type, state }
    turnTimer: null,
    log: [],
  };
}

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, createRoom(roomId));
  return rooms.get(roomId);
}

function clearRoomTimer(room) {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
}

function pushLog(room, text) {
  room.log.unshift({ id: uid(), text, at: Date.now() });
  room.log = room.log.slice(0, 20);
}

function buildUnoDeck() {
  const deck = [];
  const colors = ['red', 'yellow', 'green', 'blue'];
  const values = ['0','1','2','3','4','5','6','7','8','9'];
  for (const c of colors) {
    deck.push({ id: uid(), color: c, value: '0', type: 'number' });
    for (const v of values.slice(1)) {
      deck.push({ id: uid(), color: c, value: v, type: 'number' });
      deck.push({ id: uid(), color: c, value: v, type: 'number' });
    }
    for (const a of ['skip', 'reverse', 'draw2']) {
      deck.push({ id: uid(), color: c, value: a, type: 'action' });
      deck.push({ id: uid(), color: c, value: a, type: 'action' });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: uid(), color: 'wild', value: 'wild', type: 'wild' });
    deck.push({ id: uid(), color: 'wild', value: 'draw4', type: 'wild' });
  }
  return deck.sort(() => Math.random() - 0.5);
}

function createUnoState(room) {
  const deck = buildUnoDeck();
  const order = room.players.map((p) => p.id);
  const hands = {};
  for (const p of room.players) hands[p.id] = deck.splice(0, 7);
  let discard = deck.pop();
  while (discard.type !== 'number') deck.unshift(discard), discard = deck.pop();
  return {
    type: 'uno',
    turnIndex: 0,
    direction: 1,
    drawPile: deck,
    discardPile: [discard],
    activeColor: discard.color,
    hands,
    saidUno: {},
    selectedColorBy: {},
    startedAt: Date.now(),
    afkDeadlineAt: 0,
  };
}

function buildOkeyTiles() {
  const colors = ['red', 'blue', 'yellow', 'black'];
  const tiles = [];
  for (const c of colors) {
    for (let n = 1; n <= 13; n++) {
      tiles.push({ id: uid(), color: c, value: n, joker: false });
      tiles.push({ id: uid(), color: c, value: n, joker: false });
    }
  }
  tiles.push({ id: uid(), color: 'joker', value: 0, joker: true });
  tiles.push({ id: uid(), color: 'joker', value: 0, joker: true });
  return tiles.sort(() => Math.random() - 0.5);
}

function createOkey4State(room) {
  const tiles = buildOkeyTiles();
  const indicator = tiles.pop();
  const okey = nextOkey(indicator);
  const racks = {};
  for (let idx = 0; idx < room.players.length; idx++) {
    const pid = room.players[idx].id;
    // Normal Okey: 15 to the first player, 14 to others
    racks[pid] = tiles.splice(0, idx === 0 ? 15 : 14);
    racks[pid] = sortOkeyRack(racks[pid], 'color');
  }
  return {
    type: 'okey4',
    turnIndex: 0,
    drawPile: tiles,
    discardPile: [],
    indicator,
    okey,
    racks,
    hasDrawn: {},
    startedAt: Date.now(),
    afkDeadlineAt: 0,
  };
}

function nextOkey(tile) {
  if (!tile || tile.joker) return { color: 'joker', value: 0, joker: true };
  return { color: tile.color, value: tile.value === 13 ? 1 : tile.value + 1, joker: false };
}

function sortOkeyRack(rack, mode = 'color') {
  const colorOrder = { red: 0, blue: 1, yellow: 2, black: 3, joker: 4 };
  return [...rack].sort((a, b) => {
    if (mode === 'number') {
      if (a.value !== b.value) return a.value - b.value;
      return colorOrder[a.color] - colorOrder[b.color];
    }
    if (colorOrder[a.color] !== colorOrder[b.color]) return colorOrder[a.color] - colorOrder[b.color];
    return a.value - b.value;
  });
}

function createOkeyState(room) {
  const tiles = buildOkeyTiles();
  const indicator = tiles.pop();
  const okey = nextOkey(indicator);
  const order = room.players.map((p) => p.id);
  const racks = {};
  for (let idx = 0; idx < room.players.length; idx++) {
    const pid = room.players[idx].id;
    racks[pid] = tiles.splice(0, idx === 0 ? 15 : 14);
    racks[pid] = sortOkeyRack(racks[pid], 'color');
  }
  return {
    type: 'okey',
    turnIndex: 0,
    drawPile: tiles,
    discardPile: [],
    indicator,
    okey,
    racks,
    exposedMelds: {},
    hasDrawn: {},
    startedAt: Date.now(),
    afkDeadlineAt: 0,
  };
}

function getCurrentPlayerId(room) {
  if (!room.game) return null;
  return room.players[room.game.turnIndex]?.id ?? null;
}

function serializeCardPublic(card) {
  return card ? { id: card.id, color: card.color, value: card.value, type: card.type } : null;
}

function serializeTilePublic(tile) {
  return tile ? { id: tile.id, color: tile.color, value: tile.value, joker: tile.joker } : null;
}

function buildPublicState(room) {
  const game = room.game;
  const players = room.players.map((p) => {
    const payload = { id: p.id, username: p.username, avatar: p.avatar, bot: !!p.bot };
    if (game?.type === 'uno' && game.hands) {
      payload.count = game.hands[p.id]?.length ?? 0;
      payload.saidUno = !!game.saidUno?.[p.id];
    }
    if (game?.type === 'okey' && game.racks) {
      payload.count = game.racks[p.id]?.length ?? 0;
      payload.exposedMelds = game.exposedMelds?.[p.id] || [];
      payload.hasDrawn = !!game.hasDrawn?.[p.id];
    }
    return payload;
  });

  const currentPlayerId = game && typeof game.turnIndex === 'number' ? getCurrentPlayerId(room) : null;
  
  let publicGame = null;
  if (game) {
    if (game.type === 'uno') {
      publicGame = { type: 'uno', phase: game.phase || 'lobby', turnIndex: game.turnIndex ?? 0, direction: game.direction ?? 1, activeColor: game.activeColor || null, topCard: game.discardPile?.length ? serializeCardPublic(game.discardPile.at(-1)) : null, afkDeadlineAt: game.afkDeadlineAt || 0 };
    } else if (game.type === 'okey' || game.type === 'okey4') {
      publicGame = { type: game.type, phase: game.phase || 'lobby', turnIndex: game.turnIndex ?? 0, indicator: game.indicator ? serializeTilePublic(game.indicator) : null, okey: game.okey ? serializeTilePublic(game.okey) : null, discardTop: game.discardPile?.length ? serializeTilePublic(game.discardPile.at(-1)) : null, afkDeadlineAt: game.afkDeadlineAt || 0 };
    } else if (game.type === 'wordle') {
      publicGame = { type: 'wordle', attempts: game.attempts, maxAttempts: game.maxAttempts, finished: game.finished };
    } else if (game.type === 'xox') {
      publicGame = { type: 'xox', board: game.board, turnIndex: game.turnIndex, finished: game.finished, winner: game.winner };
    } else if (game.type === 'duel') {
      publicGame = { type: 'duel', hp: game.hp, turnIndex: game.turnIndex, log: game.log, finished: game.finished, winner: game.winner };
    }
  }

  return {
    roomId: room.id,
    hostId: room.hostId,
    players,
    currentPlayerId,
    log: room.log,
    game: publicGame,
  };
}

function buildPrivateState(room, playerId) {
  if (!room.game) return { playerId, game: null };
  if (room.game.type === 'uno') {
    return { playerId, game: room.game.hands ? { type: 'uno', hand: room.game.hands[playerId] || [] } : { type: 'uno', hand: [] } };
  }
  if (room.game.type === 'okey' || room.game.type === 'okey4') {
    return { playerId, game: room.game.racks ? { type: room.game.type, rack: room.game.racks[playerId] || [], hasDrawn: !!room.game.hasDrawn?.[playerId] } : { type: room.game.type, rack: [], hasDrawn: false } };
  }
  if (room.game.type === 'wordle') {
    return { playerId, game: { type: 'wordle', word: room.game.word } };
  }
  return { playerId, game: null };
}

function emitRoomState(room) {
  const pub = buildPublicState(room);
  io.to(room.id).emit('room:state:public', pub);
  for (const p of room.players) {
    const socket = io.sockets.sockets.get(p.socketId);
    if (socket) socket.emit('room:state:private', buildPrivateState(room, p.id));
  }
}

function scheduleTurnTimeout(roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.game) return;
  clearRoomTimer(room);
  room.game.afkDeadlineAt = Date.now() + 45_000;
  room.turnTimer = setTimeout(() => {
    handleTurnTimeout(roomId).catch((err) => console.error('[timeout]', err));
  }, 45_000);
}

async function handleTurnTimeout(roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.game) return;
  const playerId = getCurrentPlayerId(room);
  if (!playerId) return;
  pushLog(room, `${playerId} süreyi doldurdu.`);

  if (room.game.type === 'uno') {
    const hand = room.game.hands[playerId];
    if (room.game.drawPile.length === 0) room.game.drawPile = buildUnoDeck();
    hand.push(room.game.drawPile.pop());
    room.game.turnIndex = nextIndex(room.game.turnIndex, room.players.length, room.game.direction);
  } else {
    if (!room.game.hasDrawn[playerId] && room.game.drawPile.length > 0) {
      room.game.racks[playerId].push(room.game.drawPile.pop());
    }
    room.game.hasDrawn[playerId] = false;
    room.game.turnIndex = (room.game.turnIndex + 1) % room.players.length;
  }

  emitRoomState(room);
  const current = getCurrentPlayerId(room);
  const currentPlayer = room.players.find((p) => p.id === current);
  if (currentPlayer?.bot) {
    setTimeout(() => runBotTurn(roomId).catch(console.error), 900);
  } else {
    scheduleTurnTimeout(roomId);
  }
}

function nextIndex(index, size, direction = 1) {
  return ((index + direction) % size + size) % size;
}

function skipIndex(index, size, direction = 1, skip = 2) {
  return ((index + direction * skip) % size + size) % size;
}

async function runBotTurn(roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.game) return;
  const botId = getCurrentPlayerId(room);
  const bot = room.players.find((p) => p.id === botId);
  if (!bot?.bot) return;

  if (room.game.type === 'uno') {
    const g = room.game;
    const hand = g.hands[botId];
    const top = g.discardPile.at(-1);
    const playable = hand.filter((c) => c.color === 'wild' || c.color === g.activeColor || c.value === top.value);

    if (playable.length === 0) {
      if (g.drawPile.length === 0) g.drawPile = buildUnoDeck();
      hand.push(g.drawPile.pop());
      g.turnIndex = nextIndex(g.turnIndex, room.players.length, g.direction);
      pushLog(room, 'Bot kart çekti.');
    } else {
      const card = playable.find((c) => c.type !== 'number') || playable[0];
      hand.splice(hand.findIndex((h) => h.id === card.id), 1);
      g.discardPile.push(card);
      g.activeColor = card.color === 'wild' ? pick(['red','yellow','green','blue']) : card.color;
      pushLog(room, `Bot kart oynadı (${card.value}).`);
      if (hand.length === 0) {
        pushLog(room, 'Bot UNO oyununu kazandı.');
        room.game = null;
        emitRoomState(room);
        return;
      }
      if (card.value === 'draw2') {
        const nxt = nextIndex(g.turnIndex, room.players.length, g.direction);
        const pid = room.players[nxt].id;
        (g.hands[pid] ||= []).push(...g.drawPile.splice(0, 2));
        g.turnIndex = skipIndex(g.turnIndex, room.players.length, g.direction, 2);
      } else if (card.value === 'draw4') {
        const nxt = nextIndex(g.turnIndex, room.players.length, g.direction);
        const pid = room.players[nxt].id;
        (g.hands[pid] ||= []).push(...g.drawPile.splice(0, 4));
        g.turnIndex = skipIndex(g.turnIndex, room.players.length, g.direction, 2);
      } else if (card.value === 'reverse') {
        g.direction *= -1;
        g.turnIndex = nextIndex(g.turnIndex, room.players.length, g.direction);
      } else if (card.value === 'skip') {
        g.turnIndex = skipIndex(g.turnIndex, room.players.length, g.direction, 2);
      } else {
        g.turnIndex = nextIndex(g.turnIndex, room.players.length, g.direction);
      }
    }
  } else {
    const g = room.game;
    const rack = g.racks[botId];
    if (!g.hasDrawn[botId] && g.drawPile.length) {
      rack.push(g.drawPile.pop());
      g.hasDrawn[botId] = true;
    }
    const sorted = sortOkeyRack(rack, 'color');
    const discard = sorted[sorted.length - 1];
    const idx = rack.findIndex((t) => t.id === discard.id);
    rack.splice(idx, 1);
    g.discardPile.push(discard);
    g.hasDrawn[botId] = false;
    g.turnIndex = (g.turnIndex + 1) % room.players.length;
    pushLog(room, `Bot taş attı (${discard.color}${discard.value}).`);
  }

  if (room.game && room.game.type === 'xox') {
    const g = room.game;
    const empty = g.board.map((v, i) => v === null ? i : -1).filter(v => v !== -1);
    if (empty.length) {
      g.board[empty[Math.floor(Math.random() * empty.length)]] = g.turnIndex;
      const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      const win = wins.find(([a,b,c]) => g.board[a] !== null && g.board[a] === g.board[b] && g.board[a] === g.board[c]);
      if (win) { g.finished = true; g.winner = botId; }
      else if (g.board.every(c => c !== null)) { g.finished = true; g.winner = 'draw'; }
      else g.turnIndex = 1 - g.turnIndex;
    }
  } else if (room.game && room.game.type === 'duel') {
    const g = room.game;
    const dmg = Math.floor(Math.random() * 25) + 10;
    const crit = Math.random() < 0.15;
    const finalDmg = crit ? dmg * 2 : dmg;
    const targetIdx = 1 - g.turnIndex;
    const targetId = room.players[targetIdx].id;
    g.hp[targetId] = Math.max(0, g.hp[targetId] - finalDmg);
    g.log.unshift(`Bot vurdu: ${finalDmg} hasar! ${crit ? '(KRİTİK)' : ''}`);
    if (g.hp[targetId] <= 0) { g.finished = true; g.winner = botId; }
    else g.turnIndex = targetIdx;
  }

  emitRoomState(room);
  const current = getCurrentPlayerId(room);
  const currentPlayer = room.players.find((p) => p.id === current);
  if (currentPlayer?.bot) setTimeout(() => runBotTurn(roomId).catch(console.error), 900);
  else scheduleTurnTimeout(roomId);
}

function canStart(room, gameType) {
  if (gameType === 'uno') return room.players.length >= 2 && room.players.length <= 4;
  if (gameType === 'okey' || gameType === 'okey4') return room.players.length === 4;
  if (gameType === 'xox' || gameType === 'duel') return room.players.length === 2;
  if (gameType === 'wordle') return room.players.length >= 1;
  return false;
}

function createWordleState(room) {
  const WORD_POOL = ['KALEM','DENIZ','ROBOT','GITAR','MEYVE','ASLAN','KITAP','BULUT','ZAMAN','CEKET','PILAV','FENER','AKSAM','GUNES','YOLCU'];
  return { type: 'wordle', word: WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)], attempts: [], maxAttempts: 6, startedAt: Date.now() };
}
function createXoxState(room) {
  return { type: 'xox', board: Array(9).fill(null), turnIndex: 0, startedAt: Date.now() };
}
function createDuelState(room) {
  const hp = {}; room.players.forEach(p => hp[p.id] = 100);
  return { type: 'duel', hp, turnIndex: 0, startedAt: Date.now(), log: [] };
}

// Okey helper validations
function isSet(tiles) {
  if (tiles.length < 3) return false;
  const nums = new Set(tiles.map((t) => t.value));
  const colors = new Set(tiles.map((t) => t.color));
  return nums.size === 1 && colors.size === tiles.length;
}
function isRun(tiles) {
  if (tiles.length < 3) return false;
  const colors = new Set(tiles.map((t) => t.color));
  if (colors.size !== 1) return false;
  const vals = [...tiles].map((t) => t.value).sort((a,b)=>a-b);
  for (let i = 1; i < vals.length; i++) if (vals[i] !== vals[i-1] + 1) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────
//  SOCKET.IO ODA/GAME AKIŞI
// ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('room:join', ({ roomId, player }) => {
    if (!roomId || !player?.id) return;
    const room = ensureRoom(roomId);
    socket.join(roomId);

    const existing = room.players.find((p) => p.id === player.id);
    if (existing) existing.socketId = socket.id;
    else room.players.push({ ...player, socketId: socket.id, bot: !!player.bot });
    if (!room.hostId) room.hostId = player.id;
    pushLog(room, `${player.username} masaya oturdu.`);
    emitRoomState(room);
  });

  socket.on('room:leave', ({ roomId, playerId }) => {
    const room = rooms.get(roomId); if (!room) return;
    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.hostId === playerId) room.hostId = room.players[0]?.id || null;
    if (room.players.length === 0) { clearRoomTimer(room); rooms.delete(roomId); return; }
    emitRoomState(room);
  });

  socket.on('game:create', ({ roomId, gameType, requesterId }) => {
    const room = rooms.get(roomId); if (!room) return;
    if (room.hostId !== requesterId) return;
    if (room.game) return;
    room.game = { type: gameType, phase: 'lobby' };
    pushLog(room, `${gameType.toUpperCase()} lobisi açıldı.`);
    emitRoomState(room);
  });

  socket.on('game:addBot', ({ roomId, requesterId }) => {
    const room = rooms.get(roomId); if (!room) return;
    if (room.hostId !== requesterId) return;
    if (room.players.length >= 4) return;
    const botId = `BOT_${Date.now()}`;
    room.players.push({ id: botId, username: 'F39 Bot', avatar: null, socketId: null, bot: true });
    pushLog(room, 'Bot masaya eklendi.');
    emitRoomState(room);
  });

  socket.on('game:start', ({ roomId, requesterId, gameType }) => {
    const room = rooms.get(roomId); if (!room) return;
    if (room.hostId !== requesterId) return;
    if (!canStart(room, gameType)) return;

    if (gameType === 'uno') room.game = createUnoState(room);
    else if (gameType === 'okey') room.game = createOkeyState(room);
    else if (gameType === 'okey4') room.game = createOkey4State(room);
    else if (gameType === 'wordle') room.game = createWordleState(room);
    else if (gameType === 'xox') room.game = createXoxState(room);
    else if (gameType === 'duel') room.game = createDuelState(room);

    pushLog(room, `${gameType.toUpperCase()} oyunu başladı.`);
    emitRoomState(room);

    if (['uno', 'okey', 'okey4', 'xox', 'duel'].includes(gameType)) {
      const current = room.players[room.game.turnIndex];
      if (current?.bot) setTimeout(() => runBotTurn(roomId).catch(console.error), 900);
      else scheduleTurnTimeout(roomId);
    }
  });

  socket.on('wordle:guess', ({ roomId, playerId, guess }) => {
    const room = rooms.get(roomId); if (!room?.game || room.game.type !== 'wordle') return;
    const g = room.game;
    if (g.finished || g.attempts.length >= g.maxAttempts) return;
    
    const targetArr = g.word.split('');
    const guessArr = guess.split('');
    const colors = Array(5).fill('B');
    for (let i=0; i<5; i++) { if (guessArr[i] === targetArr[i]) { colors[i] = 'G'; targetArr[i] = null; guessArr[i] = null; } }
    for (let i=0; i<5; i++) { if (guessArr[i] && targetArr.includes(guessArr[i])) { colors[i] = 'Y'; targetArr[targetArr.indexOf(guessArr[i])] = null; } }
    
    g.attempts.push({ letters: guess.split(''), colors });
    if (colors.every(c => c === 'G')) g.finished = true;
    else if (g.attempts.length >= g.maxAttempts) g.finished = true;
    
    emitRoomState(room);
  });

  socket.on('xox:move', ({ roomId, playerId, index }) => {
    const room = rooms.get(roomId); if (!room?.game || room.game.type !== 'xox') return;
    const g = room.game;
    const current = getCurrentPlayerId(room); if (current !== playerId || g.finished) return;
    if (g.board[index] !== null) return;
    
    g.board[index] = g.turnIndex;
    clearRoomTimer(room);
    
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const win = wins.find(([a,b,c]) => g.board[a] !== null && g.board[a] === g.board[b] && g.board[a] === g.board[c]);
    if (win) { g.finished = true; g.winner = current; }
    else if (g.board.every(c => c !== null)) { g.finished = true; g.winner = 'draw'; }
    else g.turnIndex = 1 - g.turnIndex;
    
    emitRoomState(room);
    if (!g.finished) {
      const next = room.players[g.turnIndex];
      if (next?.bot) setTimeout(() => runBotTurn(roomId).catch(console.error), 900);
      else scheduleTurnTimeout(roomId);
    }
  });

  socket.on('duel:action', ({ roomId, playerId, action }) => {
    const room = rooms.get(roomId); if (!room?.game || room.game.type !== 'duel') return;
    const g = room.game;
    const current = getCurrentPlayerId(room); if (current !== playerId || g.finished) return;
    clearRoomTimer(room);
    
    if (action === 'flee') {
      g.finished = true; g.winner = room.players[1 - g.turnIndex].id;
      g.log.unshift(`${playerId} kaçtı!`);
    } else {
      const dmg = Math.floor(Math.random() * 25) + 10;
      const crit = Math.random() < 0.15;
      const finalDmg = crit ? dmg * 2 : dmg;
      const targetIdx = 1 - g.turnIndex;
      const targetId = room.players[targetIdx].id;
      g.hp[targetId] = Math.max(0, g.hp[targetId] - finalDmg);
      g.log.unshift(`${playerId} vurdu: ${finalDmg} hasar! ${crit ? '(KRİTİK)' : ''}`);
      
      if (g.hp[targetId] <= 0) {
        g.finished = true; g.winner = playerId;
      } else {
        g.turnIndex = targetIdx;
      }
    }
    
    emitRoomState(room);
    if (!g.finished) {
      const next = room.players[g.turnIndex];
      if (next?.bot) setTimeout(() => runBotTurn(roomId).catch(console.error), 900);
      else scheduleTurnTimeout(roomId);
    }
  });

  socket.on('uno:draw', ({ roomId, playerId }) => {
    const room = rooms.get(roomId); if (!room?.game || room.game.type !== 'uno') return;
    const g = room.game;
    const current = getCurrentPlayerId(room); if (current !== playerId) return;
    if (g.drawPile.length === 0) g.drawPile = buildUnoDeck();
    clearRoomTimer(room);
    g.hands[playerId].push(g.drawPile.pop());
    g.turnIndex = nextIndex(g.turnIndex, room.players.length, g.direction);
    pushLog(room, `${room.players.find(p=>p.id===playerId)?.username||playerId} kart çekti.`);
    emitRoomState(room);
    const next = room.players[g.turnIndex];
    if (next?.bot) setTimeout(() => runBotTurn(roomId).catch(console.error), 900);
    else scheduleTurnTimeout(roomId);
  });

  socket.on('uno:call', ({ roomId, playerId }) => {
    const room = rooms.get(roomId); if (!room?.game || room.game.type !== 'uno') return;
    room.game.saidUno[playerId] = true;
    pushLog(room, `${room.players.find(p=>p.id===playerId)?.username||playerId} UNO dedi.`);
    emitRoomState(room);
  });

  socket.on('uno:play', ({ roomId, playerId, cardId, chosenColor }) => {
    const room = rooms.get(roomId); if (!room?.game || room.game.type !== 'uno') return;
    const g = room.game; const current = getCurrentPlayerId(room); if (current !== playerId) return;
    clearRoomTimer(room);
    const hand = g.hands[playerId]; const card = hand.find((c) => c.id === cardId); if (!card) return;
    const top = g.discardPile.at(-1);
    const can = card.color === 'wild' || card.color === g.activeColor || card.value === top.value;
    if (!can) return;
    hand.splice(hand.findIndex((c)=>c.id===cardId), 1);
    g.discardPile.push(card);
    g.activeColor = card.color === 'wild' ? (chosenColor || 'red') : card.color;

    if (hand.length === 1 && !g.saidUno[playerId]) {
      if (g.drawPile.length < 2) g.drawPile = buildUnoDeck();
      hand.push(...g.drawPile.splice(0, 2));
      pushLog(room, 'UNO demediği için +2 ceza aldı.');
    }
    delete g.saidUno[playerId];

    if (hand.length === 0) {
      pushLog(room, `${room.players.find(p=>p.id===playerId)?.username||playerId} UNO oyununu kazandı.`);
      room.game = null;
      emitRoomState(room);
      return;
    }

    const nxt = nextIndex(g.turnIndex, room.players.length, g.direction);
    if (card.value === 'draw2') {
      const pid = room.players[nxt].id;
      if (g.drawPile.length < 2) g.drawPile = buildUnoDeck();
      (g.hands[pid] ||= []).push(...g.drawPile.splice(0, 2));
      g.turnIndex = skipIndex(g.turnIndex, room.players.length, g.direction, 2);
    } else if (card.value === 'draw4') {
      const pid = room.players[nxt].id;
      if (g.drawPile.length < 4) g.drawPile = buildUnoDeck();
      (g.hands[pid] ||= []).push(...g.drawPile.splice(0, 4));
      g.turnIndex = skipIndex(g.turnIndex, room.players.length, g.direction, 2);
    } else if (card.value === 'reverse') {
      g.direction *= -1;
      g.turnIndex = nextIndex(g.turnIndex, room.players.length, g.direction);
    } else if (card.value === 'skip') {
      g.turnIndex = skipIndex(g.turnIndex, room.players.length, g.direction, 2);
    } else {
      g.turnIndex = nxt;
    }

    pushLog(room, `${room.players.find(p=>p.id===playerId)?.username||playerId} kart oynadı.`);
    emitRoomState(room);
    const next = room.players[g.turnIndex];
    if (next?.bot) setTimeout(() => runBotTurn(roomId).catch(console.error), 900);
    else scheduleTurnTimeout(roomId);
  });

  socket.on('okey:sort', ({ roomId, playerId, mode }) => {
    const room = rooms.get(roomId); if (!room?.game || room.game.type !== 'okey') return;
    room.game.racks[playerId] = sortOkeyRack(room.game.racks[playerId], mode || 'color');
    emitRoomState(room);
  });

  socket.on('okey:draw-stock', ({ roomId, playerId }) => {
    const room = rooms.get(roomId); if (!room?.game || room.game.type !== 'okey') return;
    const g = room.game; const current = getCurrentPlayerId(room); if (current !== playerId) return;
    if (g.hasDrawn[playerId]) return;
    if (g.drawPile.length === 0) return;
    clearRoomTimer(room);
    g.racks[playerId].push(g.drawPile.pop());
    g.racks[playerId] = sortOkeyRack(g.racks[playerId]);
    g.hasDrawn[playerId] = true;
    pushLog(room, `${room.players.find(p=>p.id===playerId)?.username||playerId} yerden taş çekti.`);
    emitRoomState(room);
    scheduleTurnTimeout(roomId);
  });

  socket.on('okey:draw-discard', ({ roomId, playerId }) => {
    const room = rooms.get(roomId); if (!room?.game || room.game.type !== 'okey') return;
    const g = room.game; const current = getCurrentPlayerId(room); if (current !== playerId) return;
    if (g.hasDrawn[playerId] || !g.discardPile.length) return;
    clearRoomTimer(room);
    g.racks[playerId].push(g.discardPile.pop());
    g.racks[playerId] = sortOkeyRack(g.racks[playerId]);
    g.hasDrawn[playerId] = true;
    pushLog(room, `${room.players.find(p=>p.id===playerId)?.username||playerId} ıskartadan taş aldı.`);
    emitRoomState(room);
    scheduleTurnTimeout(roomId);
  });

  socket.on('okey:discard', ({ roomId, playerId, tileId }) => {
    const room = rooms.get(roomId); if (!room?.game || room.game.type !== 'okey') return;
    const g = room.game; const current = getCurrentPlayerId(room); if (current !== playerId) return;
    if (!g.hasDrawn[playerId]) return;
    clearRoomTimer(room);
    const rack = g.racks[playerId];
    const idx = rack.findIndex((t) => t.id === tileId); if (idx === -1) return;
    const [tile] = rack.splice(idx, 1);
    g.discardPile.push(tile);
    g.hasDrawn[playerId] = false;
    g.turnIndex = (g.turnIndex + 1) % room.players.length;
    pushLog(room, `${room.players.find(p=>p.id===playerId)?.username||playerId} taş attı.`);
    emitRoomState(room);
    const next = room.players[g.turnIndex];
    if (next?.bot) setTimeout(() => runBotTurn(roomId).catch(console.error), 900);
    else scheduleTurnTimeout(roomId);
  });

  socket.on('okey:meld-series', ({ roomId, playerId, tileIds }) => {
    const room = rooms.get(roomId); if (!room?.game || room.game.type !== 'okey') return;
    const rack = room.game.racks[playerId];
    const tiles = tileIds.map((id) => rack.find((t) => t.id === id)).filter(Boolean);
    if (!tiles.length) return;
    if (!isRun(tiles) && !isSet(tiles)) return;
    room.game.racks[playerId] = rack.filter((t) => !tileIds.includes(t.id));
    room.game.exposedMelds[playerId] ||= [];
    room.game.exposedMelds[playerId].push(tiles);
    pushLog(room, `${room.players.find(p=>p.id===playerId)?.username||playerId} bir seri açtı.`);
    emitRoomState(room);
  });

  socket.on('disconnect', () => {
    for (const room of rooms.values()) {
      const idx = room.players.findIndex((p) => p.socketId === socket.id);
      if (idx !== -1) {
        pushLog(room, `${room.players[idx].username} bağlantıyı kaybetti.`);
        room.players.splice(idx, 1);
        if (room.hostId === room.players[idx]?.id) room.hostId = room.players[0]?.id || null;
        emitRoomState(room);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────
//  API ROUTES (Discord OAuth / profile)
// ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/config', (_req, res) => res.json({ clientId: DISCORD_CLIENT_ID, publicBaseUrl: PUBLIC_BASE_URL }));
app.get('/.proxy/api/config', (_req, res) => res.json({ clientId: DISCORD_CLIENT_ID, publicBaseUrl: PUBLIC_BASE_URL }));

app.post('/api/token', exchangeToken);
app.post('/.proxy/api/token', exchangeToken);
app.get('/api/me', fetchDiscordProfile);
app.get('/.proxy/api/me', fetchDiscordProfile);

async function exchangeToken(req, res) {
  try {
    const { code } = req.body;
    const body = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    });
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    const data = await response.json();
    res.status(response.ok ? 200 : 400).json(data);
  } catch (e) {
    res.status(500).json({ error: 'token_exchange_failed', detail: e.message });
  }
}

async function fetchDiscordProfile(req, res) {
  try {
    const auth = req.headers.authorization || '';
    const response = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: auth } });
    const data = await response.json();
    res.status(response.ok ? 200 : 401).json(data);
  } catch (e) {
    res.status(500).json({ error: 'profile_failed', detail: e.message });
  }
}

// ─────────────────────────────────────────────────────────────
//  Vite middleware (node . ile direkt çalışsın)
// ─────────────────────────────────────────────────────────────
(async () => {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ root: __dirname, server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  server.listen(PORT, () => {
    console.log(`✅ F39 Activity server hazır: http://localhost:${PORT}`);
  });
})();
