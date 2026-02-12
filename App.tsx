
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

  // Root State Initialization
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

  // Online/Offline Detection
  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  // Topic History for Undo/Redo
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

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setSysError(null);
    const registry = JSON.parse(localStorage.getItem('edugen_registry_v5') || '[]');
    
    if (authMode === 'register') {
      if (!authForm.user || !authForm.pass || !authForm.phone) return setSysError("Complete credentials required.");
      if (registry.some((u: any) => u.user === authForm.user)) return setSysError("Node ID already assigned.");
      if (registry.some((u: any) => u.phone === authForm.phone)) return setSysError("Phone already linked to a Node.");
      
      registry.push(authForm);
      localStorage.setItem('edugen_registry_v5', JSON.stringify(registry));
      setAuthMode('login');
      alert("Registration Validated.");
    } else {
      const match = registry.find((u: any) => u.user === authForm.user && u.pass === authForm.pass);
      if (match) {
        const session = { username: match.user, phone: match.phone };
        setCurrentUser(session);
        localStorage.setItem('edugen_session_v5', JSON.stringify(session));
        navigate('/config');
      } else { setSysError("Invalid Credentials Protocol."); }
    }
  };

  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setSysError(null);
    setRecoveredInfo(null);
    const registry = JSON.parse(localStorage.getItem('edugen_registry_v5') || '[]');
    const match = registry.find((u: any) => u.phone === recoveryPhone);
    if (match) setRecoveredInfo(`FOUND: [User ID: ${match.user}] [Code: ${match.pass}]`);
    else setSysError("No Node identified with this Phone Link.");
  };

  const startGeneration = async () => {
    if (!isOnline) { setSysError("OFFLINE: Connection required for AI Synthesis."); return; }
    if (isSyncing) return;
    setIsSyncing(true);
    setSysError(null);
    setUserAnswers({});
    sessionStorage.removeItem('edugen_answers');
    
    try {
      const data = await generateTKAQuestions(topics);
      if (data && data.length > 0) {
        setQuestions(data);
        const initialTime = 45 * 60;
        setTimeLeft(initialTime);
        sessionStorage.setItem('edugen_time', initialTime.toString());
        setTimeout(() => { setIsSyncing(false); navigate('/exam'); }, 800);
      } else { throw new Error("Data Integrity Fail"); }
    } catch (err) {
      setSysError("AI Core Latency Error. Please re-initialize.");
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
    sessionStorage.removeItem('edugen_active_exam');
    sessionStorage.removeItem('edugen_answers');
    sessionStorage.removeItem('edugen_time');
    navigate('/result');
  };

  const deleteHistoryItem = (idx: number) => {
    setHistory(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      localStorage.setItem('edugen_history_v5', JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    if (window.confirm("Purge all assessment logs? This action is irreversible.")) {
      setHistory([]);
      localStorage.setItem('edugen_history_v5', JSON.stringify([]));
    }
  };

  const toggleTopic = (cat: 'math' | 'indonesian', val: string) => {
    const current = topicHistory[historyIndex];
    const nextTopics = {
      ...current,
      [cat]: current[cat].includes(val) ? current[cat].filter(x => x !== val) : [...current[cat], val]
    };
    const newHistory = topicHistory.slice(0, historyIndex + 1);
    newHistory.push(nextTopics);
    if (newHistory.length > 30) newHistory.shift();
    setTopicHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => { if (historyIndex > 0) setHistoryIndex(historyIndex - 1); };
  const redo = () => { if (historyIndex < topicHistory.length - 1) setHistoryIndex(historyIndex + 1); };

  if (!currentUser) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 overflow-hidden relative">
      <div className="orb orb-1 opacity-20"></div>
      <div className="max-w-md w-full relative z-10 px-4">
        <div className="glass-card-3d rounded-[3rem] p-10 sm:p-16 text-center border-white/5 relative">
          <div className="scanline"></div>
          <LogoElite size="large" />
          <h1 className="text-5xl sm:text-6xl font-black text-white mt-8 tracking-tighter italic leading-none">EduGen <span className="text-blue-500">TKA.</span></h1>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3 mb-10">Premium Assessment v5.0</p>
          
          {authMode === 'recover' ? (
            <form onSubmit={handleRecovery} className="space-y-4">
              <h2 className="text-lg font-black text-blue-400 uppercase tracking-widest mb-4">Node Recovery</h2>
              <input type="text" placeholder="WhatsApp Number" className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500" value={recoveryPhone} onChange={e => setRecoveryPhone(e.target.value)} />
              {recoveredInfo && <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-xl text-[10px] font-black text-blue-400 uppercase">{recoveredInfo}</div>}
              {sysError && <p className="text-rose-500 text-[10px] font-black uppercase">{sysError}</p>}
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-600/20 uppercase tracking-[0.2em]">Locate Node</button>
              <button type="button" onClick={() => setAuthMode('login')} className="w-full text-[10px] font-black text-slate-600 uppercase mt-4">Return to Auth</button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <input type="text" placeholder="User ID" className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500" value={authForm.user} onChange={e => setAuthForm({...authForm, user: e.target.value})} />
              {authMode === 'register' && (
                <input type="text" placeholder="WhatsApp Number" className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500" value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} />
              )}
              <input type="password" placeholder="Access Code" className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} />
              {sysError && <p className="text-rose-500 text-[10px] font-black uppercase">{sysError}</p>}
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-600/20 uppercase tracking-[0.2em]">
                {authMode === 'register' ? 'Deploy Node' : 'Initialize'}
              </button>
            </form>
          )}
          
          <div className="mt-8 flex flex-col gap-3">
            <button onClick={() => setAuthMode(m => m === 'login' ? 'register' : 'login')} className="text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-blue-400">
              {authMode === 'login' ? '>> Register New User' : '<< Back to Auth'}
            </button>
            {authMode === 'login' && (
              <button onClick={() => setAuthMode('recover')} className="text-[10px] font-black text-slate-800 uppercase tracking-widest hover:text-rose-500">
                Lost Node Credentials?
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-['Plus_Jakarta_Sans'] pb-20 sm:pb-0">
      {/* Network Status - Sticky top for mobile app feel */}
      {!isOnline && (
        <div className="bg-rose-600 text-white text-[9px] font-black uppercase tracking-[0.4em] py-1 text-center fixed top-0 w-full z-[100] safe-top shadow-xl">
          OFFLINE PROTOCOL ACTIVE
        </div>
      )}

      {/* Persistent Navigation - Desktop Top / Mobile Top Brand */}
      <header className={`h-20 bg-slate-900/60 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-[60] flex items-center justify-between px-6 sm:px-12 transition-all`}>
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/config')}>
          <LogoElite size="small" />
          <span className="text-2xl font-black text-white tracking-tighter">EduGen</span>
        </div>
        
        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-10">
          <NavLink to="/config" className={({isActive}) => `text-[11px] font-black uppercase tracking-[0.3em] ${isActive ? 'text-blue-400 border-b-2 border-blue-500 pb-1' : 'text-slate-500'}`}>Config</NavLink>
          <NavLink to="/history" className={({isActive}) => `text-[11px] font-black uppercase tracking-[0.3em] ${isActive ? 'text-blue-400 border-b-2 border-blue-500 pb-1' : 'text-slate-500'}`}>Logs</NavLink>
          <button onClick={() => { localStorage.removeItem('edugen_session_v5'); setCurrentUser(null); navigate('/'); }} className="bg-slate-950 px-5 py-2 rounded-xl border border-white/5 text-[9px] font-black uppercase text-rose-500">Logout</button>
        </nav>

        {/* Mobile Mini Info */}
        <div className="sm:hidden flex items-center gap-3">
           <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-blue-500' : 'bg-rose-500'} animate-pulse`}></div>
           <span className="text-[10px] font-black text-slate-500 uppercase">{currentUser?.username}</span>
        </div>
      </header>

      {/* Mobile Bottom Navigation - Pure App Experience */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-3xl border-t border-white/10 z-[70] flex justify-around items-center px-4 pb-safe h-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <NavLink to="/config" className={({isActive}) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-blue-400 scale-110' : 'text-slate-500'}`}>
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49-.01.61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/></svg>
          <span className="text-[8px] font-black uppercase tracking-widest">Setup</span>
        </NavLink>
        <NavLink to="/history" className={({isActive}) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-blue-400 scale-110' : 'text-slate-500'}`}>
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
          <span className="text-[8px] font-black uppercase tracking-widest">Logs</span>
        </NavLink>
        <button onClick={() => { localStorage.removeItem('edugen_session_v5'); setCurrentUser(null); navigate('/'); }} className="flex flex-col items-center gap-1 text-rose-500 opacity-60">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="m17 7-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
          <span className="text-[8px] font-black uppercase tracking-widest">Exit</span>
        </button>
      </nav>

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-8 py-10 sm:py-16 relative">
        {isSyncing && (
          <div className="fixed inset-0 z-[100] bg-slate-950/98 backdrop-blur-3xl flex flex-col items-center justify-center animate-in fade-in">
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
              <div className="absolute inset-0 border-[10px] border-blue-600/10 rounded-full"></div>
              <div className="absolute inset-0 border-[10px] border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-8 bg-slate-900 rounded-full flex flex-col items-center justify-center shadow-3xl">
                <span className="text-3xl sm:text-5xl font-black text-blue-500 tracking-tighter">AI-CORE</span>
              </div>
            </div>
            <div className="mt-12 text-center px-6">
              <p className="text-2xl sm:text-4xl font-black text-white italic tracking-tighter animate-pulse">{VERIFICATION_LOGS[syncStep]}</p>
              <div className="w-64 sm:w-96 h-1.5 bg-slate-900 mx-auto rounded-full mt-6 overflow-hidden border border-white/5">
                <div className="h-full bg-blue-600 animate-[loading-bar_3s_infinite_linear]" style={{width: '60%'}}></div>
              </div>
            </div>
          </div>
        )}

        <div className={isSyncing ? 'opacity-0' : 'opacity-100 transition-all duration-700'}>
          <Routes>
            <Route path="/config" element={
              <div className="space-y-12 sm:space-y-20 animate-in slide-in-from-bottom duration-700">
                <div className="text-center relative">
                  <div className="inline-block px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border bg-blue-600/10 text-blue-500 border-blue-500/20 mb-6">
                    SYSTEM GENESIS
                  </div>
                  <h2 className="text-5xl sm:text-8xl font-black text-white tracking-tighter italic leading-tight">Simulation <span className="text-blue-500">Suite.</span></h2>
                  
                  <div className="flex justify-center gap-3 mt-8">
                    <button onClick={undo} disabled={historyIndex === 0} className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-2 ${historyIndex === 0 ? 'opacity-20' : 'bg-slate-900 text-white'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path></svg> Undo
                    </button>
                    <button onClick={redo} disabled={historyIndex === topicHistory.length - 1} className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-2 ${historyIndex === topicHistory.length - 1 ? 'opacity-20' : 'bg-slate-900 text-white'}`}>
                      Redo <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="glass-card-3d p-8 sm:p-12 rounded-[3rem] relative overflow-hidden group">
                    <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-4">
                      <span className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-lg">∑</span> NUMERACY
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {NUMERASI_TOPICS.map(t => (
                        <button key={t} onClick={() => toggleTopic('math', t)} className={`px-5 py-4 rounded-2xl text-left font-black text-sm border-2 transition-all ${topics.math.includes(t) ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-900/50 border-slate-800 text-slate-500'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div className="glass-card-3d p-8 sm:p-12 rounded-[3rem] relative overflow-hidden group">
                    <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-4">
                      <span className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-lg">¶</span> LITERACY
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {LITERASI_TOPICS.map(t => (
                        <button key={t} onClick={() => toggleTopic('indonesian', t)} className={`px-5 py-4 rounded-2xl text-left font-black text-sm border-2 transition-all ${topics.indonesian.includes(t) ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-900/50 border-slate-800 text-slate-500'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-center pt-8 pb-10">
                  <button onClick={startGeneration} className={`w-full max-w-4xl btn-3d-blue text-white py-8 sm:py-12 rounded-[2.5rem] sm:rounded-[3.5rem] font-black text-3xl sm:text-5xl tracking-tighter group transition-all ${!isOnline ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}>
                    {isOnline ? 'GENERATE SYSTEM' : 'OFFLINE MODE'} <span className="inline-block group-hover:translate-x-3 transition-transform ml-2">→</span>
                  </button>
                  {sysError && <p className="mt-8 text-rose-500 font-black uppercase text-[10px] tracking-widest animate-bounce">{sysError}</p>}
                </div>
              </div>
            } />

            <Route path="/exam" element={
              questions.length > 0 ? (
                <div className="max-w-4xl mx-auto pb-40">
                  <div className="glass-card-3d p-6 rounded-3xl sticky top-24 sm:top-28 z-[55] flex items-center justify-between mb-12 bg-slate-950/80 backdrop-blur-2xl border-blue-500/20">
                    <div className="bg-slate-900 rounded-2xl p-4 border border-white/5">
                      <p className="text-[8px] font-black text-slate-600 uppercase">Timer</p>
                      <p className="text-2xl font-black text-blue-400 font-mono tracking-tighter">{Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2, '0')}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden xs:block">
                        <p className="text-[8px] font-black text-slate-600 uppercase">Progress</p>
                        <p className="text-xl font-black text-white">{Object.keys(userAnswers).length} / {questions.length}</p>
                      </div>
                      <button onClick={finalizeExam} className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl">Finish</button>
                    </div>
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
                <div className="max-w-4xl mx-auto space-y-12 pb-40 text-center animate-in zoom-in">
                  <div className="glass-card-3d p-12 sm:p-20 rounded-[3.5rem] relative overflow-hidden">
                    <div className="w-32 h-32 sm:w-48 sm:h-48 bg-gradient-to-tr from-emerald-600 to-teal-900 rounded-[2.5rem] rotate-6 flex flex-col items-center justify-center text-white shadow-3xl mx-auto mb-10 border-4 border-slate-950">
                      <span className="text-[10px] font-black opacity-60">SCORE</span>
                      <span className="text-6xl sm:text-8xl font-black tracking-tighter">{history[0]?.score || 0}</span>
                    </div>
                    <h2 className="text-4xl sm:text-6xl font-black text-white italic tracking-tighter mb-10 leading-none">Analysis Ready.</h2>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                      <button onClick={() => navigate('/history')} className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-sm uppercase shadow-3xl">Log History</button>
                      <button onClick={() => navigate('/config')} className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-sm uppercase border border-white/10">Try Again</button>
                    </div>
                  </div>
                </div>
              ) : <Navigate to="/config" />
            } />

            <Route path="/history" element={
              <div className="glass-card-3d p-8 sm:p-12 rounded-[3rem] max-w-4xl mx-auto animate-in slide-in-from-bottom relative">
                <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-3xl sm:text-4xl font-black text-white italic tracking-tighter">Archive Logs</h2>
                    <div className={`px-4 py-2 rounded-full border text-[9px] font-black uppercase ${isOnline ? 'bg-slate-900 text-blue-500' : 'text-rose-500'}`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </div>
                  </div>
                  {history.length > 0 && (
                    <button 
                      onClick={clearHistory}
                      className="px-6 py-3 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-500 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95"
                    >
                      Purge All Logs
                    </button>
                  )}
                </div>
                {history.length === 0 ? <p className="text-slate-700 py-20 text-center font-black uppercase tracking-widest text-sm">No log data.</p> : (
                  <div className="space-y-4">
                    {history.map((h, i) => (
                      <div key={i} className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 flex items-center justify-between group relative overflow-hidden transition-all duration-300">
                        <div className="absolute inset-0 bg-rose-600/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        <div>
                          <p className="font-black text-lg text-white">{h.date}</p>
                          <p className="text-[10px] font-black text-blue-500 uppercase mt-2">{h.correctCount} Hits / {h.totalQuestions}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-blue-700 border-2 border-slate-950 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-xl">{h.score}</div>
                          <button 
                            onClick={() => deleteHistoryItem(i)}
                            className="w-10 h-10 flex items-center justify-center bg-slate-950 rounded-xl text-slate-600 hover:text-rose-500 border border-white/5 transition-colors group/btn"
                            title="Delete log"
                          >
                            <svg className="w-5 h-5 group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            } />
            <Route path="*" element={<Navigate to="/config" />} />
          </Routes>
        </div>
      </main>
      
      {/* Desktop Footer Only */}
      <footer className="hidden sm:block no-print border-t border-white/5 bg-slate-950/80 backdrop-blur-xl py-10 px-10 text-center">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          <div className="text-left">
            <p className="text-xl font-black text-white italic leading-none">EduGen <span className="text-blue-500">TKA.</span></p>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">Verified Assessment System v5.0.2</p>
          </div>
          <div className="flex gap-8">
            <div className="text-center"><p className="text-sm font-black text-white">{isOnline ? 'Online' : 'Offline'}</p><p className="text-[8px] font-black text-slate-600 uppercase">Network</p></div>
            <div className="text-center"><p className="text-sm font-black text-white">4.120</p><p className="text-[8px] font-black text-slate-600 uppercase">Kernel</p></div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
