import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
// @ts-ignore
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

// ✅ Declarações locais para evitar erros TS
declare const GlobalWorkerOptions: any;
declare function getDocument(params: any): any;

import { Personnel, Rank, LeaveRecord } from '../types';

// ✅ Matrícula só dígitos
const normalizeMatriculaDigits = (value: string): string => {
  return (value ?? '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\D/g, '');
};

// @ts-ignore
(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version}/pdf.worker.min.js`;


interface ImportModalProps {
  onClose: () => void;
  onImport: (data: Omit<Personnel, 'id'>[]) => Promise<void>;
  existingPersonnel?: Personnel[];
  onFullRestore?: (data: Personnel[]) => void;
}

type Step = 'upload' | 'mapping' | 'preview';

const FIELD_LABELS: Record<string, string> = {
  ant: 'Antiguidade',
  grad: 'Patente/Posto',
  quadro: 'Quadro',
  nome: 'Nome Completo',
  matr: 'Matrícula',
  unid: 'Unidade',
  secao: 'Seção',
  situacao: 'Situação',
  esc: 'Escala',
};

const REQUIRED_FIELDS_KEYS = ['ant', 'grad', 'quadro', 'nome', 'matr', 'unid', 'secao', 'situacao', 'esc'] as const;
type RequiredFieldKey = typeof REQUIRED_FIELDS_KEYS[number];

const normalizeRank = (value: string): Rank => {
  const r = (value ?? '').toUpperCase().replace(/\s+/g, ' ').trim();

  if (r.includes('CEL') || r.includes('CORONEL')) return 'CEL';
  if (r.includes('TEN') && r.includes('COR')) return 'TC';
  if (r.includes('TC')) return 'TC';
  if (r.includes('MAJ')) return 'MAJ';
  if (r.includes('CAP')) return 'CAP';
  if ((r.includes('1') && r.includes('TEN')) || r.includes('1ºTEN')) return '1º TEN';
  if ((r.includes('2') && r.includes('TEN')) || r.includes('2ºTEN')) return '2º TEN';
  if (r.includes('ASP')) return 'ASP';
  if (r.includes('CAD')) return 'CAD';
  if (r.includes('SUB') || r === 'ST') return 'ST';
  if (r.includes('1') && r.includes('SGT')) return '1º SGT';
  if (r.includes('2') && r.includes('SGT')) return '2º SGT';
  if (r.includes('3') && r.includes('SGT')) return '3º SGT';
  if (r.includes('CB') || r.includes('CABO')) return 'CB';
  if (r.includes('SD') || r.includes('SOLD')) return 'SD';

  return 'SD';
};

const normalizeUnit = (value: string): string => {
  const u = (value ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
  // Você pode reforçar padrões aqui se quiser
  return u;
};

const normalizeTextUpper = (value: any): string => {
  return String(value ?? '').toUpperCase().replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
};

const parseIntSafe = (value: any): number => {
  const n = parseInt(String(value ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Parser para linha do "Mapa de Força" (PDF)
 * Exemplo comum:
 *  123 SD QPPMC NOME COMPLETO 199.727/0 DLF SECAO ATIVO EXP
 */
const parseMapaForcaLine = (line: string): Omit<Personnel, 'id'> | null => {
  const fullLine = line.replace(/\s+/g, ' ').trim();
  const tokens = fullLine.split(' ').filter(Boolean);

  // Deve iniciar com antiguidade numérica
  if (!tokens[0] || !/^\d+$/.test(tokens[0])) return null;

  // Captura matrícula em formatos comuns (com . e / ou -), depois normaliza pra dígitos
  const matrMatch = fullLine.match(/(\d{2,3}\.\d{3}[\/\-][0-9X]{1})/);
  if (!matrMatch) return null;

  const matrRaw = matrMatch[1];
  const matrDigits = normalizeMatriculaDigits(matrRaw);
  if (!matrDigits) return null;

  // Tenta identificar quadro: normalmente token que contém QP... (QOPMA/QPPMC etc.)
  const quadroIdx = tokens.findIndex((t) => /^Q[A-Z0-9]{2,}$/i.test(t));
  if (quadroIdx === -1) return null;

  const ant = parseIntSafe(tokens[0]);
  const grad = normalizeRank(tokens[1] || '');
  const quadro = normalizeTextUpper(tokens[quadroIdx]);

  // Nome fica entre "quadro" e "matrícula"
  const idxMatrInLine = fullLine.indexOf(matrRaw);
  const idxQuadroInLine = fullLine.indexOf(tokens[quadroIdx]);
  if (idxMatrInLine === -1 || idxQuadroInLine === -1) return null;

  const nomeBruto = fullLine
    .substring(idxQuadroInLine + tokens[quadroIdx].length, idxMatrInLine)
    .replace(/\s+/g, ' ')
    .trim();

  if (!nomeBruto || nomeBruto.length < 3) return null;

  // Depois da matrícula: unid, secao, situacao, esc (quando existir)
  const restPart = fullLine.substring(idxMatrInLine + matrRaw.length).trim();
  const restTokens = restPart.split(/\s+/).filter(Boolean);

  const unid = normalizeUnit(restTokens[0] || '');
  const secao = normalizeTextUpper(restTokens[1] || '');
  const situacao = normalizeTextUpper(restTokens[2] || 'ATIVO');
  const esc = normalizeTextUpper(restTokens[3] || 'EXP');

  return {
    ant,
    grad,
    quadro,
    nome: normalizeTextUpper(nomeBruto),
    matr: matrDigits, // ✅ só dígitos
    unid,
    secao,
    situacao,
    esc,
    saldoFerias: 30,
    saldoAbono: 5,
    role: 'USER',
    password: '',
    mustChangePassword: true,
  };
};

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport, onFullRestore }) => {
  const [step, setStep] = useState<Step>('upload');

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorLog, setErrorLog] = useState<string | null>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [fileData, setFileData] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const isMappingValid = useMemo(() => {
    return REQUIRED_FIELDS_KEYS.every((k) => Boolean(mapping[k]));
  }, [mapping]);

  const preview = useMemo(() => {
    const nomeH = mapping['nome'];
    const matrH = mapping['matr'];
    const nomeIdx = headers.indexOf(nomeH);
    const matrIdx = headers.indexOf(matrH);
    const rows = fileData.slice(0, 10);
    return { nomeIdx, matrIdx, rows };
  }, [fileData, headers, mapping]);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setErrorLog(null);

    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      // Restore completo via JSON (opcional)
      if (ext === 'json' && onFullRestore) {
        const text = await file.text();
        onFullRestore(JSON.parse(text));
        onClose();
        return;
      }

      const buffer = await file.arrayBuffer();

      // PDF
      if (ext === 'pdf') {
        const pdf = await getDocument({ data: buffer }).promise;
        const result: Omit<Personnel, 'id'>[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();

          // Agrupa por linhas (Y), com threshold de ~5px
          const itemsByY: Record<number, any[]> = {};
          (textContent.items as any[]).forEach((item: any) => {
            const y = item.transform?.[5] ?? 0;

            const existingY = Object.keys(itemsByY)
              .map(Number)
              .find((yy) => Math.abs(yy - y) <= 5);

            const key = existingY ?? y;
            if (!itemsByY[key]) itemsByY[key] = [];
            itemsByY[key].push(item);
          });

          const sortedY = Object.keys(itemsByY)
            .map(Number)
            .sort((a, b) => b - a);

          for (const y of sortedY) {
            const rowItems = itemsByY[y].sort((a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0));
            const line = rowItems.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();

            if (line && /^\d+/.test(line)) {
              const parsed = parseMapaForcaLine(line);
              if (parsed) result.push(parsed);
            }
          }
        }

        if (result.length > 0) {
          onImport(result);
          onClose();
        } else {
          setErrorLog(
            "Não foi possível extrair dados válidos do PDF. Verifique se o arquivo é um 'Mapa de Força' original."
          );
        }
        return;
      }

      // Excel / CSV
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      if (!json || json.length < 2) {
        setErrorLog('Planilha vazia ou sem dados.');
        return;
      }

      // Detecta linha de cabeçalho (primeira linha com "NOME" ou "MATR")
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(10, json.length); i++) {
        const row = json[i] ?? [];
        const joined = row.map((c) => String(c ?? '').toUpperCase()).join(' ');
        if (joined.includes('NOME') || joined.includes('MATR')) {
          headerRowIndex = i;
          break;
        }
      }

      const detectedHeaders = (json[headerRowIndex] ?? []).map((h, i) => String(h || `Coluna ${i + 1}`));
      const rows = json.slice(headerRowIndex + 1);

      setHeaders(detectedHeaders);
      setFileData(rows);
      setStep('mapping');

      // Auto-map simples
      const newMapping: Record<string, string> = {};
      detectedHeaders.forEach((h) => {
        const v = String(h).toUpperCase();
        if (v.includes('NOME')) newMapping['nome'] = h;
        if (v.includes('MATR')) newMapping['matr'] = h;
        if (v.includes('GRAD') || v.includes('PATENTE') || v.includes('POSTO')) newMapping['grad'] = h;
        if (v.includes('ANT')) newMapping['ant'] = h;
        if (v.includes('UNID')) newMapping['unid'] = h;
        if (v.includes('QUAD')) newMapping['quadro'] = h;
        if (v.includes('SEC')) newMapping['secao'] = h;
        if (v.includes('SIT')) newMapping['situacao'] = h;
        if (v.includes('ESC')) newMapping['esc'] = h;
      });

      setMapping((prev) => ({ ...prev, ...newMapping }));
    } catch (err) {
      console.error(err);
      setErrorLog('Erro ao processar arquivo. Tente outro formato ou verifique o arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const finalizeExcelImport = () => {
    if (!isMappingValid) {
      setErrorLog('Mapeamento incompleto. Vincule todos os campos obrigatórios.');
      return;
    }

    const data = fileData
      .map((row) => {
        const item: any = {
          saldoFerias: 30,
          saldoAbono: 5,
          role: 'USER',
          password: '',
          mustChangePassword: true,
        };

        REQUIRED_FIELDS_KEYS.forEach((field) => {
          const headerName = mapping[field];
          const idx = headers.indexOf(headerName);
          const val = idx !== -1 ? row[idx] : '';

          if (field === 'ant') item[field] = parseIntSafe(val);
          else if (field === 'grad') item[field] = normalizeRank(String(val));
          else if (field === 'unid') item[field] = normalizeUnit(String(val));
          else if (field === 'matr') item[field] = normalizeMatriculaDigits(String(val)); // ✅ só dígitos
          else item[field] = normalizeTextUpper(val);
        });

        return item;
      })
      .filter((p) => p.nome && p.matr && String(p.nome).length > 2 && String(p.matr).length >= 6);

    if (data.length === 0) {
      setErrorLog('Nenhum registro válido foi encontrado após a normalização.');
      return;
    }

    onImport(data);
    onClose();
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFileUpload(file);
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileUpload(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <i className="fas fa-file-import" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight">Importação de Dados</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                PDF (Mapa de Força) • Excel • CSV • Matrícula somente dígitos
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <i className="fas fa-times text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-auto">
          {errorLog && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-start gap-3">
              <i className="fas fa-circle-exclamation mt-0.5" />
              <span>{errorLog}</span>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center bg-slate-50"
              >
                <i className="fas fa-cloud-arrow-up text-3xl text-slate-400" />
                <h4 className="mt-4 text-sm font-black uppercase text-slate-700">Envie seu arquivo</h4>
                <p className="mt-2 text-xs text-slate-500">
                  Arraste e solte um PDF original (Mapa de Força) ou uma planilha (Excel/CSV).
                </p>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <label className="px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.xlsx,.xls,.csv,.json"
                      className="hidden"
                      onChange={onPickFile}
                      disabled={isProcessing}
                    />
                    {isProcessing ? 'Processando...' : 'Selecionar arquivo'}
                  </label>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900">
                <p className="font-black uppercase tracking-widest text-[10px]">Importante</p>
                <p className="mt-1">
                  A matrícula será salva <strong>apenas com dígitos</strong>. Exemplos:
                  <br />
                  <span className="font-mono">199.727/0</span> → <span className="font-mono">1997270</span>
                  <br />
                  <span className="font-mono">123.456-7</span> → <span className="font-mono">1234567</span>
                </p>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
                <h4 className="text-sm font-black text-blue-900 uppercase">Vinculação de Colunas</h4>
                <p className="text-xs text-blue-800 mt-1">
                  Selecione qual coluna da planilha corresponde a cada campo.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {REQUIRED_FIELDS_KEYS.map((field) => (
                  <div key={field} className="bg-white border border-slate-200 rounded-2xl p-4">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      {FIELD_LABELS[field]}
                    </label>
                    <select
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                      value={mapping[field] ?? ''}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value }))}
                    >
                      <option value="">-- Selecione --</option>
                      {headers.map((h, i) => (
                        <option key={`${h}-${i}`} value={h}>
                          {String(h).toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-widest"
                >
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={() => setStep('preview')}
                  disabled={!isMappingValid}
                  className="px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                >
                  Pré-visualizar
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="bg-slate-900 rounded-2xl p-5 text-white">
                <h4 className="text-sm font-black uppercase">Prévia</h4>
                <p className="text-xs text-white/70 mt-1">
                  Mostrando até 10 registros. A matrícula será importada apenas com dígitos.
                </p>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                    <tr>
                      <th className="p-3">Nome</th>
                      <th className="p-3">Matrícula (digits)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.map((row, idx) => {
                      const nome = preview.nomeIdx >= 0 ? row[preview.nomeIdx] : '';
                      const matrRaw = preview.matrIdx >= 0 ? row[preview.matrIdx] : '';
                      const matrDigits = normalizeMatriculaDigits(String(matrRaw ?? ''));

                      return (
                        <tr key={idx}>
                          <td className="p-3 font-semibold uppercase text-slate-800">
                            {normalizeTextUpper(nome)}
                          </td>
                          <td className="p-3 font-mono text-slate-600">
                            {matrDigits || <span className="text-red-600 font-bold">inválida</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setStep('mapping')}
                  className="px-4 py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-widest"
                >
                  Ajustar mapeamento
                </button>

                <button
                  type="button"
                  onClick={finalizeExcelImport}
                  className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                >
                  Importar {fileData.length} registros
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
          Dica: se algum login falhar, verifique se a matrícula no cadastro ficou só com números.
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
