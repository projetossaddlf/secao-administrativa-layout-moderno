import React, { useMemo } from 'react';
import { Personnel, LeaveRecord } from '../types';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

interface DashboardProps {
  personnel: Personnel[];
  leaves: LeaveRecord[];
}

const Dashboard: React.FC<DashboardProps> = ({ personnel, leaves }) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const fifteenDaysFromNow = new Date();
  fifteenDaysFromNow.setDate(today.getDate() + 15);
  const fifteenDaysFromNowStr = fifteenDaysFromNow.toISOString().split('T')[0];

  const activeLeaves = useMemo(() => {
    return leaves.filter((l) => l.startDate <= todayStr && l.endDate >= todayStr);
  }, [leaves, todayStr]);

  const stats = useMemo(() => {
    const totalPersonnel = personnel.length;
    const restrictedCount = personnel.filter((p) => (p.situacao ?? '').toUpperCase().includes('RESTR')).length;
    const activeCount = personnel.filter((p) => (p.situacao ?? '').toUpperCase() === 'ATIVO').length;
    const awayUnique = new Set(activeLeaves.map((l: any) => l.personnelId)).size;
    const onDuty = Math.max(activeCount - awayUnique, 0);

    const leaveTypeData = activeLeaves.reduce<Record<string, number>>((acc, leave: any) => {
      const t = (leave.type ?? 'OUTROS').toUpperCase();
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});

    const vacationsActive = leaveTypeData['FÉRIAS'] ?? leaveTypeData['FERIAS'] ?? 0;
    const pttcCount = personnel.filter((p) => (p.situacao ?? '').toUpperCase().includes('PTTC')).length;
    const civilCount = personnel.filter((p) => (p.situacao ?? '').toUpperCase().includes('CIVIL')).length;

    const chartLeaveData = [
      { name: 'Em Serviço', value: onDuty, color: '#10b981' },
      { name: 'Afastados', value: awayUnique, color: '#ef4444' },
      { name: 'Restrição', value: restrictedCount, color: '#f59e0b' },
    ];

    const rankCounts = personnel.reduce<Record<string, number>>((acc, person: any) => {
      const rank = (person.grad ?? '—').toString();
      acc[rank] = (acc[rank] || 0) + 1;
      return acc;
    }, {});

    const chartRankData = Object.entries(rankCounts)
      .map(([rank, count]) => ({ rank, count }))
      .sort((a, b) => b.count - a.count);

    const targetUnits = ['DLF', 'DALF', 'DINFRA', 'DPTS', 'CMAN', 'CMBEL'];
    const unitStats = targetUnits.reduce<Record<string, { total: number; active: number; activePerc: number }>>((acc, unit) => {
      const peopleInUnit = personnel.filter((p: any) => (p.unid ?? '').toUpperCase() === unit);
      const total = peopleInUnit.length;
      const active = peopleInUnit.filter((p: any) => (p.situacao ?? '').toUpperCase() === 'ATIVO').length;
      const activePerc = total > 0 ? (active / total) * 100 : 0;
      acc[unit] = { total, active, activePerc };
      return acc;
    }, {});

    const chartUnitData = targetUnits.map((unit) => ({
      name: unit,
      ativoPercent: unitStats[unit]?.activePerc ?? 0,
    }));

    return {
      total: totalPersonnel,
      onDuty,
      onLeave: awayUnique,
      vacationsActive,
      restrictedCount,
      pttcCount,
      civilCount,
      chartLeaveData,
      chartRankData,
      chartUnitData,
      unitStats
    };
  }, [personnel, activeLeaves]);

  const StatCard = ({ title, value, icon, colorClass, subtext }: any) => (
    <div className="bg-white/80 backdrop-blur-sm p-5 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 ${colorClass} rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform duration-300`}>
          <i className={`fas ${icon}`}></i>
        </div>
        {subtext && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-lg">{subtext}</span>}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-tight mb-1">{title}</p>
        <p className="text-3xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <StatCard title="Efetivo Total" value={stats.total} icon="fa-users" colorClass="bg-indigo-100 text-indigo-600" />
        <StatCard title="Em Serviço" value={stats.onDuty} icon="fa-user-check" colorClass="bg-emerald-100 text-emerald-600" />
        <StatCard title="Afastados Hoje" value={stats.onLeave} icon="fa-user-clock" colorClass="bg-rose-100 text-rose-600" />
        <StatCard title="Férias Ativas" value={stats.vacationsActive} icon="fa-calendar-day" colorClass="bg-violet-100 text-violet-600" />
        <StatCard title="Em Restrição" value={stats.restrictedCount} icon="fa-hand-dots" colorClass="bg-amber-100 text-amber-600" />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 rounded-3xl p-6 text-white flex items-center justify-between shadow-lg shadow-slate-200">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">PTTC</p>
            <p className="text-3xl font-black">{stats.pttcCount}</p>
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-xl">
            <i className="fas fa-user-tie"></i>
          </div>
        </div>
        <div className="bg-indigo-600 rounded-3xl p-6 text-white flex items-center justify-between shadow-lg shadow-indigo-100">
          <div>
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Civil</p>
            <p className="text-3xl font-black">{stats.civilCount}</p>
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-xl">
            <i className="fas fa-user-graduate"></i>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-slate-200 flex items-center justify-between shadow-sm">
          <div className="min-w-0">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Pronto (DLF)</p>
            <p className="text-3xl font-black text-slate-900">{(stats.unitStats?.DLF?.activePerc ?? 0).toFixed(1)}%</p>
          </div>
          <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center text-xl">
            <i className="fas fa-building-shield"></i>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status Distribution */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
              Distribuição de Status
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.chartLeaveData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {stats.chartLeaveData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Efetivo por Posto/Graduação */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <span className="w-2 h-8 bg-emerald-500 rounded-full"></span>
              Efetivo por Posto/Grad
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartRankData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="rank" 
                  type="category" 
                  width={60} 
                  tick={{ fontSize: 12, fontWeight: 'bold', fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Percentual Ativo por Unidade */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <span className="w-2 h-8 bg-violet-500 rounded-full"></span>
              Percentual Ativo por Unidade
            </h3>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartUnitData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12, fontWeight: 'bold', fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fontWeight: 'bold', fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="ativoPercent" radius={[8, 8, 0, 0]} barSize={40}>
                  {stats.chartUnitData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.ativoPercent > 80 ? '#10b981' : entry.ativoPercent > 50 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
