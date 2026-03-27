import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db';
import { VirtualTeam, TeamComposition, Rank, Personnel } from '../types';

const RANKS: Rank[] = [
    'CEL', 'TC', 'MAJ', 'CAP', '1º TEN', '2º TEN', 'ASP', 'ST',
    '1º SGT', '2º SGT', '3º SGT', 'CB', 'SD'
];

export default function VirtualBattalionManager() {
    const [teams, setTeams] = useState<VirtualTeam[]>([]);
    const [allPersonnel, setAllPersonnel] = useState<Personnel[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState<VirtualTeam | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [composition, setComposition] = useState<TeamComposition[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [teamsData, personnelData] = await Promise.all([
                db.virtualTeams.toArray(),
                db.personnel.toArray()
            ]);
            setTeams(teamsData);
            setAllPersonnel(personnelData);
        } catch (error) {
            console.error("Error loading data:", error);
            alert("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    const eligiblePersonnel = useMemo(() => {
        return allPersonnel.filter(p => p.situacao === 'COND. D');
    }, [allPersonnel]);

    const handleOpenModal = (team?: VirtualTeam) => {
        console.log("handleOpenModal called with:", team);
        if (team) {
            setEditingTeam(team);
            setName(team.name || '');
            // Garante que é um array e faz clone profundo simples para evitar mutação indesejada
            const comp = Array.isArray(team.composition) ? team.composition.map(c => ({ ...c })) : [];
            setComposition(comp);
            setSelectedMembers(team.members || []);
        } else {
            console.log("Opening for new team");
            setEditingTeam(null);
            setName('');
            setComposition([]);
            setSelectedMembers([]);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTeam(null);
        setName('');
        setComposition([]);
        setSelectedMembers([]);
    };

    const addCompositionRow = () => {
        setComposition([...composition, { rank: 'SD', count: 1 }]);
    };

    const removeCompositionRow = (index: number) => {
        const newComp = [...composition];
        newComp.splice(index, 1);
        setComposition(newComp);
    };

    const updateCompositionRow = (index: number, field: keyof TeamComposition, value: any) => {
        const newComp = [...composition];
        newComp[index] = { ...newComp[index], [field]: value };
        setComposition(newComp);
    };

    const toggleMember = (personId: string) => {
        setSelectedMembers(prev =>
            prev.includes(personId)
                ? prev.filter(id => id !== personId)
                : [...prev, personId]
        );
    };

    const handleSave = async () => {
        if (!name.trim()) return alert("Nome é obrigatório");
        if (composition.length === 0) return alert("Adicione pelo menos uma composição");

        try {
            const teamData = {
                name,
                composition,
                members: selectedMembers
            };

            if (editingTeam) {
                await db.virtualTeams.put({ ...editingTeam, ...teamData });
            } else {
                await db.virtualTeams.add(teamData);
            }

            handleCloseModal();
            loadData();
        } catch (error) {
            console.error("Error saving team:", error);
            alert("Erro ao salvar batalhão virtual.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este batalhão?")) return;
        try {
            await db.virtualTeams.delete(id);
            loadData();
        } catch (error) {
            console.error("Error deleting team:", error);
            alert("Erro ao excluir batalhão.");
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                        Gerenciamento de Batalhão Virtual
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Defina as equipes e a composição necessária (patente e quantidade) para cada uma.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
                >
                    <i className="fas fa-plus"></i>
                    Novo Batalhão
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-400">Carregando...</div>
            ) : teams.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400">
                    Nenhum batalhão virtual cadastrado.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teams.map((team) => (
                        <div key={team.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <h3 className="text-lg font-bold text-slate-800">{team.name}</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => handleOpenModal(team)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                        <i className="fas fa-edit"></i>
                                    </button>
                                    <button onClick={() => handleDelete(team.id)} className="text-slate-400 hover:text-rose-600 transition-colors">
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex-1">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Composição</h4>
                                <div className="space-y-2">
                                    {team.composition.map((comp, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-sm">
                                            <span className="font-semibold text-slate-700">{comp.rank}</span>
                                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-bold text-xs">
                                                {comp.count}x
                                            </span>
                                        </div>
                                    ))}
                                    <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-500">
                                        <span>TOTAL</span>
                                        <span>{team.composition.reduce((acc, curr) => acc + Number(curr.count), 0)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mt-2">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Membros Escalados</h4>
                                    <span className="text-xs font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
                                        {(team.members || []).length}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {(team.members || []).map(memberId => {
                                        const person = allPersonnel.find(p => p.id === memberId);
                                        return person ? (
                                            <span key={memberId} className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-medium" title={person.nome}>
                                                {person.grad} {person.nome.split(' ')[0]}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">
                                {editingTeam ? 'Editar Batalhão' : 'Novo Batalhão'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                                <i className="fas fa-times text-xl"></i>
                            </button>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Left Column: Config */}
                            <div className="w-1/2 p-6 overflow-y-auto border-r border-slate-100 space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Nome da Equipe / Batalhão</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Ex: Patrulha Bravo"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="block text-sm font-bold text-slate-700">Composição Definida</label>
                                        <button
                                            onClick={addCompositionRow}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                                        >
                                            + Adicionar
                                        </button>
                                    </div>

                                    {composition.length === 0 ? (
                                        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                                            Nenhuma composição definida.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {composition.map((row, idx) => (
                                                <div key={idx} className="flex items-center gap-3">
                                                    <select
                                                        value={row.rank}
                                                        onChange={(e) => updateCompositionRow(idx, 'rank', e.target.value)}
                                                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 text-sm"
                                                    >
                                                        {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                                                    </select>

                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-slate-500">Qtd:</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={row.count}
                                                            onChange={(e) => updateCompositionRow(idx, 'count', parseInt(e.target.value) || 0)}
                                                            className="w-20 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 text-sm"
                                                        />
                                                    </div>

                                                    <button
                                                        onClick={() => removeCompositionRow(idx)}
                                                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                    >
                                                        <i className="fas fa-trash-alt"></i>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Member Selection */}
                            <div className="w-1/2 p-6 overflow-y-auto bg-slate-50/50">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800">Escalar Membros</h4>
                                        <p className="text-xs text-slate-500">Apenas situação 'COND. D'</p>
                                    </div>
                                    <div className="text-xs font-bold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
                                        {selectedMembers.length} selecionados
                                    </div>
                                </div>

                                {eligiblePersonnel.length === 0 ? (
                                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                                        Nenhum militar em 'COND. D' encontrado no efetivo.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {eligiblePersonnel.map(p => {
                                            const isSelected = selectedMembers.includes(p.id);
                                            return (
                                                <div
                                                    key={p.id}
                                                    onClick={() => toggleMember(p.id)}
                                                    className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between transition-all ${isSelected
                                                            ? 'bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-200'
                                                            : 'bg-white border-slate-200 hover:border-indigo-300'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {p.grad}
                                                        </div>
                                                        <div>
                                                            <p className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                                                {p.nome}
                                                            </p>
                                                            <p className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                                {p.matr}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {isSelected && <i className="fas fa-check-circle text-white"></i>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={handleCloseModal}
                                className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-5 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
