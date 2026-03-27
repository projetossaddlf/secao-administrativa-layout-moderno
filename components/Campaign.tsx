import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Personnel, LeaveRecord, LeaveType } from '../types';

interface CampaignProps {
  personnel: Personnel[];
  leaves: LeaveRecord[];
  onLaunchLeave: (person: Personnel) => void;
  onEditPerson: (person: Personnel) => void;
  onUpdatePerson: (person: Personnel) => void;
  onDeletePerson: (id: string) => void;
  onResetPassword: (id: string) => void;
  onAddPersonClick: () => void;
  onImportClick: () => void;
  canManagePersonnel: boolean;
  currentUserRole?: string;
}

type DayStatus = {
  label: string;
  type: LeaveType;
};

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const isoFromYMD = (y: number, m1: number, d: number) => `${y}-${pad2(m1)}-${pad2(d)}`;
const parseISODate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const isWithinInclusive = (iso: string, startIso: string, endIso: string) => {
  const t = parseISODate(iso).getTime();
  const s = parseISODate(startIso).getTime();
  const e = parseISODate(endIso).getTime();
  return t >= s && t <= e;
};

const labelForType = (type: LeaveType | string): string => {
  switch (type) {
    case 'FÉRIAS': return 'FÉR';
    case 'ABONO': return 'ABN';
    case 'AFASTAMENTO': return 'AFA';
    case 'LICENÇA': return 'LIC';
    case 'DISPENSA': return 'DSP';
    case 'EXTRA': return 'EXT';
    case 'REPRESENTAÇÃO': return 'REP';
    case 'DISPENSA RECOMPENSA': return 'REC';
    case 'CURSO': return 'CUR';
    default: return String(type).slice(0, 3).toUpperCase();
  }
};

