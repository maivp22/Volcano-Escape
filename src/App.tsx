/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  getDoc, 
  serverTimestamp, 
  getDocs,
  writeBatch,
  query,
  orderBy,
  limit,
  increment
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { generateRoomCode, getRandomPosition } from './utils/roomUtils';
import { 
  GRID_SIZE, 
  getCellId, 
  isAdjacent, 
  getDangerZones, 
  getDifficulty 
} from './utils/gameUtils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mountain, 
  Users, 
  Play, 
  Skull, 
  Trophy, 
  Flame, 
  Compass, 
  Keyboard, 
  LogOut, 
  Medal,
  Settings,
  Volume2,
  Volume1,
  VolumeX,
  X,
  Check,
  Zap,
  MessageSquare,
  Send,
  ChevronRight
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { useAuth } from './hooks/useAuth';
import { AuthScreen } from './components/AuthScreen';
import { NicknameScreen } from './components/NicknameScreen';

import { translations, Language } from './translations';

// --- Types ---
type GameStatus = 'start' | 'lobby' | 'countdown' | 'playing' | 'finished';
type PlayerStatus = 'active' | 'eliminated' | 'spectator';
type GamePhase = 'warning' | 'lava' | 'cooldown';

interface Message {
  id: string;
  senderId: string;
  nickname: string;
  text: string;
  createdAt: any;
}

interface Player {
  id: string;
  nickname: string;
  position: { x: number; y: number };
  status: PlayerStatus;
  isGameMaster: boolean;
  avatar: { emoji: string; name: string };
  color: string;
  roundsSurvived?: number;
  eliminatedAt?: any;
}

interface GameEngineStatus {
  danger_zones: string[];
  lava_zones: string[];
  phase: GamePhase;
  round: number;
  safe_zone?: string;
}

interface Room {
  id: string;
  code: string;
  status: GameStatus;
  gameMasterId: string;
  round: number;
  warningTime: number;
  countdownStart?: any;
}

// --- Constants ---
const AVATARS = [
  { emoji: '🧭', name: 'Explorador' },
  { emoji: '🪨', name: 'Geólogo' },
  { emoji: '🧯', name: 'Bombero' },
  { emoji: '🌀', name: 'Chamán' },
  { emoji: '🏄', name: 'Surfista de lava' },
  { emoji: '🦕', name: 'Pterodáctilo' },
  { emoji: '🦎', name: 'Salamandra' },
  { emoji: '🔥', name: 'Fénix' },
  { emoji: '🌋', name: 'Vulcanólogo' },
  { emoji: '💎', name: 'Minero' },
];

const NEON_COLORS = [
  '#00ff41', // Neon Green
  '#00ffff', // Neon Cyan
  '#ff00ff', // Neon Magenta
  '#ffff00', // Neon Yellow
  '#ff4500', // Neon Orange-Red
  '#0000ff', // Neon Blue
  '#ffffff', // Neon White
  '#8a2be2', // Neon Violet
  '#ff1493', // Deep Pink
  '#ffd700', // Gold
];

// --- Components ---

const WASDPanel = ({ pressedKeys }: { pressedKeys: Set<string> }) => {
  const keys = [
    { key: 'W', label: 'W', pos: 'col-start-2' },
    { key: 'A', label: 'A', pos: 'col-start-1 row-start-2' },
    { key: 'S', label: 'S', pos: 'col-start-2 row-start-2' },
    { key: 'D', label: 'D', pos: 'col-start-3 row-start-2' },
  ];

  return (
    <div className="bg-black/40 p-6 border-2 border-[#4a2c2a] rounded-3xl backdrop-blur-sm shadow-xl flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 text-[#ff8c00] text-[10px] font-black uppercase tracking-widest">
        <Keyboard className="w-4 h-4" /> Controls
      </div>
      <div className="grid grid-cols-3 grid-rows-2 gap-2">
        {keys.map(({ key, label, pos }) => (
          <div
            key={key}
            className={`
              w-12 h-12 flex items-center justify-center rounded-xl border-2 font-black text-xl transition-all duration-75
              ${pos}
              ${pressedKeys.has(key.toLowerCase()) 
                ? 'bg-[#ff4500] border-white text-white scale-90 shadow-[0_0_15px_rgba(255,69,0,0.8)]' 
                : 'bg-[#2c1e1a] border-[#4a2c2a] text-[#f4a460]'}
            `}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Sound Manager (Web Audio API) ---
class SoundManager {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private musicVolume: number = 0.5;
  private sfxVolume: number = 0.5;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      this.updateVolumes();
    }
  }

  setMusicVolume(v: number) {
    this.musicVolume = v;
    this.updateVolumes();
  }

  setSFXVolume(v: number) {
    this.sfxVolume = v;
    this.updateVolumes();
  }

  private updateVolumes() {
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx!.currentTime, 0.1);
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx!.currentTime, 0.1);
  }

  startMusic() {
    this.init();
    if (this.musicOsc) return;

    // Simple ambient loop
    this.musicOsc = this.ctx!.createOscillator();
    const lfo = this.ctx!.createOscillator();
    const lfoGain = this.ctx!.createGain();

    this.musicOsc.type = 'triangle';
    this.musicOsc.frequency.setValueAtTime(60, this.ctx!.currentTime); // Low rumble

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.5, this.ctx!.currentTime);
    lfoGain.gain.setValueAtTime(10, this.ctx!.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(this.musicOsc.frequency);
    this.musicOsc.connect(this.musicGain!);

    lfo.start();
    this.musicOsc.start();
  }

  pauseMusic() {
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.5);
    }
  }

  resumeMusic() {
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx!.currentTime, 0.5);
    }
  }

  stopMusic() {
    if (this.musicOsc) {
      this.musicOsc.stop();
      this.musicOsc.disconnect();
      this.musicOsc = null;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playWarning() {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx!.currentTime + 0.5);
    gain.gain.setValueAtTime(this.sfxVolume * 0.2, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.5);
  }

  playElimination() {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.ctx!.currentTime + 0.8);
    gain.gain.setValueAtTime(this.sfxVolume * 0.4, this.ctx!.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.8);
  }

  playVictory() {
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + i * 0.15);
      gain.gain.setValueAtTime(this.sfxVolume * 0.2, this.ctx!.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + i * 0.15 + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(this.ctx!.currentTime + i * 0.15);
      osc.stop(this.ctx!.currentTime + i * 0.15 + 0.5);
    });
  }

  playCountdown(count: number) {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(count === 0 ? 880 : 440, this.ctx!.currentTime);
    gain.gain.setValueAtTime(this.sfxVolume * 0.3, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }
}

