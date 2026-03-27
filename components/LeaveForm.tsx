import React, { useState, useEffect, useMemo } from 'react';
import { Personnel, LeaveRecord, LeaveType } from '../types';

interface LeaveFormProps {
  personnel?: Personnel[]; // Lista para seleção caso não venha um inicial
  initialPerson?: Personnel;
  initialData?: LeaveRecord;
  leaves?: LeaveRecord[]; // Leaves history for calculating stats
  onClose?: () => void;
  onSubmit: (newLeaves: Omit<LeaveRecord, 'id' | 'createdAt' | 'launchedBy'>[] | LeaveRecord[]) => void;
  embedded?: boolean;
}

const LeaveForm: React.FC<LeaveFormProps> = ({ initialPerson, onSubmit, leaves = [], embedded = false }) => {
  const [person, setPerson] = useState<Personnel | undefined>(initialPerson);

  const [type, setType] = useState<LeaveType>('FÉRIAS');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [abonoDates, setAbonoDates] = useState<string[]>(['', '', '', '', '']);
  const [errors, setErrors] = useState<string[]>([]);

  const leaveTypes: LeaveType[] = [
    'FÉRIAS', 'ABONO', 'LTSP', 'RESTRIÇÃO', 'LICENÇA ESPECIAL',
    'LTIP', 'PRONTO EMPREGO', 'EXTRA', 'REPRESENTAÇÃO', 'DISPENSA RECOMPENSA', 'CURSO'
  ];

  const stats = useMemo(() => {
    if (!person) return { extra: 0, rep: 0, virtual: 0, pronto: 0 };
    const pLeaves = leaves.filter(l => l.personnelId === person.id);
    return {
      extra: pLeaves.filter(l => l.type === 'EXTRA').length,
      rep: pLeaves.filter(l => l.type === 'REPRESENTAÇÃO').length,
      virtual: pLeaves.filter(l => ['LTSP', 'LTIP', 'LICENÇA ESPECIAL'].includes(l.type)).length,
      pronto: pLeaves.filter(l => l.type === 'PRONTO EMPREGO').length,
    };
  }, [person, leaves]);

  useEffect(() => {
    if (initialPerson) setPerson(initialPerson);
  }, [initialPerson]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: string[] = [];
    if (!person) {
      newErrors.push('Selecione um militar válido.');
    } else {
      if (type === 'ABONO') {
        const filledDates = abonoDates.filter(d => d !== '');
        if (filledDates.length < 5) newErrors.push('Preencha as 5 datas do abono.');
        if (person.saldoAbono < 5) newErrors.push(`Saldo insuficiente (${person.saldoAbono}).`);
      } else {
        if (!startDate) newErrors.push('Data de início obrigatória.');
        if (!endDate && type !== 'EXTRA' && type !== 'REPRESENTAÇÃO') newErrors.push('Data de término obrigatória.');
      }
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    if (person) {
      if (type === 'ABONO') {
        onSubmit(abonoDates.map(d => ({ personnelId: person.id, type: 'ABONO', startDate: d, endDate: d, description: description || 'Abono Anual' })));
      } else {
        onSubmit([{ personnelId: person.id, type, startDate, endDate: endDate || startDate, description }]);
      }
      // Reset
      setStartDate('');
      setEndDate('');
      setDescription('');
    }
  };

  if (!person) {
    return (
      <div className="p-12 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4 shadow-sm">
          <i className="fas fa-user-plus text-2xl"></i>
        </div>
        <p className="text-slate-500 font-bold">Selecione um militar na aba Efetivo para realizar um lançamento.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8 p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100/50">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm font-black text-xl">
            {person.grad}
          </div>
          <div>
            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-1">Lançamento para</p>
            <h3 className="text-xl font-black text-slate-900">{person.nome}</h3>
            <p className="text-sm font-bold text-slate-500">{person.matr} • {person.unid} • {person.secao}</p>
          </div>
        </div>

        <div className="ml-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="px-3 py-2 bg-white rounded-xl border border-indigo-100 shadow-sm text-center">
            <p className="text-[9px] font-black text-indigo-400 uppercase">Extras</p>
            <p className="text-base font-black text-indigo-700">{stats.extra}</p>
          </div>
          <div className="px-3 py-2 bg-white rounded-xl border border-emerald-100 shadow-sm text-center">
            <p className="text-[9px] font-black text-emerald-400 uppercase">Repres.</p>
            <p className="text-base font-black text-emerald-700">{stats.rep}</p>
          </div>
          <div className="px-3 py-2 bg-white rounded-xl border border-amber-100 shadow-sm text-center">
            <p className="text-[9px] font-black text-amber-400 uppercase">Virtual</p>
            <p className="text-base font-black text-amber-700">{stats.virtual}</p>
          </div>
          <div className="px-3 py-2 bg-white rounded-xl border border-rose-100 shadow-sm text-center">
            <p className="text-[9px] font-black text-rose-400 uppercase">P. Emp</p>
            <p className="text-base font-black text-rose-700">{stats.pronto}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="block text-sm font-black text-slate-700 mb-4 ml-1">Tipo de Afastamento</label>
          <div className="flex flex-wrap gap-2">
            {leaveTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border ${type === t
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 scale-105"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30"
                  }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {type === 'ABONO' ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {abonoDates.map((d, i) => (
              <div key={i}>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Data {i + 1}</label>
                <input
                  type="date"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold"
                  value={d}
                  onChange={(e) => {
                    const next = [...abonoDates];
                    next[i] = e.target.value;
                    setAbonoDates(next);
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 ml-1">Data de Início</label>
              <input
                type="date"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-lg"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 ml-1">Data de Término</label>
              <input
                type="date"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-lg"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-black text-slate-700 mb-2 ml-1">Observações (Opcional)</label>
          <textarea
            rows={3}
            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
            placeholder="Detalhes adicionais sobre o afastamento..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {errors.length > 0 && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
            <i className="fas fa-exclamation-circle text-rose-500 mt-0.5"></i>
            <div className="text-rose-700 text-sm font-bold">
              {errors.map((err, i) => <p key={i}>{err}</p>)}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all active:translate-y-0"
          >
            Confirmar Lançamento
          </button>
        </div>
      </form>
    </div>
  );
};

export default LeaveForm;
