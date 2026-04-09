import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Edit2, Play, Users, Trash2 } from 'lucide-react';

const rawUrl = import.meta.env.VITE_BACKEND_URL || 'https://quizpoll-backend.onrender.com';
const API_URL = rawUrl.replace(/\/+$/, '') + '/api';

export default function AdminDashboard() {
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
      return;
    }
    fetchRooms();
  }, [token, navigate]);

  const fetchRooms = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRooms(res.data);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) navigate('/admin/login');
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      const res = await axios.post(`${API_URL}/admin/rooms`, { name: newRoomName }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewRoomName('');
      setShowCreate(false);
      // Optimistic update — append new room directly instead of re-fetching all
      setRooms(prev => [...prev, res.data]);
    } catch (err) {
      alert('Error creating room');
    }
  };

  const handleDeleteRoom = async (e, roomId) => {
    e.stopPropagation(); // Prevents triggering the card click
    if (!window.confirm("Are you sure you want to permanently delete this room?")) return;
    try {
      await axios.delete(`${API_URL}/admin/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchRooms();
    } catch (err) {
      console.error(err);
      alert(err.response?.status === 404 ? "Detailed endpoint not found on server. Did you restart the backend?" : "Error deleting room: " + (err.response?.data?.message || err.message));
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-12">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
        <button onClick={logout} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">Logout</button>
      </div>

      <div className="mb-8">
        <button 
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} /> Create New Room
        </button>
      </div>

      {showCreate && (
        <div className="card mb-8 animate-fade-in-up">
          <form onSubmit={handleCreateRoom} className="flex gap-4">
            <input
              type="text"
              placeholder="e.g. Weekly All-Hands Poll"
              className="input-field flex-1"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary whitespace-nowrap">Save Room</button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map(room => (
          <div key={room._id} className="card group cursor-pointer hover:border-brand-500/50 transition-all flex flex-col" onClick={() => navigate(`/admin/room/${room._id}`)}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold line-clamp-1 text-slate-900 dark:text-white">{room.name}</h3>
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono px-2 py-1 rounded text-sm mt-1">{room.roomCode}</span>
            </div>
            
            <div className="flex items-center text-slate-400 text-sm gap-4 mb-6">
              <span className="flex items-center gap-1"><Edit2 size={14}/> {room.questions.length} Qs</span>
              <span className="flex items-center gap-1"><Users size={14}/> {room.status}</span>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
              <span className="text-brand-600 dark:text-brand-400 font-medium group-hover:underline">Manage Session</span>
              <div className="flex gap-3">
                <button 
                  onClick={(e) => handleDeleteRoom(e, room._id)} 
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  title="Delete Room"
                >
                  <Trash2 size={18} />
                </button>
                <button className="text-brand-600 dark:text-brand-400 transition-colors">
                  <Play size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {rooms.length === 0 && !showCreate && (
           <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
             No rooms created yet.
           </div>
        )}
      </div>
    </div>
  );
}
