
import React from 'react';
import { Question } from '../types';

interface QuestionCardProps {
  question: Question;
  index: number;
  showAnswers: boolean;
  interactive?: boolean;
  currentAnswer?: any;
  onAnswerChange?: (answer: any) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ 
  question, 
  index, 
  showAnswers, 
  interactive = false,
  currentAnswer,
  onAnswerChange 
}) => {
  
  const handleMCChange = (opt: string) => {
    if (onAnswerChange) onAnswerChange(opt);
  };

  const handleMCMAChange = (opt: string) => {
    if (!onAnswerChange) return;
    const current = Array.isArray(currentAnswer) ? [...currentAnswer] : [];
    if (current.includes(opt)) {
      onAnswerChange(current.filter(item => item !== opt));
    } else {
      onAnswerChange([...current, opt]);
    }
  };

  const handleCategoryChange = (statementIndex: number, category: string) => {
    if (!onAnswerChange) return;
    const current = typeof currentAnswer === 'object' && currentAnswer !== null ? { ...currentAnswer } : {};
    current[statementIndex] = category;
    onAnswerChange(current);
  };

  const isAnswered = React.useMemo(() => {
    if (currentAnswer === undefined || currentAnswer === null) return false;
    if (typeof currentAnswer === 'string') return currentAnswer.trim() !== '';
    if (Array.isArray(currentAnswer)) return currentAnswer.length > 0;
    if (typeof currentAnswer === 'object') return Object.keys(currentAnswer).length > 0;
    return false;
  }, [currentAnswer]);

  const renderAnswers = () => {
    if (!showAnswers) return null;

    let displayAnswer = "";
    if (typeof question.correctAnswer === 'string') {
      displayAnswer = question.correctAnswer;
    } else if (Array.isArray(question.correctAnswer)) {
      displayAnswer = question.correctAnswer.join(', ');
    } else if (typeof question.correctAnswer === 'object') {
      displayAnswer = JSON.stringify(question.correctAnswer);
    }

    const isCorrect = JSON.stringify(currentAnswer) === JSON.stringify(question.correctAnswer);

    return (
      <div className={`mt-10 p-8 border-2 rounded-[3rem] shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] animate-in zoom-in duration-500 overflow-hidden relative ${
        isCorrect ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-100' : 'bg-rose-900/30 border-rose-500/40 text-rose-100'
      }`}>
        <div className="absolute top-0 right-0 p-10 opacity-5">
           <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/></svg>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-5 mb-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-2xl ${isCorrect ? 'bg-emerald-500 shadow-emerald-500/40' : 'bg-rose-500 shadow-rose-500/40'}`}>
              {isCorrect ? '✓' : '✗'}
            </div>
            <div>
              <p className="font-black text-2xl tracking-tighter italic">{isCorrect ? 'VALIDASI BERHASIL' : 'ANALISIS TERHENTI'}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">{isCorrect ? 'Performance Optimal' : 'Requires Recalibration'}</p>
            </div>
          </div>
          
          <div className="pl-19 space-y-4">
            <div>
              <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.4em] mb-2">Kunci Jawaban & Logika Sistem:</p>
              <div className="p-5 bg-slate-900/60 rounded-2xl border border-white/5 font-black text-xl text-white shadow-inner tracking-tight">{displayAnswer}</div>
            </div>
            {question.explanation && (
              <div className="mt-6 p-6 bg-white/5 rounded-[2rem] border-l-8 border-blue-500/50">
                <p className="text-base italic font-bold leading-relaxed text-slate-300">"{question.explanation}"</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative bg-slate-900/60 p-10 rounded-[4rem] transition-all duration-700 border-2 mb-16 shadow-2xl ${
      interactive && isAnswered 
        ? 'border-blue-500/50 shadow-[0_40px_80px_-20px_rgba(37,99,235,0.3)] ring-1 ring-blue-500/20 translate-y-[-4px]' 
        : 'border-white/5 shadow-black/40 hover:border-white/10 hover:shadow-blue-500/10'
    }`}>
      {/* Header Info Question Card */}
      <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <span className={`px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl border border-white/10 ${
            question.subject === 'Matematika' ? 'bg-blue-600 text-white shadow-blue-600/20' : 'bg-sky-500 text-white shadow-sky-600/20'
          }`}>
            {question.subject === 'Matematika' ? 'NUMERASI' : 'LITERASI'}
          </span>
          <span className="bg-slate-800 text-slate-400 px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-lg border border-white/5">
            {question.topic}
          </span>
          {question.cognitiveLevel && (
             <span className="bg-indigo-900/50 text-indigo-400 px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] border border-indigo-500/30">
                {question.cognitiveLevel}
             </span>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="bg-slate-950 text-blue-500 w-14 h-14 flex items-center justify-center rounded-[1.5rem] text-xl font-black border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
            {index + 1}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="h-[2px] w-12 bg-blue-500/50 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
          <div className="text-[11px] font-black text-blue-400/80 uppercase tracking-[0.5em]">{question.type}</div>
        </div>

        {question.passage && (
          <div className="bg-slate-950/40 p-10 border border-white/5 rounded-[3.5rem] italic text-slate-300 mb-10 whitespace-pre-wrap text-lg leading-relaxed font-bold shadow-inner relative group overflow-hidden">
             <div className="absolute -top-10 -right-10 p-4 opacity-[0.03] text-white transition-opacity group-hover:opacity-10">
                <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H16.017C14.9124 8 14.017 7.10457 14.017 6V3L11.017 3V21H14.017ZM5.017 21L5.017 18C5.017 16.8954 5.91243 16 7.017 16H10.017C10.5693 16 11.017 15.5523 11.017 15V9C11.017 8.44772 10.5693 8 10.017 8H7.017C5.91243 8 5.017 7.10457 5.017 6V3L2.017 3V21H5.017Z"/></svg>
             </div>
             <p className="relative z-10 text-slate-400 group-hover:text-slate-200 transition-colors"> Stimulus: {question.passage}</p>
          </div>
        )}

        <div className="text-3xl font-black text-white leading-tight tracking-tighter mb-6 italic">
          {question.text}
        </div>

        {/* Options */}
        {question.options && question.options.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            {question.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const isSelected = question.type === 'Pilihan Ganda' 
                ? currentAnswer === opt 
                : (Array.isArray(currentAnswer) && currentAnswer.includes(opt));

              return (
                <button 
                  key={i} 
                  disabled={!interactive}
                  onClick={() => interactive && (question.type === 'Pilihan Ganda' ? handleMCChange(opt) : handleMCMAChange(opt))}
                  className={`group relative flex items-center p-6 border-2 rounded-[2.5rem] transition-all duration-500 text-left ${
                    isSelected 
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-800 border-blue-400 shadow-[0_15px_30px_-5px_rgba(37,99,235,0.4),inset_0_1px_2px_rgba(255,255,255,0.3)] -translate-y-2' 
                      : 'border-white/5 bg-slate-900/30 hover:bg-slate-800/80 hover:border-white/20'
                  }`}
                >
                  <div className={`w-14 h-14 flex items-center justify-center rounded-3xl text-lg font-black mr-6 shrink-0 transition-all duration-500 ${
                    isSelected ? 'bg-white text-blue-600 shadow-inner scale-110' : 'bg-slate-950 text-slate-500 border border-white/10 shadow-lg group-hover:scale-110 group-hover:text-white'
                  }`}>
                    {letter}
                  </div>
                  <span className={`text-xl font-black leading-tight tracking-tight ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Category statements */}
        {question.categories && question.categories.length > 0 && (
          <div className="mt-12 border border-white/10 rounded-[4rem] overflow-hidden shadow-3xl bg-slate-950/20 backdrop-blur-md">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="px-10 py-6 text-[11px] font-black text-blue-500 uppercase tracking-[0.4em] border-b border-white/5">Pernyataan Berdasarkan Stimulus</th>
                  <th className="px-10 py-6 text-center w-64 text-[11px] font-black text-blue-500 uppercase tracking-[0.4em] border-b border-white/5">Kategori</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {question.categories.map((item, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors group">
                    <td className="px-10 py-8 text-slate-300 font-black text-xl tracking-tight group-hover:text-white transition-colors italic">{item.statement}</td>
                    <td className="px-10 py-8">
                       <div className="flex justify-center gap-5">
                          {['Benar', 'Salah'].map((cat) => (
                            <button
                              key={cat}
                              disabled={!interactive}
                              onClick={() => interactive && handleCategoryChange(i, cat)}
                              className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 active:scale-90 ${
                                currentAnswer?.[i] === cat 
                                ? 'bg-blue-600 text-white shadow-[0_8px_20px_-5px_rgba(37,99,235,0.4),inset_0_1px_1px_rgba(255,255,255,0.3)] translate-y-[-4px]' 
                                : 'bg-slate-900 text-slate-600 border-2 border-white/5 hover:border-blue-500/50 hover:text-blue-400'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {renderAnswers()}
    </div>
  );
};
