
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
      displayAnswer = Object.entries(question.correctAnswer)
        .map(([idx, val]) => `${parseInt(idx) + 1}: ${val}`)
        .join(' | ');
    }

    const isCorrect = JSON.stringify(currentAnswer) === JSON.stringify(question.correctAnswer);

    return (
      <div className={`mt-12 p-10 border-2 rounded-[3.5rem] shadow-2xl animate-in slide-in-from-bottom duration-500 overflow-hidden relative ${
        isCorrect ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-rose-900/20 border-rose-500/30'
      }`}>
        <div className="absolute top-0 right-0 p-12 opacity-[0.03]">
           <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/></svg>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-6 mb-8">
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-3xl text-white shadow-2xl ${isCorrect ? 'bg-emerald-500 shadow-emerald-500/40' : 'bg-rose-500 shadow-rose-500/40'}`}>
              {isCorrect ? '✓' : '✗'}
            </div>
            <div>
              <p className={`font-black text-3xl tracking-tighter italic ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isCorrect ? 'SYSTEM VALIDATION SUCCESS' : 'SYSTEM CALIBRATION ERROR'}
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-60 text-white">Analytical Response Log v5.0</p>
            </div>
          </div>
          
          <div className="space-y-6 pl-2">
            <div>
              <p className="text-[11px] font-black opacity-60 uppercase tracking-[0.4em] mb-3 text-white">Master Answer Key:</p>
              <div className="p-6 bg-slate-950/80 rounded-[2rem] border border-white/10 font-black text-2xl text-white shadow-inner tracking-tighter border-l-8 border-l-blue-500">
                {displayAnswer}
              </div>
            </div>
            {question.explanation && (
              <div className="mt-8 p-8 bg-white/5 rounded-[2.5rem] border-l-4 border-slate-500/30">
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Explanatory Logic:</p>
                <p className="text-lg italic font-bold leading-relaxed text-slate-300">"{question.explanation}"</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative p-12 rounded-[4.5rem] transition-all duration-700 border-2 shadow-2xl overflow-hidden ${
      interactive && isAnswered 
        ? 'bg-slate-900/80 border-blue-500/40 shadow-[0_50px_100px_-30px_rgba(37,99,235,0.25)] translate-y-[-8px]' 
        : 'bg-slate-900/40 border-white/5 hover:border-white/10 hover:shadow-blue-500/5'
    }`}>
      {/* Premium Header */}
      <div className="flex flex-wrap items-center justify-between gap-8 mb-12">
        <div className="flex items-center gap-5">
          <span className={`px-8 py-3 rounded-2xl text-[12px] font-black uppercase tracking-[0.4em] shadow-xl border border-white/10 ${
            question.subject === 'Matematika' ? 'bg-blue-600 text-white shadow-blue-600/30' : 'bg-sky-500 text-white shadow-sky-600/30'
          }`}>
            {question.subject === 'Matematika' ? 'NUMERASI' : 'LITERASI'}
          </span>
          <span className="bg-slate-950/80 text-slate-400 px-8 py-3 rounded-2xl text-[12px] font-black uppercase tracking-[0.4em] shadow-lg border border-white/5">
            {question.topic}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
             <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Comp-Level</p>
             <p className="text-xs font-black text-blue-500">{question.cognitiveLevel}</p>
          </div>
          <div className="bg-slate-950 text-blue-500 w-16 h-16 flex items-center justify-center rounded-[2rem] text-2xl font-black border border-white/10 shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]">
            {index + 1}
          </div>
        </div>
      </div>

      <div className="space-y-10">
        <div className="flex items-center gap-5">
          <div className="h-[3px] w-16 bg-gradient-to-r from-blue-600 to-transparent rounded-full"></div>
          <div className="text-[11px] font-black text-blue-400/80 uppercase tracking-[0.6em]">{question.type}</div>
        </div>

        {question.passage && (
          <div className="bg-slate-950/60 p-12 border border-white/5 rounded-[4rem] text-slate-300 mb-12 whitespace-pre-wrap text-xl leading-relaxed font-bold shadow-inner relative group">
             <div className="absolute -top-10 -right-10 p-4 opacity-[0.02] text-white">
                <svg className="w-56 h-56" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H16.017C14.9124 8 14.017 7.10457 14.017 6V3L11.017 3V21H14.017ZM5.017 21L5.017 18C5.017 16.8954 5.91243 16 7.017 16H10.017C10.5693 16 11.017 15.5523 11.017 15V9C11.017 8.44772 10.5693 8 10.017 8H7.017C5.91243 8 5.017 7.10457 5.017 6V3L2.017 3V21H5.017Z"/></svg>
             </div>
             <div className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-4 border-b border-white/5 pb-2">STIMULUS DATA</div>
             <p className="relative z-10 text-slate-300">{question.passage}</p>
          </div>
        )}

        <div className="text-4xl font-black text-white leading-[1.2] tracking-tighter mb-10 italic">
          {question.text}
        </div>

        {/* Options Grid */}
        {question.options && question.options.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16">
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
                  className={`group relative flex items-center p-8 border-2 rounded-[3rem] transition-all duration-500 text-left ${
                    isSelected 
                      ? 'bg-gradient-to-br from-blue-700 to-indigo-900 border-blue-400 shadow-3xl shadow-blue-600/30 -translate-y-2' 
                      : 'border-white/5 bg-slate-950/40 hover:bg-slate-900 hover:border-white/20'
                  }`}
                >
                  <div className={`w-16 h-16 flex items-center justify-center rounded-[1.5rem] text-xl font-black mr-8 shrink-0 transition-all duration-500 ${
                    isSelected ? 'bg-white text-blue-700 shadow-2xl scale-110' : 'bg-slate-900 text-slate-600 border border-white/10 group-hover:text-white'
                  }`}>
                    {letter}
                  </div>
                  <span className={`text-2xl font-black leading-tight tracking-tight ${isSelected ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Category Matrix */}
        {question.categories && question.categories.length > 0 && (
          <div className="mt-16 border-2 border-white/10 rounded-[3.5rem] overflow-hidden shadow-3xl bg-slate-950/40 backdrop-blur-xl">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900/60">
                  <th className="px-12 py-8 text-[12px] font-black text-blue-500 uppercase tracking-[0.5em] border-b border-white/10">PERNYATAAN ANALITIS</th>
                  <th className="px-12 py-8 text-center w-80 text-[12px] font-black text-blue-500 uppercase tracking-[0.5em] border-b border-white/10">KATEGORI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {question.categories.map((item, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-12 py-10 text-slate-200 font-black text-2xl tracking-tight leading-snug italic">{item.statement}</td>
                    <td className="px-12 py-10">
                       <div className="flex justify-center gap-6">
                          {['Benar', 'Salah'].map((cat) => (
                            <button
                              key={cat}
                              disabled={!interactive}
                              onClick={() => interactive && handleCategoryChange(i, cat)}
                              className={`px-8 py-4 rounded-2xl text-[12px] font-black uppercase tracking-[0.3em] transition-all duration-300 ${
                                currentAnswer?.[i] === cat 
                                ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/40 translate-y-[-4px] border-2 border-blue-400' 
                                : 'bg-slate-900/80 text-slate-600 border-2 border-white/5 hover:border-blue-500/50 hover:text-blue-400'
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
