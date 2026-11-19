'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseNavegador } from '@/lib/supabase/client';
import { btn, campo } from '@/components/ui';

export default function NovaSenha() {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const router = useRouter();
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    const { error } = await supabaseNavegador().auth.updateUser({ password: senha });
    if (error) return setErro(error.message);
    router.replace('/?msg=' + encodeURIComponent('Senha alterada.'));
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={salvar} className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-cinza-borda bg-white p-6">
        <h1 className="text-lg font-extrabold">Criar nova senha</h1>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-cinza-texto">Nova senha
          <input className={campo} type="password" minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" required />
        </label>
        {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{erro}</p>}
        <button className={btn}>Salvar</button>
      </form>
    </main>
  );
}
