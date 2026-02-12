
import React, { useState } from 'react';
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
  const [isExplanationVisible, setIsExplanationVisible] = useState(false);
  
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
      <div className={`mt-10 p-8 sm:p-10 border-2 rounded-[2.5rem] sm:rounded-[3.5rem] shadow-2xl animate-in slide-in-from-bottom duration-500 overflow-hidden relative ${
        isCorrect ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-rose-900/10 border-rose-500/20'
      }`}>
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
           <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/></svg>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-6 mb-8">
            <div className="flex items-center gap-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-2xl ${isCorrect ? 'bg-emerald-500 shadow-emerald-500/40' : 'bg-rose-500 shadow-rose-500/40'}`}>
                {isCorrect ? '✓' : '✗'}
              </div>
              <div>
                <p className={`font-black text-2xl tracking-tighter italic ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isCorrect ? 'VALIDATION SUCCESS' : 'CALIBRATION ERROR'}
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-60 text-white">Neural Response Log v5.0</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-slate-950/80 p-6 rounded-[2rem] border border-white/10 shadow-inner">
              <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.4em] mb-2 text-white">System Key Answer:</p>
              <div className="font-black text-2xl text-blue-400 tracking-tighter border-l-6 border-blue-600 pl-4">
                {displayAnswer}
              </div>
            </div>

            {question.explanation && (
              <div className="pt-2">
                {!isExplanationVisible ? (
                  <button 
                    onClick={() => setIsExplanationVisible(true)}
                    aria-expanded="false"
                    aria-label="Tampilkan penjelasan alasan AI"
                    className="w-full bg-slate-900/50 hover:bg-slate-800 border border-white/10 p-5 rounded-[1.5rem] flex items-center justify-center gap-4 transition-all group active:scale-95"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-500 group-hover:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] group-hover:text-white transition-colors">Reveal AI Rationale</span>
                  </button>
                ) : (
                  <div className="animate-in zoom-in duration-500 origin-top">
                    <div className="p-8 bg-gradient-to-br from-slate-900/80 to-slate-950 border border-blue-500/20 rounded-[2rem] relative shadow-2xl">
                      <div className="absolute -top-3 left-8 px-4 py-1 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full">AI INSIGHT CORE</div>
                      <div className="flex gap-4">
                        <div className="w-1 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full shrink-0"></div>
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest opacity-80">Explanation Analysis:</p>
                          <p className="text-lg sm:text-xl font-bold leading-relaxed text-slate-300 italic">
                            "{question.explanation}"
                          </p>
                          <div className="flex items-center gap-2 pt-4 border-t border-white/5 opacity-40">
                             <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                             <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Processed by EduGen Gemini Engine</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsExplanationVisible(false)}
                      aria-expanded="true"
                      aria-label="Sembunyikan penjelasan alasan AI"
                      className="mt-4 mx-auto block text-[9px] font-black text-slate-700 uppercase tracking-widest hover:text-blue-500 transition-colors"
                    >
                      Hide Analysis
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative p-8 sm:p-12 rounded-[3rem] sm:rounded-[4.5rem] transition-all duration-700 border-2 shadow-2xl overflow-hidden ${
      interactive && isAnswered 
        ? 'bg-slate-900/80 border-blue-500/40 shadow-[0_50px_100px_-30px_rgba(37,99,235,0.25)] translate-y-[-8px]' 
        : 'bg-slate-900/40 border-white/5 hover:border-white/10 hover:shadow-blue-500/5'
    }`}>
      {/* Premium Header */}
      <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.5em]">Question {index + 1} of 30</p>
          <div className="flex items-center gap-4">
            <span className={`px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.4em] shadow-xl border border-white/10 ${
              question.subject === 'Matematika' ? 'bg-blue-600 text-white shadow-blue-600/30' : 'bg-sky-500 text-white shadow-sky-600/30'
            }`}>
              {question.subject === 'Matematika' ? 'NUMERASI' : 'LITERASI'}
            </span>
            <span className="bg-slate-950/80 text-slate-400 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.4em] shadow-lg border border-white/5">
              {question.topic}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right hidden sm:block">
             <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Comp-Level</p>
             <p className="text-xs font-black text-blue-500">{question.cognitiveLevel}</p>
          </div>
          <div className="bg-slate-950 text-blue-500 w-14 h-14 flex items-center justify-center rounded-[1.5rem] text-xl font-black border border-white/10 shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]">
            {index + 1}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center gap-5">
          <div className="h-[3px] w-12 bg-gradient-to-r from-blue-600 to-transparent rounded-full"></div>
          <div className="text-[10px] font-black text-blue-400/80 uppercase tracking-[0.6em]">{question.type}</div>
        </div>

        {question.passage && (
          <div className="bg-slate-950/60 p-8 sm:p-12 border border-white/5 rounded-[2.5rem] sm:rounded-[4rem] text-slate-300 mb-8 whitespace-pre-wrap text-base sm:text-lg leading-relaxed font-bold shadow-inner relative group">
             <div className="absolute -top-10 -right-10 p-4 opacity-[0.02] text-white">
                <svg className="w-40 h-40 sm:w-56 h-56" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H16.017C14.9124 8 14.017 7.10457 14.017 6V3L11.017 3V21H14.017ZM5.017 21L5.017 18C5.017 16.8954 5.91243 16 7.017 16H10.017C10.5693 16 11.017 15.5523 11.017 15V9C11.017 8.44772 10.5693 8 10.017 8H7.017C5.91243 8 5.017 7.10457 5.017 6V3L2.017 3V21H5.017Z"/></svg>
             </div>
             <div className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-4 border-b border-white/5 pb-2">STIMULUS DATA</div>
             <p className="relative z-10 text-slate-300">{question.passage}</p>
          </div>
        )}

        <div className="text-2xl sm:text-3xl font-black text-white leading-[1.25] tracking-tight mb-8 italic">
          {question.text}
        </div>

        {/* Options Grid */}
        {question.options && question.options.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 mt-12" role="group" aria-label={`Pilihan jawaban untuk soal nomor ${index + 1}`}>
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
                  aria-pressed={isSelected}
                  aria-label={`Opsi ${letter}: ${opt}`}
                  className={`group relative flex items-center p-6 sm:p-8 border-2 rounded-[2rem] sm:rounded-[3rem] transition-all duration-500 text-left active:scale-95 ${
                    isSelected 
                      ? 'bg-gradient-to-br from-blue-700 to-indigo-900 border-blue-400 shadow-[0_20px_50px_rgba(37,99,235,0.4)] ring-4 ring-blue-500/30 -translate-y-2 animate-in zoom-in-95 duration-300' 
                      : 'border-white/5 bg-slate-950/40 hover:bg-slate-900 hover:border-white/20'
                  }`}
                >
                  <div className={`w-12 h-12 sm:w-16 h-16 flex items-center justify-center rounded-[1rem] sm:rounded-[1.5rem] text-lg sm:text-xl font-black mr-6 sm:mr-8 shrink-0 transition-all duration-500 relative ${
                    isSelected ? 'bg-white text-blue-700 shadow-2xl scale-110' : 'bg-slate-900 text-slate-600 border border-white/10 group-hover:text-white'
                  }`}>
                    {isSelected ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-white rounded-[1rem] sm:rounded-[1.5rem] animate-in zoom-in duration-300">
                        <svg className="w-6 h-6 sm:w-8 h-8 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                      </div>
                    ) : letter}
                  </div>
                  <span className={`text-lg sm:text-xl font-black leading-tight tracking-tight transition-colors duration-300 ${isSelected ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>{opt}</span>
                  {isSelected && (
                    <div className="absolute top-4 right-6 sm:right-8 w-2 h-2 bg-blue-400 rounded-full animate-pulse shadow-[0_0_10px_#60a5fa]"></div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Category Matrix */}
        {question.categories && question.categories.length > 0 && (
          <div className="mt-12 border-2 border-white/10 rounded-[2.5rem] sm:rounded-[3.5rem] overflow-hidden shadow-3xl bg-slate-950/40 backdrop-blur-xl overflow-x-auto">
            <table className="w-full text-left min-w-[500px]">
              <thead>
                <tr className="bg-slate-900/60">
                  <th className="px-10 py-6 text-[11px] font-black text-blue-500 uppercase tracking-[0.5em] border-b border-white/10">PERNYATAAN ANALITIS</th>
                  <th className="px-10 py-6 text-center w-64 sm:w-80 text-[11px] font-black text-blue-500 uppercase tracking-[0.5em] border-b border-white/10">KATEGORI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {question.categories.map((item, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-10 py-8 text-slate-200 font-black text-lg sm:text-xl tracking-tight leading-snug italic">{item.statement}</td>
                    <td className="px-10 py-8">
                       <div className="flex justify-center gap-4 sm:gap-6" role="group" aria-label={`Tentukan kategori untuk: ${item.statement}`}>
                          {['Benar', 'Salah'].map((cat) => (
                            <button
                              key={cat}
                              disabled={!interactive}
                              onClick={() => interactive && handleCategoryChange(i, cat)}
                              aria-pressed={currentAnswer?.[i] === cat}
                              aria-label={`Pilih ${cat} for: ${item.statement}`}
                              className={`px-6 py-3 sm:px-8 py-4 rounded-xl sm:rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 active:scale-90 ${
                                currentAnswer?.[i] === cat 
                                ? 'bg-blue-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.5)] translate-y-[-4px] border-2 border-blue-400 animate-in zoom-in-95 duration-200 ring-4 ring-blue-500/20' 
                                : 'bg-slate-900/80 text-slate-600 border-2 border-white/5 hover:border-blue-500/50 hover:text-blue-400'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {currentAnswer?.[i] === cat && (
                                  <svg className="w-3 h-3 text-white animate-in slide-in-from-left-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                )}
                                {cat}
                              </div>
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
