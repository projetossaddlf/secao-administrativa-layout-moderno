import React, { useMemo, useState } from 'react';
import { Personnel } from '../types';
import { supabase } from '../supabaseClient';

interface PasswordChangeProps {
  user: Personnel;
  onPasswordUpdated: (updatedUser: Personnel) => void;
}

function normalizeAuthError(err: any): string {
  const status = err?.status ?? err?.code ?? '';
  const msg =
    err?.message ||
    err?.error_description ||
    err?.error ||
    'Não foi possível atualizar a senha.';

  // Mensagens comuns do Supabase/GoTrue (variam por versão)
  const m = String(msg).toLowerCase();

  if (String(status) === '422') {
    if (m.includes('different') && m.includes('password')) {
      return 'A nova senha não pode ser igual à senha atual.';
    }
    if (m.includes('weak') || m.includes('strength')) {
      return 'Senha considerada fraca pelo Supabase. Aumente o tamanho e a complexidade.';
    }
    if (m.includes('at least') && m.includes('characters')) {
      return msg; // geralmente já vem dizendo o mínimo exigido
    }
    return `Senha rejeitada pelo Supabase (422): ${msg}`;
  }

  if (String(status) === '401') return 'Sessão expirada. Faça login novamente.';
  if (String(status) === '400') return msg;

  return msg;
}

const PasswordChange: React.FC<PasswordChangeProps> = ({ user, onPasswordUpdated }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const cleanNewPassword = useMemo(() => newPassword.trim(), [newPassword]);
  const cleanConfirmPassword = useMemo(() => confirmPassword.trim(), [confirmPassword]);

  // ✅ Mantive seus requisitos, mas adicionei "sem espaços" (causa rejeição em algumas políticas)
  const validations = useMemo(() => {
    const pwd = cleanNewPassword;
    return {
      length: pwd.length >= 8,
      upper: /[A-Z]/.test(pwd),
      lower: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      noSpaces: !/\s/.test(pwd),
      match: pwd !== '' && pwd === cleanConfirmPassword,
    };
  }, [cleanNewPassword, cleanConfirmPassword]);

  const isFormValid = Object.values(validations).every(Boolean);

  async function clearMustChangePasswordFlag(matr: string | number) {
    // tenta camelCase
    const tryCamel = await supabase
      .from('personnel')
      .update({ mustChangePassword: false })
      .eq('matr', matr);

    if (!tryCamel.error) return;

    // se falhar por coluna inexistente, tenta snake_case
    const msg = String(tryCamel.error.message ?? '');
    const seemsColumnMissing =
      msg.toLowerCase().includes('does not exist') ||
      msg.toLowerCase().includes('unknown') ||
      msg.toLowerCase().includes('column');

    if (seemsColumnMissing) {
      const trySnake = await supabase
        .from('personnel')
        .update({ must_change_password: false })
        .eq('matr', matr);

      if (trySnake.error) throw trySnake.error;
      return;
    }

    throw tryCamel.error;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsLoading(true);
    setError('');

    try {
      // 0) Sessão precisa existir (senão updateUser pode falhar ou ficar inconsistente)
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      if (!sessionData.session) {
        throw { status: 401, message: 'Sessão expirada. Faça login novamente.' };
      }

      // 1) Atualiza senha no Supabase Auth
      const { error: authErr } = await supabase.auth.updateUser({ password: cleanNewPassword });
      if (authErr) throw authErr;

      // 2) (opcional mas ajuda) refresh de sessão após mudança de credencial
      await supabase.auth.refreshSession();

      // 3) Desmarca obrigação de troca na sua tabela
      await clearMustChangePasswordFlag(user.matr);

      const updatedUser: Personnel = {
        ...user,
        mustChangePassword: false,
        // se seu type tiver snake_case, não precisa setar aqui
      };

      onPasswordUpdated(updatedUser);
    } catch (err: any) {
      // 🔎 Log útil pra você ver exatamente o que o Supabase devolveu
      console.error('[PasswordChange] update failed:', err);
      setError(normalizeAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const ValidationItem = ({ label, met }: { label: string; met: boolean }) => (
    <div className={`flex items-center gap-2 text-[10px] font-bold uppercase transition-colors ${met ? 'text-green-600' : 'text-slate-400'}`}>
      <i className={`fas ${met ? 'fa-check-circle' : 'fa-circle-dot opacity-30'} text-xs`}></i>
      {label}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        <div className="bg-blue-600 p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30 backdrop-blur-sm">
            <i className="fas fa-key text-2xl"></i>
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight">Primeiro Acesso</h3>
          <p className="text-blue-100 text-xs font-medium mt-1">
            Por segurança, você deve criar uma nova senha pessoal para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs font-semibold">
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Nova Senha</label>
              <input
                type="password"
                placeholder="Mínimo 8 caracteres"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Confirmar Senha</label>
              <input
                type="password"
                placeholder="Repita a nova senha"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Requisitos de Segurança:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2">
              <ValidationItem label="8+ Caracteres" met={validations.length} />
              <ValidationItem label="Letra Maiúscula" met={validations.upper} />
              <ValidationItem label="Letra Minúscula" met={validations.lower} />
              <ValidationItem label="Caractere Especial" met={validations.special} />
              <ValidationItem label="Número" met={validations.number} />
              <ValidationItem label="Sem Espaços" met={validations.noSpaces} />
              <ValidationItem label="Senhas Coincidem" met={validations.match} />
            </div>
          </div>

          <button
            type="submit"
            disabled={!isFormValid || isLoading}
            className={`w-full font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
              isFormValid
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 active:scale-95'
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            {isLoading ? <i className="fas fa-circle-notch animate-spin"></i> : 'ATUALIZAR SENHA'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordChange;
