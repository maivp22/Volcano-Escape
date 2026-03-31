import React, { useState } from 'react';
import { auth } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { motion } from 'motion/react';
import { Flame, LogIn, UserPlus, Mail, Lock } from 'lucide-react';

export function AuthScreen() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a0f0e] flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#2c1e1a] border-2 border-[#4a2c2a] rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#ff4500] rounded-2xl flex items-center justify-center shadow-lg shadow-[#ff4500]/20 mb-4">
            <Flame className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Volcano Escape</h1>
          <p className="text-[#a08070] text-sm mt-2">
            {isRegistering && <span>Create your account</span>}
            {!isRegistering && <span>Welcome back, survivor</span>}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#a08070] uppercase tracking-wider ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a08070]" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#1a0f0e] border-2 border-[#4a2c2a] rounded-2xl py-3 pl-12 pr-4 text-white focus:border-[#ff4500] outline-none transition-colors"
                placeholder="survivor@volcano.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#a08070] uppercase tracking-wider ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a08070]" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#1a0f0e] border-2 border-[#4a2c2a] rounded-2xl py-3 pl-12 pr-4 text-white focus:border-[#ff4500] outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {isRegistering && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#a08070] uppercase tracking-wider ml-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a08070]" />
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-[#1a0f0e] border-2 border-[#4a2c2a] rounded-2xl py-3 pl-12 pr-4 text-white focus:border-[#ff4500] outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 rounded-xl">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#ff4500] hover:bg-[#ff5722] disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#ff4500]/20 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isRegistering && <UserPlus className="w-5 h-5" />}
                {!isRegistering && <LogIn className="w-5 h-5" />}
                {isRegistering && <span>Register</span>}
                {!isRegistering && <span>Sign In</span>}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
            }}
            className="text-[#a08070] hover:text-white text-sm font-medium transition-colors"
          >
            {isRegistering && <span>Already have an account? Sign In</span>}
            {!isRegistering && <span>Don't have an account? Register</span>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
