
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

const LOADING_MESSAGES = [
  "Membangun Koneksi ke Brain-AI Core...",
  "Menganalisis Standar Kurikulum Merdeka...",
  "Menyusun Paket Literasi Fiksi & Informasi...",
  "Mengonfigurasi Problem Solving Numerasi...",
  "Menghasilkan Validasi Kunci Jawaban...",
  "Menyiapkan Simulasi Standar ANBK...",
  "Melakukan Finalisasi Paket Soal..."
];

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const Logo3D = ({ size = "normal" }: { size?: "small" | "normal" | "large" }) => {
  const dimensions = size === "small" ? "w-12 h-12" : size === "large" ? "w-40 h-40" : "w-24 h-24";
  const fontSize = size === "small" ? "text-2xl" : size === "large" ? "text-7xl" : "text-5xl";
  const rounding = size === "small" ? "rounded-xl" : "rounded-[3rem]";
  
  return (
    <div className={`${dimensions} logo-container group cursor-default relative z-10 mx-auto`}>
      <div className={`absolute inset-0 bg-blue-600/30 ${rounding} blur-xl group-hover:bg-blue-500/50 transition-all duration-700`}></div>
      <div className={`logo-3d-element absolute inset-0 bg-gradient-to-br from-blue-400 via-blue-700 to-indigo-950 ${rounding} flex items-center justify-center text-white font-black shadow-2xl border border-white/20 backdrop-blur-md`}>
        <span className={`${fontSize} tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] select-none`}>E</span>
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
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
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

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!currentUser) return;
    const resetSessionTimer = () => {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = setTimeout(() => {
        handleLogout();
        alert("Sesi Anda telah berakhir karena tidak ada aktivitas selama 30 menit.");
      }, SESSION_TIMEOUT_MS);
    };
    resetSessionTimer();
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetSessionTimer));
    return () => {
      events.forEach(event => window.removeEventListener(event, resetSessionTimer));
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    };
  }, [currentUser]);

  useEffect(() => {
    const savedUser = localStorage.getItem('edugen_user_session');
    if (savedUser) {
      try { setCurrentUser(JSON.parse(savedUser)); } catch (e) { localStorage.removeItem('edugen_user_session'); }
    }
    const savedHistory = localStorage.getItem('edugen_exam_history');
    if (savedHistory) {
      try { setResultsHistory(JSON.parse(savedHistory)); } catch (e) { setResultsHistory([]); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('edugen_exam_history', JSON.stringify(resultsHistory));
  }, [resultsHistory]);

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
    let users = JSON.parse(localStorage.getItem('edugen_registered_users') || '[]');

    if (authView === 'register') {
      if (!authForm.username || !authForm.password || !authForm.phone) { setError("Harap lengkapi semua field."); return; }
      if (users.some((u: any) => u.username === authForm.username)) { setError("Username sudah ada."); return; }
      users.push({ ...authForm });
      localStorage.setItem('edugen_registered_users', JSON.stringify(users));
      setAuthView('login');
      alert("Pendaftaran Berhasil! Silakan masuk.");
    } else if (authView === 'login') {
      const user = users.find((u: any) => u.username === authForm.username && u.password === authForm.password);
      if (user) {
        setCurrentUser(user);
        localStorage.setItem('edugen_user_session', JSON.stringify(user));
        navigate('/config');
      } else { setError("Username atau Password salah."); }
    }
  };

  const toggleTopic = (subject: 'math' | 'indonesian', topic: string) => {
    setSelectedTopics(prev => {
      const current = prev[subject];
      const updated = current.includes(topic) ? current.filter(t => t !== topic) : [...current, topic];
      return { ...prev, [subject]: updated.length === 0 ? [topic] : updated };
    });
  };

  const handleGenerate = async () => {
    setLoading(true); 
    setError(null); 
    setUserAnswers({});
    try {
      const result = await generateTKAQuestions(selectedTopics);
      setQuestions(result);
      setTimeLeft(60 * 60); 
      setTimeout(() => {
        setLoading(false);
        navigate('/exam');
      }, 1500);
    } catch (err) { 
      setError("Sinkronisasi AI terhenti. Silakan coba lagi."); 
      setLoading(false);
    }
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
    return Object.values(userAnswers).filter(ans => ans !== undefined && ans !== null).length;
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

  // LOGIN SCREEN RENDER
  if (!currentUser) return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden animate-in fade-in duration-1000">
      <div className="max-w-xl w-full relative z-10">
        <div className="glass-card-3d rounded-[4rem] p-12 text-center border-white/10 relative overflow-hidden">
          <div className="scanline"></div>
          
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3 bg-blue-600/20 px-4 py-2 rounded-full border border-blue-500/30">
               <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Secure Core Active</span>
            </div>
          </div>

          <Logo3D size="large" />
          
          <div className="mt-8 space-y-2">
             <h1 className="text-5xl font-black text-white tracking-tighter italic">EduGen <span className="text-blue-500">TKA.</span></h1>
             <p className="text-slate-400 font-bold text-sm uppercase tracking-[0.4em] opacity-60">Professional Assessment Platform</p>
          </div>

          <form onSubmit={handleAuth} className="mt-12 space-y-4">
            <div className="relative group">
               <input 
                 type="text" 
                 placeholder="Username ID" 
                 className="w-full px-8 py-5 rounded-3xl bg-slate-900/60 border-2 border-slate-800 text-white font-bold text-lg placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all input-glow" 
                 value={authForm.username} 
                 onChange={e => setAuthForm({...authForm, username: e.target.value})} 
               />
               <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
               </div>
            </div>

            <div className="relative group">
               <input 
                 type="password" 
                 placeholder="Access Code" 
                 className="w-full px-8 py-5 rounded-3xl bg-slate-900/60 border-2 border-slate-800 text-white font-bold text-lg placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all input-glow" 
                 value={authForm.password} 
                 onChange={e => setAuthForm({...authForm, password: e.target.value})} 
               />
               <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
               </div>
            </div>

            {authView === 'register' && (
               <input 
                 type="tel" 
                 placeholder="WhatsApp Connection" 
                 className="w-full px-8 py-5 rounded-3xl bg-slate-900/60 border-2 border-slate-800 text-white font-bold text-lg placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all input-glow animate-in slide-in-from-top" 
                 value={authForm.phone} 
                 onChange={e => setAuthForm({...authForm, phone: e.target.value})} 
               />
            )}

            {error && <p className="text-rose-500 font-black text-xs uppercase tracking-widest animate-bounce">{error}</p>}

            <button type="submit" className="w-full btn-3d-blue text-white py-6 rounded-[2rem] font-black text-2xl tracking-tighter uppercase mt-4">
               {authView === 'login' ? 'INITIALIZE SYSTEM' : 'CREATE PROTOCOL'}
            </button>
          </form>

          <div className="mt-10 flex flex-col gap-3">
             <button 
               onClick={() => { setAuthView(authView === 'login' ? 'register' : 'login'); setError(null); }} 
               className="text-[11px] font-black text-slate-500 hover:text-blue-400 uppercase tracking-[0.4em] transition-colors"
             >
                {authView === 'login' ? 'Belum terdaftar? Jalankan pendaftaran' : 'Sudah terdaftar? Kembali ke login'}
             </button>
             <div className="flex items-center justify-center gap-2 mt-4 opacity-30">
                <span className="h-[1px] w-8 bg-slate-500"></span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Global Encryption Standard</span>
                <span className="h-[1px] w-8 bg-slate-500"></span>
             </div>
          </div>
        </div>

        {/* Floating status side card */}
        <div className="hidden lg:block absolute -right-24 top-20 glass-card-3d p-4 rounded-2xl w-32 animate-bounce duration-[5s]">
           <p className="text-[8px] font-black text-blue-500 uppercase mb-2">Network</p>
           <div className="h-1 bg-blue-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-[80%] animate-pulse"></div>
           </div>
           <p className="text-[9px] font-bold text-white mt-2">Latency: 12ms</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col pb-16">
      <header className="bg-slate-950/60 backdrop-blur-3xl border-b-2 border-white/5 sticky top-0 z-50 no-print h-24">
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/config')}>
            <Logo3D size="small" />
            <h1 className="text-2xl font-black text-white tracking-tighter">EduGen TKA</h1>
          </div>
          <nav className="flex items-center gap-8">
            <NavLink to="/config" className={({ isActive }) => `text-[11px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-blue-400 border-b-2 border-blue-500 pb-1' : 'text-slate-400'}`}>Konfigurasi</NavLink>
            <NavLink to="/history" className={({ isActive }) => `text-[11px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-blue-400 border-b-2 border-blue-500 pb-1' : 'text-slate-400'}`}>Riwayat</NavLink>
            <button onClick={handleLogout} className="bg-slate-800/50 border border-white/5 text-blue-400 px-6 py-2 rounded-xl text-[11px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">Logout</button>
          </nav>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-8 pt-12 relative">
        {loading && (
          <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in duration-500">
            <div className="max-w-xl w-full text-center flex flex-col items-center">
               <div className="relative w-80 h-80 mb-16">
                  <div className="absolute inset-0 border-[6px] border-blue-500/10 rounded-full scale-110"></div>
                  <div className="absolute inset-0 border-[16px] border-blue-600 border-t-transparent rounded-full animate-spin shadow-[0_0_80px_rgba(37,99,235,0.4)]"></div>
                  <div className="absolute inset-8 bg-gradient-to-br from-blue-600 to-indigo-900 rounded-full flex flex-col items-center justify-center text-white shadow-2xl animate-pulse">
                    <span className="font-black text-sm uppercase tracking-[0.4em] opacity-70">AI BRAIN</span>
                    <span className="font-black text-5xl tracking-tighter mt-2">PROCESS</span>
                  </div>
               </div>
               
               <div className="space-y-6">
                  <h3 className="text-6xl font-black text-white italic tracking-tighter">Sintesis Soal...</h3>
                  <div className="h-12 flex items-center justify-center">
                    <p className="text-blue-400 font-black text-2xl uppercase tracking-[0.3em] animate-in slide-in-from-bottom" key={loadingMsgIdx}>
                      {LOADING_MESSAGES[loadingMsgIdx]}
                    </p>
                  </div>
               </div>

               <div className="mt-20 w-full max-w-md h-3 bg-slate-900 rounded-full overflow-hidden relative shadow-inner border border-white/5">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-sky-400 animate-[loading-bar_2s_infinite_linear]" style={{ width: '60%' }}></div>
               </div>
            </div>
          </div>
        )}

        <div className={loading ? 'opacity-20 pointer-events-none' : ''}>
          <Routes>
            <Route path="/" element={<Navigate to="/config" replace />} />
            <Route path="/config" element={
              <div className="space-y-20 max-w-5xl mx-auto text-center animate-in slide-in-from-bottom duration-700">
                <div className="flex flex-col items-center">
                  <div className="bg-blue-600/10 text-blue-500 px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.3em] border border-blue-500/20 mb-8">System Configuration Phase</div>
                  <h2 className="text-8xl font-black text-white tracking-tighter mb-6 italic">Modul <span className="text-blue-500">TKA.</span></h2>
                  <p className="text-slate-400 font-black text-xl uppercase tracking-widest opacity-60">Generator Soal Berbasis Standar Kemendikdasmen</p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-12">
                   <div className="glass-card-3d p-12 rounded-[4rem] text-left">
                      <h3 className="text-3xl font-black text-white mb-10 flex items-center gap-4">
                        <span className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-xl shadow-blue-500/30">∑</span> NUMERASI
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        {NUMERASI_TOPICS.map(t => (
                          <button key={t} onClick={() => toggleTopic('math', t)} className={`p-6 rounded-[2rem] text-sm font-black transition-all border-2 text-left px-10 ${selectedTopics.math.includes(t) ? 'bg-gradient-to-br from-blue-600 to-blue-800 border-blue-400 text-white shadow-xl' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}>{t}</button>
                        ))}
                      </div>
                   </div>

                   <div className="glass-card-3d p-12 rounded-[4rem] text-left">
                      <h3 className="text-3xl font-black text-white mb-10 flex items-center gap-4">
                        <span className="w-14 h-14 bg-sky-500 rounded-2xl flex items-center justify-center text-2xl shadow-xl shadow-sky-500/30">¶</span> LITERASI
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        {LITERASI_TOPICS.map(t => (
                          <button key={t} onClick={() => toggleTopic('indonesian', t)} className={`p-6 rounded-[2rem] text-sm font-black transition-all border-2 text-left px-10 ${selectedTopics.indonesian.includes(t) ? 'bg-gradient-to-br from-sky-500 to-sky-700 border-sky-300 text-white shadow-xl' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}>{t}</button>
                        ))}
                      </div>
                   </div>
                </div>
                
                <div className="flex flex-col items-center pt-10 pb-20">
                  {error && <p className="text-rose-400 font-black mb-6 animate-bounce">{error}</p>}
                  <button onClick={handleGenerate} className="w-full max-w-3xl btn-3d-blue text-white py-12 rounded-[3rem] font-black text-4xl tracking-tighter flex items-center justify-center gap-6">
                    INITIALIZE GENESIS-AI
                  </button>
                  <p className="mt-8 text-[10px] font-black text-slate-600 uppercase tracking-[0.6em]">Hardware Accelerated Processing Unit V.4.1</p>
                </div>
              </div>
            } />

            <Route path="/exam" element={
              questions.length > 0 ? (
                <div className="max-w-4xl mx-auto pb-40 animate-in fade-in duration-700">
                   <div className="glass-card-3d p-8 rounded-[3rem] sticky top-28 z-40 flex items-center justify-between mb-16 shadow-2xl">
                      <div className="flex items-center gap-6">
                         <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30"><svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3" /></svg></div>
                         <div><p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Countdown</p><p className="text-3xl font-black text-blue-400 font-mono tracking-tighter">{Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2, '0')}</p></div>
                      </div>
                      <div className="flex items-center gap-10">
                         <div className="text-right"><p className="text-[11px] font-black text-slate-500 uppercase">Progress</p><p className="text-xl font-black text-white">{answeredCount} / {questions.length}</p></div>
                         <button onClick={calculateScore} className="btn-3d-blue px-12 py-4 rounded-2xl font-black text-sm uppercase text-white tracking-widest">Submit</button>
                      </div>
                   </div>
                   <div className="space-y-16">
                      {questions.map((q, i) => (
                        <QuestionCard key={i} index={i} question={q} showAnswers={false} interactive={true} currentAnswer={userAnswers[i]} onAnswerChange={(ans) => setUserAnswers({...userAnswers, [i]: ans})} />
                      ))}
                   </div>
                </div>
              ) : <Navigate to="/config" />
            } />

            <Route path="/result" element={
              questions.length > 0 ? (
                <div className="max-w-6xl mx-auto space-y-20 pb-40 animate-in zoom-in duration-700">
                   <div className="glass-card-3d p-20 rounded-[5rem] text-center relative overflow-hidden">
                      <div className="scanline"></div>
                      <div className="w-56 h-56 rounded-[4rem] bg-gradient-to-br from-blue-500 to-indigo-900 flex flex-col items-center justify-center text-white shadow-3xl mx-auto mb-12 border-8 border-slate-900 transform -rotate-6">
                         <span className="text-sm font-black uppercase tracking-widest opacity-60">SCORE</span>
                         <span className="text-8xl font-black tracking-tighter">{resultsHistory[0]?.score || 0}</span>
                      </div>
                      <h2 className="text-7xl font-black text-white italic tracking-tighter mb-12">Session Completed.</h2>
                      <div className="flex justify-center gap-8">
                        <button onClick={() => navigate('/config')} className="btn-3d-blue px-16 py-6 rounded-[2.5rem] font-black text-2xl uppercase text-white tracking-tighter">New Simulation</button>
                      </div>
                   </div>
                   <div className="space-y-16 pt-20">
                      <h3 className="text-5xl font-black text-white italic text-center tracking-tighter">Performance Analysis</h3>
                      {questions.map((q, i) => (
                        <QuestionCard key={i} index={i} question={q} showAnswers={true} interactive={false} currentAnswer={userAnswers[i]} />
                      ))}
                   </div>
                </div>
              ) : <Navigate to="/config" />
            } />

            <Route path="/history" element={
              <div className="glass-card-3d p-16 rounded-[4rem] max-w-5xl mx-auto animate-in slide-in-from-bottom duration-700">
                 <h2 className="text-5xl font-black text-white italic mb-16 tracking-tighter">Archived Logs</h2>
                 {resultsHistory.length === 0 ? <p className="text-slate-600 font-bold italic py-20 text-center text-xl">No historical data found in database.</p> : (
                   <div className="space-y-6">
                      {resultsHistory.map((res, i) => (
                        <div key={i} className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-white/5 flex items-center justify-between group hover:border-blue-500/30 transition-all cursor-default">
                           <div><p className="font-black text-2xl text-white tracking-tight">{res.date}</p><p className="text-xs font-black text-blue-500 uppercase tracking-widest mt-2">{res.correctCount} / {res.totalQuestions} Questions Accurate</p></div>
                           <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-900 rounded-[2rem] flex items-center justify-center font-black text-3xl text-white shadow-2xl border border-white/10">{res.score}</div>
                        </div>
                      ))}
                   </div>
                 )}
              </div>
            } />
          </Routes>
        </div>
      </main>
      
      <footer className="mt-auto py-12 text-center opacity-30 no-print">
        <p className="text-[10px] font-black uppercase tracking-[0.8em]">&copy; 2025 EduGen Labs &bull; Quantum Assessment Engine</p>
      </footer>
    </div>
  );
};

export default App;
