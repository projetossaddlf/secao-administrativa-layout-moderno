import React, { useMemo, useState } from 'react';
import { Personnel, LeaveRecord } from '../types';

interface ForceMapModalProps {
  personnel: Personnel[];
  leaves: LeaveRecord[];
  onClose: () => void;
}

type RowDef = {
  label: string;
  grad: string;
  quadro: string;
  // group ID for row spanning
  group?: 'SUPERIORES' | 'INTERMEDIARIOS' | 'SUBALTERNOS' | 'PRACAS';
};

function escapeCSV(v: any) {
  return `"${String(v ?? '').replaceAll('"', '""')}"`;
}

function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ForceMapModal: React.FC<ForceMapModalProps> = ({ personnel, leaves, onClose }) => {
  const [selectedUnit, setSelectedUnit] = useState<string>('GERAL');
  const todayStr = new Date().toISOString().split('T')[0];

  // Extrair unidades únicas do efetivo
  const uniqueUnits = useMemo(() => {
    const units = Array.from(new Set(personnel.map(p => p.unid))).sort();
    return ['GERAL', ...units];
  }, [personnel]);

  // Identificar quem está de serviço hoje (não está em afastamento ativo) filtrando por unidade
  const presentPersonnel = useMemo(() => {
    return personnel.filter(p => {
      // Filtro de unidade
      const matchesUnit = selectedUnit === 'GERAL' || p.unid === selectedUnit;
      if (!matchesUnit) return false;

      // Filtro de afastamento
      const activeLeave = leaves.find(l =>
        l.personnelId === p.id &&
        l.startDate <= todayStr &&
        l.endDate >= todayStr
      );
      return !activeLeave;
    });
  }, [personnel, leaves, todayStr, selectedUnit]);

  // Linhas conforme o PDF
  const rows: RowDef[] = [
    // OFICIAIS SUPERIORES
    { label: 'MAJ QOPM', grad: 'MAJ', quadro: 'QOPM', group: 'SUPERIORES' },
    { label: 'MAJ QOPMA', grad: 'MAJ', quadro: 'QOPMA', group: 'SUPERIORES' },
    { label: 'MAJ QOPMM', grad: 'MAJ', quadro: 'QOPMM', group: 'SUPERIORES' },
    { label: 'MAJ QOPME', grad: 'MAJ', quadro: 'QOPME', group: 'SUPERIORES' },

    // INTERMEDIARIOS
    { label: 'CAP QOPM', grad: 'CAP', quadro: 'QOPM', group: 'INTERMEDIARIOS' },
    { label: 'CAP QOPMA', grad: 'CAP', quadro: 'QOPMA', group: 'INTERMEDIARIOS' },
    { label: 'CAP QOPMM', grad: 'CAP', quadro: 'QOPMM', group: 'INTERMEDIARIOS' },
    { label: 'CAP QOPME', grad: 'CAP', quadro: 'QOPME', group: 'INTERMEDIARIOS' },

    // SUBALTERNOS (1º e 2º TEN)
    { label: '1º TEN QOPM', grad: '1º TEN', quadro: 'QOPM', group: 'SUBALTERNOS' },
    { label: '1º TEN QOPMA', grad: '1º TEN', quadro: 'QOPMA', group: 'SUBALTERNOS' },
    { label: '1º TEN QOPMM', grad: '1º TEN', quadro: 'QOPMM', group: 'SUBALTERNOS' },
    { label: '1º TEN QOPME', grad: '1º TEN', quadro: 'QOPME', group: 'SUBALTERNOS' },
    { label: '2º TEN QOPM', grad: '2º TEN', quadro: 'QOPM', group: 'SUBALTERNOS' },
    { label: '2º TEN QOPMA', grad: '2º TEN', quadro: 'QOPMA', group: 'SUBALTERNOS' },
    { label: '2º TEN QOPMM', grad: '2º TEN', quadro: 'QOPMM', group: 'SUBALTERNOS' },
    { label: '2º TEN QOPME', grad: '2º TEN', quadro: 'QOPME', group: 'SUBALTERNOS' },

    // PRACAS (Subten a Sd)
    { label: 'SUBTENENTE', grad: 'ST', quadro: 'QPPMC', group: 'PRACAS' },
    { label: '1º SARGENTO', grad: '1º SGT', quadro: 'QPPMC', group: 'PRACAS' },
    { label: '2º SARGENTO', grad: '2º SGT', quadro: 'QPPMC', group: 'PRACAS' },
    { label: '3º SARGENTO', grad: '3º SGT', quadro: 'QPPMC', group: 'PRACAS' },
    { label: 'CABO', grad: 'CB', quadro: 'QPPMC', group: 'PRACAS' },
    { label: 'SOLDADO', grad: 'SD', quadro: 'QPPMC', group: 'PRACAS' },
  ];

  const tableData = useMemo(() => {
    let totalExpediente = 0;
    let totalEscala = 0;

    const groupTotals: Record<string, number> = { SUPERIORES: 0, INTERMEDIARIOS: 0, SUBALTERNOS: 0, PRACAS: 0 };
    const groupCounts: Record<string, number> = { SUPERIORES: 0, INTERMEDIARIOS: 0, SUBALTERNOS: 0, PRACAS: 0 };

    // First pass to calculate group totals and row counts
    rows.forEach(row => {
      const filtered = presentPersonnel.filter(p =>
        p.grad === row.grad &&
        (row.quadro === 'QPPMC' ? true : p.quadro === row.quadro)
      );
      const total = filtered.length; // Active count (Expediente + Escala)
      if (row.group) {
        groupTotals[row.group] += total;
        groupCounts[row.group] += 1;
      }
    });


    // Keep track of which groups we've already started rendering rowSpan for
    const processedGroups: Record<string, boolean> = {};

    const items = rows.map(row => {
      const filtered = presentPersonnel.filter(p =>
        p.grad === row.grad &&
        (row.quadro === 'QPPMC' ? true : p.quadro === row.quadro)
      );

      const expediente = filtered.filter(p => p.esc === 'EXP').length;
      const escala = filtered.filter(p => p.esc !== 'EXP').length;
      const total = expediente + escala;

      totalExpediente += expediente;
      totalEscala += escala;

      let rowSpan = 1;
      let totalCirculo: number | undefined = undefined;
      let showCirculoTotal = false;

      if (row.group) {
        if (!processedGroups[row.group]) {
          // First row of the group
          rowSpan = groupCounts[row.group];
          totalCirculo = groupTotals[row.group];
          showCirculoTotal = true;
          processedGroups[row.group] = true;
        } else {
          // Subsequent rows in group - these cells will be spanned over
          rowSpan = 0;
          showCirculoTotal = false;
        }
      }

      return { ...row, expediente, escala, total, totalCirculo, rowSpan, showCirculoTotal };
    });

    return {
      items,
      totalExpediente,
      totalEscala,
      grandTotal: totalExpediente + totalEscala,
    };
  }, [presentPersonnel]); // rows is constant

  const tsvText = useMemo(() => {
    const header = ['POSTO/GRADUAÇÃO', 'EXPEDIENTE', 'ESCALA', 'TOTAL', 'TOTAL DO CIRCULO HIERÁRQUICO'];
    const lines = tableData.items.map((r: any) =>
      [r.label, r.expediente, r.escala, r.total, r.showCirculoTotal ? r.totalCirculo : ''].join('\t')
    );
    return [header.join('\t'), ...lines].join('\n');
  }, [tableData.items]);

  const csvText = useMemo(() => {
    const header = ['POSTO/GRADUAÇÃO', 'EXPEDIENTE', 'ESCALA', 'TOTAL', 'TOTAL DO CIRCULO HIERÁRQUICO'];
    const lines = tableData.items.map((r: any) =>
      [escapeCSV(r.label), r.expediente, r.escala, r.total, r.showCirculoTotal ? r.totalCirculo : ''].join(',')
    );
    return [header.join(','), ...lines].join('\n');
  }, [tableData.items]);

  const handleCopyExcel = async () => {
    await navigator.clipboard.writeText(tsvText);
  };

  const handleExportCSV = () => {
    downloadTextFile('mapa-forca.csv', csvText, 'text/csv;charset=utf-8');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Cabeçalho do Relatório */}
        <div className="p-8 text-center relative border-b border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors print:hidden"
          >
            <i className="fas fa-times text-xl"></i>
          </button>

          <div className="space-y-1 mb-6">
            <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest">Governo do Distrito Federal</h2>
            <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest">Polícia Militar do Distrito Federal</h2>
            <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest">Departamento de Gestão de Pessoal</h2>
            <h3 className="text-xs font-bold text-slate-500 uppercase">Seção Administrativa</h3>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="flex justify-center gap-8 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
              <div>PERÍODO: {new Date().toLocaleDateString('pt-BR')}</div>
              <div className="hidden print:block">UNIDADE: {selectedUnit}</div>
            </div>

            {/* Seletor de Unidade - Escondido na Impressão */}
            <div className="print:hidden w-full max-w-xs space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Selecionar Unidade</label>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              >
                {uniqueUnits.map(unit => (
                  <option key={unit} value={unit}>
                    {unit === 'GERAL' ? 'TODAS AS UNIDADES (GERAL)' : unit}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-0">
          <table className="w-full border-collapse border-t border-slate-200">
            <thead>
              <tr className="bg-slate-100/50">
                <th className="p-4 border border-slate-200 text-left text-[11px] font-black text-slate-700 uppercase min-w-[180px]">Posto e Graduação</th>
                <th className="p-4 border border-slate-200 text-center text-[11px] font-black text-slate-700 uppercase w-24">Expediente</th>
                <th className="p-4 border border-slate-200 text-center text-[11px] font-black text-slate-700 uppercase w-24">Escala</th>
                <th className="p-4 border border-slate-200 text-center text-[11px] font-black text-slate-700 uppercase w-24 bg-slate-200/50">Total</th>

                {/* NOVA COLUNA (modelo PDF) */}
                <th className="p-4 border border-slate-200 text-center text-[11px] font-black text-slate-700 uppercase w-44">
                  Total do Círculo Hierárquico
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {tableData.items.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 border border-slate-200 font-bold text-slate-800 text-xs">{row.label}</td>
                  <td className="p-3 border border-slate-200 text-center font-bold text-slate-600 text-xs">{row.expediente}</td>
                  <td className="p-3 border border-slate-200 text-center font-bold text-slate-600 text-xs">{row.escala}</td>
                  <td className="p-3 border border-slate-200 text-center font-black text-slate-900 text-xs bg-slate-50">{row.total}</td>

                  {/* TOTAL DO CÍRCULO HIERÁRQUICO */}
                  {row.showCirculoTotal ? (
                    <td
                      className="p-3 border border-slate-200 text-center font-black text-slate-900 text-xs align-middle bg-white"
                      rowSpan={row.rowSpan}
                    >
                      {row.totalCirculo}
                    </td>
                  ) : (
                    // Se rowSpan for 0, não renderiza td. Se não tiver grupo, renderiza vazio
                    row.rowSpan === 0 ? null : <td className="p-3 border border-slate-200"></td>
                  )}
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="bg-slate-900 text-white">
                <td className="p-4 border border-slate-800 font-black text-xs uppercase tracking-widest">
                  Total Geral ({selectedUnit})
                </td>
                <td className="p-4 border border-slate-800 text-center font-black text-sm">{tableData.totalExpediente}</td>
                <td className="p-4 border border-slate-800 text-center font-black text-sm">{tableData.totalEscala}</td>
                <td className="p-4 border border-slate-800 text-center font-black text-sm bg-blue-600">{tableData.grandTotal}</td>

                {/* célula final do footer */}
                <td className="p-4 border border-slate-800 text-center font-black text-sm bg-slate-800/50">
                  {/* Opcional: Soma total de todos os círculos (deve ser igual ao grandTotal) */}
                  {tableData.grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-6 bg-slate-50 flex flex-wrap justify-between items-center border-t border-slate-200 gap-4 print:hidden">
          <p className="text-[9px] font-black text-slate-400 uppercase">* Dados baseados no efetivo presente ({selectedUnit})</p>

          <div className="flex gap-2 flex-wrap">
            {/* NOVOS BOTÕES (Excel/CSV) */}
            <button
              onClick={handleCopyExcel}
              className="bg-white border border-slate-300 text-slate-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-slate-100 transition-all flex items-center gap-2 shadow-sm"
              title="Copia em formato de planilha (TSV) para colar no Excel/Sheets"
            >
              <i className="fas fa-copy"></i> Copiar (Excel)
            </button>

            <button
              onClick={handleExportCSV}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg"
              title="Exporta CSV"
            >
              <i className="fas fa-file-csv"></i> Exportar CSV
            </button>

            {/* BOTÕES EXISTENTES */}
            <button
              onClick={onClose}
              className="bg-white border border-slate-300 text-slate-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-slate-100 transition-all flex items-center gap-2 shadow-sm"
            >
              <i className="fas fa-times"></i> Fechar
            </button>

            <button
              onClick={() => window.print()}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <i className="fas fa-print"></i> Gerar Documento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForceMapModal;
