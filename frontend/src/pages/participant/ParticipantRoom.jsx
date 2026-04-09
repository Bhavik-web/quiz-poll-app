import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../../utils/socket';
import { Loader2, CheckCircle } from 'lucide-react';

export default function ParticipantRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('connecting');
  const [question, setQuestion] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [answeredId, setAnsweredId] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [userId] = useState(() => {
    let id = localStorage.getItem('guestId');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('guestId', id);
    }
    return id;
  });

  useEffect(() => {
    socket.emit('join_room', { roomCode, userId }, (response) => {
      if (response.error) {
        alert(response.error);
        navigate('/');
        return;
      }
      setStatus(response.status);
      setQuestion(response.currentQuestion);
      setShowResults(response.showResults);
    });

    socket.on('new_question', (q) => {
      setQuestion(q);
      setStatus('active');
      setShowResults(false);
      setResultsData(null);
      setAnsweredId(null);
    });

    socket.on('show_results', (data) => {
      setShowResults(true);
      setResultsData(data);
    });

    socket.on('session_ended', () => {
      setStatus('finished');
    });
    
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect', () => setIsConnected(true));

    return () => {
      socket.off('new_question');
      socket.off('show_results');
      socket.off('session_ended');
      socket.off('disconnect');
      socket.off('connect');
    };
  }, [roomCode, userId, navigate]);

  const handleAnswer = (optionId) => {
    if (answeredId) return;
    setAnsweredId(optionId);
    socket.emit('submit_answer', {
      roomCode,
      userId,
      questionId: question._id,
      selectedOption: optionId
    }, (res) => {
      if (res.error) {
        setAnsweredId(null);
        alert(res.error);
      }
    });
  };

  if (status === 'connecting') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-brand-500 w-12 h-12" /></div>;
  }

  if (status === 'finished') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <div className="card w-full max-w-md">
          <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Session Ended</h2>
          <p className="text-slate-500 dark:text-slate-400">Thanks for participating!</p>
        </div>
      </div>
    );
  }

  if (status === 'waiting' || (status === 'active' && !question)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <Loader2 className="animate-spin text-brand-600 dark:text-brand-500 w-16 h-16 mb-6" />
        <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Waiting for the Host</h2>
        <p className="text-slate-500 dark:text-slate-400">Please wait until the next question is pushed.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {!isConnected && (
        <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-center py-2 text-sm font-semibold animate-pulse z-50">
          Connection lost. Reconnecting...
        </div>
      )}
      <div className="w-full max-w-lg card animate-fade-in-up">
        <div className="mb-8">
          <span className="inline-block px-3 py-1 bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            {question.type === 'poll' ? 'Live Poll' : 'Live Quiz'}
          </span>
          <h2 className="text-2xl md:text-3xl font-bold leading-tight text-slate-900 dark:text-white">{question.text}</h2>
        </div>

        <div className="space-y-4">
          {question.options.map((opt) => {
             const isAnswered = answeredId === opt.id;
             let btnClass = "w-full text-left p-4 rounded-xl border-2 transition-all flex justify-between items-center text-slate-900 dark:text-white ";
             
             if (showResults && resultsData) {
               // Showing results mode
               let isCorrect = question.type === 'quiz' && resultsData.correctAnswer === opt.id;
               let isWrongSelection = question.type === 'quiz' && isAnswered && !isCorrect;
               
               if (isCorrect) btnClass += "border-green-500 bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-100";
               else if (isWrongSelection) btnClass += "border-red-500 bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-100";
               else btnClass += "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 opacity-50";

             } else {
               // Voting mode
               if (answeredId) {
                 if (isAnswered) btnClass += "border-brand-500 bg-brand-100 dark:bg-brand-500/20 text-brand-800 dark:text-brand-100";
                 else btnClass += "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 opacity-50";
               } else {
                 btnClass += "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700/50 cursor-pointer active:scale-[0.98]";
               }
             }

             return (
               <button
                 key={opt.id}
                 disabled={!!answeredId || showResults}
                 onClick={() => handleAnswer(opt.id)}
                 className={btnClass}
               >
                 <span className="text-lg font-medium">{opt.text}</span>
                 {isAnswered && !showResults && <CheckCircle className="text-brand-500" />}
               </button>
             );
          })}
        </div>
      </div>
    </div>
  );
}
