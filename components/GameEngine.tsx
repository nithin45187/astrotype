import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, WordEntity } from '../types';
import { WORD_LIST, GAME_SPEED_BASE, SPAWN_RATE_BASE, DIFFICULTY_SCALE, INITIAL_LIVES, CANVAS_HEIGHT_PERCENT } from '../constants';
import { playSound } from '../audio';

interface GameEngineProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: (score: number) => void; // Parent score state for final screen
  score: number;
}

export const GameEngine: React.FC<GameEngineProps> = ({ gameState, setGameState, setScore, score }) => {
  // Game State Refs (Mutable for Performance)
  const wordsRef = useRef<WordEntity[]>([]);
  const lastTimeRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number>(INITIAL_LIVES);
  const targetIdRef = useRef<string | null>(null);

  // UI State (synced for rendering)
  const [renderWords, setRenderWords] = useState<WordEntity[]>([]);
  const [renderLives, setRenderLives] = useState<number>(INITIAL_LIVES);

  // Helper: Generate a unique word that isn't currently on screen
  const spawnWord = useCallback(() => {
    const currentWords = wordsRef.current.map(w => w.text);
    let candidate = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    
    // Simple retry to avoid duplicates on screen
    let attempts = 0;
    while (currentWords.includes(candidate) && attempts < 10) {
      candidate = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
      attempts++;
    }

    const level = Math.floor(scoreRef.current / DIFFICULTY_SCALE);
    const speedMultiplier = 1 + (level * 0.1);

    const newWord: WordEntity = {
      id: Math.random().toString(36).substr(2, 9),
      text: candidate,
      x: Math.random() * 80 + 10, // 10% to 90%
      y: -10, // Start slightly above
      speed: (GAME_SPEED_BASE + (Math.random() * 0.02)) * speedMultiplier,
      typedIndex: 0,
      isTarget: false,
    };

    wordsRef.current.push(newWord);
  }, []);

  // Main Game Loop
  const loop = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING) return;

    if (!lastTimeRef.current) lastTimeRef.current = time;
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Spawning Logic
    const level = Math.floor(scoreRef.current / DIFFICULTY_SCALE);
    const currentSpawnRate = Math.max(500, SPAWN_RATE_BASE - (level * 100));
    
    if (time - lastSpawnRef.current > currentSpawnRate) {
      spawnWord();
      lastSpawnRef.current = time;
    }

    // Update positions
    let hitBottom = false;
    wordsRef.current = wordsRef.current.filter(word => {
      word.y += word.speed * (deltaTime / 16); // Normalize to ~60fps

      if (word.y > CANVAS_HEIGHT_PERCENT) {
        hitBottom = true;
        // If this was the target, clear target
        if (word.id === targetIdRef.current) {
          targetIdRef.current = null;
        }
        return false; // Remove word
      }
      return true;
    });

    if (hitBottom) {
      livesRef.current -= 1;
      setRenderLives(livesRef.current);
      playSound('lifeLost');
      if (livesRef.current <= 0) {
        playSound('gameover');
        setGameState(GameState.GAME_OVER);
        return; // Stop loop
      }
    }

    // Force React Render
    // Optimization: Only update state if meaningful changes (optional, but 60hz react render is fine for <50 elements)
    setRenderWords([...wordsRef.current]);

    animationFrameRef.current = requestAnimationFrame(loop);
  }, [gameState, setGameState, spawnWord]);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.PLAYING) return;

      const key = e.key.toLowerCase();
      // Ignore non-character keys
      if (key.length !== 1 || !/[a-z]/.test(key)) return;

      let words = wordsRef.current;
      let targetId = targetIdRef.current;

      // 1. If we have a target, check against it
      if (targetId) {
        const targetWord = words.find(w => w.id === targetId);
        if (targetWord) {
          const nextChar = targetWord.text[targetWord.typedIndex];
          if (key === nextChar) {
            // Match
            targetWord.typedIndex += 1;
            playSound('laser');

            // Check if destroyed
            if (targetWord.typedIndex >= targetWord.text.length) {
              // Destroyed
              scoreRef.current += 1;
              setScore(scoreRef.current);
              targetIdRef.current = null; // Unlock
              playSound('explosion');
              // Remove immediately from ref
              wordsRef.current = wordsRef.current.filter(w => w.id !== targetId);
            }
          } else {
            // Mismatch
            playSound('error');
          }
        } else {
          // Target disappeared (e.g. hit bottom), reset
          targetIdRef.current = null;
        }
      } 
      
      // 2. If no target (or just reset), try to acquire one
      if (!targetIdRef.current) {
        // Find all words starting with this key
        const candidates = words.filter(w => w.text.startsWith(key));
        
        if (candidates.length > 0) {
          // Pick the one closest to the bottom (highest Y) or just the first one
          // Sorting by Y desc ensures we target the most dangerous one first
          candidates.sort((a, b) => b.y - a.y);
          const newTarget = candidates[0];
          
          newTarget.isTarget = true; // Visuals
          newTarget.typedIndex = 1; // We typed the first letter
          targetIdRef.current = newTarget.id;
          playSound('laser');

           // Check instant destroy (1 letter words)
           if (newTarget.typedIndex >= newTarget.text.length) {
              scoreRef.current += 1;
              setScore(scoreRef.current);
              targetIdRef.current = null;
              playSound('explosion');
              wordsRef.current = wordsRef.current.filter(w => w.id !== newTarget.id);
           }
        } else {
          // No word starts with this key
          playSound('error');
        }
      }

      // Update the render state to reflect typed characters
      setRenderWords([...wordsRef.current]);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, setScore]);

  // Start/Stop Loop
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      // NOTE: We do not handle reset logic here anymore.
      // The parent component is responsible for remounting GameEngine using the 'key' prop
      // to ensure a full fresh state (empty refs, empty arrays) on restart.
      
      animationFrameRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState, loop]);

  // Render Visuals
  return (
    <div className="absolute inset-0 z-10 font-mono">
      {/* Heads Up Display */}
      <div className="absolute top-4 left-4 text-cyan-400 text-xl font-bold z-20">
        SCORE: {scoreRef.current}
      </div>
      <div className="absolute top-4 right-4 text-red-400 text-xl font-bold z-20 flex gap-2">
        LIVES: 
        {Array.from({ length: Math.max(0, renderLives) }).map((_, i) => (
          <span key={i} className="text-red-500">♥</span>
        ))}
      </div>

      {/* Danger Line */}
      <div 
        className="absolute w-full border-t border-red-500/30 border-dashed z-0" 
        style={{ top: `${CANVAS_HEIGHT_PERCENT}%` }}
      >
        <span className="text-xs text-red-500/50 absolute right-2 -top-4">DANGER ZONE</span>
      </div>

      {/* Words */}
      {renderWords.map((word) => {
        const isTarget = targetIdRef.current === word.id;
        return (
          <div
            key={word.id}
            className={`absolute transform -translate-x-1/2 transition-transform will-change-transform ${isTarget ? 'z-30 scale-110' : 'z-10'}`}
            style={{ 
              left: `${word.x}%`, 
              top: `${word.y}%`,
            }}
          >
            <div className="relative">
              {/* Target Line (Ship is roughly at 50% bottom) */}
              {isTarget && (
                <div className="absolute top-full left-1/2 w-0.5 bg-gradient-to-b from-cyan-500/50 to-transparent h-[100vh] -z-10 origin-top" />
              )}
              
              <div className={`px-2 py-1 rounded ${isTarget ? 'bg-slate-900/80 ring-1 ring-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-slate-900/40'}`}>
                <span className="text-green-400 font-bold border-b-2 border-green-500">
                  {word.text.slice(0, word.typedIndex)}
                </span>
                <span className={`${isTarget ? 'text-white font-bold' : 'text-slate-300'}`}>
                  {word.text.slice(word.typedIndex)}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Player Ship Visual */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
        <div className="w-0 h-0 
          border-l-[20px] border-l-transparent
          border-b-[30px] border-b-cyan-600
          border-r-[20px] border-r-transparent
          relative">
            <div className="absolute top-[30px] left-[-10px] w-5 h-2 bg-orange-500 blur-sm animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};