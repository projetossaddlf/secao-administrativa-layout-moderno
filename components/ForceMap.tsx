import React, { useMemo, useState } from "react";
import type { Personnel, LeaveRecord } from "../types";
import RedScale from "./RedScale";
import ForceMapModal from "./ForceMapModal";

type Props = {
  personnel: Personnel[];
  leaves: LeaveRecord[];
};

const RANK_ORDER = [
  "MAJ",
  "CAP",
  "1º TEN",
  "2º TEN",
  "ASP OF",
  "ST",
  "1º SGT",
  "2º SGT",
  "3º SGT",
  "CB",
  "SD",
];

const normalizeRank = (raw: any) => {
  const s = (raw ?? "").toString().trim().toUpperCase();
  if (!s) return "—";

  // normalizações comuns
  if (s.includes("MAJOR")) return "MAJ";
  if (s.includes("CAP")) return "CAP";
  if (s.includes("1") && s.includes("TEN")) return "1º TEN";
  if (s.includes("2") && s.includes("TEN")) return "2º TEN";
  if (s.includes("ASP")) return "ASP OF";
  if (s.includes("SUBTEN") || s === "ST") return "ST";
  if (s.includes("1") && s.includes("SGT")) return "1º SGT";
  if (s.includes("2") && s.includes("SGT")) return "2º SGT";
  if (s.includes("3") && s.includes("SGT")) return "3º SGT";
  if (s.includes("CB") || s.includes("CABO")) return "CB";
  if (s.includes("SD") || s.includes("SOLDADO")) return "SD";

  return s;
};

const normalizeUnit = (raw: any) => (raw ?? "").toString().trim().toUpperCase();

const ForceMap: React.FC<Props> = ({ personnel, leaves }) => {
  const [unit, setUnit] = useState<string>("TOTAL");

  const units = useMemo(() => {
    const set = new Set<string>();
    personnel.forEach((p) => {
      const u = normalizeUnit((p as any).unid);
      if (u) set.add(u);
    });
    return ["TOTAL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [personnel]);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const [periodStart, setPeriodStart] = useState<string>(todayStr);
  const [periodEnd, setPeriodEnd] = useState<string>(todayStr);

  const [showRedScale, setShowRedScale] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const activeLeaves = useMemo(() => {
    // considera afastamento se cruza o período selecionado
    return leaves.filter((l: any) => l.startDate <= periodEnd && l.endDate >= periodStart);
  }, [leaves, periodStart, periodEnd]);

  const inUnit = useMemo(() => {
    if (unit === "TOTAL") return personnel;
    return personnel.filter((p: any) => normalizeUnit(p.unid) === unit);
  }, [personnel, unit]);

  const notPTTC = useMemo(() => {
    // não contabiliza PTTC no mapa-força
    return inUnit.filter((p: any) => !p.pttc);
  }, [inUnit]);

  const awaySet = useMemo(() => new Set(activeLeaves.map((l: any) => l.personnelId ?? l.personId)), [activeLeaves]);

  const effective = useMemo(() => {
    // Considera ATIVO e não afastado no período
    return notPTTC.filter((p: any) => {
      const sit = (p.situacao ?? "").toString().toUpperCase();
      const isActive = sit === "ATIVO";
      const away = awaySet.has(p.id);
      return isActive && !away;
    });
  }, [notPTTC, awaySet]);

  const counts = useMemo(() => {
    const base: Record<string, number> = {};
    for (const r of RANK_ORDER) base[r] = 0;

    for (const p of effective as any[]) {
      const r = normalizeRank(p.grad);
      if (!(r in base)) base[r] = 0;
      base[r] += 1;
    }

    const rows = RANK_ORDER.map((r) => ({ rank: r, qty: base[r] ?? 0 }));
    const total = rows.reduce((acc, cur) => acc + (cur.qty || 0), 0);
    return { rows, total };
  }, [effective]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6">
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-start lg:items-end justify-between">
          <div>
            <div className="text-lg md:text-xl font-black text-slate-800">Mapa Força</div>
            <div className="text-xs text-slate-500 font-semibold">
              Quantitativo por posto/graduação • Unidade: <b>{unit}</b>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-end w-full lg:w-auto">
            <div className="w-full sm:w-[220px]">
              <label className="text-[10px] font-black uppercase text-slate-500">Unidade</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-black"
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-[180px]">
              <label className="text-[10px] font-black uppercase text-slate-500">Início</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              />
            </div>

            <div className="w-full sm:w-[180px]">
              <label className="text-[10px] font-black uppercase text-slate-500">Fim</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              />
            </div>
          </div>

          <div className="mt-4 lg:mt-0 flex justify-end gap-3">
            <button
              onClick={() => setShowDetail(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
            >
              <i className="fas fa-table"></i>
              Mapa Detalhado
            </button>

            <button
              onClick={() => setShowRedScale(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg shadow-rose-200 transition-all flex items-center gap-2"
            >
              <i className="fas fa-list-ol"></i>
              Escala Vermelha
            </button>
          </div>
        </div>
      </div>

      {/* Tabela estilo planilha */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Posto/Graduação</th>
                <th className="px-4 py-3 text-right">Quantitativo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {counts.rows.map((r) => (
                <tr key={r.rank} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-black text-slate-800">{r.rank}</td>
                  <td className="px-4 py-3 text-right font-black text-slate-900">{r.qty}</td>
                </tr>
              ))}
              <tr className="bg-slate-900 text-white">
                <td className="px-4 py-3 font-black uppercase">TOTAL</td>
                <td className="px-4 py-3 text-right font-black">{counts.total}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="px-4 md:px-6 py-3 text-[11px] text-slate-500 font-semibold">
          * Considera apenas <b>ATIVO</b>, exclui <b>PTTC</b> e exclui afastados no período.
        </div>
      </div>
      {showRedScale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowRedScale(false)}
              className="absolute top-6 right-6 z-10 w-10 h-10 bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 rounded-full flex items-center justify-center transition-colors"
            >
              <i className="fas fa-times text-lg"></i>
            </button>
            <RedScale personnel={personnel} leaves={leaves} />
          </div>
        </div>
      )}

      {showDetail && (
        <ForceMapModal
          personnel={personnel}
          leaves={leaves}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  )
}
export default ForceMap;
