import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { Personnel } from '../types';

interface PersonnelEditModalProps {
    initialData: Personnel | null;
    onClose: () => void;
    onSave: () => void;
}

const normalizeMatricula = (raw: any) => (raw ?? "").toString().trim().replace(/\D/g, "");

// Opções pré-definidas para os selects
const RANKS = [
    'CEL', 'TC', 'MAJ', 'CAP', '1º TEN', '2º TEN', 'ASP', 'CAD',
    'ST', '1º SGT', '2º SGT', '3º SGT', 'CB', 'SD', 'F.CIVIL'
];
// Quadro removido das opções fixas a pedido do usuário, volta a ser texto livre ou conforme necessidade futura.
const UNITS = ['CMAN', 'CMBEL', 'DLF', 'DINFRA', 'DALF', 'DPTS'];
const SITUATIONS = ['PTTC', 'DISPOSIÇÃO', 'CEDIDO', 'FUNCIONÁRIO CIVIL', 'COND. D'];
const SCALES = ['EXPEDIENTE', '12x36A', '12x36B'];
const ROLES = ['USER', 'ADMIN', 'ADMINISTRADOR'];

const PersonnelEditModal: React.FC<PersonnelEditModalProps> = ({ initialData, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<Personnel>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (initialData && initialData.id) {
            setFormData({ ...initialData });
        } else {
            // Default values for new entry
            setFormData({
                role: "USER",
                situacao: "", // Removido 'ATIVO' das opções padrão, deixando vazio ou a criterio
                ant: 0,
                ativo: true,
                grad: "SD",
                quadro: "QPRA",
                nome: "",
                matr: "",
                unid: "DLF",
                secao: "",
                funcao: "",
                restr: "",
                pttc: false,
                esc: "EXPEDIENTE"
            });
        }
    }, [initialData]);

    const handleChange = (field: keyof Personnel, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        try {
            if (!formData.nome || !formData.matr) {
                alert("Nome e Matrícula são obrigatórios.");
                return;
            }

            setIsSaving(true);
            const payload: any = { ...formData };
            payload.matr = normalizeMatricula(payload.matr);
            payload.matr_norm = payload.matr_norm ? normalizeMatricula(payload.matr_norm) : payload.matr;

            // Ensure number for 'ant'
            if (typeof payload.ant !== 'number') {
                payload.ant = parseInt(payload.ant) || 0;
            }

            if (payload.id) {
                await db.personnel.put(payload as Personnel);
            } else {
                if (!payload.id) delete payload.id;
                await db.personnel.add(payload as Personnel);
            }

            onSave();
            onClose();
        } catch (error) {
            console.error("Error saving personnel:", error);
            alert("Erro ao salvar dados.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-800">
                        {initialData?.id ? 'Editar Militar' : 'Novo Militar'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Matrícula</label>
                            <input
                                type="text"
                                value={formData.matr || ''}
                                onChange={(e) => handleChange('matr', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 font-semibold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Patente / Graduação</label>
                            <select
                                value={formData.grad || ''}
                                onChange={(e) => handleChange('grad', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 font-semibold bg-white"
                            >
                                <option value="">Selecione...</option>
                                {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quadro</label>
                            <input
                                type="text"
                                value={formData.quadro || ''}
                                onChange={(e) => handleChange('quadro', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 font-semibold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Antiguidade (0 = maior)</label>
                            <input
                                type="number"
                                value={formData.ant || 0}
                                onChange={(e) => handleChange('ant', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 font-semibold"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                        <input
                            type="text"
                            value={formData.nome || ''}
                            onChange={(e) => handleChange('nome', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 font-bold"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade</label>
                            <select
                                value={formData.unid || ''}
                                onChange={(e) => handleChange('unid', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 font-semibold bg-white"
                            >
                                <option value="">Selecione...</option>
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Seção</label>
                            <input
                                type="text"
                                value={formData.secao || ''}
                                onChange={(e) => handleChange('secao', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 font-semibold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Situação</label>
                            <select
                                value={formData.situacao || ''}
                                onChange={(e) => handleChange('situacao', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 font-semibold bg-white"
                            >
                                <option value="">Selecione...</option>
                                {SITUATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Função</label>
                            <input
                                type="text"
                                value={formData.funcao || ''}
                                onChange={(e) => handleChange('funcao', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 font-semibold"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role (Permissão)</label>
                            <select
                                value={formData.role || 'USER'}
                                onChange={(e) => handleChange('role', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 font-semibold bg-white"
                            >
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Escala</label>
                            <select
                                value={formData.esc || ''}
                                onChange={(e) => handleChange('esc', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 font-semibold bg-white"
                            >
                                <option value="">Selecione...</option>
                                {SCALES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                        disabled={isSaving}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors flex items-center gap-2"
                    >
                        {isSaving && <i className="fas fa-circle-notch animate-spin"></i>}
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PersonnelEditModal;
