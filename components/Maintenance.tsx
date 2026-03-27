import React, { useState } from 'react';
import { db } from '../db';

interface MaintenanceProps {
  onRestoreComplete?: () => void; // ✅ opcional (não muda layout)
}

const Maintenance: React.FC<MaintenanceProps> = ({ onRestoreComplete }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await db.exportFullBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `backup_saddlf_${timestamp}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Erro ao exportar dados.');
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("ATENÇÃO: Restaurar um backup irá APAGAR todos os dados atuais e substituí-los pelo conteúdo do arquivo. Deseja continuar?")) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // ✅ Validação tolerante (aceita formato novo e legado)
      // Novo: { version, exportedAt, tables: { personnel, leaves, role_configs } }
      // Legado: { personnel, leaves, role_configs }
      const tables = (data as any)?.tables ?? data;

      const personnelArr = (tables as any)?.personnel;
      const leavesArr = (tables as any)?.leaves;
      const roleConfigsArr = (tables as any)?.role_configs ?? (tables as any)?.roleConfigs;

      const hasValidShape =
        Array.isArray(personnelArr) ||
        Array.isArray(leavesArr) ||
        Array.isArray(roleConfigsArr);

      if (!hasValidShape) {
        throw new Error("Formato de arquivo inválido.");
      }

      // ✅ Import correto (db.ts atual)
      await db.importFullBackup(data);

      alert('Restauração concluída com sucesso! A aplicação será atualizada.');
      if (typeof onRestoreComplete === "function") onRestoreComplete();
    } catch (error) {
      alert('Erro ao restaurar dados: ' + (error instanceof Error ? error.message : 'Arquivo corrompido ou inválido.'));
      console.error(error);
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card de Exportação */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mb-6">
            <i className="fas fa-file-export"></i>
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Exportar Dados</h3>
          <p className="text-sm text-slate-500 font-medium mt-2 leading-relaxed">
            Gere um arquivo de backup completo contendo todo o efetivo, histórico de lançamentos e configurações de acesso. 
            Útil para migração de computador ou salvaguarda semanal.
          </p>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            {isExporting ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-download"></i>}
            <span>GERAR BACKUP JSON</span>
          </button>
        </div>

        {/* Card de Restauração */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl mb-6">
            <i className="fas fa-cloud-arrow-up"></i>
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Restaurar / Migrar</h3>
          <p className="text-sm text-slate-500 font-medium mt-2 leading-relaxed">
            Importe um arquivo de backup para restaurar o sistema. 
            <span className="text-red-500 font-bold block mt-1">Isso apagará permanentemente todos os dados atuais.</span>
          </p>
          
          <div className="relative mt-8">
            <input 
              type="file" 
              accept=".json" 
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              onChange={handleImport}
              disabled={isRestoring}
            />
            <div className="bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3">
              {isRestoring ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-upload"></i>}
              <span>CARREGAR ARQUIVO DE BACKUP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Maintenance;
