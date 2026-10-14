import React from 'react';

// OKEY TAŞI BİLEŞENİ
const OkeyTile = ({ color, number, isJoker, isIndicator }) => {
  const bg = isJoker ? 'bg-purple-100 border-purple-300 text-purple-600' :
             color === 'red' ? 'bg-stone-50 border-stone-200 text-red-500' :
             color === 'blue' ? 'bg-stone-50 border-stone-200 text-blue-500' :
             color === 'yellow' ? 'bg-stone-50 border-stone-200 text-yellow-500' :
             'bg-stone-50 border-stone-200 text-black';

  return (
    <div className={`relative flex flex-col items-center justify-center w-14 h-20 rounded-xl border-b-4 shadow-lg ${bg} transform transition-transform hover:-translate-y-2 cursor-pointer`}>
      <span className="text-3xl font-black">{isJoker ? '✦' : number}</span>
      <div className={`w-3 h-3 rounded-full mt-1 ${isJoker ? 'bg-purple-400' : 'bg-stone-300'}`} />
      {isIndicator && <div className="absolute -top-2 -right-2 bg-yellow-400 text-xs px-1 rounded-full border border-white">Göst</div>}
    </div>
  );
};

// OKEY ISTAKASI
const OkeyRack = ({ tiles }) => (
  <div className="w-full max-w-4xl mx-auto mt-8 relative">
    {/* Tahta ıstaka arkaplanı */}
    <div className="absolute inset-0 bg-yellow-900/90 rounded-2xl border-t-8 border-yellow-700 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] transform perspective-1000 rotateX-12" />
    
    <div className="relative p-6 flex flex-wrap gap-2 justify-center min-h-[120px]">
      {tiles.map((t, i) => <OkeyTile key={i} {...t} />)}
    </div>
  </div>
);

// UNO KARTI BİLEŞENİ
const UnoCard = ({ color, value, rotation = 0 }) => {
  const bg = color === 'wild' ? 'bg-[conic-gradient(at_center,_red_25%,_blue_25%_50%,_yellow_50%_75%,_green_75%_100%)]' :
             color === 'red' ? 'bg-red-500' :
             color === 'blue' ? 'bg-blue-500' :
             color === 'green' ? 'bg-green-500' :
             'bg-yellow-500 text-black';
             
  const textCol = color === 'yellow' || color === 'wild' ? 'text-black' : 'text-white';

  return (
    <div 
      className={`relative w-28 h-40 rounded-xl border-4 border-white shadow-2xl flex flex-col items-center justify-center cursor-pointer transition-transform hover:-translate-y-6 ${bg}`}
      style={{ transform: `rotate(${rotation}deg)`, marginLeft: '-2rem' }}
    >
      <span className={`absolute top-2 left-2 font-bold text-lg ${textCol}`}>{value}</span>
      <div className="w-20 h-28 bg-white/20 rounded-full flex items-center justify-center transform -skew-y-6">
        <span className={`text-5xl font-black italic drop-shadow-md ${textCol}`}>{value}</span>
      </div>
      <span className={`absolute bottom-2 right-2 font-bold text-lg rotate-180 ${textCol}`}>{value}</span>
    </div>
  );
};

// OYUN MASASI (ANA GÖRÜNÜM)
export default function GameBoard({ type }) {
  if (type === 'uno') {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900 to-black flex flex-col justify-between p-8 overflow-hidden">
        {/* Rakipler */}
        <div className="flex justify-center gap-12">
          <div className="text-center"><img src="https://cdn.discordapp.com/embed/avatars/1.png" className="w-16 h-16 rounded-full border-2 border-red-500 mb-2 shadow-lg shadow-red-500/50" /><div className="bg-black/50 px-3 py-1 rounded text-white font-bold">Rakip 1 (5)</div></div>
          <div className="text-center"><img src="https://cdn.discordapp.com/embed/avatars/2.png" className="w-16 h-16 rounded-full border-2 border-blue-500 mb-2 shadow-lg shadow-blue-500/50" /><div className="bg-black/50 px-3 py-1 rounded text-white font-bold">Rakip 2 (3)</div></div>
        </div>

        {/* Ortadaki Deste ve Açık Kart */}
        <div className="flex justify-center items-center gap-8 my-8">
          <div className="w-28 h-40 bg-black border-4 border-white rounded-xl flex items-center justify-center shadow-2xl text-red-500 font-black text-3xl rotate-[-5deg]">UNO</div>
          <UnoCard color="green" value="7" rotation={5} />
        </div>

        {/* Senin Elin (Fan şeklinde) */}
        <div className="flex justify-center pl-8 mb-4">
          <UnoCard color="red" value="2" rotation={-15} />
          <UnoCard color="blue" value="Skip" rotation={-5} />
          <UnoCard color="wild" value="+4" rotation={5} />
          <UnoCard color="yellow" value="9" rotation={15} />
        </div>
        
        {/* UNO Butonu */}
        <button className="absolute bottom-10 right-10 w-24 h-24 bg-red-600 border-4 border-white rounded-full text-white font-black text-xl shadow-[0_0_30px_rgba(255,0,0,0.8)] active:scale-95 transition-transform">
          CALL<br/>UNO
        </button>
      </div>
    );
  }

  // OKEY MASASI
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-900 to-black flex flex-col justify-between p-8">
      {/* Rakipler (Yukarıda, sağda, solda) */}
      <div className="flex justify-between items-start w-full max-w-5xl mx-auto">
        <div className="text-center"><img src="https://cdn.discordapp.com/embed/avatars/3.png" className="w-16 h-16 rounded-lg border-2 border-white" /><div className="text-white font-bold mt-1">14 Taş</div></div>
        <div className="text-center"><img src="https://cdn.discordapp.com/embed/avatars/4.png" className="w-16 h-16 rounded-lg border-2 border-white" /><div className="text-white font-bold mt-1">14 Taş</div></div>
        <div className="text-center"><img src="https://cdn.discordapp.com/embed/avatars/0.png" className="w-16 h-16 rounded-lg border-2 border-white" /><div className="text-white font-bold mt-1">14 Taş</div></div>
      </div>

      {/* Ortadaki Gösterge ve Okey */}
      <div className="flex justify-center items-center gap-16 my-8">
        <div className="flex flex-col items-center">
          <span className="text-white font-bold mb-2 tracking-widest text-sm">GÖSTERGE</span>
          <OkeyTile color="red" number="5" isIndicator />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-white font-bold mb-2 tracking-widest text-sm">SON ATILAN</span>
          <OkeyTile color="black" number="11" />
        </div>
      </div>

      {/* Senin Istakan */}
      <OkeyRack tiles={[
        { color: 'red', number: '1' }, { color: 'red', number: '2' }, { color: 'red', number: '3' },
        { color: 'blue', number: '13' }, { color: 'blue', number: '13' },
        { color: 'yellow', number: '7' }, { color: 'black', number: '8' }, { color: 'black', number: '9' },
        { color: 'joker', isJoker: true }
      ]} />
      
      {/* Aksiyon Butonları */}
      <div className="flex justify-center gap-4 mt-6">
        <button className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg">Yerden Çek</button>
        <button className="px-6 py-3 bg-teal-600 text-white font-bold rounded-lg shadow-lg">Yandan Al</button>
        <button className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow-lg">Seçileni At</button>
        <button className="px-6 py-3 bg-purple-600 text-white font-bold rounded-lg shadow-lg">Seri Aç</button>
      </div>
    </div>
  );
}
