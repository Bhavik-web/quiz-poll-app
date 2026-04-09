import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';

export default function Home() {
  const [code, setCode] = null || useState('');
  const navigate = useNavigate();

  const handleJoin = (e) => {
    e.preventDefault();
    if (code.trim().length === 6) {
      navigate(`/room/${code.toUpperCase()}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="card w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-500/20 text-brand-500 mb-4">
            <Zap size={32} />
          </div>
          <h1 className="text-3xl font-bold mb-2 text-slate-900 dark:text-white">Join a Live Session</h1>
          <p className="text-slate-500 dark:text-slate-400">Enter the room code to participate.</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <input
              type="text"
              maxLength={6}
              placeholder="e.g. A1B2C3"
              className="input-field text-center text-2xl uppercase tracking-widest font-bold placeholder:font-normal placeholder:lowercase placeholder:tracking-normal"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            className="btn-primary w-full text-lg py-3"
            disabled={code.length !== 6}
          >
            Join Room
          </button>
        </form>


      </div>
    </div>
  );
}
