
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
  const dim = size === "small" ? "w-10 h-10" : size === "large" ? "w-48 h-48" : "w-28 h-28";
  const font = size === "small" ? "text-xl" : size === "large" ? "text-7xl" : "text-5xl";
  const rounded = size === "small" ? "rounded-xl" : "rounded-[3rem]";
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

  // Root State Initialization (Strict Persistence)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('edugen_session_v5');
    return saved ? JSON.parse(saved) : null;
  });

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

  // Attempt Tracking: Check if user has already completed an exam
  const hasAlreadyAttempted = useMemo(() => {
    return history.some(h => h.username === currentUser?.username);
  }, [history, currentUser]);

  // Undo/Redo State Management for Topics
  const [topicHistory, setTopicHistory] = useState<TopicSelection[]>([{
    math: ["Bilangan & Operasi", "Pecahan"],
    indonesian: ["Teks Sastra", "Ide Pokok"]
  }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const topics = useMemo(() => topicHistory[historyIndex], [topicHistory, historyIndex]);

  // Sync Timer for UI
  useEffect(() => {
    let itv: any;
    if (isSyncing) {
      itv = setInterval(() => setSyncStep(s => (s + 1) % VERIFICATION_LOGS.length), 1000);
    }
    return () => clearInterval(itv);
  }, [isSyncing]);

  // Exam Logic with Persistence
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

  // Persistence triggers
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
    
    if (match) {
      setRecoveredInfo(`FOUND: [Terminal ID: ${match.user}] [Code: ${match.pass}]`);
    } else {
      setSysError("No Node identified with this Phone Link.");
    }
  };

  const startGeneration = async () => {
    if (isSyncing || hasAlreadyAttempted) return;
    setIsSyncing(true);
    setSysError(null);
    setUserAnswers({});
    sessionStorage.removeItem('edugen_answers');
    
    try {
      const data = await generateTKAQuestions(topics);
      if (data && data.length > 0) {
        setQuestions(data);
        const initialTime = 45 * 60; // 45 Minutes Standard
        setTimeLeft(initialTime);
        sessionStorage.setItem('edugen_time', initialTime.toString());
        
        setTimeout(() => {
          setIsSyncing(false);
          navigate('/exam');
        }, 800);
      } else { throw new Error("Data Integrity Fail: Null Set"); }
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

  const toggleTopic = (cat: 'math' | 'indonesian', val: string) => {
    if (hasAlreadyAttempted) return; // Disable changes if attempted
    const current = topicHistory[historyIndex];
    const nextTopics = {
      ...current,
      [cat]: current[cat].includes(val) 
        ? current[cat].filter(x => x !== val) 
        : [...current[cat], val]
    };
    
    // Create new history branch
    const newHistory = topicHistory.slice(0, historyIndex + 1);
    newHistory.push(nextTopics);
    
    // Limit history size to 30 for performance
    if (newHistory.length > 30) newHistory.shift();
    
    setTopicHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) setHistoryIndex(historyIndex - 1);
  };

  const redo = () => {
    if (historyIndex < topicHistory.length - 1) setHistoryIndex(historyIndex + 1);
  };

  if (!currentUser) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 overflow-hidden relative">
      <div className="orb orb-1 opacity-20"></div>
      <div className="max-w-md w-full relative z-10">
        <div className="glass-card-3d rounded-[4rem] p-16 text-center border-white/5 relative">
          <div className="scanline"></div>
          <LogoElite size="large" />
          <h1 className="text-6xl font-black text-white mt-10 tracking-tighter italic">EduGen <span className="text-blue-500">TKA.</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3 mb-12">Certified Assessment V.5.0</p>
          
          {authMode === 'recover' ? (
            <form onSubmit={handleRecovery} className="space-y-4">
              <h2 className="text-xl font-black text-blue-400 uppercase tracking-widest mb-6">Node Recovery</h2>
              <div className="relative">
                <input type="text" placeholder="WhatsApp Number" className="w-full bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 text-white font-bold placeholder:text-slate-700 outline-none focus:border-blue-500 transition-all shadow-inner" value={recoveryPhone} onChange={e => setRecoveryPhone(e.target.value)} />
              </div>
              {recoveredInfo && (
                <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-2xl animate-in zoom-in">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{recoveredInfo}</p>
                </div>
              )}
              {sysError && <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest animate-bounce">{sysError}</p>}
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-6 rounded-3xl shadow-2xl shadow-blue-600/30 transition-all uppercase tracking-[0.2em] text-lg">Locate Node</button>
              <button type="button" onClick={() => { setAuthMode('login'); setSysError(null); setRecoveredInfo(null); }} className="w-full text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mt-4 hover:text-white transition-colors">Return to Auth</button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="relative">
                <input type="text" placeholder="Terminal ID" className="w-full bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 text-white font-bold placeholder:text-slate-700 outline-none focus:border-blue-500 transition-all shadow-inner" value={authForm.user} onChange={e => setAuthForm({...authForm, user: e.target.value})} />
              </div>
              {authMode === 'register' && (
                <div className="relative">
                  <input type="text" placeholder="WhatsApp Number" className="w-full bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 text-white font-bold placeholder:text-slate-700 outline-none focus:border-blue-500 transition-all shadow-inner" value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} />
                </div>
              )}
              <div className="relative">
                <input type="password" placeholder="Access Code" className="w-full bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 text-white font-bold placeholder:text-slate-700 outline-none focus:border-blue-500 transition-all shadow-inner" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} />
              </div>
              {sysError && <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest animate-bounce">{sysError}</p>}
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-6 rounded-3xl shadow-2xl shadow-blue-600/30 transition-all uppercase tracking-[0.2em] text-lg">
                {authMode === 'register' ? 'Deploy Node' : 'Initialize'}
              </button>
            </form>
          )}
          
          <div className="mt-10 flex flex-col gap-4">
            <button onClick={() => { setAuthMode(m => m === 'login' ? 'register' : 'login'); setSysError(null); }} className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] hover:text-blue-400 transition-colors">
              {authMode === 'login' ? '>> Register New Node' : '<< Back to Auth'}
            </button>
            {authMode === 'login' && (
              <button onClick={() => { setAuthMode('recover'); setSysError(null); }} className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] hover:text-rose-500 transition-colors">
                Lost Node Credentials?
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-['Plus_Jakarta_Sans']">
      <header className="h-24 bg-slate-900/40 backdrop-blur-3xl border-b border-white/5 sticky top-0 z-[60] flex items-center justify-between px-12">
        <div className="flex items-center gap-5 cursor-pointer group" onClick={() => navigate('/config')}>
          <LogoElite size="small" />
          <span className="text-3xl font-black text-white tracking-tighter group-hover:text-blue-400 transition-colors">EduGen</span>
        </div>
        <nav className="flex items-center gap-10">
          <NavLink to="/config" className={({isActive}) => `text-[11px] font-black uppercase tracking-[0.3em] transition-all ${isActive ? 'text-blue-400 border-b-2 border-blue-500 pb-1' : 'text-slate-500 hover:text-white'}`}>Config</NavLink>
          <NavLink to="/history" className={({isActive}) => `text-[11px] font-black uppercase tracking-[0.3em] transition-all ${isActive ? 'text-blue-400 border-b-2 border-blue-500 pb-1' : 'text-slate-500 hover:text-white'}`}>Logs</NavLink>
          <button onClick={() => { localStorage.removeItem('edugen_session_v5'); setCurrentUser(null); navigate('/'); }} className="bg-slate-950 px-6 py-2 rounded-xl border border-white/5 text-[10px] font-black uppercase text-rose-500 hover:bg-rose-500 hover:text-white transition-all">Logout</button>
        </nav>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-8 py-16 relative">
        {isSyncing && (
          <div className="fixed inset-0 z-[100] bg-slate-950/98 backdrop-blur-3xl flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="relative w-80 h-80 flex items-center justify-center">
              <div className="absolute inset-0 border-[12px] border-blue-600/10 rounded-full"></div>
              <div className="absolute inset-0 border-[12px] border-blue-500 border-t-transparent rounded-full animate-spin shadow-[0_0_50px_rgba(37,99,235,0.3)]"></div>
              <div className="absolute inset-10 bg-slate-900 rounded-full flex flex-col items-center justify-center shadow-3xl">
                <span className="text-5xl font-black text-blue-500 tracking-tighter">AI-CORE</span>
              </div>
            </div>
            <div className="mt-16 text-center space-y-4">
              <p className="text-4xl font-black text-white italic tracking-tighter animate-pulse">{VERIFICATION_LOGS[syncStep]}</p>
              <div className="w-96 h-2 bg-slate-900 mx-auto rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 animate-[loading-bar_3s_infinite_linear]" style={{width: '60%'}}></div>
              </div>
              <div className="pt-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.5em]">Establishing Secure Assessment Bundle</div>
            </div>
          </div>
        )}

        <div className={isSyncing ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 transition-all duration-700'}>
          <Routes>
            <Route path="/config" element={
              <div className="max-w-6xl mx-auto space-y-20 animate-in slide-in-from-bottom duration-1000">
                <div className="text-center relative">
                  <div className={`absolute -top-10 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.4em] border ${hasAlreadyAttempted ? 'bg-rose-600/20 text-rose-500 border-rose-500/20' : 'bg-blue-600/10 text-blue-500 border-blue-500/20'}`}>
                    {hasAlreadyAttempted ? 'SESSION LOCKED • ATTEMPT EXHAUSTED' : 'SYSTEM VERIFIED • GENESIS MODULE'}
                  </div>
                  <h2 className="text-8xl font-black text-white tracking-tighter mt-8 italic">Simulation <span className="text-blue-500">Suite.</span></h2>
                  <p className="text-slate-500 font-black uppercase tracking-[0.6em] text-sm mt-4">Next-Generation Assessment Engine</p>
                  
                  {/* Undo/Redo HUD */}
                  {!hasAlreadyAttempted && (
                    <div className="flex justify-center gap-4 mt-8">
                      <button 
                        onClick={undo} 
                        disabled={historyIndex === 0}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-2 transition-all ${historyIndex === 0 ? 'opacity-20 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 hover:border-blue-500/50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path></svg>
                        Undo
                      </button>
                      <button 
                        onClick={redo} 
                        disabled={historyIndex === topicHistory.length - 1}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-2 transition-all ${historyIndex === topicHistory.length - 1 ? 'opacity-20 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 hover:border-blue-500/50'}`}
                      >
                        Redo
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      </button>
                    </div>
                  )}
                </div>

                <div className={`grid md:grid-cols-2 gap-12 transition-all ${hasAlreadyAttempted ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                  <div className="glass-card-3d p-12 rounded-[4rem] relative overflow-hidden group hover:border-blue-500/30">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-blue-500 transform group-hover:scale-125 transition-transform"><svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg></div>
                    <h3 className="text-3xl font-black text-white mb-10 flex items-center gap-5">
                      <span className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-2xl shadow-blue-500/30">∑</span> NUMERACY
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {NUMERASI_TOPICS.map(t => (
                        <button key={t} onClick={() => toggleTopic('math', t)} className={`p-6 rounded-[2rem] text-left font-black text-base border-2 transition-all duration-300 ${topics.math.includes(t) ? 'bg-gradient-to-br from-blue-600 to-blue-800 border-blue-400 text-white shadow-xl -translate-y-1' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div className="glass-card-3d p-12 rounded-[4rem] relative overflow-hidden group hover:border-indigo-500/30">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-500 transform group-hover:scale-125 transition-transform"><svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5-1.17 0-2.39.15-3.5.5V19c1.11-.35 2.33-.5 3.5-.5 1.95 0-4.05.4 5.5 1.5 1.45-1.1 3.55-1.5 5.5-1.5 1.17 0-2.39.15-3.5.5V5z"/></svg></div>
                    <h3 className="text-3xl font-black text-white mb-10 flex items-center gap-5">
                      <span className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-2xl shadow-indigo-500/30">¶</span> LITERACY
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {LITERASI_TOPICS.map(t => (
                        <button key={t} onClick={() => toggleTopic('indonesian', t)} className={`p-6 rounded-[2rem] text-left font-black text-base border-2 transition-all duration-300 ${topics.indonesian.includes(t) ? 'bg-gradient-to-br from-indigo-600 to-indigo-800 border-indigo-400 text-white shadow-xl -translate-y-1' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-center pt-10 pb-32">
                  {hasAlreadyAttempted ? (
                    <div className="w-full max-w-4xl mx-auto p-12 bg-slate-900 border-2 border-rose-500/30 rounded-[3.5rem] flex flex-col items-center gap-6 animate-pulse">
                      <svg className="w-20 h-20 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v3m0-3h3m-3 0H9m12-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      <div>
                        <h4 className="text-3xl font-black text-white uppercase tracking-tighter">Access Period Completed</h4>
                        <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.4em] mt-2">Only one attempt allowed per Terminal ID.</p>
                      </div>
                      <button onClick={() => navigate('/history')} className="mt-4 bg-slate-950 px-10 py-4 rounded-2xl border border-white/10 text-blue-400 font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all">Review Past Log</button>
                    </div>
                  ) : (
                    <button onClick={startGeneration} className="w-full max-w-4xl btn-3d-blue text-white py-12 rounded-[3.5rem] font-black text-5xl tracking-tighter group transition-all">
                      GENERATE SYSTEM <span className="inline-block group-hover:translate-x-4 transition-transform ml-4">→</span>
                    </button>
                  )}
                  {sysError && <p className="mt-10 text-rose-500 font-black uppercase text-xs tracking-[0.4em] animate-bounce">{sysError}</p>}
                </div>
              </div>
            } />

            <Route path="/exam" element={
              questions.length > 0 ? (
                <div className="max-w-5xl mx-auto pb-64 animate-in fade-in duration-1000">
                  <div className="glass-card-3d p-8 rounded-[3.5rem] sticky top-28 z-[55] flex items-center justify-between mb-16 shadow-3xl border-blue-500/20 bg-slate-950/80 backdrop-blur-2xl">
                    <div className="flex items-center gap-8">
                      <div className="bg-slate-900 rounded-3xl p-5 border border-white/5 shadow-inner">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Node Connection Stability</p>
                        <p className="text-4xl font-black text-blue-400 font-mono tracking-tighter mt-1">{Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2, '0')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-12">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Assessment Progress</p>
                        <p className="text-3xl font-black text-white tracking-tighter">{Object.keys(userAnswers).length} / {questions.length}</p>
                      </div>
                      <button onClick={finalizeExam} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-blue-600/20 transition-all border border-blue-400/40">Finalize Session</button>
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
              history.length > 0 ? (
                <div className="max-w-5xl mx-auto space-y-20 pb-40 animate-in zoom-in duration-700">
                  <div className="glass-card-3d p-20 rounded-[5rem] text-center border-emerald-500/20 relative overflow-hidden">
                    <div className="scanline"></div>
                    <div className="w-52 h-52 bg-gradient-to-tr from-emerald-600 to-teal-900 rounded-[3rem] rotate-6 flex flex-col items-center justify-center text-white shadow-3xl mx-auto mb-12 border-8 border-slate-950 outline outline-4 outline-emerald-500/20">
                      <span className="text-[12px] font-black opacity-60 tracking-widest">VERIFIED SCORE</span>
                      <span className="text-9xl font-black tracking-tighter drop-shadow-2xl">{history[0]?.score || 0}</span>
                    </div>
                    <h2 className="text-7xl font-black text-white italic tracking-tighter mb-10">Analysis Complete.</h2>
                    <div className="flex justify-center gap-6">
                      <button onClick={() => navigate('/history')} className="bg-blue-600 hover:bg-blue-500 text-white px-16 py-7 rounded-[2.5rem] font-black text-2xl tracking-tighter shadow-3xl transition-all border border-blue-400/30">VIEW HISTORY LOGS</button>
                    </div>
                  </div>
                  <div className="space-y-16 pt-20 border-t border-white/5">
                    <h3 className="text-5xl font-black text-white text-center italic tracking-tighter">System Analytics & Log Review</h3>
                    {questions.length > 0 ? questions.map((q, i) => (
                      <QuestionCard key={i} index={i} question={q} showAnswers={true} interactive={false} currentAnswer={userAnswers[i]} />
                    )) : history[0] && <div className="text-center text-slate-500 italic">Historical data review active.</div>}
                  </div>
                </div>
              ) : <Navigate to="/config" />
            } />

            <Route path="/history" element={
              <div className="glass-card-3d p-16 rounded-[4rem] max-w-5xl mx-auto animate-in slide-in-from-bottom duration-700 border-white/5">
                <div className="flex items-center justify-between mb-16">
                  <h2 className="text-5xl font-black text-white italic tracking-tighter">Archive Node Logs</h2>
                  <div className="px-5 py-2 rounded-full bg-slate-900 border border-white/5 text-[10px] font-black text-blue-500 uppercase tracking-widest">System Online</div>
                </div>
                {history.length === 0 ? <p className="text-slate-700 font-bold py-32 text-center uppercase tracking-[0.5em] text-sm">Database Empty • No entries recorded.</p> : (
                  <div className="space-y-6">
                    {history.map((h, i) => (
                      <div key={i} className="bg-slate-900/60 p-10 rounded-[2.5rem] border border-white/5 flex items-center justify-between group hover:border-blue-500/40 transition-all duration-500">
                        <div>
                          <p className="font-black text-2xl text-white tracking-tight">{h.date}</p>
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mt-3">{h.correctCount} / {h.totalQuestions} Competency Success Hits</p>
                          <p className="text-[9px] font-black text-slate-500 mt-1 uppercase">NODE: {h.username}</p>
                          <div className="flex gap-2 mt-4 flex-wrap">
                            {h.topics.slice(0, 3).map((t, idx) => (
                              <span key={idx} className="bg-slate-950 px-3 py-1 rounded-lg text-[8px] font-black text-slate-500 uppercase border border-white/5">{t}</span>
                            ))}
                          </div>
                        </div>
                        <div className="w-24 h-24 bg-gradient-to-tr from-blue-700 to-indigo-900 border-4 border-slate-950 rounded-[2rem] flex items-center justify-center font-black text-4xl text-white shadow-2xl group-hover:scale-110 transition-transform">{h.score}</div>
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
      
      <footer className="no-print border-t border-white/5 bg-slate-950/80 backdrop-blur-xl py-12 px-10 text-center">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-left">
            <p className="text-xl font-black text-white tracking-tighter italic">EduGen <span className="text-blue-500">TKA.</span></p>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Digital Assessment Verified System v5.0.2</p>
          </div>
          <div className="flex gap-10">
            <div className="text-center"><p className="text-xs font-black text-white">2.5k+</p><p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Tests Sync</p></div>
            <div className="text-center"><p className="text-xs font-black text-white">99.9%</p><p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Uptime AI</p></div>
            <div className="text-center"><p className="text-xs font-black text-white">4.120</p><p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Kernel V</p></div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
