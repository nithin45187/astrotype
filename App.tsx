import React, { useState } from 'react';
import { GameEngine } from './components/GameEngine';
import { Starfield } from './components/Starfield';
import { GameState } from './types';
import { initAudio } from './audio';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [score, setScore] = useState(0);
  const [gameKey, setGameKey] = useState(0);

  const resetGame = () => {
    // Resume audio context on user interaction
    initAudio();
    
    // Reset state
    setScore(0);
    setGameState(GameState.PLAYING);
    
    // Change key to force full unmount/remount of GameEngine.
    // This ensures all refs, timers, and internal state are completely wiped.
    setGameKey(prev => prev + 1);
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden font-sans select-none">
      <Starfield />

      {/* Main Game Layer */}
      <GameEngine 
        key={gameKey} // Key forces remount on reset
        gameState={gameState} 
        setGameState={setGameState}
        setScore={setScore}
        score={score}
      />

      {/* Start Screen Overlay */}
      {gameState === GameState.IDLE && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm">
          <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-8 tracking-tighter drop-shadow-2xl">
            ASTRO<span className="text-white">TYPE</span>
          </h1>
          <p className="text-slate-400 mb-8 text-lg max-w-md text-center">
            Defend your station from incoming debris. Type the words to destroy them before they crash.
          </p>
          <button 
            onClick={resetGame}
            className="group relative px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xl transition-all shadow-[0_0_20px_rgba(8,145,178,0.5)] hover:shadow-[0_0_40px_rgba(8,145,178,0.7)]"
          >
            START MISSION
            <div className="absolute inset-0 rounded-lg border-2 border-white/20 group-hover:scale-105 transition-transform"></div>
          </button>
        </div>
      )}

      {/* Game Over Screen Overlay */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-900/90 backdrop-blur-sm animate-in fade-in duration-300">
          <h2 className="text-6xl font-black text-white mb-2 tracking-widest">GAME OVER</h2>
          <div className="text-4xl font-mono text-red-200 mb-8">
            FINAL SCORE: <span className="text-white">{score}</span>
          </div>
          <button 
            onClick={resetGame}
            className="px-8 py-4 bg-white text-red-900 hover:bg-gray-100 font-bold rounded text-xl shadow-xl transition-colors"
          >
            TRY AGAIN
          </button>
        </div>
      )}
      
      {/* Mobile Warning */}
      <div className="absolute bottom-2 right-2 text-xs text-slate-700 pointer-events-none md:block hidden">
        Keyboard required
      </div>
      <div className="md:hidden absolute top-0 left-0 w-full p-4 bg-yellow-600 text-black text-center font-bold z-50">
        Physical keyboard highly recommended for this game.
      </div>
    </div>
  );
}