
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, NavLink, Navigate } from 'react-router-dom';
import { generateTKAQuestions } from './services/geminiService';
import { Question, TopicSelection, User, UserResult } from './types';
import { QuestionCard } from './components/QuestionCard';

const NUMERASI_TOPICS = [
  "Bilangan & Operasi", "Aljabar Dasar", "Geometri", "Pengukuran", "Data & Statistik", "Pecahan", "KPK & FPB", "Logika Angka"
];

const LITERASI_TOPICS = [
  "Teks Sastra", "Teks Informasi", "Ide Pokok", "Ejaan & Tata Bahasa", "Kosakata", "Struktur Kalimat", "Analisis Puisi"
];

const VERIFICATION_LOGS = [
  "ESTABLISHING NEURAL LINK...",
  "ACCESSING ACADEMIC DATABASE...",
  "SYNCING CURRICULUM STANDARDS...",
  "GENERATING DYNAMIC STIMULUS...",
  "STRUCTURING ASSESSMENT MATRIX...",
  "VALIDATING ANSWER PROTOCOLS...",
  "ENCRYPTING SESSION DATA...",
  "READY FOR DEPLOYMENT."
];

const LogoElite = ({ size = "normal" }: { size?: "small" | "normal" | "large" }) => {
  const dim = size === "small" ? "w-10 h-10" : size === "large" ? "w-40 h-40" : "w-24 h-24";
  const font = size === "small" ? "text-xl" : size === "large" ? "text-6xl" : "text-4xl";
  const rounded = size === "small" ? "rounded-xl" : "rounded-[2.5rem]";
  return (
    <div className={`${dim} relative group mx-auto flex items-center justify-center`}>
      <div className={`absolute inset-0 bg-blue-600/20 blur-3xl ${rounded} animate-pulse`}></div>
      <div className={`absolute inset-0 bg-gradient-to-tr from-blue-700 via-indigo-900 to-slate-950 ${rounded} rotate-6 group-hover:rotate-12 transition-transform duration-700 shadow-2xl border border-white/10`}></div>
      <div className={`absolute inset-0 bg-slate-950/40 backdrop-blur-xl ${rounded} border border-white/20 flex items-center justify-center shadow-inner`}>
        <span className={`${font} font-black text-white tracking-tighter drop-shadow-2xl`}>ED</span>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('edugen_session_v5');
    return saved ? JSON.parse(saved) : null;
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'recover'>('login');
  const [authForm, setAuthForm] = useState({ user: '', pass: '', phone: '' });
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveredInfo, setRecoveredInfo] = useState<string | null>(null);
  
  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = sessionStorage.getItem('edugen_active_exam');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [userAnswers, setUserAnswers] = useState<Record<number, any>>(() => {
    const saved = sessionStorage.getItem('edugen_answers');
    return saved ? JSON.parse(saved) : {};
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState(0);
  const [sysError, setSysError] = useState<string | null>(null);
  
  const [history, setHistory] = useState<UserResult[]>(() => {
    const saved = localStorage.getItem('edugen_history_v5');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = sessionStorage.getItem('edugen_time');
    return saved ? parseInt(saved) : 0;
  });
  const timerId = useRef<any>(null);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const [topicHistory, setTopicHistory] = useState<TopicSelection[]>([{
    math: ["Bilangan & Operasi", "Pecahan"],
    indonesian: ["Teks Sastra", "Ide Pokok"]
  }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const topics = useMemo(() => topicHistory[historyIndex], [topicHistory, historyIndex]);

  useEffect(() => {
    let itv: any;
    if (isSyncing) {
      itv = setInterval(() => setSyncStep(s => (s + 1) % VERIFICATION_LOGS.length), 1000);
    }
    return () => clearInterval(itv);
  }, [isSyncing]);

  useEffect(() => {
    if (location.pathname === '/exam' && timeLeft > 0) {
      timerId.current = setInterval(() => {
        setTimeLeft(t => {
          const next = t - 1;
          sessionStorage.setItem('edugen_time', next.toString());
          return next;
        });
      }, 1000);
    } else if (location.pathname === '/exam' && timeLeft === 0 && questions.length > 0) {
      finalizeExam();
    }
    return () => clearInterval(timerId.current);
  }, [location.pathname, timeLeft]);

  useEffect(() => {
    if (questions.length > 0) sessionStorage.setItem('edugen_active_exam', JSON.stringify(questions));
    sessionStorage.setItem('edugen_answers', JSON.stringify(userAnswers));
  }, [questions, userAnswers]);

  const getRegistry = () => JSON.parse(localStorage.getItem('edugen_registry_v5') || '[]');

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setSysError(null);
    const registry = getRegistry();
    
    if (authMode === 'register') {
      if (registry.length > 0) return setSysError("Single User Mode: A master account is already active.");
      if (!authForm.user || !authForm.pass || !authForm.phone) return setSysError("All credentials required.");
      
      const singleUserRegistry = [authForm];
      localStorage.setItem('edugen_registry_v5', JSON.stringify(singleUserRegistry));
      setAuthMode('login');
      alert("Master Account Established.");
    } else {
      const match = registry.find((u: any) => u.user === authForm.user && u.pass === authForm.pass);
      if (match) {
        const session = { username: match.user, phone: match.phone };
        setCurrentUser(session);
        localStorage.setItem('edugen_session_v5', JSON.stringify(session));
        navigate('/config');
      } else { setSysError("Access Denied: Invalid Credentials."); }
    }
  };

  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setSysError(null);
    const registry = getRegistry();
    const match = registry.find((u: any) => u.phone === recoveryPhone);
    if (match) setRecoveredInfo(`FOUND: [User ID: ${match.user}] [Code: ${match.pass}]`);
    else setSysError("No linked phone identified.");
  };

  const startGeneration = async () => {
    if (!isOnline) { setSysError("OFFLINE: Sync required."); return; }
    if (isSyncing) return;
    setIsSyncing(true);
    setSysError(null);
    try {
      const data = await generateTKAQuestions(topics);
      if (data && data.length > 0) {
        setQuestions(data);
        const initialTime = 45 * 60;
        setTimeLeft(initialTime);
        sessionStorage.setItem('edugen_time', initialTime.toString());
        setTimeout(() => { setIsSyncing(false); navigate('/exam'); }, 1000);
      } else { throw new Error("Integrity Fail"); }
    } catch (err) {
      setSysError("AI Synthesis Latency. Please try again.");
      setIsSyncing(false);
    }
  };

  const finalizeExam = () => {
    clearInterval(timerId.current);
    let correct = 0;
    questions.forEach((q, i) => {
      if (JSON.stringify(userAnswers[i]) === JSON.stringify(q.correctAnswer)) correct++;
    });
    const score = Math.round((correct / questions.length) * 100);
    const res = {
      username: currentUser?.username || 'Guest',
      score,
      totalQuestions: questions.length,
      correctCount: correct,
      date: new Date().toLocaleString('id-ID'),
      topics: [...topics.math, ...topics.indonesian]
    };
    const newHistory = [res, ...history];
    setHistory(newHistory);
    localStorage.setItem('edugen_history_v5', JSON.stringify(newHistory));
    navigate('/result');
  };

  const deleteHistoryItem = (idx: number) => {
    setHistory(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      localStorage.setItem('edugen_history_v5', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleTopic = (cat: 'math' | 'indonesian', val: string) => {
    const current = topicHistory[historyIndex];
    const nextTopics = {
      ...current,
      [cat]: current[cat].includes(val) 
        ? current[cat].filter(x => x !== val) 
        : [...current[cat], val]
    };
    
    // Fixed logic to update topicHistory correctly
    const newHistory = [...topicHistory.slice(0, historyIndex + 1), nextTopics];
    if (newHistory.length > 20) newHistory.shift();
    
    setTopicHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  if (!currentUser) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
      <div className="orb orb-1 opacity-20"></div>
      <div className="max-w-md w-full relative z-10">
        <div className="glass-card-3d rounded-[3rem] p-10 sm:p-16 text-center border-white/5 relative">
          <div className="scanline"></div>
          <LogoElite size="large" />
          <h1 className="text-5xl sm:text-6xl font-black text-white mt-8 tracking-tighter italic">EduGen <span className="text-blue-500">TKA-SD.</span></h1>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3 mb-10">Single User Edition v5.2</p>
          
          {authMode === 'recover' ? (
            <form onSubmit={handleRecovery} className="space-y-4">
              <h2 className="text-lg font-black text-blue-400 uppercase tracking-widest">Recovery</h2>
              <input type="text" placeholder="WhatsApp Number" className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 text-white font-bold outline-none" value={recoveryPhone} onChange={e => setRecoveryPhone(e.target.value)} />
              {recoveredInfo && <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-xl text-[10px] font-black text-blue-400">{recoveredInfo}</div>}
              {sysError && <p className="text-rose-500 text-[10px] font-black uppercase">{sysError}</p>}
              <button type="submit" className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl uppercase tracking-[0.2em]">Verify</button>
              <button type="button" onClick={() => setAuthMode('login')} className="w-full text-[10px] font-black text-slate-600 uppercase mt-4">Back</button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <input type="text" placeholder="User ID" className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500" value={authForm.user} onChange={e => setAuthForm({...authForm, user: e.target.value})} />
              {authMode === 'register' && (
                <input type="text" placeholder="WhatsApp Number" className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 text-white font-bold outline-none" value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} />
              )}
              <input type="password" placeholder="Access Code" className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} />
              {sysError && <p className="text-rose-500 text-[10px] font-black uppercase">{sysError}</p>}
              <button type="submit" className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl uppercase tracking-[0.2em]">
                {authMode === 'register' ? 'Register User' : 'Initialize'}
              </button>
            </form>
          )}
          
          <div className="mt-8 flex flex-col gap-3">
            {getRegistry().length === 0 && authMode === 'login' && (
              <button onClick={() => setAuthMode('register')} className="text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-blue-400">&gt;&gt; REGISTER NEW USER</button>
            )}
            {authMode === 'register' && (
              <button onClick={() => setAuthMode('login')} className="text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-blue-400">&lt;&lt; BACK TO LOGIN</button>
            )}
            {authMode === 'login' && (
              <button onClick={() => setAuthMode('recover')} className="text-[10px] font-black text-slate-800 uppercase tracking-widest hover:text-rose-500">LOST CREDENTIALS?</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-['Plus_Jakarta_Sans'] pb-20 sm:pb-0">
      <header className="h-20 bg-slate-900/60 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-[60] flex items-center justify-between px-6 sm:px-12">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/config')}>
          <LogoElite size="small" />
          <span className="text-2xl font-black text-white tracking-tighter">EduGen</span>
        </div>
        <nav className="hidden sm:flex items-center gap-10">
          <NavLink to="/config" className={({isActive}) => `text-[11px] font-black uppercase tracking-[0.3em] ${isActive ? 'text-blue-400 border-b-2 border-blue-500 pb-1' : 'text-slate-500'}`}>Setup</NavLink>
          <NavLink to="/history" className={({isActive}) => `text-[11px] font-black uppercase tracking-[0.3em] ${isActive ? 'text-blue-400 border-b-2 border-blue-500 pb-1' : 'text-slate-500'}`}>Logs</NavLink>
          <button onClick={() => { localStorage.removeItem('edugen_session_v5'); setCurrentUser(null); navigate('/'); }} className="text-[9px] font-black uppercase text-rose-500">Exit</button>
        </nav>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-8 py-10 sm:py-16">
        {isSyncing && (
          <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center">
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
              <div className="absolute inset-0 border-[10px] border-blue-600/10 rounded-full"></div>
              <div className="absolute inset-0 border-[10px] border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-3xl font-black text-blue-500">AI-CORE</span>
            </div>
            <p className="mt-12 text-2xl font-black text-white italic animate-pulse">{VERIFICATION_LOGS[syncStep]}</p>
          </div>
        )}

        <Routes>
          <Route path="/config" element={
            <div className="space-y-12 sm:space-y-20">
              <div className="text-center">
                <h2 className="text-5xl sm:text-8xl font-black text-white tracking-tighter italic">Simulation <span className="text-blue-500">Suite.</span></h2>
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="glass-card-3d p-8 rounded-[3rem] transition-all duration-500 hover:shadow-blue-500/10">
                  <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-4"><span className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">∑</span> NUMERACY</h3>
                  <div className="flex flex-wrap gap-3">
                    {NUMERASI_TOPICS.map(t => (
                      <button 
                        key={t} 
                        onClick={() => toggleTopic('math', t)} 
                        className={`px-5 py-4 rounded-2xl text-left font-black text-sm border-2 transition-all duration-300 active:scale-90 ${
                          topics.math.includes(t) 
                            ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/30 scale-105' 
                            : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="glass-card-3d p-8 rounded-[3rem] transition-all duration-500 hover:shadow-indigo-500/10">
                  <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-4"><span className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">¶</span> LITERACY</h3>
                  <div className="flex flex-wrap gap-3">
                    {LITERASI_TOPICS.map(t => (
                      <button 
                        key={t} 
                        onClick={() => toggleTopic('indonesian', t)} 
                        className={`px-5 py-4 rounded-2xl text-left font-black text-sm border-2 transition-all duration-300 active:scale-90 ${
                          topics.indonesian.includes(t) 
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/30 scale-105' 
                            : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-center pt-8">
                <button onClick={startGeneration} className="w-full max-w-4xl btn-3d-blue text-white py-10 rounded-[2.5rem] font-black text-3xl sm:text-5xl group">
                   GENERATE SYSTEM <span className="inline-block group-hover:translate-x-2 transition-transform">→</span>
                </button>
                {sysError && <p className="mt-8 text-rose-500 font-black uppercase text-[10px] tracking-widest">{sysError}</p>}
              </div>
            </div>
          } />

          <Route path="/exam" element={
            questions.length > 0 ? (
              <div className="max-w-4xl mx-auto pb-40">
                <div className="glass-card-3d p-6 rounded-3xl sticky top-24 z-[55] flex items-center justify-between mb-12 bg-slate-950/80 border-blue-500/20">
                  <div className="bg-slate-900 rounded-2xl p-4"><p className="text-[8px] font-black uppercase">Timer</p><p className="text-2xl font-black text-blue-400">{Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2, '0')}</p></div>
                  <button onClick={finalizeExam} className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-black uppercase">Finish</button>
                </div>
                <div className="space-y-12">
                  {questions.map((q, i) => (
                    <QuestionCard key={i} index={i} question={q} showAnswers={false} interactive={true} currentAnswer={userAnswers[i]} onAnswerChange={(ans) => setUserAnswers({...userAnswers, [i]: ans})} />
                  ))}
                </div>
              </div>
            ) : <Navigate to="/config" />
          } />

          <Route path="/result" element={
            history.length > 0 ? (
              <div className="max-w-4xl mx-auto space-y-12 pb-40 text-center">
                <div className="glass-card-3d p-12 rounded-[3.5rem]">
                  <div className="w-32 h-32 sm:w-48 sm:h-48 bg-emerald-600 rounded-[2.5rem] flex flex-col items-center justify-center text-white mx-auto mb-10">
                    <span className="text-[10px] font-black">SCORE</span>
                    <span className="text-6xl sm:text-8xl font-black">{history[0]?.score || 0}</span>
                  </div>
                  <h2 className="text-4xl sm:text-6xl font-black text-white italic mb-10">Analysis Ready.</h2>
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button onClick={() => navigate('/history')} className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase">History Logs</button>
                    <button onClick={() => navigate('/config')} className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black uppercase">Retry</button>
                  </div>
                </div>
                <div className="mt-20 space-y-12 text-left">
                  <h3 className="text-3xl font-black text-white italic">Detailed Review</h3>
                  <div className="space-y-10">
                    {questions.map((q, i) => (
                      <QuestionCard key={i} index={i} question={q} showAnswers={true} interactive={false} currentAnswer={userAnswers[i]} />
                    ))}
                  </div>
                </div>
              </div>
            ) : <Navigate to="/config" />
          } />

          <Route path="/history" element={
            <div className="glass-card-3d p-8 rounded-[3rem] max-w-4xl mx-auto">
              <h2 className="text-3xl font-black text-white italic mb-10">Archive Logs</h2>
              {history.length === 0 ? <p className="text-slate-700 py-20 text-center uppercase font-black">No log data.</p> : (
                <div className="space-y-4">
                  {history.map((h, i) => (
                    <div key={i} className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 flex items-center justify-between">
                      <div><p className="font-black text-lg text-white">{h.date}</p><p className="text-[10px] font-black text-blue-500 uppercase">{h.correctCount} Hits / {h.totalQuestions}</p></div>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-blue-700 rounded-2xl flex items-center justify-center font-black text-xl text-white">{h.score}</div>
                        <button onClick={() => deleteHistoryItem(i)} className="text-rose-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          } />
          <Route path="*" element={<Navigate to="/config" />} />
        </Routes>
      </main>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-3xl border-t border-white/10 z-[70] flex justify-around items-center h-20">
        <NavLink to="/config" className={({isActive}) => `flex flex-col items-center gap-1 ${isActive ? 'text-blue-400' : 'text-slate-500'}`}><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/></svg><span className="text-[8px] font-black uppercase">Setup</span></NavLink>
        <NavLink to="/history" className={({isActive}) => `flex flex-col items-center gap-1 ${isActive ? 'text-blue-400' : 'text-slate-500'}`}><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z"/></svg><span className="text-[8px] font-black uppercase">Logs</span></NavLink>
        <button onClick={() => { localStorage.removeItem('edugen_session_v5'); setCurrentUser(null); navigate('/'); }} className="flex flex-col items-center gap-1 text-rose-500"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M10.09 15.59 11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg><span className="text-[8px] font-black uppercase">Exit</span></button>
      </nav>
    </div>
  );
};

export default App;
