import React, { useState } from "react";
import { User, Lock, Save, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { translateFirebaseError } from "../lib/errorTranslations";

export default function Profile({ user, onUpdateUser }: any) {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    professionalCouncil: user?.professionalCouncil || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: "error", text: "As senhas não coincidem." });
      return;
    }

    if (formData.newPassword && formData.currentPassword !== user.password) {
      setMessage({ type: "error", text: "Senha atual incorreta." });
      return;
    }

    try {
      setLoading(true);
      const updatedData: any = { 
        name: formData.name,
        professionalCouncil: formData.professionalCouncil 
      };
      
      if (formData.newPassword) {
        updatedData.password = formData.newPassword;
      }

      if (user.id === 'super_admin') {
        // Special case for hardcoded super admin: create record if it doesn't exist
        const existing = await api.users.findByEmail('administrador');
        if (existing) {
          await api.users.update(existing.id, updatedData);
        } else {
          await api.users.create({
            ...updatedData,
            email: 'administrador',
            role: 'admin',
            permissions: ['dashboard', 'students', 'import_students', 'appointments', 'documents', 'reports', 'settings', 'admin'],
            status: 'active'
          });
        }
      } else {
        await api.users.update(user.id, updatedData);
      }

      onUpdateUser({ ...user, ...updatedData });
      setMessage({ type: "success", text: "Perfil atualizado com sucesso!" });
      setFormData(prev => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }));
    } catch (err) {
      setMessage({ type: "error", text: "Erro ao atualizar perfil: " + translateFirebaseError(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center gap-5">
        <div className="bg-gradient-to-br from-pedagogic-blue to-blue-700 text-white p-4 rounded-[1.5rem] shadow-xl shadow-blue-100">
          <User size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Meu Perfil</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Gerencie suas informações de acesso</p>
        </div>
      </div>

      <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-pedagogic-blue/5 rounded-full -mr-16 -mt-16 blur-2xl" />
        
        {message.text && (
          <div className={`mb-8 p-4 rounded-2xl text-sm font-bold flex items-center gap-3 ${
            message.type === "success" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
          }`}>
            <ShieldCheck size={18} />
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" 
                  required
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Registro Profissional / Conselho</label>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" 
                  placeholder="Ex: CRP 02/12345"
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all"
                  value={formData.professionalCouncil}
                  onChange={e => setFormData({ ...formData, professionalCouncil: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">E-mail (Login)</label>
              <input 
                type="text" 
                disabled
                className="w-full px-6 py-4 bg-gray-100 border border-slate-100 rounded-2xl font-bold text-slate-400 cursor-not-allowed"
                value={user?.email === 'administrador' ? 'administrador (Super Admin)' : user?.email}
              />
            </div>

            <div className="pt-6 border-t border-slate-50">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Lock size={16} className="text-pedagogic-blue" />
                Alterar Senha
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Senha Atual</label>
                  <input 
                    type="password" 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all"
                    placeholder="Necessário para alterar a senha"
                    value={formData.currentPassword}
                    onChange={e => setFormData({ ...formData, currentPassword: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nova Senha</label>
                  <input 
                    type="password" 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.newPassword}
                    onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Confirmar Nova Senha</label>
                  <input 
                    type="password" 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all"
                    placeholder="Repita a nova senha"
                    value={formData.confirmPassword}
                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button 
              type="submit"
              disabled={loading}
              className="bg-pedagogic-blue text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 shadow-xl shadow-blue-100 flex items-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {loading ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