const Campaign: React.FC<CampaignProps> = ({
  personnel,
  leaves,
  onLaunchLeave,
  onEditPerson,
  onDeletePerson,
  onResetPassword,
  onAddPersonClick,
  onImportClick,
  canManagePersonnel,
  currentUserRole,
}) => {
  const isAdmin = currentUserRole === 'ADMIN';
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number>(now.getDate());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterGrad, setFilterGrad] = useState<string>('');
  const [filterQuadro, setFilterQuadro] = useState<string>('');
  const [filterUnid, setFilterUnid] = useState<string>('');
  const [filterSecao, setFilterSecao] = useState<string>('');
  const [filterSituacao, setFilterSituacao] = useState<string>('');
  const [filterEsc, setFilterEsc] = useState<string>('');
  
  // Estado para o menu de ações (renderizado via Portal para não ser "cortado" por containers com overflow)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
        setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleRepositionOrClose = () => {
      // Em scroll/resize, fecha para evitar desalinhamento.
      setActiveMenuId(null);
      setMenuPos(null);
    };
    window.addEventListener('scroll', handleRepositionOrClose, true);
    window.addEventListener('resize', handleRepositionOrClose);
    return () => {
      window.removeEventListener('scroll', handleRepositionOrClose, true);
      window.removeEventListener('resize', handleRepositionOrClose);
    };
  }, []);

  const daysInMonth = useMemo(() => {
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => i + 1);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    const lastDay = daysInMonth[daysInMonth.length - 1] ?? 30;
    if (selectedDay > lastDay) setSelectedDay(lastDay);
  }, [daysInMonth, selectedDay]);

  const uniqSorted = (arr: string[]) =>
    Array.from(new Set(arr.map((s) => (s ?? '').toString().trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
    );

  const filterOptions = useMemo(() => {
    return {
      grad: uniqSorted(personnel.map((p: any) => p.grad)),
      quadro: uniqSorted(personnel.map((p: any) => p.quadro)),
      unid: uniqSorted(personnel.map((p: any) => p.unid)),
      secao: uniqSorted(personnel.map((p: any) => p.secao)),
      situacao: uniqSorted(personnel.map((p: any) => p.situacao)),
      esc: uniqSorted(personnel.map((p: any) => p.esc)),
    };
  }, [personnel]);

  const getDayStatus = (personId: string, day: number): DayStatus | null => {
    if (!leaves) return null;
    const iso = isoFromYMD(selectedYear, selectedMonth + 1, day);
    const rec = leaves.find((l) => l.personnelId === personId && isWithinInclusive(iso, l.startDate, l.endDate));
    if (!rec) return null;
    return { label: labelForType(rec.type), type: rec.type };
  };

  const filteredPersonnelList = useMemo(() => {
    return personnel
      .filter((p) => {
        const matchesSearch = !searchTerm || p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.matr.includes(searchTerm);
        const matchesGrad = !filterGrad || p.grad === filterGrad;
        const matchesQuadro = !filterQuadro || (p as any).quadro === filterQuadro;
        const matchesUnid = !filterUnid || p.unid === filterUnid;
        const matchesSecao = !filterSecao || (p as any).secao === filterSecao;
        const matchesSituacao = !filterSituacao || (p as any).situacao === filterSituacao;
        const matchesEsc = !filterEsc || (p as any).esc === filterEsc;
        return (
          matchesSearch &&
          matchesGrad &&
          matchesQuadro &&
          matchesUnid &&
          matchesSecao &&
          matchesSituacao &&
          matchesEsc
        );
      })
      .sort((a, b) => a.ant - b.ant);
  }, [personnel, searchTerm, filterGrad, filterQuadro, filterUnid, filterSecao, filterSituacao, filterEsc]);

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'FÉRIAS': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'ABONO': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'DISPENSA': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-rose-100 text-rose-700 border-rose-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full">
      {/* Controls Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Gestão de Efetivo</h2>
            <p className="text-slate-500 font-medium">Controle de presença e lançamentos mensais</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {canManagePersonnel && (
              <>
                <button onClick={onAddPersonClick} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
                  <i className="fas fa-plus text-xs"></i> Novo Militar
                </button>
                <button onClick={onImportClick} className="px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2">
                  <i className="fas fa-file-import text-xs"></i> Importar
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input 
              type="text" 
              placeholder="Buscar por nome ou matrícula..." 
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select 
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setSelectedMonth(now.getMonth());
                setSelectedYear(now.getFullYear());
                setSelectedDay(now.getDate());
              }}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all"
            >
              Hoje
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <select
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700"
            value={filterGrad}
            onChange={(e) => setFilterGrad(e.target.value)}
          >
            <option value="">Graduação (todas)</option>
            {filterOptions.grad.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <select
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700"
            value={filterQuadro}
            onChange={(e) => setFilterQuadro(e.target.value)}
          >
            <option value="">Quadro (todos)</option>
            {filterOptions.quadro.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>

          <select
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700"
            value={filterUnid}
            onChange={(e) => setFilterUnid(e.target.value)}
          >
            <option value="">Unidade (todas)</option>
            {filterOptions.unid.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <select
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700"
            value={filterSecao}
            onChange={(e) => setFilterSecao(e.target.value)}
          >
            <option value="">Seção (todas)</option>
            {filterOptions.secao.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700"
            value={filterSituacao}
            onChange={(e) => setFilterSituacao(e.target.value)}
          >
            <option value="">Situação (todas)</option>
            {filterOptions.situacao.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700"
            value={filterEsc}
            onChange={(e) => setFilterEsc(e.target.value)}
          >
            <option value="">Escala (todas)</option>
            {filterOptions.esc.map((e1) => (
              <option key={e1} value={e1}>
                {e1}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50/50 z-10">Militar</th>
                {daysInMonth.map(d => (
                  <th key={d} className={`px-2 py-5 text-center min-w-[40px] text-[10px] font-black ${d === selectedDay ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400'}`}>
                    {pad2(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPersonnelList.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-20 border-r border-slate-50">
                    <div className="flex items-center gap-3 relative">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-600 text-xs">
                        {p.grad}
                      </div>
                      <div className="min-w-0 flex-1 group/name">
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            // Posiciona o menu na tela (fixed + portal) para não ser cortado por containers com overflow.
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const nextId = activeMenuId === p.id ? null : p.id;
                            if (!nextId) {
                              setActiveMenuId(null);
                              setMenuPos(null);
                              return;
                            }

                            const desiredLeft = rect.left;
                            const desiredTop = rect.bottom + 8;

                            const menuWidth = 224; // w-56
                            const margin = 12;
                            const maxLeft = Math.max(margin, window.innerWidth - menuWidth - margin);
                            const clampedLeft = Math.min(Math.max(desiredLeft, margin), maxLeft);

                            setActiveMenuId(nextId);
                            setMenuPos({ top: desiredTop, left: clampedLeft });
                          }}
                          className="w-full text-left cursor-pointer"
                          aria-haspopup="menu"
                          aria-expanded={activeMenuId === p.id}
                        >
                          <p className="text-sm font-bold text-slate-900 truncate group-hover/name:text-indigo-600 transition-colors">{p.nome}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{p.matr} • {p.unid}</p>
                        </button>
                      </div>

                      {/* Dropdown Menu (Portal + position:fixed) */}
                      {activeMenuId === p.id && menuPos &&
                        createPortal(
                          <div
                            ref={menuRef}
                            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
                            className="w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[9999] overflow-hidden animate-in zoom-in-95 duration-100"
                            role="menu"
                          >
                            <div className="p-2 space-y-1">
                              <button
                                onClick={() => { onLaunchLeave(p); setActiveMenuId(null); setMenuPos(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"
                              >
                                <i className="fas fa-calendar-plus text-indigo-400"></i> Lançar Afastamento
                              </button>
                              <button
                                onClick={() => { onEditPerson(p); setActiveMenuId(null); setMenuPos(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"
                              >
                                <i className="fas fa-user-edit text-indigo-400"></i> Editar Dados
                              </button>
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => { onResetPassword(p.id); setActiveMenuId(null); setMenuPos(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-all"
                                  >
                                    <i className="fas fa-key text-amber-400"></i> Resetar Senha
                                  </button>
                                  <div className="h-px bg-slate-50 mx-2 my-1"></div>
                                  <button
                                    onClick={() => { if(confirm('Excluir este usuário?')) onDeletePerson(p.id); setActiveMenuId(null); setMenuPos(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                  >
                                    <i className="fas fa-trash-alt"></i> Excluir Usuário
                                  </button>
                                </>
                              )}
                            </div>
                          </div>,
                          document.body
                        )}
                    </div>
                  </td>
                  {daysInMonth.map(d => {
                    const status = getDayStatus(p.id, d);
                    return (
                      <td 
                        key={d} 
                        onClick={() => {
                          setSelectedDay(d);
                          onLaunchLeave(p);
                        }}
                        className={`px-1 py-4 text-center cursor-pointer transition-all ${d === selectedDay ? 'bg-indigo-50/30' : ''}`}
                      >
                        {status ? (
                          <div className={`mx-auto w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] font-black shadow-sm ${getStatusColor(status.type)}`}>
                            {status.label}
                          </div>
                        ) : (
                          <div className="mx-auto w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-slate-300"></div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredPersonnelList.length === 0 && (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <i className="fas fa-user-slash text-3xl"></i>
            </div>
            <p className="text-slate-500 font-bold">Nenhum militar encontrado com os filtros aplicados.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Campaign;
