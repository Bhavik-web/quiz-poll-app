import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from '../../utils/socket';
import { Users, Play, SkipForward, BarChart2, StopCircle, ArrowLeft, Plus, Monitor, Edit2, Trash2 } from 'lucide-react';
import QRCode from 'react-qr-code';

const rawUrl = import.meta.env.VITE_BACKEND_URL || 'https://quizpoll-backend.onrender.com';
const API_URL = rawUrl.replace(/\/+$/, '') + '/api';

export default function AdminLiveControl() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [participantsCount, setParticipantsCount] = useState(0);
  const [responsesCount, setResponsesCount] = useState(0);
  const [liveStats, setLiveStats] = useState([]);
  const [isConnected, setIsConnected] = useState(true);
  
  // Question form
  const [showAddQ, setShowAddQ] = useState(false);
  const [editingQId, setEditingQId] = useState(null);
  const [qType, setQType] = useState('poll');
  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState([{ id: '1', text: '' }, { id: '2', text: '' }]);
  const [qCorrect, setQCorrect] = useState('1');

  const navigate = useNavigate();
  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
      return;
    }
    fetchRoom();
  }, [roomId]);

  const fetchRoom = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRoom(res.data);
      
      // Init socket for admin
      socket.emit('admin_join', { roomCode: res.data.roomCode }, (data) => {
        setParticipantsCount(data?.participantsCount || 0);
        updateResponsesCount(res.data, data?.responses || []);
      });
    } catch (err) {
       console.error(err);
    }
  };

  useEffect(() => {
    socket.on('participant_update', (count) => {
      setParticipantsCount(count);
    });

    socket.on('responses_update', (responses) => {
      setResponsesCount(responses.length);
      // Calc stats if showResults is true
      calculateStats(responses);
    });

    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect', () => setIsConnected(true));

    return () => {
      socket.off('participant_update');
      socket.off('responses_update');
      socket.off('disconnect');
      socket.off('connect');
    };
  }, [room]);

  const updateResponsesCount = (rm, allRes) => {
    if (rm?.currentQuestionIndex >= 0) {
      const qId = rm.questions[rm.currentQuestionIndex]._id;
      const qRes = allRes.filter(r => r.questionId.toString() === qId.toString());
      setResponsesCount(qRes.length);
      calculateStats(qRes);
    }
  };

  const calculateStats = (responses) => {
    if (!room || room.currentQuestionIndex < 0) return;
    const q = room.questions[room.currentQuestionIndex];
    const stats = q.options.map(opt => ({
      id: opt.id,
      text: opt.text,
      count: responses.filter(r => r.selectedOption === opt.id).length
    }));
    setLiveStats(stats);
  };

  const handleStartSession = () => {
    socket.emit('admin_start_session', { roomCode: room.roomCode }, () => {
      fetchRoom(); // Refresh state
    });
  };

  const handleNextQuestion = () => {
    const nextIdx = room.currentQuestionIndex + 1;
    if (nextIdx < room.questions.length) {
      socket.emit('admin_next_question', { roomCode: room.roomCode, index: nextIdx }, () => {
        setLiveStats([]);
        setResponsesCount(0);
        fetchRoom();
      });
    }
  };

  const handleShowResults = () => {
    socket.emit('admin_show_results', { roomCode: room.roomCode }, () => {
      fetchRoom();
    });
  };

  const handleEndSession = () => {
    if (window.confirm("End this session?")) {
      socket.emit('admin_end_session', { roomCode: room.roomCode }, () => {
        fetchRoom();
      });
    }
  };

  const handleAddOption = () => {
    setQOptions([...qOptions, { id: (qOptions.length + 1).toString(), text: '' }]);
  };

  const handleEditQuestion = (q) => {
    setQType(q.type || 'poll');
    setQText(q.text);
    setQOptions(q.options && q.options.length > 0 ? q.options : [{ id: '1', text: '' }, { id: '2', text: '' }]);
    setQCorrect(q.correctAnswer || '1');
    setEditingQId(q._id);
    setShowAddQ(true);
  };

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    try {
      await axios.delete(`${API_URL}/admin/rooms/${roomId}/questions/${qId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchRoom();
    } catch (err) {
      alert("Error deleting question");
    }
  };

  const saveQuestion = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        type: qType,
        text: qText,
        options: qOptions.filter(o => o.text.trim() !== ''),
        correctAnswer: qType === 'quiz' ? qCorrect : undefined,
        timeLimit: 30
      };

      if (editingQId) {
        await axios.put(`${API_URL}/admin/rooms/${roomId}/questions/${editingQId}`, payload, { headers: { Authorization: `Bearer ${token}` }});
      } else {
        await axios.post(`${API_URL}/admin/rooms/${roomId}/questions`, payload, { headers: { Authorization: `Bearer ${token}` }});
      }
      
      setShowAddQ(false);
      setEditingQId(null);
      setQText('');
      setQOptions([{ id: '1', text: '' }, { id: '2', text: '' }]);
      fetchRoom();
    } catch (err) {
      alert("Error saving question");
    }
  };

  if (!room) return <div className="p-8 text-white">Loading...</div>;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 p-4 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><ArrowLeft size={20}/></button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{room.name}</h1>
            <div className="text-sm text-slate-500 dark:text-slate-400">Join Code: <span className="text-slate-900 dark:text-white font-mono font-bold">{room.roomCode}</span></div>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => window.open(`/admin/present/${roomId}`, '_blank')} className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-1.5 rounded-full text-sm font-bold transition-colors shadow-sm">
            <Monitor size={16} /> Present
          </button>
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-full text-sm text-slate-900 dark:text-white">
            <Users size={16} className="text-brand-600 dark:text-brand-400"/>
            <span className="font-bold">{participantsCount}</span> Online
          </div>
        </div>
      </header>

      {!isConnected && (
        <div className="w-full bg-red-500 text-white text-center py-2 text-sm font-semibold animate-pulse z-50">
          Connection lost. Reconnecting...
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Questions List */}
        <div className="w-80 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 overflow-y-auto hidden md:block">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur z-10">
            <h2 className="font-bold text-slate-900 dark:text-white">Questions ({room.questions.length})</h2>
            {room.status === 'waiting' && (
              <button 
                onClick={() => { setShowAddQ(!showAddQ); setEditingQId(null); setQText(''); setQOptions([{id:'1',text:''},{id:'2',text:''}]); }} 
                className="p-1 hover:bg-slate-700 rounded text-brand-400"
              >
                <Plus size={18}/>
              </button>
            )}
          </div>
          <div className="p-2 space-y-2">
            {room.questions.map((q, idx) => (
              <div key={q._id} className={`p-3 rounded-lg border group relative ${room.currentQuestionIndex === idx ? 'bg-brand-100 dark:bg-brand-500/20 border-brand-500' : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
                <div className="flex justify-between items-start">
                  <div className="text-xs text-brand-600 dark:text-brand-400 font-bold uppercase mb-1 drop-shadow-sm dark:drop-shadow-md">
                    {q.type} • Q{idx + 1}
                  </div>
                  {room.status === 'waiting' && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                       <button onClick={(e) => { e.stopPropagation(); handleEditQuestion(q); }} className="text-slate-400 hover:text-brand-500"><Edit2 size={14}/></button>
                       <button onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(q._id); }} className="text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                    </div>
                  )}
                </div>
                <div className="text-sm line-clamp-2">{q.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          {showAddQ && room.status === 'waiting' ? (
            <div className="max-w-xl mx-auto card">
              <h2 className="text-xl font-bold mb-4">{editingQId ? 'Edit Question' : 'Add Question'}</h2>
              <form onSubmit={saveQuestion} className="space-y-4">
                <div className="flex gap-4 mb-4">
                  <button type="button" onClick={() => setQType('poll')} className={`flex-1 py-2 rounded-lg border text-sm font-bold ${qType === 'poll' ? 'border-brand-500 bg-brand-500/20 text-white' : 'border-slate-700 text-slate-400'}`}>Poll</button>
                  <button type="button" onClick={() => setQType('quiz')} className={`flex-1 py-2 rounded-lg border text-sm font-bold ${qType === 'quiz' ? 'border-brand-500 bg-brand-500/20 text-white' : 'border-slate-700 text-slate-400'}`}>Quiz (Scored)</button>
                </div>
                
                <input type="text" placeholder="Question Text" className="input-field" value={qText} onChange={e => setQText(e.target.value)} required />
                
                <div className="space-y-2 mt-4">
                  <label className="text-sm text-slate-400">Options</label>
                  {qOptions.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      {qType === 'quiz' && (
                        <input type="radio" name="correct" checked={qCorrect === opt.id} onChange={() => setQCorrect(opt.id)} />
                      )}
                      <input type="text" className="input-field py-2" placeholder={`Option ${i+1}`} value={opt.text} onChange={e => {
                        const newOpts = [...qOptions];
                        newOpts[i].text = e.target.value;
                        setQOptions(newOpts);
                      }} required />
                    </div>
                  ))}
                  <button type="button" onClick={handleAddOption} className="text-sm text-brand-400 hover:text-brand-300">+ Add Option</button>
                </div>
                
                <div className="flex gap-4 mt-6">
                  <button type="submit" className="btn-primary flex-1">{editingQId ? 'Update Question' : 'Save Question'}</button>
                  <button type="button" onClick={() => { setShowAddQ(false); setEditingQId(null); setQText(''); setQOptions([{id:'1',text:''},{id:'2',text:''}]); }} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto flex flex-col h-full justify-center">
              {room.status === 'waiting' && (
                <div className="text-center">
                  <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-fuchsia-600 dark:from-brand-400 dark:to-fuchsia-500 mb-6 font-mono tracking-widest">{room.roomCode}</div>
                  <p className="text-xl text-slate-600 dark:text-slate-300 mb-6">Go to <span className="text-slate-900 dark:text-white font-bold">{window.location.origin}</span> and enter this code</p>
                  
                  <div className="mb-8 flex justify-center">
                    <div className="bg-white p-4 rounded-2xl shadow-xl inline-block border-4 border-slate-100">
                      <QRCode value={`${window.location.origin}/room/${room.roomCode}`} size={160} level="H" />
                    </div>
                  </div>
                  
                  {room.questions.length > 0 ? (
                    <button onClick={handleStartSession} className="btn-primary text-xl px-12 py-4 flex items-center justify-center gap-3 mx-auto">
                      <Play fill="currentColor" /> Start Session Now
                    </button>
                  ) : (
                    <div className="text-yellow-400 p-4 bg-yellow-400/10 rounded-lg inline-block">Add questions from the left panel before starting.</div>
                  )}
                </div>
              )}

              {room.status === 'active' && room.currentQuestionIndex >= 0 && (
                <div className="animate-fade-in-up">
                  <div className="mb-8">
                    <span className="text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider text-sm mb-2 block">
                      Question {room.currentQuestionIndex + 1} of {room.questions.length}
                    </span>
                    <h2 className="text-3xl md:text-5xl font-bold leading-tight text-slate-900 dark:text-white">{room.questions[room.currentQuestionIndex].text}</h2>
                  </div>

                  {/* Live Progress Bar indicator */}
                  <div className="mb-8 p-6 card flex flex-col gap-4">
                     <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-4">
                        <span className="text-slate-600 dark:text-slate-300">Responses received</span>
                        <span className="text-2xl font-bold bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300 px-4 py-1 rounded-full">{responsesCount} / {participantsCount}</span>
                     </div>
                     
                     {room.showResults && liveStats.length > 0 && (
                       <div className="space-y-4 pt-4">
                          <h3 className="font-bold flex items-center gap-2"><BarChart2 className="text-brand-400"/> Results</h3>
                          {liveStats.map(stat => {
                            const percent = responsesCount === 0 ? 0 : Math.round((stat.count / responsesCount) * 100);
                            const q = room.questions[room.currentQuestionIndex];
                            const isCorrect = q.type === 'quiz' && q.correctAnswer === stat.id;
                            
                            return (
                              <div key={stat.id} className="relative">
                                <div className="flex justify-between text-sm mb-1 z-10 relative px-2">
                                  <span className="font-medium drop-shadow-sm dark:drop-shadow-md text-slate-900 dark:text-white">{stat.text} {isCorrect && '✅'}</span>
                                  <span className="font-bold drop-shadow-sm dark:drop-shadow-md text-slate-900 dark:text-white">{percent}% ({stat.count})</span>
                                </div>
                                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 relative">
                                  <div className={`absolute top-0 left-0 h-full transition-all duration-1000 ${isCorrect ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${percent}%` }}></div>
                                </div>
                              </div>
                            )
                          })}
                       </div>
                     )}
                  </div>
                </div>
              )}

              {room.status === 'finished' && (
                <div className="text-center">
                  <h2 className="text-4xl font-bold mb-4 text-slate-900 dark:text-white">Session Finished</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-8">All questions have been completed.</p>
                  <button onClick={() => navigate('/admin/dashboard')} className="btn-secondary">Return to Dashboard</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Control Footer */}
      {room.status === 'active' && (
        <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex justify-between items-center z-10 shrink-0">
          <button onClick={handleEndSession} className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-2 transition-colors">
            <StopCircle size={20}/> End Session
          </button>
          
          <div className="flex gap-4">
            {!room.showResults ? (
               <button onClick={handleShowResults} className="btn-secondary flex items-center gap-2 border-brand-500/50 hover:bg-brand-500/20 text-white">
                 <BarChart2 size={18}/> Reveal Results
               </button>
            ) : (room.currentQuestionIndex < room.questions.length - 1 ? (
               <button onClick={handleNextQuestion} className="btn-primary flex items-center gap-2">
                 Next Question <SkipForward size={18}/>
               </button>
            ) : (
                <button onClick={handleEndSession} className="btn-primary flex items-center gap-2">
                 Finish Session <StopCircle size={18}/>
               </button>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
