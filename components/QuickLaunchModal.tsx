
import React, { useState, useEffect, useRef } from 'react';
import { Personnel, LeaveRecord } from '../types';
import LeaveForm from './LeaveForm';

interface QuickLaunchModalProps {
  personnel: Personnel[];
  leaves: LeaveRecord[]; // Added leaves prop
  onClose: () => void;
  onSubmit: (leaves: Omit<LeaveRecord, 'id' | 'createdAt' | 'launchedBy'>[]) => void;
}

const QuickLaunchModal: React.FC<QuickLaunchModalProps> = ({ personnel, leaves, onClose, onSubmit }) => {
  const [matr, setMatr] = useState('');
  const [foundPerson, setFoundPerson] = useState<Personnel | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const formatMatricula = (value: string) => {
    const clean = value.toUpperCase().replace(/[^0-9X]/g, '').slice(0, 7);
    let formatted = '';
    if (clean.length > 0) {
      if (clean.length <= 3) formatted = clean;
      else if (clean.length <= 6) formatted = `${clean.slice(0, 3)}.${clean.slice(3)}`;
      else formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}/${clean.slice(6)}`;
    }
    return formatted;
  };

  const handleMatriculaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMatricula(e.target.value);
    setMatr(formatted);

    // Busca comparando o ID normalizado (incluindo X)
    const person = personnel.find(p => p.matr.toUpperCase().replace(/[^0-9X]/g, '') === formatted.toUpperCase().replace(/[^0-9X]/g, ''));
    if (person) {
      setFoundPerson(person);
    } else {
      setFoundPerson(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        <div className="bg-slate-900 p-8 text-center relative border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>

          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-500/20">
            <i className="fas fa-bolt text-2xl text-white"></i>
          </div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">Lançamento por Matrícula</h3>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Busca Direta de Efetivo</p>
        </div>

        <div className="p-8">
          <div className="relative mb-8">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Digite a Matrícula do Militar</label>
            <div className="relative">
              <i className="fas fa-id-card absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 text-lg"></i>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="000.000/X"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-5 pl-14 pr-4 text-xl font-black text-slate-800 focus:border-blue-500 outline-none transition-all placeholder:text-slate-200"
                value={matr}
                onChange={handleMatriculaChange}
              />
              {foundPerson && (
                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2 animate-in fade-in zoom-in">
                  <span className="text-[10px] font-black text-green-500 bg-green-50 px-2 py-1 rounded-lg border border-green-100 uppercase">LOCALIZADO</span>
                  <i className="fas fa-check-circle text-green-500 text-xl"></i>
                </div>
              )}
            </div>
          </div>

          {foundPerson ? (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 mb-8 flex items-center gap-6">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-xl font-black text-blue-600 border border-slate-200 shadow-sm shrink-0">
                  {foundPerson.grad.charAt(0)}{foundPerson.nome.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-blue-600 uppercase tracking-widest leading-none mb-1">{foundPerson.grad}</p>
                  <h4 className="text-lg font-black text-slate-900 uppercase truncate leading-tight">{foundPerson.nome}</h4>
                  <div className="flex gap-3 mt-2">
                    <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase">{foundPerson.unid}</span>
                    <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase">{foundPerson.secao || 'GERAL'}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Saldo Férias</p>
                  <p className="text-xl font-black text-slate-800">{foundPerson.saldoFerias}d</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-2">
                <LeaveForm
                  person={foundPerson}
                  onClose={onClose}
                  onSubmit={onSubmit}
                />
              </div>
            </div>
          ) : matr.length >= 7 ? (
            <div className="text-center py-12 animate-in fade-in">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <i className="fas fa-user-slash text-slate-300 text-xl"></i>
              </div>
              <p className="text-sm font-bold text-slate-400">Nenhum militar encontrado com esta matrícula.</p>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-300 flex flex-col items-center gap-4">
              <i className="fas fa-search text-4xl opacity-20"></i>
              <p className="text-xs font-black uppercase tracking-widest opacity-50">Aguardando dados para pesquisa...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickLaunchModal;
