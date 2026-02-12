
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, NavLink, Navigate } from 'react-router-dom';
import { generateTKAQuestions } from './services/geminiService';
import { Question, TopicSelection, User, UserResult } from './types';
import { QuestionCard } from './components/QuestionCard';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend
} from 'recharts';

const NUMERASI_TOPICS = [
  "Bilangan & Operasi", "Aljabar Dasar", "Geometri Bangun Datar", "Geometri Bangun Ruang", "Pengukuran & Satuan", "Data & Statistik", "KPK & FPB", "Pecahan & Desimal", "Perbandingan & Skala"
];

const LITERASI_TOPICS = [
  "Teks Fiksi (Sastra)", "Teks Informasi (Faktual)", "Ide Pokok & Pendukung", "Simpulan & Interpretasi", "Ejaan & Tata Bahasa", "Kosakata & Sinonim", "Puisi & Majas", "Struktur Kalimat"
];

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const Logo3D = ({ size = "normal" }: { size?: "small" | "normal" | "large" }) => {
  const dimensions = size === "small" ? "w-12 h-12" : size === "large" ? "w-32 h-32" : "w-20 h-20";
  const fontSize = size === "small" ? "text-2xl" : size === "large" ? "text-6xl" : "text-4xl";
  const rounding = size === "small" ? "rounded-xl" : "rounded-[2.5rem]";
  
  return (
    <div className={`${dimensions} logo-container group cursor-default relative z-10`}>
      <div className={`absolute inset-0 bg-blue-600 ${rounding} transform rotate-6 scale-95 group-hover:rotate-12 group-hover:scale-100 transition-all duration-500 shadow-2xl shadow-blue-500/30 opacity-40`}></div>
      <div className={`logo-3d-element absolute inset-0 bg-gradient-to-br from-blue-400 via-blue-600 to-blue-900 ${rounding} flex items-center justify-center text-white font-black shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] border-2 border-white/20 backdrop-blur-md`}>
        <span className={`${fontSize} tracking-tighter logo-glow select-none`}>E</span>
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-50"></div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgotPassword'>('login');
  const [authForm, setAuthForm] = useState({ username: '', phone: '', password: '' });
  const [resetStatus, setResetStatus] = useState<{ success: boolean; msg: string } | null>(null);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultsHistory, setResultsHistory] = useState<UserResult[]>([]);
  
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedTopics, setSelectedTopics] = useState<TopicSelection>({
    math: ["Bilangan & Operasi", "Geometri Bangun Datar"],
    indonesian: ["Teks Fiksi (Sastra)", "Teks Informasi (Faktual)"]
  });

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('edugen_user_session');
    if (timerRef.current) clearInterval(timerRef.current);
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    navigate('/');
  };

  // Session Inactivity Timeout Logic
  useEffect(() => {
    if (!currentUser) return;

    const resetSessionTimer = () => {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = setTimeout(() => {
        handleLogout();
        alert("Sesi Anda telah berakhir karena tidak ada aktivitas selama 30 menit. Silakan masuk kembali.");
      }, SESSION_TIMEOUT_MS);
    };

    // Initial start
    resetSessionTimer();

    // Event listeners for activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetSessionTimer));

    return () => {
      events.forEach(event => window.removeEventListener(event, resetSessionTimer));
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    };
  }, [currentUser]);

  // Load Initial State
  useEffect(() => {
    const savedUser = localStorage.getItem('edugen_user_session');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('edugen_user_session');
      }
    }
    const savedHistory = localStorage.getItem('edugen_exam_history');
    if (savedHistory) {
      try {
        setResultsHistory(JSON.parse(savedHistory));
      } catch (e) {
        setResultsHistory([]);
      }
    }
  }, []);

  // Sync History
  useEffect(() => {
    localStorage.setItem('edugen_exam_history', JSON.stringify(resultsHistory));
  }, [resultsHistory]);

  // Exam Timer Logic
  useEffect(() => {
    const isExamPath = location.pathname === '/exam';
    if (isExamPath && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (isExamPath && timeLeft === 0 && questions.length > 0) {
      calculateScore();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [location.pathname, timeLeft]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetStatus(null);
    
    let users: User[] = [];
    try {
      users = JSON.parse(localStorage.getItem('edugen_registered_users') || '[]');
    } catch (e) { users = []; }

    if (authView === 'register') {
      if (!authForm.username || !authForm.password || !authForm.phone) {
        setError("Harap isi semua data pendaftaran."); return;
      }
      if (users.some(u => u.username === authForm.username)) {
        setError("Username sudah terdaftar."); return;
      }
      if (users.some(u => u.phone === authForm.phone)) {
        setError("Nomor WhatsApp sudah digunakan."); return;
      }
      users.push({ ...authForm });
      localStorage.setItem('edugen_registered_users', JSON.stringify(users));
      setAuthView('login');
      alert("Pendaftaran Berhasil! Silakan masuk.");
    } else if (authView === 'login') {
      const user = users.find(u => u.username === authForm.username && u.password === authForm.password);
      if (user) {
        setCurrentUser(user);
        localStorage.setItem('edugen_user_session', JSON.stringify(user));
        navigate('/config');
      } else {
        setError("Username atau password tidak valid.");
      }
    } else if (authView === 'forgotPassword') {
      const user = users.find(u => u.phone === authForm.phone);
      if (user) {
        setResetStatus({ 
          success: true, 
          msg: `Identitas diverifikasi. Akun: ${user.username}. Password: ${user.password}` 
        });
      } else {
        setError("Nomor WhatsApp tidak ditemukan.");
      }
    }
  };

  const toggleTopic = (subject: 'math' | 'indonesian', topic: string) => {
    setSelectedTopics(prev => {
      const current = prev[subject];
      const updated = current.includes(topic) 
        ? current.filter(t => t !== topic)
        : [...current, topic];
      return { ...prev, [subject]: updated.length === 0 ? [topic] : updated };
    });
  };

  const handleGenerate = async () => {
    setLoading(true); setError(null); setUserAnswers({});
    try {
      const result = await generateTKAQuestions(selectedTopics);
      setQuestions(result);
      setTimeLeft(60 * 60); // 60 minutes
      navigate('/exam');
    } catch (err) { 
      setError("AI sedang sibuk atau API Key bermasalah. Silakan coba lagi."); 
    } finally { setLoading(false); }
  };

  const calculateScore = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    let correct = 0;
    questions.forEach((q, idx) => {
      if (JSON.stringify(userAnswers[idx]) === JSON.stringify(q.correctAnswer)) correct++;
    });
    const finalScore = Math.round((correct / questions.length) * 100);
    const newResult = {
      username: currentUser?.username || 'Guest',
      score: finalScore,
      totalQuestions: questions.length,
      correctCount: correct,
      date: new Date().toLocaleString('id-ID'),
      topics: [...selectedTopics.math, ...selectedTopics.indonesian]
    };
    setResultsHistory(prev => [newResult, ...prev]);
    navigate('/result');
  };

  const answeredCount = useMemo(() => {
    return Object.values(userAnswers).filter(ans => {
      if (ans === undefined || ans === null) return false;
      if (typeof ans === 'string') return ans.trim() !== '';
      if (Array.isArray(ans)) return ans.length > 0;
      if (typeof ans === 'object' && ans !== null) return Object.keys(ans).length > 0;
      return false;
    }).length;
  }, [userAnswers]);

  const stats = useMemo(() => {
    if (questions.length === 0) return null;
    const subjects: Record<string, number> = {};
    const topics: Record<string, number> = {};
    const cogs: Record<string, number> = { 'L1 (Pemahaman)': 0, 'L2 (Penerapan)': 0, 'L3 (Penalaran)': 0 };
    
    questions.forEach(q => {
      subjects[q.subject] = (subjects[q.subject] || 0) + 1;
      topics[q.topic] = (topics[q.topic] || 0) + 1;
      if (q.cognitiveLevel) cogs[q.cognitiveLevel]++;
    });
    
    return { 
      pieData: Object.entries(subjects).map(([name, value]) => ({ name, value })),
      barData: Object.entries(topics).map(([name, count]) => ({ name, count })),
      cogData: Object.entries(cogs).map(([name, value]) => ({ name, value }))
    };
  }, [questions]);

  const COLORS = ['#3b82f6', '#0ea5e9', '#6366f1', '#1d4ed8'];
  const COG_COLORS = ['#60a5fa', '#3b82f6', '#1e3a8a'];

  // Auth Screen
  if (!currentUser) return (
    <div className="min-h-screen flex items-center justify-center p-6 animate-in fade-in duration-1000">
      <div className="max-w-md w-full glass-card-3d rounded-[4rem] p-12 text-center border-white/10">
        <div className="mb-12 flex flex-col items-center">
          <Logo3D size="large" />
          <h1 className="mt-8 text-4xl font-black text-white tracking-tighter">EduGen TKA</h1>
          <p className="text-blue-400 font-black text-sm uppercase tracking-[0.4em] mt-2 opacity-80 italic">verified academic ability test standar</p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-5">
          {authView !== 'forgotPassword' && (
            <input 
              type="text" placeholder="Username" autoComplete="username"
              className="w-full px-8 py-4 rounded-2xl border-2 border-slate-800 bg-slate-900/50 text-white font-bold text-lg focus:border-blue-500 outline-none transition-all" 
              value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} 
            />
          )}
          {(authView === 'register' || authView === 'forgotPassword') && (
            <input 
              type="tel" placeholder="Nomor WA (Contoh: 0812...)" autoComplete="tel"
              className="w-full px-8 py-4 rounded-2xl border-2 border-slate-800 bg-slate-900/50 text-white font-bold text-lg focus:border-blue-500 outline-none transition-all" 
              value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} 
            />
          )}
          {authView !== 'forgotPassword' && (
            <input 
              type="password" placeholder="Password" autoComplete="current-password"
              className="w-full px-8 py-4 rounded-2xl border-2 border-slate-800 bg-slate-900/50 text-white font-bold text-lg focus:border-blue-500 outline-none transition-all" 
              value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} 
            />
          )}

          {error && <p className="text-rose-400 text-sm font-black italic">{error}</p>}
          {resetStatus && (
            <div className="p-4 bg-emerald-900/40 text-emerald-300 rounded-xl text-sm font-black italic border border-emerald-500/30">
              {resetStatus.msg}
            </div>
          )}

          <button type="submit" className="w-full btn-3d-blue text-white py-5 rounded-2xl font-black text-xl tracking-wide uppercase">
            {authView === 'login' ? 'MULAI BELAJAR' : authView === 'register' ? 'DAFTAR' : 'CEK PASSWORD'}
          </button>
        </form>

        <div className="mt-10 flex flex-col gap-4">
          <button onClick={() => { setAuthView(authView === 'login' ? 'register' : 'login'); setError(null); setResetStatus(null); }} className="text-xs font-black text-blue-400 hover:text-white transition-colors uppercase tracking-widest">
            {authView === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}
          </button>
          {authView === 'login' && (
            <button onClick={() => { setAuthView('forgotPassword'); setError(null); }} className="text-[10px] font-black text-slate-500 hover:text-rose-400 uppercase tracking-widest italic">
              Lupa Password?
            </button>
          )}
          {authView === 'forgotPassword' && (
            <button onClick={() => setAuthView('login')} className="text-xs font-black text-slate-500 uppercase tracking-widest">
              Kembali
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const activeLinkClass = "text-blue-400 border-b-2 border-blue-500 pb-1";
  const inactiveLinkClass = "text-slate-400 hover:text-blue-400 border-b-2 border-transparent pb-1 transition-all";

  return (
    <div className="min-h-screen flex flex-col pb-16">
      <header className="bg-slate-900/60 backdrop-blur-2xl border-b-2 border-white/5 sticky top-0 z-50 no-print h-24">
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/config')}>
            <Logo3D size="small" />
            <h1 className="text-2xl font-black text-white tracking-tighter">EduGen TKA</h1>
          </div>
          <nav className="flex items-center gap-8">
            <NavLink to="/config" className={({ isActive }) => `text-[11px] font-black uppercase tracking-[0.2em] ${isActive ? activeLinkClass : inactiveLinkClass}`}>
              Konfigurasi
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `text-[11px] font-black uppercase tracking-[0.2em] ${isActive ? activeLinkClass : inactiveLinkClass}`}>
              Riwayat
            </NavLink>
            <button 
              onClick={handleLogout} 
              className="bg-slate-800/80 text-blue-400 px-6 py-2 rounded-xl text-[11px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all ml-4"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-8 pt-12">
        <Routes>
          <Route path="/" element={<Navigate to="/config" replace />} />
          
          <Route path="/config" element={
            !loading ? (
              <div className="space-y-20 animate-in slide-in-from-bottom duration-700 max-w-5xl mx-auto text-center">
                <div className="flex flex-col items-center">
                  <h2 className="text-7xl font-black text-white tracking-tighter mb-6 italic">Modul <span className="text-blue-500">Akademik.</span></h2>
                  <p className="text-slate-400 font-black text-xl uppercase tracking-widest opacity-60">Generator Soal Berbasis Standar Kemendikdasmen</p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-10">
                   <div className="glass-card-3d p-10 rounded-[3rem] text-left border-blue-500/10">
                      <h3 className="text-3xl font-black text-white mb-8 flex items-center gap-4"><span className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-lg">∑</span> NUMERASI</h3>
                      <div className="grid grid-cols-1 gap-3">
                        {NUMERASI_TOPICS.map(t => {
                          const isSelected = selectedTopics.math.includes(t);
                          return (
                            <button 
                              key={t} 
                              onClick={() => toggleTopic('math', t)} 
                              className={`p-4 rounded-xl text-xs font-black transition-all duration-500 border-2 ${
                                isSelected 
                                  ? 'bg-blue-600 border-blue-300 text-white animate-glow-blue scale-105 z-10' 
                                  : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-blue-800 opacity-40'
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                   </div>
                   <div className="glass-card-3d p-10 rounded-[3rem] text-left border-sky-500/10">
                      <h3 className="text-3xl font-black text-white mb-8 flex items-center gap-4"><span className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center text-lg">¶</span> LITERASI</h3>
                      <div className="grid grid-cols-1 gap-3">
                        {LITERASI_TOPICS.map(t => {
                          const isSelected = selectedTopics.indonesian.includes(t);
                          return (
                            <button 
                              key={t} 
                              onClick={() => toggleTopic('indonesian', t)} 
                              className={`p-4 rounded-xl text-xs font-black transition-all duration-500 border-2 ${
                                isSelected 
                                  ? 'bg-sky-500 border-sky-200 text-white animate-glow-sky scale-105 z-10' 
                                  : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-sky-800 opacity-40'
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                   </div>
                </div>
                
                <div className="flex flex-col items-center pt-10 pb-20">
                  {error && <p className="text-rose-400 font-black italic mb-6">{error}</p>}
                  <button onClick={handleGenerate} className="w-full max-w-2xl btn-3d-blue text-white py-10 rounded-[2.5rem] font-black text-3xl tracking-widest flex items-center justify-center gap-6 group">
                    GENERATE SOAL TKA
                    <svg className="w-10 h-10 group-hover:translate-x-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-40 text-center flex flex-col items-center animate-pulse">
                 <div className="relative w-48 h-48 mb-12">
                    <div className="absolute inset-0 border-[12px] border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-6 bg-blue-600 rounded-full flex items-center justify-center text-white font-black text-[10px] px-2 text-center uppercase leading-tight shadow-lg">Academic Ability Test</div>
                 </div>
                 <h3 className="text-4xl font-black text-white italic">generate soal TKA...</h3>
              </div>
            )
          } />

          <Route path="/exam" element={
            questions.length > 0 ? (
              <div className="animate-in fade-in duration-700 max-w-4xl mx-auto pb-40">
                 <div className="glass-card-3d p-6 rounded-[2.5rem] sticky top-28 z-40 flex items-center justify-between mb-12 shadow-2xl border-white/5">
                    <div className="flex items-center gap-5">
                       <div className="bg-blue-600 p-3 rounded-xl"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3" /></svg></div>
                       <div><p className="text-[10px] font-black text-slate-500 uppercase">Sisa Waktu</p><p className="text-2xl font-black text-blue-400 font-mono">{Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2, '0')}</p></div>
                    </div>
                    <div className="flex items-center gap-8">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Terjawab: {answeredCount}/{questions.length}</p>
                       <button onClick={calculateScore} className="btn-3d-blue px-10 py-3 rounded-xl font-black text-xs uppercase text-white">Selesai</button>
                    </div>
                 </div>
                 <div className="space-y-10">
                    {questions.map((q, i) => (
                      <QuestionCard key={i} index={i} question={q} showAnswers={false} interactive={true} currentAnswer={userAnswers[i]} onAnswerChange={(ans) => setUserAnswers({...userAnswers, [i]: ans})} />
                    ))}
                 </div>
              </div>
            ) : <Navigate to="/config" />
          } />

          <Route path="/result" element={
            questions.length > 0 ? (
              <div className="animate-in zoom-in duration-700 max-w-6xl mx-auto space-y-20 pb-40">
                 <div className="glass-card-3d p-16 rounded-[4rem] text-center border-white/10 relative overflow-hidden">
                    <div className="w-48 h-48 rounded-[3rem] bg-gradient-to-br from-blue-500 to-blue-800 flex flex-col items-center justify-center text-white shadow-2xl mx-auto mb-10 border-4 border-slate-900 transform -rotate-3">
                       <span className="text-xs font-black opacity-80 uppercase">SKOR</span>
                       <span className="text-7xl font-black">{resultsHistory[0]?.score || 0}</span>
                    </div>
                    <h2 className="text-6xl font-black text-white italic tracking-tighter mb-10">Simulasi Selesai.</h2>
                    <div className="flex justify-center gap-6">
                      <button onClick={() => navigate('/config')} className="btn-3d-blue px-12 py-5 rounded-[2rem] font-black text-xl uppercase text-white">Ulangi Tes</button>
                      <button onClick={() => window.print()} className="bg-slate-800 text-white px-12 py-5 rounded-[2rem] font-black text-xl border border-white/5 uppercase">Print Hasil</button>
                    </div>
                 </div>

                 <div className="grid md:grid-cols-3 gap-8">
                    <div className="glass-card-3d p-8 rounded-[3rem] border-white/5">
                      <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-8 text-center">Literasi vs Numerasi</h4>
                      <div className="h-64"><ResponsiveContainer><PieChart><Pie data={stats?.pieData} innerRadius={60} outerRadius={80} dataKey="value" stroke="none">{stats?.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
                    </div>
                    <div className="glass-card-3d p-8 rounded-[3rem] border-white/5">
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-8 text-center">Level Kognitif</h4>
                      <div className="h-64"><ResponsiveContainer><PieChart><Pie data={stats?.cogData} innerRadius={60} outerRadius={80} dataKey="value" stroke="none">{stats?.cogData.map((_, i) => <Cell key={i} fill={COG_COLORS[i % COG_COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
                    </div>
                    <div className="glass-card-3d p-8 rounded-[3rem] border-white/5">
                      <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.4em] mb-8 text-center">Sebaran Topik</h4>
                      <div className="h-64"><ResponsiveContainer><BarChart data={stats?.barData} layout="vertical"><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={80} fontSize={9} fontWeight="bold" tick={{fill: '#94a3b8'}} stroke="none" /><Tooltip /><Bar dataKey="count" fill="#3b82f6" radius={[0, 10, 10, 0]} barSize={15} /></BarChart></ResponsiveContainer></div>
                    </div>
                 </div>

                 <div className="space-y-10 pt-20">
                    <h3 className="text-4xl font-black text-white italic text-center">Analisis Jawaban</h3>
                    {questions.map((q, i) => (
                      <QuestionCard key={i} index={i} question={q} showAnswers={true} interactive={false} currentAnswer={userAnswers[i]} />
                    ))}
                 </div>
              </div>
            ) : <Navigate to="/config" />
          } />

          <Route path="/history" element={
            <div className="glass-card-3d p-12 rounded-[4rem] max-w-4xl mx-auto animate-in slide-in-from-bottom duration-700">
               <h2 className="text-4xl font-black text-white italic mb-12 flex items-center justify-between">Arsip Tes</h2>
               {resultsHistory.length === 0 ? <p className="text-slate-500 font-bold italic py-20 text-center">Belum ada riwayat tes.</p> : (
                 <div className="space-y-4">
                    {resultsHistory.map((res, i) => (
                      <div key={i} className="bg-slate-900/40 p-6 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-blue-500/30 transition-all">
                         <div><p className="font-black text-xl text-white">{res.date}</p><p className="text-[10px] font-black text-blue-500 uppercase">{res.correctCount} / {res.totalQuestions} Soal Terjawab Benar</p></div>
                         <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center font-black text-2xl text-white shadow-xl">{res.score}</div>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          } />
        </Routes>
      </main>
      
      <footer className="mt-auto py-10 text-center opacity-40 no-print">
        <p className="text-[10px] font-black uppercase tracking-[0.5em]">&copy; 2025 EduGen Professional TKA Laboratory</p>
      </footer>
    </div>
  );
};

export default App;