const sounds = new SoundManager();

export default function App() {
  const { user, profile, loading: authLoading, setNickname, updateNickname } = useAuth();
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [engine, setEngine] = useState<GameEngineStatus | null>(null);
  const [hallOfFame, setHallOfFame] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);

  // --- Settings State ---
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'es');
  const [showSettings, setShowSettings] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [musicVolume, setMusicVolume] = useState(() => Number(localStorage.getItem('musicVolume') || 50));
  const [sfxVolume, setSfxVolume] = useState(() => Number(localStorage.getItem('sfxVolume') || 50));
  const [colorblindMode, setColorblindMode] = useState(() => localStorage.getItem('colorblindMode') === 'true');
  const [animationQuality, setAnimationQuality] = useState(() => localStorage.getItem('animationQuality') || 'High');
  const [newNickname, setNewNickname] = useState('');

  useEffect(() => {
    setNewNickname(profile?.nickname || '');
  }, [profile?.nickname]);

  useEffect(() => {
    localStorage.setItem('musicVolume', musicVolume.toString());
    sounds.setMusicVolume(musicVolume / 100);
  }, [musicVolume]);

  useEffect(() => {
    localStorage.setItem('sfxVolume', sfxVolume.toString());
    sounds.setSFXVolume(sfxVolume / 100);
  }, [sfxVolume]);

  useEffect(() => {
    localStorage.setItem('colorblindMode', colorblindMode.toString());
  }, [colorblindMode]);

  useEffect(() => {
    localStorage.setItem('animationQuality', animationQuality);
  }, [animationQuality]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = translations[language];

  const playerId = user?.uid || null;

  // --- Hall of Fame ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'), orderBy('victories', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const topPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHallOfFame(topPlayers);
    });
    return unsubscribe;
  }, [user]);

  // --- Keyboard Listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.key) return;
      let key = e.key.toLowerCase();
      if (key === 'arrowup') key = 'w';
      if (key === 'arrowdown') key = 's';
      if (key === 'arrowleft') key = 'a';
      if (key === 'arrowright') key = 'd';

      if (['w', 'a', 's', 'd'].includes(key)) {
        setPressedKeys(prev => new Set(prev).add(key));
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.key) return;
      let key = e.key.toLowerCase();
      if (key === 'arrowup') key = 'w';
      if (key === 'arrowdown') key = 's';
      if (key === 'arrowleft') key = 'a';
      if (key === 'arrowright') key = 'd';

      if (['w', 'a', 's', 'd'].includes(key)) {
        setPressedKeys(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- Keyboard Movement ---
  useEffect(() => {
    if (!room || room.status !== 'playing' || !playerId || showPreview) return;
    const currentPlayer = players.find(p => p.id === playerId);
    if (!currentPlayer || currentPlayer.status !== 'active') return;

    const move = (dx: number, dy: number) => {
      const newX = currentPlayer.position.x + dx;
      const newY = currentPlayer.position.y + dy;
      if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE) {
        handleMove(newX, newY);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.key) return;
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') move(0, -1);
      if (key === 's' || key === 'arrowdown') move(0, 1);
      if (key === 'a' || key === 'arrowleft') move(-1, 0);
      if (key === 'd' || key === 'arrowright') move(1, 0);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [room?.status, playerId, players, showPreview]);

  // --- Game Engine Logic (GM Only) ---
  useEffect(() => {
    if (!room || room.status !== 'playing' || !playerId || room.gameMasterId !== playerId || !roomCode) return;

    let timer: NodeJS.Timeout;
    const runRound = async () => {
      const roomRef = doc(db, `rooms/${roomCode}`);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists() || roomSnap.data().status !== 'playing') return;

      const currentRound = (roomSnap.data().round || 0) + 1;
      const activePlayersCount = players.filter(p => p.status === 'active').length;
      const { dangerCount, warningTime, cooldownTime, isSpecial } = getDifficulty(activePlayersCount, currentRound);
      
      // 1. Warning Phase
      // Pick a safe zone (shield)
      const allCells = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
          allCells.push(getCellId(x, y));
        }
      }
      const safeZone = allCells[Math.floor(Math.random() * allCells.length)];

      const dangerZones = getDangerZones(dangerCount, players.map(p => getCellId(p.position.x, p.position.y)), [safeZone]);
      
      await updateDoc(doc(db, `rooms/${roomCode}/game_engine/status`), {
        danger_zones: dangerZones,
        lava_zones: [],
        phase: 'warning',
        round: currentRound,
        safe_zone: safeZone
      });
      await updateDoc(roomRef, { round: currentRound, warningTime });

      if (isSpecial) {
        setBannerText(t.specialRound);
        sounds.playWarning(); // Extra warning sound for special round
      }

      // 2. Lava Phase
      timer = setTimeout(async () => {
        await updateDoc(doc(db, `rooms/${roomCode}/game_engine/status`), {
          danger_zones: [],
          lava_zones: dangerZones,
          phase: 'lava'
        });

        // 3. Cooldown Phase
        timer = setTimeout(async () => {
          await updateDoc(doc(db, `rooms/${roomCode}/game_engine/status`), {
            lava_zones: [],
            phase: 'cooldown'
          });
          
          const finalSnap = await getDoc(roomRef);
          if (finalSnap.exists() && finalSnap.data().status === 'playing') {
            timer = setTimeout(runRound, 2000);
          }
        }, cooldownTime);
      }, warningTime);
    };

    // Wait for preview to finish before starting first round
    timer = setTimeout(runRound, 3500);

    return () => clearTimeout(timer);
  }, [room?.status, room?.gameMasterId, playerId, roomCode]);

  // --- Banner Logic ---
  useEffect(() => {
    if (!engine) return;
    if (engine.phase === 'warning') {
      setBannerText(t.heatIntensifying.replace('{round}', engine.round.toString()));
    } else if (engine.phase === 'lava') {
      setBannerText(t.lavaEruption);
    } else {
      setBannerText(null);
    }
  }, [engine?.phase, engine?.round, t]);

  // --- Sound Triggers ---
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const volumeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start music as soon as user is in the app (main menu or playing)
    if (user) {
      sounds.startMusic();
      sounds.resumeMusic();
    } else {
      sounds.stopMusic();
    }
  }, [user]);

  // Handle volume keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      const isPlus = e.key === '+' || e.key === '=' || e.key === 'ArrowUp' || e.key === 'AudioVolumeUp';
      const isMinus = e.key === '-' || e.key === '_' || e.key === 'ArrowDown' || e.key === 'AudioVolumeDown';
      const isMute = e.key.toLowerCase() === 'm' || e.key === 'AudioVolumeMute';

      if (isPlus || isMinus || isMute) {
        if (isPlus) {
          setMusicVolume(prev => Math.min(100, prev + 5));
          setSfxVolume(prev => Math.min(100, prev + 5));
        } else if (isMinus) {
          setMusicVolume(prev => Math.max(0, prev - 5));
          setSfxVolume(prev => Math.max(0, prev - 5));
        } else if (isMute) {
          setMusicVolume(prev => prev === 0 ? 50 : 0);
          setSfxVolume(prev => prev === 0 ? 50 : 0);
        }

        // Show indicator
        setShowVolumeIndicator(true);
        if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
        volumeTimerRef.current = setTimeout(() => setShowVolumeIndicator(false), 2000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global click to resume AudioContext (browser policy)
  useEffect(() => {
    const handleGlobalClick = () => {
      sounds.resume();
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      sounds.playCountdown(countdown);
    } else if (countdown === 0) {
      sounds.playCountdown(0);
    }
  }, [countdown]);

  useEffect(() => {
    const currentPlayer = players.find(p => p.id === playerId);
    if (currentPlayer?.status === 'eliminated') {
      sounds.pauseMusic();
    } else if (currentPlayer?.status === 'active' && room?.status === 'playing') {
      sounds.resumeMusic();
    }
  }, [players, room?.status, playerId]);

  useEffect(() => {
    if (engine?.phase === 'warning') {
      sounds.playWarning();
    }
  }, [engine?.phase]);

  useEffect(() => {
    if (room?.status === 'finished') {
      sounds.playVictory();
    }
  }, [room?.status]);

  // --- Elimination Check ---
  useEffect(() => {
    if (!engine || engine.phase !== 'lava' || !playerId || !roomCode) return;
    
    const currentPlayer = players.find(p => p.id === playerId);
    if (currentPlayer && currentPlayer.status === 'active') {
      const currentPos = getCellId(currentPlayer.position.x, currentPlayer.position.y);
      if (engine.lava_zones.includes(currentPos)) {
        const rounds = engine.round > 0 ? engine.round - 1 : 0;
        updateDoc(doc(db, `rooms/${roomCode}/players/${playerId}`), {
          status: 'eliminated',
          roundsSurvived: rounds,
          eliminatedAt: serverTimestamp()
        });
        sounds.playElimination();
        
        // Update rounds survived in global profile
        if (rounds > 0) {
          updateDoc(doc(db, 'users', playerId), {
            roundsSurvived: increment(rounds),
            updatedAt: serverTimestamp()
          });
        }
      }
    }
  }, [engine?.phase, engine?.lava_zones, playerId, players, roomCode]);

  // --- Victory Check ---
  useEffect(() => {
    if (room?.status === 'finished' && playerId) {
      const winner = players.find(p => p.status === 'active');
      if (winner && winner.id === playerId) {
        updateDoc(doc(db, 'users', playerId), {
          victories: increment(1),
          updatedAt: serverTimestamp()
        });
      }
    }
  }, [room?.status, playerId, players]);

  // --- Victory Check (GM Only) ---
  useEffect(() => {
    if (!room || room.status !== 'playing' || !playerId || room.gameMasterId !== playerId || !roomCode) return;
    
    const activePlayers = players.filter(p => p.status === 'active');
    if (activePlayers.length === 1 && players.length > 1) {
      updateDoc(doc(db, `rooms/${roomCode}`), { status: 'finished' });
    } else if (activePlayers.length === 0 && players.length > 0) {
      updateDoc(doc(db, `rooms/${roomCode}`), { status: 'finished' });
    }
  }, [players, room?.status, room?.gameMasterId, playerId, roomCode]);

  // --- Preview Logic ---
  useEffect(() => {
    if (room?.status === 'playing') {
      setShowPreview(true);
      const timer = setTimeout(() => setShowPreview(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [room?.status]);

  // --- Countdown Logic ---
  useEffect(() => {
    if (room?.status === 'countdown' && room.countdownStart) {
      const start = room.countdownStart.toMillis();
      const interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.floor((now - start) / 1000);
        const remaining = 3 - diff;
        
        if (remaining <= 0) {
          setCountdown(0);
          clearInterval(interval);
          if (room.gameMasterId === playerId) {
            updateDoc(doc(db, `rooms/${roomCode}`), { status: 'playing' });
          }
        } else {
          setCountdown(remaining);
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [room?.status, room?.countdownStart, room?.gameMasterId, playerId, roomCode]);

  // --- Firestore Listeners ---
  useEffect(() => {
    if (!roomCode) return;

    const unsubRoom = onSnapshot(doc(db, `rooms/${roomCode}`), (snapshot) => {
      if (snapshot.exists()) {
        setRoom({ id: snapshot.id, ...snapshot.data() } as any);
      } else {
        setError('Expedition lost');
        setRoomCode(null);
      }
    });

    const unsubPlayers = onSnapshot(collection(db, `rooms/${roomCode}/players`), (snapshot) => {
      const p = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setPlayers(p);
    });

    const unsubEngine = onSnapshot(doc(db, `rooms/${roomCode}/game_engine/status`), (snapshot) => {
      if (snapshot.exists()) {
        setEngine(snapshot.data() as GameEngineStatus);
      }
    });

    const qMessages = query(collection(db, `rooms/${roomCode}/messages`), orderBy('createdAt', 'desc'), limit(20));
    const unsubMessages = onSnapshot(qMessages, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)).reverse();
      setMessages(msgs);
    });

    return () => {
      unsubRoom();
      unsubPlayers();
      unsubEngine();
      unsubMessages();
    };
  }, [roomCode]);

  // --- Actions ---
  const handleCreateRoom = async () => {
    if (!profile || !playerId) return;
    const code = generateRoomCode();
    
    try {
      await setDoc(doc(db, `rooms/${code}`), {
        code,
        status: 'lobby',
        createdAt: serverTimestamp(),
        gameMasterId: playerId,
        round: 0,
        warningTime: 2000
      });

      await setDoc(doc(db, `rooms/${code}/players/${playerId}`), {
        nickname: profile.nickname,
        position: getRandomPosition(GRID_SIZE),
        status: 'active',
        isGameMaster: true,
        joinedAt: serverTimestamp(),
        avatar: AVATARS[0],
        color: NEON_COLORS[0]
      });

      await setDoc(doc(db, `rooms/${code}/game_engine/status`), {
        danger_zones: [],
        lava_zones: [],
        phase: 'cooldown',
        round: 0
      });

      // Update games played
      await updateDoc(doc(db, 'users', playerId), {
        gamesPlayed: increment(1),
        updatedAt: serverTimestamp()
      });

      setRoomCode(code);
      setError(null);
    } catch (err) {
      setError('Failed to start expedition');
    }
  };

  const handleJoinRoom = async () => {
    if (!profile || !playerId || !inputCode.trim()) {
      setError('Expedition Code required');
      return;
    }
    const code = inputCode.toUpperCase();
    const roomSnap = await getDoc(doc(db, `rooms/${code}`));
    
    if (!roomSnap.exists()) {
      setError('Expedition not found');
      return;
    }

    if (roomSnap.data().status !== 'lobby') {
      setError('Expedition already departed');
      return;
    }

    const playersSnap = await getDocs(collection(db, `rooms/${code}/players`));
    if (playersSnap.size >= 10) {
      setError('Expedition is full');
      return;
    }

    try {
      await setDoc(doc(db, `rooms/${code}/players/${playerId}`), {
        nickname: profile.nickname,
        position: getRandomPosition(GRID_SIZE),
        status: 'active',
        isGameMaster: false,
        joinedAt: serverTimestamp(),
        avatar: AVATARS[playersSnap.size],
        color: NEON_COLORS[playersSnap.size]
      });

      // Update games played
      await updateDoc(doc(db, 'users', playerId), {
        gamesPlayed: increment(1),
        updatedAt: serverTimestamp()
      });

      setRoomCode(code);
      setError(null);
    } catch (err) {
      setError('Failed to join expedition');
    }
  };

  const handleStartGame = async () => {
    if (!roomCode) return;
    await updateDoc(doc(db, `rooms/${roomCode}`), { 
      status: 'countdown',
      countdownStart: serverTimestamp()
    });
  };

  const handleSendMessage = async (text: string) => {
    if (!roomCode || !playerId || !profile) return;
    await setDoc(doc(collection(db, `rooms/${roomCode}/messages`)), {
      senderId: playerId,
      nickname: profile.nickname,
      text,
      createdAt: serverTimestamp()
    });
  };

  const handleMove = async (x: number, y: number) => {
    if (!room || room.status !== 'playing' || !playerId || !roomCode || showPreview) return;
    const currentPlayer = players.find(p => p.id === playerId);
    if (!currentPlayer || currentPlayer.status !== 'active') return;

    if (!isAdjacent(currentPlayer.position, { x, y })) return;
    if (engine?.lava_zones.includes(getCellId(x, y))) return;

    // Collision Check: Silent cancel if occupied
    const isOccupied = players.some(p => p.status === 'active' && p.position.x === x && p.position.y === y);
    if (isOccupied) return;

    await updateDoc(doc(db, `rooms/${roomCode}/players/${playerId}`), {
      position: { x, y }
    });
  };

  const handleRestart = async () => {
    if (!roomCode || room?.gameMasterId !== playerId) return;
    
    const batch = writeBatch(db);
    players.forEach(p => {
      batch.update(doc(db, `rooms/${roomCode}/players/${p.id}`), {
        status: 'active',
        position: getRandomPosition(GRID_SIZE)
      });
    });
    batch.update(doc(db, `rooms/${roomCode}`), {
      status: 'lobby',
      round: 0
    });
    batch.update(doc(db, `rooms/${roomCode}/game_engine/status`), {
      danger_zones: [],
      lava_zones: [],
      phase: 'cooldown',
      round: 0
    });
    
    await batch.commit();
  };

  // --- Render Helpers ---
  const renderStart = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#1a0f0a] text-[#f4a460] p-4 stone-texture relative">
      {/* Fixed Instructions Button */}
      <button 
        onClick={() => setShowInstructions(true)}
        className="fixed top-6 right-6 w-12 h-12 bg-[#ff4500] text-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,69,0,0.4)] hover:bg-[#ff6347] hover:scale-110 transition-all z-50 border-2 border-white/20 font-black text-xl italic"
        title={t.howToPlay}
      >
        i
      </button>

      {/* Volume Indicator Overlay */}
      <AnimatePresence>
        {showVolumeIndicator && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 border-2 border-[#ff4500] px-6 py-3 rounded-full z-[100] flex items-center gap-4 backdrop-blur-md shadow-[0_0_30px_rgba(255,69,0,0.2)]"
          >
            {musicVolume === 0 ? (
              <VolumeX className="w-5 h-5 text-red-500" />
            ) : musicVolume < 50 ? (
              <Volume1 className="w-5 h-5 text-[#ff8c00]" />
            ) : (
              <Volume2 className="w-5 h-5 text-[#ff4500]" />
            )}
            <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                initial={false}
                animate={{ width: `${musicVolume}%` }}
                className="h-full bg-gradient-to-r from-[#ff8c00] to-[#ff4500]"
              />
            </div>
            <span className="text-white font-black text-xs min-w-[3ch]">{musicVolume}%</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Flame className="w-16 h-16 text-[#ff4500] animate-pulse drop-shadow-[0_0_10px_rgba(255,69,0,0.8)]" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white drop-shadow-lg italic">
            VOLCANO_ESCAPE
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-[#ff8c00] font-bold">{t.subtitle}</p>
        </div>

        <div className="space-y-4 bg-black/40 p-8 border-2 border-[#4a2c2a] rounded-3xl backdrop-blur-sm shadow-2xl relative">
          <button 
            onClick={() => setShowSettings(true)}
            className="absolute top-4 right-4 p-2 text-[#a08070] hover:text-[#ff8c00] transition-colors"
          >
            <Settings className="w-6 h-6" />
          </button>

          <div className="flex items-center justify-between bg-[#2c1e1a] p-3 rounded-2xl border border-[#4a2c2a] mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#4a2c2a] rounded-xl flex items-center justify-center text-xl">👤</div>
              <div>
                <p className="text-[8px] font-bold text-[#ff8c00] uppercase">{t.survivor}</p>
                <p className="text-white font-bold text-sm">{profile?.nickname}</p>
              </div>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 text-[#4a2c2a] hover:text-[#ff4500] transition-colors"
              title={t.signOut}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {!isJoining ? (
            <div className="space-y-3">
              <button 
                onClick={handleCreateRoom}
                className="w-full bg-[#ff4500] text-white font-black p-4 rounded-xl hover:bg-[#ff6347] transition-all shadow-lg shadow-[#ff4500]/20 flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <Mountain className="w-5 h-5" /> {t.startExpedition}
              </button>
              <button 
                onClick={() => setIsJoining(true)}
                className="w-full border-2 border-[#ff4500] text-[#ff4500] font-black p-4 rounded-xl hover:bg-[#ff4500]/10 transition-all uppercase tracking-widest"
              >
                {t.joinExpedition}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#ff8c00] font-bold">{t.expeditionCode}</label>
                <input 
                  type="text" 
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  className="w-full bg-[#2c1e1a] border-2 border-[#4a2c2a] p-4 rounded-xl focus:outline-none focus:border-[#ff4500] transition-all text-white placeholder-[#4a2c2a]"
                  placeholder="X7K2PQ"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleJoinRoom}
                  className="flex-1 bg-[#ff4500] text-white font-black p-4 rounded-xl hover:bg-[#ff6347] transition-all uppercase tracking-widest"
                >
                  {t.join}
                </button>
                <button 
                  onClick={() => setIsJoining(false)}
                  className="px-6 border-2 border-[#4a2c2a] text-[#f4a460] rounded-xl hover:bg-white/5 uppercase font-bold text-xs"
                >
                  {t.back}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hall of Fame */}
        <div className="bg-black/40 p-6 border-2 border-[#4a2c2a] rounded-3xl backdrop-blur-sm shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Medal className="w-5 h-5 text-[#ff8c00]" />
            <h2 className="text-xs font-black text-white uppercase tracking-widest">{t.hallOfFame}</h2>
          </div>
          <div className="space-y-2">
            {hallOfFame?.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between bg-[#2c1e1a]/50 p-3 rounded-xl border border-[#4a2c2a]/50">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold w-5 ${i === 0 ? 'text-[#ff8c00]' : 'text-[#a08070]'}`}>#{i + 1}</span>
                  <span className="text-white font-bold text-xs">{p.nickname}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-[#ff8c00]" />
                  <span className="text-[#ff8c00] font-bold text-[10px]">{p.victories}</span>
                </div>
              </div>
            ))}
            {hallOfFame.length === 0 && (
              <p className="text-center text-[#a08070] text-[10px] italic py-2">{t.noSurvivors}</p>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-400 text-xs p-3 rounded-lg text-center font-bold">
            ⚠ {t.error}: {error}
          </div>
        )}

        {/* Instructions Modal */}
        <AnimatePresence>
          {showInstructions && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-lg bg-[#2c1e1a] border-2 border-[#4a2c2a] rounded-[2rem] p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto scrollbar-thin"
              >
                <div className="flex justify-between items-center border-b border-[#4a2c2a] pb-4">
                  <h3 className="text-2xl font-black text-white italic flex items-center gap-2">
                    📜 {t.howToPlayTitle}
                  </h3>
                  <button onClick={() => setShowInstructions(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <X className="w-6 h-6 text-[#a08070]" />
                  </button>
                </div>

                <div className="space-y-6 text-sm">
                  <section className="space-y-2">
                    <h4 className="text-[#ff8c00] font-black uppercase tracking-widest text-xs">🔥 {t.rules.objective.title}</h4>
                    <p className="text-[#f4a460] leading-relaxed">
                      {t.rules.objective.desc}
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-[#ff8c00] font-black uppercase tracking-widest text-xs">🛡️ {t.rules.safeZones.title}</h4>
                    <p className="text-[#f4a460] leading-relaxed">
                      {t.rules.safeZones.desc}
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-[#ff8c00] font-black uppercase tracking-widest text-xs">🌋 {t.rules.lavaRound.title}</h4>
                    <p className="text-[#f4a460] leading-relaxed">
                      {t.rules.lavaRound.desc}
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-[#ff8c00] font-black uppercase tracking-widest text-xs">🎮 {t.rules.controls.title}</h4>
                    <ul className="list-disc list-inside text-[#f4a460] space-y-1">
                      {t.rules.controls.list?.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-[#ff8c00] font-black uppercase tracking-widest text-xs">📈 {t.rules.difficulty.title}</h4>
                    <p className="text-[#f4a460] leading-relaxed">
                      {t.rules.difficulty.desc}
                    </p>
                  </section>
                </div>

                <button 
                  onClick={() => setShowInstructions(false)}
                  className="w-full bg-[#ff4500] text-white font-black p-4 rounded-xl hover:bg-[#ff6347] transition-all uppercase tracking-widest"
                >
                  {t.gotIt}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-md bg-[#2c1e1a] border-2 border-[#4a2c2a] rounded-[2rem] p-8 shadow-2xl space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-white italic flex items-center gap-2">
                    <Settings className="w-6 h-6 text-[#ff8c00]" /> {t.settings}
                  </h3>
                  <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <X className="w-6 h-6 text-[#a08070]" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Language Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#ff8c00] uppercase tracking-widest">{t.language}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setLanguage('es')}
                        className={`p-3 rounded-xl border-2 font-bold text-xs transition-all ${language === 'es' ? 'bg-[#ff8c00] border-[#ff8c00] text-white' : 'bg-black/20 border-[#4a2c2a] text-[#a08070]'}`}
                      >
                        Español
                      </button>
                      <button 
                        onClick={() => setLanguage('en')}
                        className={`p-3 rounded-xl border-2 font-bold text-xs transition-all ${language === 'en' ? 'bg-[#ff8c00] border-[#ff8c00] text-white' : 'bg-black/20 border-[#4a2c2a] text-[#a08070]'}`}
                      >
                        English
                      </button>
                    </div>
                  </div>

                  {/* Nickname */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#ff8c00] uppercase tracking-widest">{t.nickname}</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        className="flex-1 bg-[#1a0f0a] border-2 border-[#4a2c2a] p-3 rounded-xl text-white text-sm focus:border-[#ff8c00] outline-none"
                        maxLength={12}
                      />
                      <button 
                        onClick={async () => {
                          try {
                            await updateNickname(newNickname);
                            setShowSettings(false);
                          } catch (err: any) {
                            alert(err.message);
                          }
                        }}
                        className="bg-[#ff8c00] text-white p-3 rounded-xl hover:bg-[#ffa500]"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Volumes */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-[#ff8c00] uppercase tracking-widest">{t.musicVolume}</label>
                        <span className="text-[10px] font-bold text-white">{musicVolume}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={musicVolume}
                        onChange={(e) => setMusicVolume(Number(e.target.value))}
                        className="w-full accent-[#ff8c00]"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-[#ff8c00] uppercase tracking-widest">{t.sfxVolume}</label>
                        <span className="text-[10px] font-bold text-white">{sfxVolume}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={sfxVolume}
                        onChange={(e) => setSfxVolume(Number(e.target.value))}
                        className="w-full accent-[#ff8c00]"
                      />
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setColorblindMode(!colorblindMode)}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${colorblindMode ? 'bg-[#ff8c00]/10 border-[#ff8c00] text-white' : 'bg-black/20 border-[#4a2c2a] text-[#a08070]'}`}
                    >
                      <Zap className="w-5 h-5" />
                      <span className="text-[10px] font-black uppercase">{t.colorblind}</span>
                    </button>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-[#ff8c00] uppercase tracking-widest text-center block">{t.animations}</label>
                      <select 
                        value={animationQuality}
                        onChange={(e) => setAnimationQuality(e.target.value)}
                        className="w-full bg-black/20 border-2 border-[#4a2c2a] p-3 rounded-xl text-white text-[10px] font-black uppercase outline-none"
                      >
                        <option value="High">{t.high}</option>
                        <option value="Medium">{t.medium}</option>
                        <option value="Low">{t.low}</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    onClick={() => signOut(auth)}
                    className="w-full bg-red-500/10 border-2 border-red-500/50 text-red-500 font-black p-4 rounded-2xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-5 h-5" /> {t.signOut}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );

  const renderLobby = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#1a0f0a] text-[#f4a460] p-4 stone-texture">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex justify-between items-end border-b-4 border-[#4a2c2a] pb-6">
          <div>
            <h2 className="text-4xl font-black tracking-tighter text-white italic">{t.camp}: {roomCode}</h2>
            <p className="text-xs font-bold text-[#ff8c00] uppercase tracking-widest">{t.status}: {t.gatheringTeam}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold opacity-50 uppercase">{t.explorers}</p>
            <p className="text-3xl font-black text-[#ff4500]">{players.length}/10</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest font-black text-[#ff8c00] flex items-center gap-2">
              <Users className="w-4 h-4" /> {t.teamRoster}
            </h3>
            <div className="space-y-2">
              {players.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-black/30 p-4 border-2 border-[#4a2c2a] rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xl shadow-[0_0_15px_rgba(255,255,255,0.2)]" style={{ backgroundColor: p.color }}>
                      {p.avatar.emoji}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-white">{p.nickname}</span>
                      <span className="text-[8px] uppercase tracking-widest text-[#ff8c00]">{p.avatar.name}</span>
                    </div>
                    {p.isGameMaster && <span className="text-[9px] bg-[#ff4500] text-white px-2 py-0.5 rounded-full font-black">{t.leader}</span>}
                  </div>
                  <span className="text-[10px] font-bold text-[#ff8c00]">{t.ready}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 flex flex-col justify-center">
            {room?.gameMasterId === playerId ? (
              <button 
                onClick={handleStartGame}
                disabled={players.length < 2}
                className="w-full bg-[#ff4500] text-white font-black p-8 rounded-2xl hover:bg-[#ff6347] transition-all shadow-xl shadow-[#ff4500]/20 uppercase tracking-[0.2em] text-xl disabled:opacity-30"
              >
                {t.departExpedition}
              </button>
            ) : (
              <div className="p-10 border-4 border-dashed border-[#4a2c2a] rounded-3xl text-center text-sm font-black text-[#ff8c00] italic animate-pulse">
                {t.waitingForLeader}
              </div>
            )}
            <button 
              onClick={() => setRoomCode(null)}
              className="w-full border-2 border-[#4a2c2a] text-[#f4a460] font-bold p-4 rounded-xl hover:bg-white/5 transition-all uppercase text-xs"
            >
              {t.leaveCamp}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGame = () => {
    const currentPlayer = players.find(p => p.id === playerId);
    const isEliminated = currentPlayer?.status !== 'active';
    const sortedPlayers = [...players].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      if (a.status !== 'active' && b.status !== 'active') {
        const roundsDiff = (b.roundsSurvived || 0) - (a.roundsSurvived || 0);
        if (roundsDiff !== 0) return roundsDiff;
        // Tie-breaker: whoever died later (larger timestamp) is ranked higher
        const aTime = a.eliminatedAt?.toMillis() || 0;
        const bTime = b.eliminatedAt?.toMillis() || 0;
        return bTime - aTime;
      }
      return 0;
    });

    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-[#1a0f0a] text-[#f4a460] p-4 gap-6 overflow-hidden stone-texture">
        {/* Left Panel: Ranking & Chat */}
        <div className="lg:w-1/4 space-y-4 flex flex-col h-[calc(100vh-2rem)]">
          <div className="bg-black/40 p-5 border-2 border-[#4a2c2a] rounded-3xl backdrop-blur-sm">
            <h3 className="text-[10px] font-black text-[#ff8c00] uppercase tracking-widest mb-4 flex items-center gap-2">
              <Trophy className="w-3 h-3" /> {t.liveRanking}
            </h3>
            <div className="space-y-2 max-h-[30vh] overflow-y-auto scrollbar-thin pr-1">
              {sortedPlayers?.map((p, i) => (
                <div 
                  key={p.id} 
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${p.status === 'active' ? 'bg-white/5 border-[#4a2c2a]' : 'bg-red-500/5 border-red-500/20 opacity-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-[#a08070]">#{i + 1}</span>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ backgroundColor: p.color }}>
                      {p.avatar.emoji}
                    </div>
                    <span className="text-xs font-bold text-white truncate max-w-[80px]">{p.nickname}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-[#ff8c00] uppercase">
                      {p.status === 'active' ? t.round : t.survived}
                    </p>
                    <p className={`text-[10px] font-black ${p.status === 'active' ? 'text-green-400' : 'text-red-500'}`}>
                      {p.status === 'active' ? (room?.round || 0) : (p.roundsSurvived || 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 bg-black/40 border-2 border-[#4a2c2a] rounded-3xl p-4 flex flex-col overflow-hidden backdrop-blur-sm">
            <h3 className="text-[10px] font-black text-[#ff8c00] uppercase tracking-widest mb-3 flex items-center gap-2">
              <MessageSquare className="w-3 h-3" /> {t.expeditionChat}
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin pr-2 mb-4">
              {messages?.map(m => (
                <div key={m.id} className={`flex flex-col ${m.senderId === playerId ? 'items-end' : 'items-start'}`}>
                  <span className="text-[8px] font-bold opacity-50 mb-0.5">{m.nickname}</span>
                  <div className={`px-3 py-1.5 rounded-2xl text-sm ${m.senderId === playerId ? 'bg-[#ff4500] text-white' : 'bg-[#2c1e1a] text-[#f4a460]'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {['😈', '🔥', '💀', '👋'].map(emoji => (
                <button 
                  key={emoji}
                  onClick={() => handleSendMessage(emoji)}
                  className="bg-[#2c1e1a] hover:bg-[#4a2c2a] p-2 rounded-xl text-xl transition-all"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {t.chatPhrases?.map(phrase => (
                <button 
                  key={phrase}
                  onClick={() => handleSendMessage(phrase)}
                  className="bg-[#2c1e1a] hover:bg-[#4a2c2a] p-1.5 rounded-lg text-[10px] font-bold text-[#f4a460] transition-all uppercase"
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Game Board */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 relative">
          <AnimatePresence>
            {countdown !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1.5 }}
                exit={{ opacity: 0, scale: 3 }}
                className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
              >
                <div className="text-9xl font-black text-white italic drop-shadow-[0_0_30px_rgba(255,69,0,0.8)] animate-shake">
                  {countdown === 0 ? t.go : countdown}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {bannerText && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-[#ff4500] text-white font-black px-6 py-2 rounded-full text-sm uppercase tracking-widest shadow-lg z-30"
              >
                {bannerText}
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`relative bg-[#2c1e1a] border-4 border-[#4a2c2a] p-2 rounded-3xl shadow-2xl shadow-black ${engine?.phase === 'warning' ? 'animate-shake' : ''}`}>
            <div 
              className="grid gap-1.5" 
              style={{ 
                gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                width: 'min(85vw, 550px)',
                height: 'min(85vw, 550px)'
              }}
            >
              {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                const x = i % GRID_SIZE;
                const y = Math.floor(i / GRID_SIZE);
                const id = getCellId(x, y);
                const isDanger = engine?.danger_zones.includes(id);
                const isLava = engine?.lava_zones.includes(id);
                const isSafe = engine?.safe_zone === id;
                
                return (
                  <div 
                    key={id}
                    onClick={() => handleMove(x, y)}
                    className={`
                      relative rounded-lg cursor-pointer transition-all duration-300 border border-black/20 overflow-hidden
                      ${isLava ? 'bg-[#ff4500] lava-glow scale-95' : 
                        isSafe ? 'bg-blue-500/30 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' :
                        isDanger ? 'bg-[#ff8c00] animate-pulse scale-105 z-10' : 
                        'bg-[#4a2c2a] hover:bg-[#5a3c3a]'}
                    `}
                  >
                    {/* Safe Zone Shield */}
                    {isSafe && (
                      <div className="absolute inset-0 flex items-center justify-center text-2xl z-20 animate-bounce">
                        🛡️
                      </div>
                    )}
                    {/* Colorblind Mode Patterns */}
                    {colorblindMode && isLava && (
                      <div className="absolute inset-0 opacity-40 pointer-events-none flex items-center justify-center">
                        <X className="w-full h-full text-black/40 stroke-[4]" />
                      </div>
                    )}
                    {colorblindMode && isDanger && (
                      <div className="absolute inset-0 opacity-40 pointer-events-none flex items-center justify-center">
                        <div className="w-full h-full border-4 border-black/40 border-dashed rounded-lg" />
                      </div>
                    )}

                    {/* Lava Particles */}
                    {isLava && animationQuality !== 'Low' && (
                      <>
                        <div className="lava-particle w-1 h-1 left-[20%] top-[60%]" style={{ animationDelay: '0.2s' }} />
                        <div className="lava-particle w-2 h-2 left-[50%] top-[40%]" style={{ animationDelay: '0.5s' }} />
                        {animationQuality === 'High' && (
                          <div className="lava-particle w-1.5 h-1.5 left-[70%] top-[80%]" style={{ animationDelay: '0.8s' }} />
                        )}
                      </>
                    )}
                    <AnimatePresence>
                      {players.filter(p => p.status === 'active' && p.position.x === x && p.position.y === y).map(p => (
                        <motion.div
                          key={p.id}
                          layoutId={p.id}
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          className="absolute inset-1.5 rounded-full border-2 border-black/30 flex items-center justify-center shadow-lg text-xl"
                          style={{ backgroundColor: p.color }}
                        >
                          {p.avatar.emoji}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Overlays */}
            {showPreview && currentPlayer && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center text-white z-40 rounded-3xl p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-32 h-32 rounded-full flex items-center justify-center text-6xl mb-6 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                  style={{ backgroundColor: currentPlayer.color }}
                >
                  {currentPlayer.avatar.emoji}
                </motion.div>
                <h2 className="text-4xl font-black italic mb-2">{t.thisIsYou}</h2>
                <p className="text-xl font-bold text-[#ff8c00] uppercase tracking-widest">{currentPlayer.nickname}</p>
                <p className="text-xs opacity-50 mt-2 uppercase tracking-widest">{currentPlayer.avatar.name}</p>
              </div>
            )}

            {isEliminated && room?.status === 'playing' && !showPreview && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-red-500 z-10 rounded-3xl">
                <Skull className="w-24 h-24 mb-4 animate-bounce" />
                <h2 className="text-5xl font-black tracking-tighter italic uppercase">{t.burned}</h2>
                <p className="text-sm font-bold uppercase tracking-widest opacity-70">{t.fellIntoLava}</p>
                <p className="mt-8 text-[10px] font-black animate-pulse uppercase tracking-[0.5em]">{t.spectating}</p>
              </div>
            )}

            {room?.status === 'finished' && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-start text-[#ff4500] z-20 rounded-3xl p-6 overflow-y-auto scrollbar-thin">
                <Trophy className="w-12 h-12 mb-2 text-yellow-500 animate-pulse drop-shadow-[0_0_20px_rgba(234,179,8,0.5)] shrink-0" />
                <h2 className="text-2xl md:text-3xl font-black tracking-tighter italic text-white uppercase mb-2 mt-2 shrink-0">{t.expeditionEnd}</h2>
                
                {/* Podium View */}
                <div className="flex items-end justify-center gap-2 md:gap-4 mb-4 w-full max-w-lg shrink-0">
                  {/* 2nd Place */}
                  {sortedPlayers[1] && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0, y: 50 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: 0.6, type: "spring", bounce: 0.5 }}
                      className="flex flex-col items-center w-1/3"
                    >
                      <div className="text-2xl mb-1">🥈</div>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl mb-1 shadow-[0_0_15px_rgba(255,255,255,0.2)] border-2 border-gray-300" style={{ backgroundColor: sortedPlayers[1].color }}>
                        {sortedPlayers[1].avatar.emoji}
                      </div>
                      <p className="text-white font-bold text-[10px] md:text-xs truncate w-full text-center px-1">{sortedPlayers[1].nickname}</p>
                      <div className="w-full h-16 bg-gradient-to-t from-gray-400/80 to-gray-300/50 mt-1 rounded-t-xl border-t-4 border-gray-300 flex items-center justify-center text-white font-black text-2xl drop-shadow-md">
                        2
                      </div>
                    </motion.div>
                  )}

                  {/* 1st Place */}
                  {sortedPlayers[0] && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0, y: 50 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: 1.0, type: "spring", bounce: 0.5 }}
                      className="flex flex-col items-center w-1/3 z-10"
                    >
                      <div className="text-3xl mb-1 animate-bounce">🥇</div>
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-1 shadow-[0_0_25px_rgba(255,215,0,0.5)] border-2 border-yellow-400" style={{ backgroundColor: sortedPlayers[0].color }}>
                        {sortedPlayers[0].avatar.emoji}
                      </div>
                      <p className="text-white font-black text-xs md:text-sm truncate w-full text-center px-1">{sortedPlayers[0].nickname}</p>
                      <div className="w-full h-24 bg-gradient-to-t from-yellow-600/80 to-yellow-400/50 mt-1 rounded-t-xl border-t-4 border-yellow-400 flex items-center justify-center text-white font-black text-3xl drop-shadow-md">
                        1
                      </div>
                    </motion.div>
                  )}

                  {/* 3rd Place */}
                  {sortedPlayers[2] && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0, y: 50 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
                      className="flex flex-col items-center w-1/3"
                    >
                      <div className="text-xl mb-1">🥉</div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg mb-1 shadow-[0_0_15px_rgba(205,127,50,0.4)] border-2 border-amber-600" style={{ backgroundColor: sortedPlayers[2].color }}>
                        {sortedPlayers[2].avatar.emoji}
                      </div>
                      <p className="text-white font-bold text-[8px] md:text-[10px] truncate w-full text-center px-1">{sortedPlayers[2].nickname}</p>
                      <div className="w-full h-12 bg-gradient-to-t from-orange-800/80 to-amber-700/50 mt-1 rounded-t-xl border-t-4 border-amber-600 flex items-center justify-center text-white font-black text-xl drop-shadow-md">
                        3
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Other Players List */}
                {sortedPlayers.length > 3 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="w-full max-w-sm max-h-24 mb-4 overflow-y-auto scrollbar-thin space-y-2 pr-2 shrink-0"
                  >
                    {sortedPlayers.slice(3).map((p, i) => (
                      <div key={p.id} className="flex flex-row items-center justify-between bg-black/40 border-2 border-[#4a2c2a] rounded-xl p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-[#a08070] font-black text-xs">#{i + 4}</span>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ backgroundColor: p.color }}>
                            {p.avatar.emoji}
                          </div>
                          <span className="text-white font-bold text-sm">{p.nickname}</span>
                        </div>
                        <span className="text-[10px] font-black text-[#ff4500] uppercase">{p.roundsSurvived || 0} {t.round}</span>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* Controls */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 2.0 }}
                  className="flex flex-col items-center gap-2 w-full max-w-sm mt-auto shrink-0"
                >
                  {room?.gameMasterId === playerId && (
                    <button 
                      onClick={handleRestart}
                      className="w-full bg-[#ff4500] text-white font-black py-3 rounded-xl hover:bg-[#ff6347] transition-all shadow-xl shadow-[#ff4500]/30 uppercase tracking-widest text-sm"
                    >
                      {t.newExpedition}
                    </button>
                  )}
                  <button 
                    onClick={() => setRoomCode(null)}
                    className="text-[#a08070] font-black uppercase tracking-widest text-xs hover:text-white transition-colors p-2"
                  >
                    {t.returnToMenu}
                  </button>
                </motion.div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Status & Controls */}
        <div className="lg:w-1/4 space-y-4 flex flex-col h-[calc(100vh-2rem)]">
          <div className="bg-black/40 p-5 border-2 border-[#4a2c2a] rounded-3xl space-y-4 backdrop-blur-sm">
            <div className="flex justify-between items-center">
              <h2 className="font-black text-white italic uppercase">{t.camp} {roomCode}</h2>
              <span className="text-[10px] bg-[#ff4500] text-white px-3 py-1 rounded-full font-black uppercase">{t.round} {room?.round}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="opacity-50 uppercase">{t.yourStatus}:</span>
                <span className={isEliminated ? 'text-red-500' : 'text-[#ff4500]'}>
                  {isEliminated ? t.eliminated : t.active}
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-bold">
                <span className="opacity-50 uppercase">{t.survivors}:</span>
                <span className="text-white">{players.filter(p => p.status === 'active').length} / {players.length}</span>
              </div>
            </div>
          </div>

          <div className="flex-1" />

          <WASDPanel pressedKeys={pressedKeys} />
        </div>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#1a0f0a] flex items-center justify-center stone-texture">
        <div className="w-12 h-12 border-4 border-[#ff4500]/20 border-t-[#ff4500] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  if (!profile) return <NicknameScreen onSetNickname={setNickname} />;

  return (
    <div className="min-h-screen bg-[#1a0f0a] selection:bg-[#ff4500] selection:text-white overflow-x-hidden">
      {!roomCode ? renderStart() : room?.status === 'lobby' ? renderLobby() : renderGame()}
    </div>
  );
}
