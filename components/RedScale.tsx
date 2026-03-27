import React, { useMemo, useState } from 'react';
import { Personnel, LeaveRecord, LeaveType, Rank } from '../types';

// 🟡 Definição local para RANK_FILTERS (corrige ts2304)
const RANK_FILTERS: string[] = [
  'CEL',
  'TC',
  'MAJ',
  'CAP',
  '1º TEN',
  '2º TEN',
  'ASP',
  'ST',
  '1º SGT',
  '2º SGT',
  '3º SGT',
  'CB',
  'SD'
];

interface RedScaleProps {
  personnel: Personnel[];
  leaves: LeaveRecord[];
  currentUser?: Personnel | null; // ✅ adicionado
}

type RankedEntry = {
  person: Personnel;
  totalExtras: number;
  lastExtraDate: string | null;
  tipo: 'EXTRA' | 'REPRESENTAÇÃO';
};

const isExtraOrRepresentation = (type: LeaveType): boolean =>
  type === 'EXTRA' || type === 'REPRESENTAÇÃO';

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
};

function RedScale({
  personnel,
  leaves,
}: {
  personnel: Personnel[];
  leaves: LeaveRecord[];
}) {

  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');

  const [filterGrad, setFilterGrad] = useState('');
  const [filterUnid, setFilterUnid] = useState('');

  const today = useMemo(
    () => new Date().toLocaleDateString('pt-BR'),
    []
  );

  const toggleRank = (rank: Rank) => {
    setSelectedRanks((prev) => prev.includes(rank) ? prev.filter((r) => r !== rank) : [...prev, rank]
    );
  };

  const clearRanks = () => setSelectedRanks([]);

  const rankedList = useMemo(() => {
    // 1. Filtrar elegíveis (Exclui PTTC e CIVIL, Mantém todos os outros ATIVOS/Restritos/etc)
    const eligible = personnel.filter((p) => {
      const grad = (p.grad || '').toUpperCase();
      const sit = (p.situacao || '').toUpperCase();

      if (grad === 'F.CIVIL') return false;
      if (sit.includes('PTTC')) return false;

      // Filtros de UI
      if (selectedRanks.length > 0 && !selectedRanks.includes(p.grad as Rank)) return false;
      if (selectedUnit && p.unid !== selectedUnit) return false;

      return true;
    });

    // 2. Mapear contagens por tipo
    const countsByPerson = new Map<string, { extra: number; rep: number; virtual: number; pronto: number; lastExtra: string | null; lastRep: string | null }>();

    // Inicializa mapa
    eligible.forEach(p => {
      countsByPerson.set(p.id, { extra: 0, rep: 0, virtual: 0, pronto: 0, lastExtra: null, lastRep: null });
    });

    // Processa afastamentos
    for (const l of leaves) {
      if (!countsByPerson.has(l.personnelId)) continue;
      const data = countsByPerson.get(l.personnelId)!;

      const type = l.type;

      if (type === 'EXTRA') {
        data.extra++;
        if (!data.lastExtra || l.startDate > data.lastExtra) data.lastExtra = l.startDate;
      } else if (type === 'REPRESENTAÇÃO') {
        data.rep++;
        if (!data.lastRep || l.startDate > data.lastRep) data.lastRep = l.startDate;
      } else if (type === 'PRONTO EMPREGO') {
        data.pronto++;
      } else if (type === 'LTSP' || type === 'LTIP' || type === 'LICENÇA ESPECIAL') {
        // Mapeamento de Batalhão Virtual
        data.virtual++;
      }
    }

    // 3. Montar lista final
    const result = eligible.map(p => {
      const stats = countsByPerson.get(p.id)!;
      return {
        person: p,
        ...stats
      };
    });

    // 4. Ordenação (Critério: Menos Extras -> Antiguidade)
    result.sort((a, b) => {
      if (a.extra !== b.extra) return a.extra - b.extra;
      return b.person.ant - a.person.ant;
    });

    return result;
  }, [personnel, leaves, selectedRanks, selectedUnit]);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-full max-h-full">
      <div className="p-6 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">
            Escala Vermelha Integrada
          </h2>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Lista unificada de policiais (exceto PTTC/Civil). Ordenação sugerida: Menor qtde Extras &gt; Antiguidade.
          </p>
          <div className="flex gap-4 mt-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Hoje: {today}
            </p>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">
              Total Listado: {rankedList.length}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          <button
            type="button"
            onClick={clearRanks}
            className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-colors duration-150 ${selectedRanks.length === 0
                ? 'bg-indigo-700 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50'
              }`}
          >
            Limpar Filtro
          </button>

          <select
            value={selectedRanks[0] || ''}
            onChange={(e) => setSelectedRanks(e.target.value ? [e.target.value] : [])}
            className="bg-white border border-gray-300 rounded-full px-5 py-2 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:bg-gray-50 outline-none cursor-pointer shadow-sm"
          >
            <option value="">TODAS PATENTES</option>
            {RANK_FILTERS.map((rank) => (
              <option key={rank} value={rank}>
                {rank}
              </option>
            ))}
          </select>

          <select
            className="bg-white border border-gray-200 rounded-full px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 outline-none"
            value={selectedUnit || ''}
            onChange={(e) => setSelectedUnit(e.target.value)}
          >
            <option value="">TODAS UNIDADES</option>
            {[...new Set(personnel.map((p) => p.unid))].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-0">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest text-[9px] sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 w-16 text-center bg-slate-50">Fila</th>
              <th className="px-4 py-3 bg-slate-50">Militar</th>
              <th className="px-4 py-3 text-center bg-slate-50">Patente</th>
              <th className="px-4 py-3 text-center bg-slate-50">Antig.</th>
              <th className="px-4 py-3 text-center bg-indigo-50/50 text-indigo-700">Extras</th>
              <th className="px-4 py-3 text-center bg-emerald-50/50 text-emerald-700">Repres.</th>
              <th className="px-4 py-3 text-center bg-amber-50/50 text-amber-700" title="LTSP + LTIP + Licença Especial">Btl. Virtual</th>
              <th className="px-4 py-3 text-center bg-rose-50/50 text-rose-700">P. Emprego</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rankedList.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-[11px] text-slate-400 font-medium">
                  Nenhum militar encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              rankedList.map((entry, idx) => (
                <tr
                  key={entry.person.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 text-center font-black text-[11px] text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-semibold text-slate-800 uppercase">
                        {entry.person.nome}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {entry.person.matr} • {entry.person.unid}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-[11px] font-bold text-slate-700">
                    {entry.person.grad}
                  </td>
                  <td className="px-4 py-3 text-center text-[11px]">
                    {entry.person.ant.toString().padStart(3, '0')}
                  </td>

                  {/* EXTRAS */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-indigo-700 text-xs">{entry.extra}</span>
                      <span className="text-[9px] text-slate-400">{formatDate(entry.lastExtra)}</span>
                    </div>
                  </td>

                  {/* REPRESENTAÇÕES */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-emerald-700 text-xs">{entry.rep}</span>
                      <span className="text-[9px] text-slate-400">{formatDate(entry.lastRep)}</span>
                    </div>
                  </td>

                  {/* BATALHÃO VIRTUAL */}
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold text-xs ${entry.virtual > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                      {entry.virtual}
                    </span>
                  </td>

                  {/* PRONTO EMPREGO */}
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold text-xs ${entry.pronto > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                      {entry.pronto}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RedScale;