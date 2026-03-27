import React, { useState, useMemo } from 'react';
import { Personnel, LeaveRecord } from '../types';

interface ReportsProps {
  personnel: Personnel[];
  leaves: LeaveRecord[];
}

const Reports: React.FC<ReportsProps> = ({ personnel, leaves }) => {
  const [filterUnid, setFilterUnid] = useState('');
  const [filterSecao, setFilterSecao] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterSituacao, setFilterSituacao] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const unidades = useMemo(() => Array.from(new Set(personnel.map(p => p.unid))).sort(), [personnel]);
  const secoes = useMemo(() => 
    Array.from(new Set(personnel.filter(p => !filterUnid || p.unid === filterUnid).map(p => p.secao)))
    .filter(Boolean).sort(), [personnel, filterUnid]
  );
  const situacoes = useMemo(() => Array.from(new Set(personnel.map(p => p.situacao))).sort(), [personnel]);

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      const p = personnel.find(person => person.id === l.personnelId);
      if (!p) return false;

      const matchesUnid = !filterUnid || p.unid === filterUnid;
      const matchesSecao = !filterSecao || p.secao === filterSecao;
      const matchesType = !filterType || l.type === filterType;
      const matchesSituacao = !filterSituacao || p.situacao === filterSituacao;
      
      const lStart = new Date(l.startDate).getTime();
      const lEnd = new Date(l.endDate).getTime();
      const fStart = startDate ? new Date(startDate).getTime() : -Infinity;
      const fEnd = endDate ? new Date(endDate).getTime() : Infinity;

      const matchesDate = (lStart <= fEnd && lEnd >= fStart);

      return matchesUnid && matchesSecao && matchesType && matchesSituacao && matchesDate;
    });
  }, [leaves, personnel, filterUnid, filterSecao, filterType, filterSituacao, startDate, endDate]);

  const stats = useMemo(() => {
    return {
      totalDias: filteredLeaves.reduce((acc, l) => {
        const s = new Date(l.startDate);
        const e = new Date(l.endDate);
        const diff = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return acc + diff;
      }, 0),
      count: filteredLeaves.length,
      ferias: filteredLeaves.filter(l => l.type === 'FÉRIAS').length,
      abono: filteredLeaves.filter(l => l.type === 'ABONO').length,
      dispensa: filteredLeaves.filter(l => l.type === 'LTSP' || l.type === 'DISPENSA').length,
    };
  }, [filteredLeaves]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Filters Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm print:hidden">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
            <i className="fas fa-filter text-indigo-600"></i>
            Filtros do Relatório
          </h3>
          <button 
            onClick={() => {
              setFilterUnid(''); setFilterSecao(''); setFilterType(''); setFilterSituacao(''); setStartDate(''); setEndDate('');
            }}
            className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Limpar Filtros
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Unidade', value: filterUnid, setter: setFilterUnid, options: unidades },
            { label: 'Seção', value: filterSecao, setter: setFilterSecao, options: secoes, disabled: !filterUnid },
            { label: 'Situação', value: filterSituacao, setter: setFilterSituacao, options: situacoes },
          ].map((f, i) => (
            <div key={i}>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">{f.label}</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 disabled:opacity-50"
                value={f.value}
                onChange={(e) => f.setter(e.target.value)}
                disabled={f.disabled}
              >
                <option value="">Todas</option>
                {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Tipo</label>
            <select 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="FÉRIAS">FÉRIAS</option>
              <option value="ABONO">ABONO</option>
              <option value="LTSP">LTSP</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Início</label>
            <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700" value={startDate} onChange={(e) => setStartDate(e.target.value)}/>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Fim</label>
            <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700" value={endDate} onChange={(e) => setEndDate(e.target.value)}/>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 print:hidden">
        {[
          { label: 'Registros', value: stats.count, color: 'bg-indigo-600 text-white' },
          { label: 'Total Dias', value: stats.totalDias, color: 'bg-white text-slate-900' },
          { label: 'Férias', value: stats.ferias, color: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
          { label: 'Abonos', value: stats.abono, color: 'bg-blue-50 text-blue-700 border border-blue-100' },
          { label: 'LTSP', value: stats.dispensa, color: 'bg-rose-50 text-rose-700 border border-rose-100' },
        ].map((s, i) => (
          <div key={i} className={`${s.color} p-6 rounded-3xl shadow-sm flex flex-col justify-between h-32`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{s.label}</p>
            <p className="text-3xl font-black">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Report Table Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black text-slate-900">Relatório Consolidado</h3>
            <p className="text-sm font-medium text-slate-500">Dados baseados nos filtros selecionados acima</p>
          </div>
          <button onClick={() => window.print()} className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
            <i className="fas fa-print text-slate-400"></i> Imprimir Relatório
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-100/30 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5">Militar</th>
                <th className="px-8 py-5">Unidade/Seção</th>
                <th className="px-8 py-5">Tipo</th>
                <th className="px-8 py-5 text-center">Período</th>
                <th className="px-8 py-5 text-center">Duração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLeaves.length === 0 ? (
                <tr><td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-bold italic">Nenhum dado localizado para os filtros aplicados.</td></tr>
              ) : (
                filteredLeaves.map(l => {
                  const p = personnel.find(x => x.id === l.personnelId);
                  const duracao = Math.ceil(Math.abs(new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="font-black text-slate-900">{p?.grad} {p?.nome}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{p?.matr}</div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="text-sm font-bold text-slate-700">{p?.unid}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase">{p?.secao}</div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${
                          l.type === 'FÉRIAS' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          l.type === 'ABONO' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {l.type}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center font-bold text-slate-600 text-sm">
                        {new Date(l.startDate + 'T00:00:00').toLocaleDateString('pt-BR')} <i className="fas fa-arrow-right mx-2 text-[10px] text-slate-300"></i> {new Date(l.endDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-8 py-5 text-center font-black text-slate-900">{duracao} dias</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
