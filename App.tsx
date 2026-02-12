
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
  "Sinkronisasi Brain-AI...",
  "Menganalisis Kurikulum...",
  "Menyusun Stimulus Literasi...",
  "Memproses Numerasi Dasar...",
  "Validasi Logika Soal...",
  "Finalisasi Paket Asesmen..."
];

const Logo3D = ({ size = "normal" }: { size?: "small" | "normal" | "large" }) => {
  const dimensions = size === "small" ? "w-12 h-12" : size === "large" ? "w-44 h-44" : "w-24 h-24";
  const fontSize = size === "small" ? "text-2xl" : size === "large" ? "text-7xl" : "text-5xl";
  const rounding = size === "small" ? "rounded-xl" : "rounded-[3.5rem]";
  
  return (
    <div className={`${dimensions} group cursor-default relative z-10 mx-auto`}>
      <div className={`absolute inset-0 bg-blue-600/20 ${rounding} blur-2xl animate-pulse`}></div>
      <div className={`absolute inset-0 bg-gradient-to-br from-blue-400 via-blue-700 to-slate-950 ${rounding} flex items-center justify-center text-white font-black shadow-2xl border border-white/20 backdrop-blur-xl`}>
        <span className={`${fontSize} tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.6)] select-none`}>E</span>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Inisialisasi sinkron untuk mencegah blank screen pada refresh
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('edugen_user_session');
      return (saved && saved !== "undefined") ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const [resultsHistory, setResultsHistory] = useState<UserResult[]>(() => {
    try {
      const saved = localStorage.getItem('edugen_exam_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [selectedTopics, setSelectedTopics] = useState<TopicSelection>({
    math: ["Bilangan & Operasi", "Pecahan & Desimal"],
    indonesian: ["Teks Fiksi (Sastra)", "Ejaan & Tata Bahasa"]
  });

  // Animasi Loading
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Timer Control
  useEffect(() => {
    if (location.pathname === '/exam' && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (location.pathname === '/exam' && timeLeft === 0 && questions.length > 0) {
      calculateScore();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [location.pathname, timeLeft]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const users = JSON.parse(localStorage.getItem('edugen_registered_users') || '[]');

    if (authView === 'register') {
      if (!authForm.username || !authForm.password) { setError("Harap lengkapi formulir."); return; }
      if (users.some((u: any) => u.username === authForm.username)) { setError("Username sudah terdaftar."); return; }
      users.push({ ...authForm });
      localStorage.setItem('edugen_registered_users', JSON.stringify(users));
      setAuthView('login');
      alert("Registrasi Berhasil!");
    } else {
      const user = users.find((u: any) => u.username === authForm.username && u.password === authForm.password);
      if (user) {
        setCurrentUser(user);
        localStorage.setItem('edugen_user_session', JSON.stringify(user));
        navigate('/config');
      } else { setError("Kredensial tidak valid."); }
    }
  };

  const handleGenerate = async () => {
    if (loading) return;
    setLoading(true); 
    setError(null);
    setUserAnswers({});
    
    try {
      const result = await generateTKAQuestions(selectedTopics);
      if (result && result.length > 0) {
        setQuestions(result);
        setTimeLeft(45 * 60); // 45 Menit Standard
        setLoading(false);
        navigate('/exam');
      } else {
        throw new Error("Gagal memuat soal.");
      }
    } catch (err) {
      console.error(err);
      setError("AI sedang sibuk atau koneksi terputus. Silakan coba lagi.");
      setLoading(false);
    }
  };

  const calculateScore = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    let correct = 0;
    questions.forEach((q, idx) => {
      if (JSON.stringify(userAnswers[idx]) === JSON.stringify(q.correctAnswer)) correct++;
    });
    const score = Math.round((correct / questions.length) * 100);
    const newResult = {
      username: currentUser?.username || 'Guest',
      score,
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

  const handleLogout = () => {
    localStorage.removeItem('edugen_user_session');
    setCurrentUser(null);
    navigate('/');
  };

  // UI GUARD
  if (!currentUser) return (
    <div className="min-h-screen flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="max-w-xl w-full">
        <div className="glass-card-3d rounded-[4rem] p-16 text-center relative overflow-hidden">
          <div className="scanline"></div>
          <Logo3D size="large" />
          <h1 className="text-6xl font-black text-white tracking-tighter italic mt-10">EduGen <span className="text-blue-500">TKA.</span></h1>
          <form onSubmit={handleAuth} className="mt-12 space-y-5">
            <input type="text" placeholder="ID Terminal" className="w-full px-10 py-6 rounded-3xl input-cyber text-white font-bold text-lg outline-none" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} />
            <input type="password" placeholder="Kode Akses" className="w-full px-10 py-6 rounded-3xl input-cyber text-white font-bold text-lg outline-none" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            {error && <p className="text-rose-500 font-bold text-xs uppercase tracking-widest">{error}</p>}
            <button type="submit" className="w-full btn-3d-blue text-white py-6 rounded-3xl font-black text-2xl uppercase mt-4">Initialize System</button>
          </form>
          <button onClick={() => setAuthView(authView === 'login' ? 'register' : 'login')} className="mt-8 text-[11px] font-black text-slate-500 hover:text-blue-400 uppercase tracking-widest">
            {authView === 'login' ? 'Register New Node' : 'Return to Login'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-950/80 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-50 h-24">
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/config')}>
            <Logo3D size="small" />
            <span className="text-3xl font-black text-white tracking-tighter">EduGen</span>
          </div>
          <nav className="flex items-center gap-8">
            <NavLink to="/config" className={({ isActive }) => `text-[11px] font-black uppercase tracking-widest ${isActive ? 'text-blue-400' : 'text-slate-500'}`}>Config</NavLink>
            <NavLink to="/history" className={({ isActive }) => `text-[11px] font-black uppercase tracking-widest ${isActive ? 'text-blue-400' : 'text-slate-500'}`}>Logs</NavLink>
            <button onClick={handleLogout} className="bg-slate-900 px-5 py-2 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-blue-600 hover:text-white transition-all">Exit</button>
          </nav>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-8 pt-12 relative">
        {loading && (
          <div className="fixed inset-0 z-[100] bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in duration-300">
            <div className="text-center">
               <div className="relative w-72 h-72 mx-auto mb-16">
                  <div className="absolute inset-0 border-[15px] border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-8 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl">
                    <span className="font-black text-white text-4xl">AI</span>
                  </div>
               </div>
               <h3 className="text-6xl font-black text-white italic tracking-tighter mb-4">Processing...</h3>
               <p className="text-blue-400 font-black text-2xl uppercase tracking-widest animate-pulse" key={loadingMsgIdx}>
                 {LOADING_MESSAGES[loadingMsgIdx]}
               </p>
            </div>
          </div>
        )}

        <div className={loading ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}>
          <Routes>
            <Route path="/" element={<Navigate to="/config" replace />} />
            <Route path="/config" element={
              <div className="max-w-5xl mx-auto space-y-16 animate-in slide-in-from-bottom duration-700">
                <div className="text-center">
                  <h2 className="text-8xl font-black text-white tracking-tighter mb-4">Modul <span className="text-blue-500">TKA.</span></h2>
                  <p className="text-slate-500 font-black uppercase tracking-[0.5em]">Generator Soal Standar ANBK</p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-12">
                   {[{ title: 'NUMERASI', key: 'math', topics: NUMERASI_TOPICS, color: 'blue' }, 
                     { title: 'LITERASI', key: 'indonesian', topics: LITERASI_TOPICS, color: 'sky' }].map(sub => (
                     <div key={sub.key} className="glass-card-3d p-12 rounded-[4rem]">
                        <h3 className={`text-3xl font-black text-white mb-10 text-${sub.color}-500`}>{sub.title}</h3>
                        <div className="flex flex-col gap-4">
                          {sub.topics.map(t => (
                            <button key={t} onClick={() => setSelectedTopics(p => ({...p, [sub.key]: p[sub.key as keyof TopicSelection].includes(t) ? p[sub.key as keyof TopicSelection].filter(x=>x!==t) : [...p[sub.key as keyof TopicSelection], t]}))} 
                                    className={`p-6 rounded-[2.5rem] text-sm font-black text-left transition-all border-2 ${selectedTopics[sub.key as keyof TopicSelection].includes(t) ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-900/50 border-slate-800 text-slate-500'}`}>
                              {t}
                            </button>
                          ))}
                        </div>
                     </div>
                   ))}
                </div>
                
                <div className="text-center pb-20">
                  <button onClick={handleGenerate} className="w-full max-w-4xl btn-3d-blue text-white py-12 rounded-[3.5rem] font-black text-5xl tracking-tighter">GENERATE SOAL</button>
                  {error && <p className="mt-8 text-rose-500 font-black uppercase tracking-widest">{error}</p>}
                </div>
              </div>
            } />

            <Route path="/exam" element={
              questions.length > 0 ? (
                <div className="max-w-4xl mx-auto pb-40 animate-in fade-in duration-700">
                   <div className="glass-card-3d p-8 rounded-[3rem] sticky top-28 z-40 flex items-center justify-between mb-16 shadow-2xl">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Time Remaining</p>
                        <p className="text-3xl font-black text-blue-400 font-mono">{Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2, '0')}</p>
                      </div>
                      <div className="flex items-center gap-10">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-500 uppercase">Progress</p>
                          <p className="text-xl font-black text-white">{Object.keys(userAnswers).length} / {questions.length}</p>
                        </div>
                        <button onClick={calculateScore} className="btn-3d-blue px-10 py-4 rounded-2xl font-black text-sm uppercase text-white">Selesai</button>
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
                <div className="max-w-5xl mx-auto space-y-16 pb-40 animate-in zoom-in duration-500">
                   <div className="glass-card-3d p-20 rounded-[5rem] text-center">
                      <div className="w-48 h-48 rounded-[3rem] bg-blue-600 flex flex-col items-center justify-center text-white shadow-3xl mx-auto mb-10 transform -rotate-3">
                         <span className="text-sm font-black opacity-60">SCORE</span>
                         <span className="text-8xl font-black tracking-tighter">{resultsHistory[0]?.score || 0}</span>
                      </div>
                      <h2 className="text-6xl font-black text-white italic tracking-tighter mb-10">Simulasi Selesai.</h2>
                      <button onClick={() => navigate('/config')} className="btn-3d-blue px-16 py-6 rounded-[2.5rem] font-black text-2xl uppercase text-white">Coba Lagi</button>
                   </div>
                   <div className="space-y-12">
                      <h3 className="text-4xl font-black text-white text-center">Analisis Jawaban</h3>
                      {questions.map((q, i) => (
                        <QuestionCard key={i} index={i} question={q} showAnswers={true} interactive={false} currentAnswer={userAnswers[i]} />
                      ))}
                   </div>
                </div>
              ) : <Navigate to="/config" />
            } />

            <Route path="/history" element={
              <div className="glass-card-3d p-16 rounded-[4rem] max-w-4xl mx-auto animate-in slide-in-from-bottom">
                 <h2 className="text-5xl font-black text-white italic mb-12 tracking-tighter">Riwayat Sesi</h2>
                 {resultsHistory.length === 0 ? <p className="text-slate-600 font-bold py-10 text-center">Belum ada data riwayat.</p> : (
                   <div className="space-y-4">
                      {resultsHistory.map((res, i) => (
                        <div key={i} className="bg-slate-900/40 p-8 rounded-[2rem] border border-white/5 flex items-center justify-between">
                           <div>
                             <p className="font-black text-xl text-white">{res.date}</p>
                             <p className="text-xs font-black text-blue-500 uppercase tracking-widest">{res.correctCount} / {res.totalQuestions} Benar</p>
                           </div>
                           <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-xl">{res.score}</div>
                        </div>
                      ))}
                   </div>
                 )}
              </div>
            } />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default App;
