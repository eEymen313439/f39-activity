import React from 'react';

// GERÇEK UNO KARTI BİLEŞENİ
const UnoCard = ({ color, value, rotation, overlap }) => (
  <div 
    className={`relative w-24 h-36 rounded-xl border-4 border-white shadow-2xl flex flex-col items-center justify-center transform transition-transform hover:-translate-y-4`}
    style={{ 
      background: `linear-gradient(135deg, ${color} 0%, ${color}aa 100%)`,
      marginLeft: overlap ? '-3rem' : '0',
      transform: `rotate(${rotation}deg)`
    }}
  >
    <span className="absolute top-2 left-2 text-white font-bold text-lg">{value}</span>
    <div className="w-16 h-24 bg-white rounded-full flex items-center justify-center opacity-20">
       <span className="text-6xl font-black italic" style={{ color }}>{value}</span>
    </div>
    <span className="absolute bottom-2 right-2 text-white font-bold text-lg rotate-180">{value}</span>
  </div>
);

// GERÇEK OKEY ISTAKA BİLEŞENİ
const OkeyRack = ({ tiles }) => (
  <div className="w-full h-48 bg-yellow-900/80 rounded-t-3xl border-t-8 border-yellow-700 p-4 flex flex-wrap gap-2 justify-center shadow-[0_-10px_50px_rgba(0,0,0,0.5)]">
    {tiles.map((t, i) => (
      <div key={i} className="w-12 h-16 bg-stone-100 rounded-lg border-b-4 border-stone-400 flex flex-col items-center justify-center shadow-md">
        <span className={`text-2xl font-bold ${t.color}`}>{t.value}</span>
        <div className="w-2 h-2 rounded-full bg-stone-300 mt-1" />
      </div>
    ))}
  </div>
);

export default function GameUI() {
  return (
    <div className="min-h-screen bg-[#1e2124] text-white flex flex-col justify-between p-8">
      {/* MASA ÜSTÜ */}
      <div className="flex justify-center items-center gap-12">
        <div className="w-32 h-32 rounded-full border-4 border-brand p-1">
           <img src="avatar_url" className="rounded-full" />
           <div className="bg-brand text-xs font-bold text-center -mt-4 rounded">OYUNCU 1</div>
        </div>
      </div>

      {/* OYUN ALANI (ORTA) */}
      <div className="flex flex-col items-center gap-4">
        <div className="eyebrow text-gray-400">MASADAKİ KART</div>
        <UnoCard color="#ef4444" value="7" rotation={0} />
      </div>

      {/* OYUNCU ELİ (ALT) */}
      <div className="flex flex-col items-center w-full">
        <div className="flex justify-center mb-8">
          <UnoCard color="#3b82f6" value="2" rotation={-10} overlap />
          <UnoCard color="#10b981" value="Skip" rotation={-5} overlap />
          <UnoCard color="#f59e0b" value="Rev" rotation={5} overlap />
          <UnoCard color="#ef4444" value="+2" rotation={10} overlap />
        </div>
        
        <OkeyRack tiles={[
          { color: 'text-red-500', value: '5' },
          { color: 'text-blue-500', value: '11' },
          { color: 'text-yellow-500', value: '13' },
          { color: 'text-black', value: '1' }
        ]} />
      </div>
    </div>
  );
}
