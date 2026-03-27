import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { Personnel, Rank, LeaveRecord } from '../types';

// Configuração do worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs';

interface ImportModalProps {
  onClose: () => void;
  onImport: (data: Omit<Personnel, 'id'>[]) => void;
  onFullRestore?: (data: { personnel: Personnel[], leaves: LeaveRecord[] }) => void;
  existingPersonnel: Personnel[];
}

const FIELD_LABELS: Record<string, string> = {
  ant: 'Antiguidade',
  grad: 'Patente',
  quadro: 'Quadro',
  nome: 'Nome Completo',
  matr: 'Matrícula',
  unid: 'Unidade',
  secao: 'Seção',
  situacao: 'Situação',
  esc: 'Escala'
};

const REQUIRED_FIELDS_KEYS: (keyof Omit<Personnel, 'id'>)[] = [
  'ant', 
  'grad', 
  'quadro', 
  'nome', 
  'matr', 
  'unid', 
  'secao', 
  'situacao', 
  'esc'
];

const VALID_UNITS = ['CMAN', 'CMBEL', 'DLF', 'DINFRA', 'DALF', 'DPTS'];

// Cabeçalho padrão esperado para PDFs "alinhados" sem linha de cabeçalho
const PDF_DEFAULT_HEADERS = [
  'Antiguidade',
  'Patente',
  'Quadro',
  'Nome Completo',
  'Matrícula',
  'Unidade',
  'Seção',
  'Situação',
  'Escala'
];

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport, onFullRestore }) => {
  const [fileData, setFileData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);

  const findHeaderRow = (rows: any[][]) => {
    const keywords = ['NOME', 'MATR', 'GRAD', 'POSTO', 'ANT', 'IDENTIDADE', 'RE', 'UNID', 'QUADRO', 'SEÇÃO', 'SITUAÇÃO', 'ESCALA'];
    let bestRow = 0;
    let maxMatches = 0;

    for (let i = 0; i < Math.min(50, rows.length); i++) {
      let matches = 0;
      if (!rows[i]) continue;
      rows[i].forEach(cell => {
        const val = String(cell || '').toUpperCase();
        if (keywords.some(k => val.includes(k))) matches++;
      });
      if (matches > maxMatches) {
        maxMatches = matches;
        bestRow = i;
      }
    }
    return bestRow;
  };

  const buildDefaultPdfMapping = () => {
    const defaultMapping: Record<string, string> = {};
    defaultMapping['ant'] = 'Antiguidade';
    defaultMapping['grad'] = 'Patente';
    defaultMapping['quadro'] = 'Quadro';
    defaultMapping['nome'] = 'Nome Completo';
    defaultMapping['matr'] = 'Matrícula';
    defaultMapping['unid'] = 'Unidade';
    defaultMapping['secao'] = 'Seção';
    defaultMapping['situacao'] = 'Situação';
    defaultMapping['esc'] = 'Escala';
    return defaultMapping;
  };

  const parsePDF = async (arrayBuffer: ArrayBuffer) => {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const allRows: string[][] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const itemsByY: Record<number, any[]> = {};
      textContent.items.forEach((item: any) => {
        const y = Math.round(item.transform[5]);
        const closeY = Object.keys(itemsByY).find(key => Math.abs(Number(key) - y) < 4);
        const targetY = closeY ? Number(closeY) : y;
        if (!itemsByY[targetY]) itemsByY[targetY] = [];
        itemsByY[targetY].push(item);
      });

      const sortedY = Object.keys(itemsByY).map(Number).sort((a, b) => b - a);
      sortedY.forEach(y => {
        const rowItems = itemsByY[y].sort((a, b) => a.transform[4] - b.transform[4]);
        const processedRow: string[] = [];
        let currentText = '';
        let lastX = -1;

        rowItems.forEach(item => {
          const x = item.transform[4];
          if (lastX !== -1 && x - lastX > 15) {
            processedRow.push(currentText.trim());
            currentText = item.str;
          } else {
            currentText += (currentText ? ' ' : '') + item.str;
          }
          lastX = x + (item.width || 0);
        });
        processedRow.push(currentText.trim());

        if (processedRow.join('').trim().length > 0) {
          allRows.push(processedRow);
        }
      });
    }

    if (allRows.length > 0) {
      const hIdx = findHeaderRow(allRows);
      const headerCandidate = allRows[hIdx] || [];

      const headerKeywords = ['NOME', 'MATR', 'GRAD', 'POSTO', 'ANT', 'IDENTIDADE', 'RE', 'UNID', 'QUADRO', 'SEÇÃO', 'SITUAÇÃO', 'ESCALA'];
      const hasHeader = headerCandidate.some(cell => {
        const val = String(cell || '').toUpperCase();
        return headerKeywords.some(k => val.includes(k));
      });

      if (hasHeader) {
        // PDF com linha de cabeçalho -> usa cabeçalho detectado normalmente
        const detectedHeaders = headerCandidate.map((h, i) => h || `Coluna ${i + 1}`);
        setHeaders(detectedHeaders);
        setFileData(allRows.slice(hIdx + 1));
        setStep('mapping');
        autoMap(detectedHeaders);
      } else {
        // PDF SEM linha de cabeçalho -> assume colunas fixas na ordem:
        // Antiguidade, Patente, Quadro, Nome Completo, Matrícula, Unidade, Seção, Situação, Escala
        setHeaders(PDF_DEFAULT_HEADERS);
        setFileData(allRows);
        setMapping(buildDefaultPdfMapping());
        setStep('mapping');
      }
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    try {
      if (ext === 'json' && onFullRestore) {
        const text = await file.text();
        onFullRestore(JSON.parse(text));
        return;
      }

      const buffer = await file.arrayBuffer();
      if (ext === 'pdf') {
        await parsePDF(buffer);
      } else {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        if (json.length > 0) {
          const hIdx = findHeaderRow(json);
          const detectedHeaders = json[hIdx].map((h, i) => String(h || `Coluna ${i + 1}`));
          setHeaders(detectedHeaders);
          setFileData(json.slice(hIdx + 1));
          setStep('mapping');
          autoMap(detectedHeaders);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao processar arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const autoMap = (detectedHeaders: string[]) => {
    const newMapping: Record<string, string> = {};
    detectedHeaders.forEach(h => {
      const val = String(h || '').toUpperCase().trim();
      if (val.includes('NOME') || val.includes('MILITAR')) newMapping['nome'] = h;
      if (val.includes('MATR') || val === 'RE' || val.includes('IDENT')) newMapping['matr'] = h;
      if (val.includes('GRAD') || val.includes('POSTO') || val === 'PATENTE') newMapping['grad'] = h;
      if (val.includes('ANT') || val === 'Nº' || val === 'ORDEM') newMapping['ant'] = h;
      if (val.includes('UNID')) newMapping['unid'] = h;
      if (val.includes('QUAD')) newMapping['quadro'] = h;
      if (val.includes('SEC') || val.includes('SEÇÃO')) newMapping['secao'] = h;
      if (val.includes('SIT')) newMapping['situacao'] = h;
      if (val.includes('ESC')) newMapping['esc'] = h;
    });
    setMapping(newMapping);
  };

  const normalizeRank = (val: string): Rank => {
    const r = String(val).toUpperCase().trim();
    if (r.includes('CORONEL')) return 'CEL';
    if (r.includes('TEN') && r.includes('COR')) return 'TC';
    if (r.includes('MAJ')) return 'MAJ';
    if (r.includes('CAP')) return 'CAP';
    if (r.includes('TEN') && r.includes('1')) return '1º TEN';
    if (r.includes('TEN') && r.includes('2')) return '2º TEN';
    if (r.includes('ASP')) return 'ASP';
    if (r.includes('CAD')) return 'CAD';
    if (r.includes('SUB') || r === 'ST') return 'ST';
    if (r.includes('SGT') && r.includes('1')) return '1º SGT';
    if (r.includes('SGT') && r.includes('2')) return '2º SGT';
    if (r.includes('SGT') && r.includes('3')) return '3º SGT';
    if (r.includes('CB') || r.includes('CABO')) return 'CB';
    if (r.includes('SD') || r.includes('SOLD')) return 'SD';
    return 'SD';
  };

  const normalizeUnit = (val: string): string => {
    const u = String(val).toUpperCase().trim();
    const found = VALID_UNITS.find(unit => u.includes(unit));
    return found || 'DLF';
  };

  const processImport = () => {
    const finalData: Omit<Personnel, 'id'>[] = fileData.map(row => {
      const item: any = { saldoFerias: 30, saldoAbono: 5, role: 'USER' };
      REQUIRED_FIELDS_KEYS.forEach(field => {
        const headerName = mapping[field];
        const colIdx = headers.indexOf(headerName);
        let val = colIdx !== -1 ? row[colIdx] : '';

        if (field === 'ant') {
          // Garante que a antiguidade seja apenas o número inteiro
          const numeric = String(val).replace(/\D/g, '');
          item[field] = parseInt(numeric) || 0;
        } else if (field === 'grad') {
          item[field] = normalizeRank(val);
        } else if (field === 'unid') {
          item[field] = normalizeUnit(val);
        } else if (field === 'nome') {
          item[field] = String(val).toUpperCase().trim();
        } else {
          item[field] = String(val || '').toUpperCase().trim();
        }
      });
      return item;
    }).filter(p => p.nome && p.matr && p.nome.length > 2);

    onImport(finalData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="bg-slate-900 p-6 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <i className="fas fa-file-import"></i>
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight">Importação Assistida</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sincronização de Efetivo</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-8 flex-1 overflow-y-auto">
          {step === 'upload' && (
            <div className="border-4 border-dashed rounded-3xl p-16 text-center bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer relative">
              {isProcessing ? (
                <div className="space-y-4">
                  <i className="fas fa-circle-notch fa-spin text-5xl"></i>
                  <p className="text-sm font-black text-slate-600 uppercase">Analisando Estrutura...</p>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    accept=".pdf,.xlsx,.xls,.csv,.json"
                    onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  />
                  <i className="fas fa-cloud-arrow-up text-6xl text-slate-300 mb-6"></i>
                  <h4 className="text-xl font-black text-slate-800 uppercase mb-2">Carregar PDF ou Planilha</h4>
                  <p className="text-sm text-slate-500 font-medium mb-8">Arraste o arquivo aqui para iniciar a vinculação</p>
                  <div className="flex justify-center gap-3">
                    <span className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-slate-400">PDF Alinhado</span>
                    <span className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-slate-400">Excel Automático</span>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-blue-900 uppercase mb-1">Vinculação de Colunas</h4>
                  <p className="text-xs text-blue-800 font-medium">
                    Relacione as colunas do seu arquivo aos campos do SADDLF. Para PDFs padronizados, o mapeamento já vem preenchido.
                  </p>
                </div>
                <button
                  onClick={() => autoMap(headers)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <i className="fas fa-magic"></i> AUTO-MAP
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {REQUIRED_FIELDS_KEYS.map(field => (
                  <div
                    key={field}
                    className="flex flex-col gap-1.5 p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:shadow-md hover:bg-white group"
                  >
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 group-hover:text-blue-500">
                      <i className={`fas ${mapping[field] ? 'fa-check-circle text-green-500' : 'fa-circle text-slate-200'}`}></i>
                      {FIELD_LABELS[field]}
                    </label>
                    <select
                      className={`w-full bg-white border-2 rounded-xl px-4 py-3 text-xs font-black outline-none transition-all ${
                        mapping[field] ? 'border-blue-500 text-blue-700' : 'border-slate-200 text-slate-400'
                      }`}
                      value={mapping[field] || ''}
                      onChange={e => setMapping({ ...mapping, [field]: e.target.value })}
                    >
                      <option value="">-- SELECIONAR COLUNA --</option>
                      {headers.map((h, i) => (
                        <option key={i} value={h}>
                          {h.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 pt-6">
                <button onClick={() => setStep('upload')} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs">
                  Cancelar
                </button>
                <button
                  onClick={() => setStep('preview')}
                  disabled={!mapping['nome'] || !mapping['matr'] || !mapping['ant']}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl disabled:opacity-50"
                >
                  Conferir Dados
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 text-[11px] text-amber-900 font-bold flex items-center gap-4">
                <i className="fas fa-info-circle text-xl"></i>
                <div>
                  <p className="uppercase">Validação de Integridade Ativa</p>
                  <p className="opacity-70">
                    A antiguidade será importada como número inteiro e as unidades serão normalizadas.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-900 text-white font-black uppercase tracking-widest">
                    <tr>{REQUIRED_FIELDS_KEYS.map(f => <th key={f} className="p-4">{FIELD_LABELS[f]}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fileData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {REQUIRED_FIELDS_KEYS.map(field => {
                          const hName = mapping[field];
                          const colIdx = headers.indexOf(hName);
                          let val = colIdx !== -1 ? row[colIdx] : '-';
                          if (field === 'ant') val = parseInt(String(val).replace(/\D/g, '')) || 0;
                          if (field === 'grad') val = normalizeRank(String(val));
                          if (field === 'unid') val = normalizeUnit(String(val));
                          return (
                            <td key={field} className="p-4 font-bold text-slate-700 uppercase">
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setStep('mapping')} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs">
                  Ajustar Mapeamento
                </button>
                <button
                  onClick={processImport}
                  className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl"
                >
                  Finalizar Importação
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
