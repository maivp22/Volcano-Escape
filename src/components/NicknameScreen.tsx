import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Compass, User, ArrowRight } from 'lucide-react';

interface NicknameScreenProps {
  onSetNickname: (nickname: string) => Promise<void>;
}

export function NicknameScreen({ onSetNickname }: NicknameScreenProps) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSetNickname(nickname);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a0f0e] flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-[#2c1e1a] border-2 border-[#4a2c2a] rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#ff8c00] rounded-2xl flex items-center justify-center shadow-lg shadow-[#ff8c00]/20 mb-4">
            <Compass className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Set Your Nickname</h1>
          <p className="text-[#a08070] text-sm mt-2">Choose your survivor name</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#a08070] uppercase tracking-wider ml-1">Nickname</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a08070]" />
              <input 
                type="text" 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                maxLength={12}
                className="w-full bg-[#1a0f0e] border-2 border-[#4a2c2a] rounded-2xl py-3 pl-12 pr-4 text-white focus:border-[#ff8c00] outline-none transition-colors"
                placeholder="Survivor123"
              />
            </div>
            <p className="text-xs text-[#a08070] ml-1">Max 12 characters, no spaces.</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 rounded-xl">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading || !nickname.trim()}
            className="w-full bg-[#ff8c00] hover:bg-[#ffa500] disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#ff8c00]/20 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Confirm Nickname
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
