import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { translateFirebaseError } from "../lib/errorTranslations";
import { School, Building2, Mail, Phone, MapPin, CheckCircle2, ArrowLeft, ShieldCheck, ShieldAlert } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function SchoolRegistration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    unit: "",
    cnpj: "",
    email: "",
    address: "",
    mecAuthorization: "",
    phone: ""
  });

  const [limitReached, setLimitReached] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkLimit = async () => {
      const savedUser = localStorage.getItem("user");
      const user = savedUser ? JSON.parse(savedUser) : null;
      
      if (user?.planId === 'trial' || user?.isTrial) {
        try {
          const schools = await api.schools.list();
          if (schools && schools.length >= 1) {
            setLimitReached(true);
          }
        } catch (err) {
          console.error("Error checking school limit:", err);
        }
      }
      setChecking(false);
    };
    checkLimit();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (limitReached) return;
    setLoading(true);
    try {
      await api.schools.create(formData);
      setSuccess(true);
      setTimeout(() => {
        navigate("/escolas");
      }, 3000);
    } catch (err) {
      alert("Erro ao cadastrar escola: " + translateFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sesi-blue"></div>
      </div>
    );
  }

  if (limitReached) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-amber-50 border-2 border-amber-200 p-8 rounded-[2.5rem] text-center shadow-xl shadow-amber-100/50">
          <div className="w-20 h-20 bg-white rounded-[2rem] shadow-sm flex items-center justify-center mx-auto mb-6 text-amber-500">
             <ShieldAlert size={40} />
          </div>
          <h2 className="text-2xl font-black text-amber-900 mb-4 tracking-tight uppercase">Limite de Teste Grátis</h2>
          <p className="text-amber-800 font-medium mb-8 max-w-md mx-auto leading-relaxed">
            Seu período de teste grátis permite o cadastro de apenas <b>1 escola</b>. 
            Faça o upgrade para o plano Básico, Profissional ou Premium para cadastrar múltiplas unidades.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/escolas" className="px-8 py-4 bg-white text-amber-900 font-black rounded-2xl border border-amber-200 hover:bg-amber-100 transition-all text-xs uppercase tracking-widest">
              Ver Escolas
            </Link>
            <Link to="/planos" className="px-8 py-4 bg-amber-500 text-white font-black rounded-2xl shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all text-xs uppercase tracking-widest">
              Ver Planos de Upgrade
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Escola Cadastrada!</h2>
          <p className="text-gray-600 mb-8">
            A escola <strong>{formData.name}</strong> foi registrada com sucesso no sistema SGE Psicologia.
          </p>
          <div className="animate-pulse text-sesi-blue font-medium">
            Redirecionando para a lista de escolas...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/escolas" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Cadastro de Escola</h2>
          <p className="text-gray-500 mt-1">Registre uma nova unidade escolar no sistema</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-sesi-blue p-6 text-white">
          <div className="flex items-center gap-3">
            <Building2 size={32} />
            <div>
              <h3 className="text-xl font-bold">Informações Institucionais</h3>
              <p className="text-blue-100 text-sm">Preencha os dados oficiais da unidade</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <School size={16} className="text-sesi-blue" /> Nome da Escola
              </label>
              <input 
                type="text" 
                required
                placeholder="Ex: SESI Centro de Excelência"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sesi-blue focus:border-transparent outline-none transition-all"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value, unit: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <ShieldCheck size={16} className="text-sesi-blue" /> CNPJ
              </label>
              <input 
                type="text" 
                required
                placeholder="00.000.000/0000-00"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sesi-blue focus:border-transparent outline-none transition-all"
                value={formData.cnpj}
                onChange={e => setFormData({...formData, cnpj: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Mail size={16} className="text-sesi-blue" /> E-mail Institucional
              </label>
              <input 
                type="email" 
                required
                placeholder="escola@sesipe.org.br"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sesi-blue focus:border-transparent outline-none transition-all"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Phone size={16} className="text-sesi-blue" /> Telefone de Contato
              </label>
              <input 
                type="text" 
                placeholder="(81) 0000-0000"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sesi-blue focus:border-transparent outline-none transition-all"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <ShieldCheck size={16} className="text-sesi-blue" /> Autorização MEC
              </label>
              <input 
                type="text" 
                placeholder="Nº da Portaria ou Registro"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sesi-blue focus:border-transparent outline-none transition-all"
                value={formData.mecAuthorization}
                onChange={e => setFormData({...formData, mecAuthorization: e.target.value})}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin size={16} className="text-sesi-blue" /> Endereço Completo
              </label>
              <input 
                type="text" 
                placeholder="Rua, Número, Bairro, Cidade - UF"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sesi-blue focus:border-transparent outline-none transition-all"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-8 border-t border-gray-100">
            <Link 
              to="/escolas"
              className="px-8 py-3 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors"
            >
              Cancelar
            </Link>
            <button 
              type="submit"
              disabled={loading}
              className={`px-12 py-3 bg-sesi-green text-white font-bold rounded-xl shadow-lg shadow-green-100 hover:bg-green-700 transition-all flex items-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? "Processando..." : "Finalizar Cadastro"}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
        <div className="bg-sesi-blue text-white p-2 rounded-lg">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h4 className="font-bold text-sesi-blue mb-1">Segurança e Conformidade</h4>
          <p className="text-sm text-blue-800 leading-relaxed">
            Ao cadastrar uma nova escola, ela terá acesso imediato às funcionalidades de agendamento e gestão de alunos. 
            Certifique-se de que os dados do CNPJ e E-mail estão corretos para garantir a integridade das comunicações oficiais.
          </p>
        </div>
      </div>
    </div>
  );
}
