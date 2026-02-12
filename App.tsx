
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, NavLink, Navigate } from 'react-router-dom';
import { generateTKAQuestions } from './services/geminiService';
import { Question, TopicSelection, User, UserResult } from './types';
import { QuestionCard } from './components/QuestionCard';

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

const Logo3D = ({ size = "normal" }: { size?: "small" | "normal" | "large" }) => {
  const dimensions = size === "small" ? "w-12 h-12" : size === "large" ? "w-44 h-44" : "w-24 h-24";
  const fontSize = size === "small" ? "text-2xl" : size === "large" ? "text-7xl" : "text-5xl";
  const rounding = size === "small" ? "rounded-xl" : "rounded-[3.5rem]";
  
  return (
    <div className={`${dimensions} group cursor-default relative z-10 mx-auto`}>
      <div className={`absolute inset-0 bg-blue-600/20 ${rounding} blur-2xl group-hover:bg-blue-500/40 transition-all duration-1000 animate-pulse`}></div>
      <div className={`absolute inset-0 bg-gradient-to-br from-blue-400 via-blue-700 to-slate-950 ${rounding} flex items-center justify-center text-white font-black shadow-2xl border border-white/20 backdrop-blur-xl transform group-hover:rotate-3 transition-transform duration-500`}>
        <span className={`${fontSize} tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.6)] select-none`}>E</span>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '', phone: '' });
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resultsHistory, setResultsHistory] = useState<UserResult[]>([]);
  
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [selectedTopics, setSelectedTopics] = useState<TopicSelection>({
    math: ["Bilangan & Operasi", "Geometri Bangun Datar"],
    indonesian: ["Teks Fiksi (Sastra)", "Teks Informasi (Faktual)"]
  });

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('edugen_user_session');
      if (savedUser) setCurrentUser(JSON.parse(savedUser));
      
      const savedHistory = localStorage.getItem('edugen_exam_history');
      if (savedHistory) setResultsHistory(JSON.parse(savedHistory));
    } catch (e) {
      console.warn("Storage sync failed", e);
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading]);

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
    let users = JSON.parse(localStorage.getItem('edugen_registered_users') || '[]');

    if (authView === 'register') {
      if (!authForm.username || !authForm.password) { setError("Lengkapi kredensial."); return; }
      if (users.some((u: any) => u.username === authForm.username)) { setError("Username sudah ada."); return; }
      users.push({ ...authForm });
      localStorage.setItem('edugen_registered_users', JSON.stringify(users));
      setAuthView('login');
      alert("Pendaftaran Berhasil!");
    } else {
      const user = users.find((u: any) => u.username === authForm.username && u.password === authForm.password);
      if (user) {
        setCurrentUser(user);
        localStorage.setItem('edugen_user_session', JSON.stringify(user));
        navigate('/config');
      } else { setError("Username atau Password salah."); }
    }
  };

  const handleGenerate = async () => {
    setLoading(true); setError(null);
    try {
      const result = await generateTKAQuestions(selectedTopics);
      setQuestions(result);
      setTimeLeft(60 * 60);
      setTimeout(() => {
        setLoading(false);
        navigate('/exam');
      }, 2000);
    } catch (err) {
      setError("AI Network Failure. Please retry.");
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
    const updatedHistory = [newResult, ...resultsHistory];
    setResultsHistory(updatedHistory);
    localStorage.setItem('edugen_exam_history', JSON.stringify(updatedHistory));
    navigate('/result');
  };

  const answeredCount = useMemo(() => Object.values(userAnswers).filter(ans => ans != null).length, [userAnswers]);

  // LOGIN UI
  if (!currentUser) return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden animate-in fade-in duration-1000">
      <div className="max-w-xl w-full relative z-10">
        <div className="glass-card-3d rounded-[4.5rem] p-16 text-center border-white/10 relative overflow-hidden">
          <div className="scanline"></div>
          
          <div className="flex justify-center mb-10">
            <div className="flex items-center gap-3 bg-blue-600/10 px-5 py-2.5 rounded-full border border-blue-500/30 shadow-[0_0_20px_rgba(37,99,235,0.1)]">
               <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_#3b82f6]"></span>
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400">Neural Network Active</span>
            </div>
          </div>

          <Logo3D size="large" />
          
          <div className="mt-10 space-y-3">
             <h1 className="text-6xl font-black text-white tracking-tighter italic">EduGen <span className="text-blue-500">TKA.</span></h1>
             <p className="text-slate-500 font-bold text-sm uppercase tracking-[0.5em] opacity-80">Next-Gen Assessment Platform</p>
          </div>

          <form onSubmit={handleAuth} className="mt-14 space-y-5">
            <div className="relative group">
               <input 
                 type="text" 
                 placeholder="Terminal ID (Username)" 
                 className="w-full px-10 py-6 rounded-[2.5rem] input-cyber text-white font-bold text-lg placeholder:text-slate-700 outline-none" 
                 value={authForm.username} 
                 onChange={e => setAuthForm({...authForm, username: e.target.value})} 
               />
            </div>

            <div className="relative group">
               <input 
                 type="password" 
                 placeholder="Access Key (Password)" 
                 className="w-full px-10 py-6 rounded-[2.5rem] input-cyber text-white font-bold text-lg placeholder:text-slate-700 outline-none" 
                 value={authForm.password} 
                 onChange={e => setAuthForm({...authForm, password: e.target.value})} 
               />
            </div>

            {error && <p className="text-rose-500 font-black text-xs uppercase tracking-widest animate-bounce mt-4">{error}</p>}

            <button type="submit" className="w-full btn-3d-blue text-white py-7 rounded-[2.5rem] font-black text-2xl tracking-tighter uppercase mt-6 group overflow-hidden relative">
               <span className="relative z-10">{authView === 'login' ? 'INITIALIZE SYSTEM' : 'CREATE PROTOCOL'}</span>
               <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            </button>
          </form>

          <button 
            onClick={() => { setAuthView(authView === 'login' ? 'register' : 'login'); setError(null); }} 
            className="mt-10 text-[11px] font-black text-slate-500 hover:text-blue-400 uppercase tracking-[0.5em] transition-colors"
          >
             {authView === 'login' ? '>> Register New Node' : '<< Return to Access'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col pb-16">
      <header className="bg-slate-950/70 backdrop-blur-3xl border-b border-white/5 sticky top-0 z-50 no-print h-24">
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/config')}>
            <Logo3D size="small" />
            <h1 className="text-3xl font-black text-white tracking-tighter">EduGen</h1>
          </div>
          <nav className="flex items-center gap-10">
            <NavLink to="/config" className={({ isActive }) => `text-[11px] font-black uppercase tracking-[0.3em] ${isActive ? 'text-blue-400 border-b-2 border-blue-500 pb-2' : 'text-slate-500'}`}>Config</NavLink>
            <NavLink to="/history" className={({ isActive }) => `text-[11px] font-black uppercase tracking-[0.3em] ${isActive ? 'text-blue-400 border-b-2 border-blue-500 pb-2' : 'text-slate-500'}`}>Logs</NavLink>
            <button onClick={() => { localStorage.removeItem('edugen_user_session'); window.location.reload(); }} className="bg-slate-900 border border-white/5 text-slate-400 px-6 py-2 rounded-xl text-[11px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">Exit</button>
          </nav>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-8 pt-12 relative">
        {loading && (
          <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in duration-500">
            <div className="max-w-xl w-full text-center flex flex-col items-center">
               <div className="relative w-80 h-80 mb-20">
                  <div className="absolute inset-0 border-[8px] border-blue-600/10 rounded-full scale-110"></div>
                  <div className="absolute inset-0 border-[20px] border-blue-600 border-t-transparent rounded-full animate-spin shadow-[0_0_100px_rgba(37,99,235,0.4)]"></div>
                  <div className="absolute inset-10 bg-gradient-to-br from-blue-500 to-indigo-900 rounded-full flex flex-col items-center justify-center text-white shadow-3xl animate-pulse">
                    <span className="font-black text-sm uppercase tracking-[0.5em] opacity-70">AI BRAIN</span>
                    <span className="font-black text-6xl tracking-tighter mt-3">CORE</span>
                  </div>
               </div>
               
               <div className="space-y-8">
                  <h3 className="text-7xl font-black text-white italic tracking-tighter">Sintesis Soal...</h3>
                  <div className="h-16 flex items-center justify-center">
                    <p className="text-blue-400 font-black text-2xl uppercase tracking-[0.4em] animate-in slide-in-from-bottom" key={loadingMsgIdx}>
                      {LOADING_MESSAGES[loadingMsgIdx]}
                    </p>
                  </div>
               </div>

               <div className="mt-20 w-full max-w-md h-3 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-sky-400 animate-[loading-bar_2s_infinite_linear]" style={{ width: '60%' }}></div>
               </div>
            </div>
          </div>
        )}

        <div className={loading ? 'opacity-0 scale-95 transition-all duration-700 pointer-events-none' : 'opacity-100 scale-100 transition-all duration-700'}>
          <Routes>
            <Route path="/" element={<Navigate to="/config" replace />} />
            <Route path="/config" element={
              <div className="space-y-24 max-w-6xl mx-auto text-center animate-in slide-in-from-bottom duration-1000">
                <div className="flex flex-col items-center">
                  <div className="bg-blue-600/10 text-blue-500 px-8 py-3 rounded-full text-[12px] font-black uppercase tracking-[0.4em] border border-blue-500/20 mb-10">Neural Architecture Phase</div>
                  <h2 className="text-9xl font-black text-white tracking-tighter mb-8 italic">Modul <span className="text-blue-500 text-shadow-glow">TKA.</span></h2>
                  <p className="text-slate-500 font-black text-2xl uppercase tracking-[0.3em] opacity-80">Generator Soal Berbasis Standar Kemendikdasmen</p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-16">
                   <div className="glass-card-3d p-14 rounded-[5rem] text-left">
                      <h3 className="text-4xl font-black text-white mb-12 flex items-center gap-5">
                        <span className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-3xl shadow-2xl shadow-blue-500/40">∑</span> NUMERASI
                      </h3>
                      <div className="grid grid-cols-1 gap-5">
                        {NUMERASI_TOPICS.map(t => (
                          <button key={t} onClick={() => setSelectedTopics(p => ({...p, math: p.math.includes(t) ? p.math.filter(x=>x!==t) : [...p.math, t]}))} className={`p-7 rounded-[2.5rem] text-sm font-black transition-all border-2 text-left px-12 ${selectedTopics.math.includes(t) ? 'bg-gradient-to-br from-blue-600 to-blue-800 border-blue-400 text-white shadow-2xl' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}>{t}</button>
                        ))}
                      </div>
                   </div>

                   <div className="glass-card-3d p-14 rounded-[5rem] text-left">
                      <h3 className="text-4xl font-black text-white mb-12 flex items-center gap-5">
                        <span className="w-16 h-16 bg-sky-500 rounded-3xl flex items-center justify-center text-3xl shadow-2xl shadow-sky-500/40">¶</span> LITERASI
                      </h3>
                      <div className="grid grid-cols-1 gap-5">
                        {LITERASI_TOPICS.map(t => (
                          <button key={t} onClick={() => setSelectedTopics(p => ({...p, indonesian: p.indonesian.includes(t) ? p.indonesian.filter(x=>x!==t) : [...p.indonesian, t]}))} className={`p-7 rounded-[2.5rem] text-sm font-black transition-all border-2 text-left px-12 ${selectedTopics.indonesian.includes(t) ? 'bg-gradient-to-br from-sky-500 to-sky-700 border-sky-300 text-white shadow-2xl' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}>{t}</button>
                        ))}
                      </div>
                   </div>
                </div>
                
                <div className="flex flex-col items-center pt-20 pb-32">
                  <button onClick={handleGenerate} className="w-full max-w-4xl btn-3d-blue text-white py-14 rounded-[3.5rem] font-black text-5xl tracking-tighter flex items-center justify-center gap-8 group">
                    INITIALIZE GENESIS-AI
                    <svg className="w-12 h-12 group-hover:translate-x-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                  </button>
                  <p className="mt-12 text-[12px] font-black text-slate-700 uppercase tracking-[0.8em]">Hardware Accelerated Assessment Engine V.4.1</p>
                </div>
              </div>
            } />

            <Route path="/exam" element={
              questions.length > 0 ? (
                <div className="max-w-5xl mx-auto pb-64 animate-in fade-in duration-1000">
                   <div className="glass-card-3d p-10 rounded-[4rem] sticky top-28 z-40 flex items-center justify-between mb-20 shadow-3xl">
                      <div className="flex items-center gap-8">
                         <div className="bg-blue-600 w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/40"><svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M12 8v4l3 3" /></svg></div>
                         <div><p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.4em]">Node Sync Remaining</p><p className="text-4xl font-black text-blue-400 font-mono tracking-tighter">{Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2, '0')}</p></div>
                      </div>
                      <div className="flex items-center gap-12">
                         <div className="text-right"><p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Accuracy Buffer</p><p className="text-2xl font-black text-white">{answeredCount} / {questions.length}</p></div>
                         <button onClick={calculateScore} className="btn-3d-blue px-16 py-5 rounded-[2rem] font-black text-lg uppercase text-white tracking-widest">Finalize Session</button>
                      </div>
                   </div>
                   <div className="space-y-20">
                      {questions.map((q, i) => (
                        <QuestionCard key={i} index={i} question={q} showAnswers={false} interactive={true} currentAnswer={userAnswers[i]} onAnswerChange={(ans) => setUserAnswers({...userAnswers, [i]: ans})} />
                      ))}
                   </div>
                </div>
              ) : <Navigate to="/config" />
            } />
            
            <Route path="/result" element={<Navigate to="/config" />} />
            <Route path="/history" element={<Navigate to="/config" />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default App;
