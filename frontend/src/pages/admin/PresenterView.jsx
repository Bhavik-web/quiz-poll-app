import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../../utils/socket';
import { Users, BarChart2 } from 'lucide-react';
import QRCode from 'react-qr-code';

const rawUrl = import.meta.env.VITE_BACKEND_URL || 'https://quizpoll-backend-a3b5.onrender.com';
const API_URL = rawUrl.replace(/\/+$/, '') + '/api';

export default function PresenterView() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [participantsCount, setParticipantsCount] = useState(0);
  const [responsesCount, setResponsesCount] = useState(0);
  const [liveStats, setLiveStats] = useState([]);
  const [isConnected, setIsConnected] = useState(true);

  // Read-only token check (presentation mode assumes admin token)
  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    if (!token) {
      window.close(); // Not authenticated
      return;
    }
    fetchRoom();
  }, [roomId, token]);

  const fetchRoom = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRoom(res.data);
      
      socket.emit('admin_join', { roomCode: res.data.roomCode }, (data) => {
        setParticipantsCount(data?.participantsCount || 0);
        updateResponsesCount(res.data, data?.responses || []);
      });
    } catch (err) {
       console.error("Error fetching room for presentation", err);
    }
  };

  useEffect(() => {
    if (!room) return;

    // To ensure the view stays perfectly in sync with the control panel,
    // we should really listen for state changes. However, socket mostly sends individual updates.
    // For simplicity, we can listen for responses and participants, but we also 
    // need to know when question changes.
    // Actually, we can poll or listen to new_question events.
    
    // We can listen to general participant updates
    socket.on('participant_update', (count) => {
      setParticipantsCount(count);
    });

    socket.on('responses_update', (responses) => {
      setResponsesCount(responses.length);
      calculateStats(responses);
    });

    // The admin panel emits 'new_question' to the room code
    socket.on('new_question', (q) => {
      // Re-fetch room to get full state
      fetchRoom();
    });

    socket.on('show_results', () => {
      fetchRoom();
    });
    
    socket.on('session_ended', () => {
      fetchRoom();
    });

    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect', () => setIsConnected(true));

    return () => {
      socket.off('participant_update');
      socket.off('responses_update');
      socket.off('new_question');
      socket.off('show_results');
      socket.off('session_ended');
      socket.off('disconnect');
      socket.off('connect');
    };
  }, [room?.roomCode]);


  // Socket events (new_question, show_results, session_ended, responses_update)
  // already keep this view perfectly in sync. Removed the previous 5-second
  // setInterval(fetchRoom) polling — it created unnecessary DB/network load
  // that scales linearly with the number of admin presenter windows.



  const updateResponsesCount = (rm, allRes) => {
    if (rm?.currentQuestionIndex >= 0 && rm.questions.length > 0) {
      const q = rm.questions[rm.currentQuestionIndex];
      const qId = q._id;
      const qRes = allRes.filter(r => r.questionId.toString() === qId.toString());
      setResponsesCount(qRes.length);
      
      // Calculate stats based on responses
      const stats = q.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        count: qRes.filter(r => r.selectedOption === opt.id).length
      }));
      setLiveStats(stats);
    }
  };

  const calculateStats = (responses) => {
    if (!room || room.currentQuestionIndex < 0) return;
    const q = room.questions[room.currentQuestionIndex];
    if (!q) return;
    const stats = q.options.map(opt => ({
      id: opt.id,
      text: opt.text,
      count: responses.filter(r => r.selectedOption === opt.id).length
    }));
    setLiveStats(stats);
  };

  if (!room) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-bold text-2xl">Loading Presentation...</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-brand-600/10 dark:bg-brand-500/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-fuchsia-600/10 dark:bg-fuchsia-500/20 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="absolute top-6 right-6 flex items-center gap-4 z-50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-6 py-3 rounded-full shadow-lg border border-slate-200 dark:border-slate-700">
         <div className="text-xl font-bold flex gap-2 items-center text-slate-800 dark:text-white">
           <Users className="text-brand-500" />
           {participantsCount} Joined
         </div>
      </div>

      {!isConnected && (
        <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-center py-3 text-lg font-semibold animate-pulse z-50">
          Connection lost. Reconnecting...
        </div>
      )}

      <div className="w-full max-w-6xl w-full z-10 flex-1 flex flex-col justify-center">
        {room.status === 'waiting' && (
          <div className="text-center animate-fade-in-up">
            <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-4">{room.name}</h1>
            <p className="text-3xl text-slate-600 dark:text-slate-300 mb-12">
              Join at <span className="font-bold text-brand-600 dark:text-brand-400">{window.location.origin}</span>
            </p>
            
            <div className="flex justify-center items-center gap-16">
              <div className="bg-white p-6 rounded-3xl shadow-2xl border-8 border-slate-100">
                <QRCode value={`${window.location.origin}/room/${room.roomCode}`} size={300} level="H" />
              </div>
              <div className="text-left">
                <p className="text-2xl text-slate-500 dark:text-slate-400 font-medium mb-2">Room Code</p>
                <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-fuchsia-600 font-mono tracking-widest">{room.roomCode}</div>
              </div>
            </div>
          </div>
        )}

        {room.status === 'active' && room.currentQuestionIndex >= 0 && (
          <div className="animate-fade-in-up w-full">
            <div className="mb-12 text-center">
              <h2 className="text-5xl md:text-6xl font-bold leading-tight text-slate-900 dark:text-white max-w-5xl mx-auto">{room.questions[room.currentQuestionIndex].text}</h2>
            </div>

            {/* Results Grid - Show live updating bars if it's a poll, or wait for showResults if it's a quiz */}
            <div className="max-w-4xl mx-auto bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/50">
               <div className="flex justify-between items-center mb-8 border-b border-slate-200 dark:border-slate-700 pb-6">
                  <h3 className="text-3xl font-bold flex items-center gap-3 text-slate-900 dark:text-white"><BarChart2 className="w-8 h-8 text-brand-500"/> Live Responses</h3>
                  <span className="text-3xl font-black bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300 px-6 py-2 rounded-full">{responsesCount}</span>
               </div>
               
               <div className="space-y-6">
                 {liveStats.map(stat => {
                    const percent = responsesCount === 0 ? 0 : Math.round((stat.count / responsesCount) * 100);
                    const q = room.questions[room.currentQuestionIndex];
                    
                    // For quizzes, only highlight correct answering if results are revealed
                    const isCorrect = q.type === 'quiz' && q.correctAnswer === stat.id && room.showResults;
                    // Keep bars hidden for quiz until revealed, but polls are always revealed
                    const showBars = q.type === 'poll' || room.showResults;

                    return (
                      <div key={stat.id} className="relative">
                        <div className="flex justify-between text-2xl mb-3 z-10 relative px-4">
                          <span className="font-bold drop-shadow-md text-slate-900 dark:text-white">{stat.text} {isCorrect && ' ✅'}</span>
                          {showBars && <span className="font-bold drop-shadow-md text-slate-900 dark:text-white">{percent}% ({stat.count})</span>}
                        </div>
                        <div className="h-14 bg-slate-200/50 dark:bg-slate-900/50 rounded-xl overflow-hidden shadow-inner relative border border-slate-300 dark:border-slate-800">
                          <div 
                            className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out ${isCorrect ? 'bg-green-500' : 'bg-brand-500'}`} 
                            style={{ width: showBars ? `${percent}%` : '0%' }}
                          ></div>
                        </div>
                      </div>
                    )
                 })}
               </div>
            </div>
          </div>
        )}

        {room.status === 'finished' && (
           <div className="text-center animate-fade-in-up">
              <h2 className="text-6xl font-bold mb-6 text-slate-900 dark:text-white">Session Finished</h2>
              <p className="text-3xl text-slate-500 dark:text-slate-400">Thank you for participating!</p>
           </div>
        )}
      </div>
    </div>
  );
}
