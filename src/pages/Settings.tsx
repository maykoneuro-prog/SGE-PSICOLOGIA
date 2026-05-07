import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { translateFirebaseError } from "../lib/errorTranslations";
import { format } from "date-fns";
import { Plus, Trash2, Settings as SettingsIcon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { db, auth } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

export default function Settings() {
  const [types, setTypes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [letterheads, setLetterheads] = useState<any[]>([]);
  const [editingLetterhead, setEditingLetterhead] = useState<string | null>(null);
  const [newType, setNewType] = useState({ name: "", label: "" });
  const [newCategory, setNewCategory] = useState({ name: "", type: "" });
  const [newLetterhead, setNewLetterhead] = useState({ 
    name: "", 
    logoUrl: "", 
    isDefault: false,
    allowedUsers: [] as string[],
    allowedUnits: [] as string[]
  });
  const [schools, setSchools] = useState<any[]>([]);
  const [documentLayouts, setDocumentLayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appSettings, setAppSettings] = useState({ name: "", logoUrl: "" });
  const [isTrial, setIsTrial] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const user = savedUser ? JSON.parse(savedUser) : null;
    setIsTrial(user?.planId === 'trial' || user?.isTrial);
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [t, c, l, s, dl, sch] = await Promise.all([
        api.appointmentTypes.list(),
        api.categories.list(),
        api.letterheads.list(),
        api.appSettings.get(),
        api.documentLayouts.list(),
        api.schools.list()
      ]);
      setTypes(t || []);
      setCategories(c || []);
      setLetterheads(l || []);
      setAppSettings(s);
      setDocumentLayouts(dl || []);
      setSchools(sch || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAppSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.appSettings.update(appSettings);
      alert("Configurações do sistema atualizadas com sucesso!");
      loadData();
    } catch (err) {
      alert("Erro ao atualizar configurações: " + translateFirebaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddLetterhead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTrial && letterheads.length >= 1 && !editingLetterhead) {
      alert("No seu teste grátis você pode cadastrar apenas 1 timbrado.");
      return;
    }
    try {
      setSaving(true);
      if (editingLetterhead) {
        await api.letterheads.update(editingLetterhead, newLetterhead);
        setEditingLetterhead(null);
      } else {
        await api.letterheads.create(newLetterhead);
      }
      setNewLetterhead({ 
        name: "", 
        logoUrl: "", 
        isDefault: false,
        allowedUsers: [],
        allowedUnits: []
      });
      loadData();
    } catch (err) {
      alert("Erro ao salvar timbrado: " + translateFirebaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEditLetterhead = (l: any) => {
    setEditingLetterhead(l.id);
    setNewLetterhead({
      name: l.name,
      logoUrl: l.logoUrl,
      isDefault: l.isDefault || false,
      allowedUsers: l.allowedUsers || [],
      allowedUnits: l.allowedUnits || []
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteLetterhead = async (id: string) => {
    if (!id) return;
    if (!window.confirm("Tem certeza que deseja excluir este timbrado?")) return;
    try {
      await api.letterheads.delete(id);
      loadData();
    } catch (err) {
      alert("Erro ao excluir timbrado: " + translateFirebaseError(err));
    }
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.appointmentTypes.create(newType);
      setNewType({ name: "", label: "" });
      loadData();
    } catch (err) {
      alert("Erro ao adicionar tipo: " + translateFirebaseError(err));
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.categories.create(newCategory);
      setNewCategory({ name: "", type: "" });
      loadData();
    } catch (err) {
      alert("Erro ao adicionar categoria: " + translateFirebaseError(err));
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm("Tem certeza? Isso pode afetar categorias e atendimentos existentes.")) return;
    try {
      await api.appointmentTypes.delete(id);
      loadData();
    } catch (err) {
      alert("Erro ao excluir tipo: " + translateFirebaseError(err));
    }
  };

  const handleSeed = async () => {
    try {
      setLoading(true);
      // Seed Appointment Types
      const defaultTypes = [
        { name: "psychological", label: "Psicológico" },
        { name: "pedagogical", label: "Pedagógico" }
      ];
      
      for (const t of defaultTypes) {
        const existing = types.find(et => et.name === t.name);
        if (!existing) {
          await api.appointmentTypes.create(t);
        }
      }

      // Seed Categories
      const defaultCategories = [
        { name: "Ansiedade", type: "psychological" },
        { name: "Dificuldade de Aprendizagem", type: "pedagogical" },
        { name: "Conflito Familiar", type: "psychological" },
        { name: "Comportamental", type: "psychological" }
      ];

      for (const c of defaultCategories) {
        const existing = categories.find(ec => ec.name === c.name && ec.type === c.type);
        if (!existing) {
          await api.categories.create(c);
        }
      }

      alert("Dados iniciais carregados com sucesso!");
      loadData();
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar dados iniciais: " + translateFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="text-sesi-blue" size={28} />
          <h2 className="text-2xl font-bold text-gray-800">Configurações do Sistema</h2>
        </div>
        <button 
          onClick={handleSeed}
          className="text-xs text-gray-400 hover:text-sesi-blue underline"
        >
          Carregar Dados Iniciais
        </button>
      </div>

      {/* Configuração do Sistema */}
      <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 mb-8">
        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
          <div className="w-1.5 h-6 bg-pedagogic-blue rounded-full"></div>
          Configuração Visual do SGE
        </h3>
        
        <form onSubmit={handleUpdateAppSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome do Sistema</label>
            <input 
              type="text" 
              placeholder="Ex: SGE Psicologia" 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all"
              value={appSettings.name}
              onChange={e => setAppSettings({...appSettings, name: e.target.value})}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">URL da Logo (Topo do Menu)</label>
            <input 
              type="text" 
              placeholder="https://exemplo.com/logo.png" 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all"
              value={appSettings.logoUrl}
              onChange={e => setAppSettings({...appSettings, logoUrl: e.target.value})}
              required
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <div className="flex items-center gap-4">
               {appSettings.logoUrl && (
                 <img src={appSettings.logoUrl} alt="Preview" className="h-12 object-contain bg-white p-2 rounded-xl" referrerPolicy="no-referrer" />
               )}
               <p className="text-xs text-blue-700 font-medium leading-relaxed">
                 A logo aparecerá no topo do menu lateral e na tela de login. <br/>
                 Certifique-se de usar URLs estáveis (Imgur, Cloudinary, etc).
               </p>
            </div>
            <button 
              disabled={saving}
              className="bg-pedagogic-blue text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>

      {/* Gestão de Timbrados */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">Gestão de Timbrados (Papel Timbrado)</h3>
          {isTrial && letterheads.length >= 1 && !editingLetterhead && (
            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200">
              Limite de 1 Timbrado (Teste Grátis)
            </span>
          )}
        </div>
        
        <form onSubmit={handleAddLetterhead} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-gray-50 p-6 rounded-xl">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Timbrado</label>
            <input 
              type="text" 
              placeholder="Ex: Timbrado Oficial SESI" 
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue"
              value={newLetterhead.name}
              onChange={e => setNewLetterhead({...newLetterhead, name: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL da Imagem do Timbrado (PNG/JPG)</label>
            <input 
              type="text" 
              placeholder="https://exemplo.com/timbrado.png" 
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue"
              value={newLetterhead.logoUrl}
              onChange={e => setNewLetterhead({...newLetterhead, logoUrl: e.target.value})}
              required
            />
            <p className="text-[10px] text-gray-400 mt-1">Dica: Use uma imagem que já contenha o cabeçalho completo.</p>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input 
              type="checkbox" 
              id="isDefault"
              checked={newLetterhead.isDefault}
              onChange={e => setNewLetterhead({...newLetterhead, isDefault: e.target.checked})}
              className="w-4 h-4 text-sesi-blue rounded border-gray-300 focus:ring-sesi-blue"
            />
            <label htmlFor="isDefault" className="text-sm font-medium text-gray-700">Definir como Padrão</label>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Psicólogos Autorizados (UIDs separados por vírgula)</label>
              <input 
                type="text" 
                placeholder="Ex: uid123, uid456" 
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue"
                value={newLetterhead.allowedUsers.join(', ')}
                onChange={e => setNewLetterhead({
                  ...newLetterhead, 
                  allowedUsers: e.target.value.split(',').map(u => u.trim()).filter(u => u !== '')
                })}
              />
              <p className="text-[10px] text-gray-400 mt-1">Se vazio, disponível para todos (se for padrão) ou restrito por unidade.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidades Autorizadas</label>
              <div className="max-h-32 overflow-y-auto p-2 bg-white border rounded-lg space-y-1">
                {schools.map(s => (
                  <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input 
                      type="checkbox" 
                      checked={newLetterhead.allowedUnits.includes(s.unit || s.name)}
                      onChange={e => {
                        const unit = s.unit || s.name;
                        const next = e.target.checked 
                          ? [...newLetterhead.allowedUnits, unit]
                          : newLetterhead.allowedUnits.filter(u => u !== unit);
                        setNewLetterhead({...newLetterhead, allowedUnits: next});
                      }}
                      className="w-3 h-3 text-sesi-blue rounded border-gray-300 focus:ring-sesi-blue"
                    />
                    <span className="truncate">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex items-end">
            <button 
              disabled={saving}
              className="w-full bg-sesi-blue text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-bold disabled:opacity-50"
            >
              {saving ? (
                <>Salvando...</>
              ) : (
                <>
                  <Plus size={20} /> {editingLetterhead ? 'Salvar Alterações' : 'Adicionar Timbrado'}
                </>
              )}
            </button>
          </div>
          {editingLetterhead && (
            <div className="md:col-span-2 flex justify-end">
              <button 
                type="button"
                onClick={() => {
                  setEditingLetterhead(null);
                  setNewLetterhead({ name: "", logoUrl: "", isDefault: false });
                }}
                className="text-sm text-gray-500 hover:text-sesi-blue underline"
              >
                Cancelar Edição
              </button>
            </div>
          )}
        </form>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {letterheads.map(l => (
              <div key={l.id} className="p-4 border rounded-xl bg-white shadow-sm relative group hover:border-sesi-blue transition-all">
                <div className="flex items-center gap-4 mb-3">
                  <img src={l.logoUrl} alt={l.name} className="h-16 w-full object-contain bg-gray-50 p-1 rounded" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="font-bold text-gray-800 truncate">{l.name}</p>
                  <p className="text-[10px] text-gray-400">
                    Criado em: {l.createdAt?.toDate ? format(l.createdAt.toDate(), 'dd/MM/yy') : 'N/A'}
                    {l.isDefault && <span className="ml-2 bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase">Padrão</span>}
                  </p>
                  {(l.allowedUnits?.length > 0 || l.allowedUsers?.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {l.allowedUnits?.map((u: string) => (
                        <span key={u} className="text-[8px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded uppercase font-bold">{u}</span>
                      ))}
                      {l.allowedUsers?.map((uid: string) => (
                        <span key={uid} className="text-[8px] bg-purple-50 text-purple-600 px-1 py-0.5 rounded uppercase font-bold">UID: {uid.substring(0, 5)}...</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-2 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleEditLetterhead(l)}
                    className="p-1.5 text-sesi-blue hover:bg-blue-50 rounded transition-colors"
                    title="Editar"
                  >
                    <SettingsIcon size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteLetterhead(l.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          {letterheads.length === 0 && (
            <div className="col-span-full p-8 text-center text-gray-400 border-2 border-dashed rounded-xl">
              Nenhum timbrado cadastrado.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gestão de Tipos */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Tipos de Atendimento</h3>
          
          <form onSubmit={handleAddType} className="flex gap-2 mb-6">
            <input 
              type="text" 
              placeholder="ID (ex: psicologico)" 
              className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue"
              value={newType.name}
              onChange={e => setNewType({...newType, name: e.target.value})}
              required
            />
            <input 
              type="text" 
              placeholder="Nome (ex: Psicológico)" 
              className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue"
              value={newType.label}
              onChange={e => setNewType({...newType, label: e.target.value})}
              required
            />
            <button className="bg-sesi-blue text-white p-2 rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={20} />
            </button>
          </form>

          <div className="space-y-2">
            {types.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">{t.label}</p>
                  <p className="text-xs text-gray-500">ID: {t.name}</p>
                </div>
                <button 
                  onClick={() => handleDeleteType(t.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Gestão de Categorias */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Categorias</h3>
          
          <form onSubmit={handleAddCategory} className="flex flex-col gap-2 mb-6">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Nome da Categoria" 
                className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue"
                value={newCategory.name}
                onChange={e => setNewCategory({...newCategory, name: e.target.value})}
                required
              />
              <select 
                className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue"
                value={newCategory.type}
                onChange={e => setNewCategory({...newCategory, type: e.target.value})}
                required
              >
                <option value="">Selecione o Tipo</option>
                {types.map(t => (
                  <option key={t.id} value={t.name}>{t.label}</option>
                ))}
              </select>
              <button className="bg-sesi-blue text-white p-2 rounded-lg hover:bg-blue-700 transition-colors">
                <Plus size={20} />
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">{c.name}</p>
                  <p className="text-xs text-blue-600 font-medium">
                    {types.find(t => t.name === c.type)?.label || c.type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Configuração de Layouts por Documento */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Configuração de Layout por Documento</h3>
          <p className="text-sm text-gray-500 mb-6">Defina qual timbrado será usado automaticamente para cada tipo de documento.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 'school_diagnosis', name: 'Diagnóstico Escolar' },
              { id: 'psychological_listening', name: 'Registro de Escuta Psicológica' },
              { id: 'group_attendance', name: 'Atendimento em Grupo' },
              { id: 'pedagogical_participation', name: 'Participação em Ativ. Pedagógicas' },
              { id: 'classroom_evolution', name: 'Ficha de Evolução em Sala' },
              { id: 'referral', name: 'Encaminhamento' },
              { id: 'attendance_declaration', name: 'Declaração de Comparecimento' },
              { id: 'authorization_term', name: 'Termo de Autorização' },
            ].map(docType => {
              const layout = documentLayouts.find(l => l.documentTypeId === docType.id);
              return (
                <div key={docType.id} className="p-4 border rounded-xl bg-slate-50 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-black text-slate-400 tracking-widest uppercase mb-1">{docType.name}</p>
                    <select 
                      className="w-full px-3 py-2 bg-white border border-slate-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pedagogic-blue"
                      value={layout?.letterheadId || ""}
                      onChange={async (e) => {
                        try {
                          await api.documentLayouts.upsert(docType.id, {
                            letterheadId: e.target.value,
                            showProfessionalSignature: layout?.showProfessionalSignature ?? true,
                            showDate: layout?.showDate ?? true
                          });
                          loadData();
                        } catch (err) {
                          alert("Erro ao salvar layout: " + translateFirebaseError(err));
                        }
                      }}
                    >
                      <option value="">Timbrado Padrão</option>
                      {letterheads.map(lh => (
                        <option key={lh.id} value={lh.id}>{lh.name}</option>
                      ))}
                    </select>
                  </div>
                  {layout && (
                    <div className="flex gap-2">
                       <label className="flex items-center gap-1 cursor-pointer" title="Assinatura">
                         <input 
                           type="checkbox" 
                           checked={layout.showProfessionalSignature} 
                           onChange={async (e) => {
                             await api.documentLayouts.upsert(docType.id, { ...layout, showProfessionalSignature: e.target.checked });
                             loadData();
                           }}
                           className="w-3 h-3 rounded"
                         />
                         <span className="text-[10px] text-slate-400 font-bold uppercase">Ass.</span>
                       </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Diagnóstico de Conexão */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-amber-500" size={24} />
            <h3 className="text-lg font-bold text-gray-800">Diagnóstico de Conexão</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Verifique se o sistema consegue se comunicar com o banco de dados. 
            O ID configurado atualmente é: <code className="bg-slate-100 px-2 py-0.5 rounded font-mono text-sesi-blue">firestore-prod</code>
          </p>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={async () => {
                try {
                  setSaving(true);
                  const testRef = doc(db, 'test_connection', 'status');
                  await setDoc(testRef, { 
                    lastTest: serverTimestamp(),
                    status: 'ok',
                    tester: auth.currentUser?.email || 'unauthenticated',
                    dbId: 'firestore-prod'
                  }, { merge: true });
                  const snap = await getDoc(testRef);
                  if (snap.exists()) {
                    alert("Sucesso! Conexão e escrita no Firestore funcionando corretamente.");
                  } else {
                    alert("Erro: O documento foi 'salvo' mas não pôde ser recuperado.");
                  }
                } catch (err) {
                  console.error("Test connection error:", err);
                  alert("Falha Crítica: " + translateFirebaseError(err));
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Testando...' : 'Testar Escrita/Leitura'}
            </button>
          </div>
        </div>

        {/* Manutenção */}
        {!isTrial && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Manutenção do Banco de Dados</h3>
            <div className="bg-red-50 p-6 rounded-xl border border-red-100">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-red-900">Limpar Cadastro de Alunos</h4>
                  <p className="text-sm text-red-700">Esta ação excluirá permanentemente todos os alunos cadastrados. Use com cautela.</p>
                </div>
                <button 
                  onClick={async () => {
                    if (confirm("Tem certeza que deseja excluir TODOS os alunos? Esta ação não pode ser desfeita.")) {
                      try {
                        setSaving(true);
                        await api.students.deleteAll();
                        alert("Todos os alunos foram excluídos com sucesso.");
                      } catch (err) {
                        console.error(err);
                        alert("Erro ao excluir alunos: " + translateFirebaseError(err));
                      } finally {
                        setSaving(false);
                      }
                    }
                  }}
                  disabled={saving}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  {saving ? 'Excluindo...' : 'Limpar Banco de Alunos'}
                </button>
              </div>
            </div>

            <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-blue-100">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sesi-blue">Carga Inicial de Unidades</h4>
                  <p className="text-sm text-blue-700">Cadastrar automaticamente as unidades escolares padrão do sistema.</p>
                </div>
                <button 
                  disabled={saving}
                  onClick={async () => {
                    const schoolsToSeed = [
                      { name: "UNIDADE VASCO DA GAMA", unit: "VASCO DA GAMA", cnpj: "03.910.210/0005-39", email: "contato@exemplo.org.br", address: "Rua Vasco da Gama, 145 – PE", mecAuthorization: "INEP: 26167115", phone: "(81) 99933-7502", contact: "Lilian Roberta", filial: "504" },
                      { name: "UNIDADE IBURA", unit: "IBURA", cnpj: "03.910.210/0003-77", email: "contato@exemplo.org.br", address: "Rua Ministro Oliveira Salazar, 228 – PE", mecAuthorization: "INEP: 26168154", phone: "(81) 8877-0893", contact: "Nalygia Maria", filial: "505" },
                      { name: "UNIDADE CAMARAGIBE", unit: "CAMARAGIBE", cnpj: "03.910.210/0008-81", email: "contato@exemplo.org.br", address: "Rua Severino Santos, 343 – PE", mecAuthorization: "INEP: 26107210", phone: "(81) 98899-1759", contact: "Adelson Barbosa", filial: "506" },
                      { name: "UNIDADE PAULISTA", unit: "PAULISTA", cnpj: "03.910.210/0009-62", email: "contato@exemplo.org.br", address: "Travessa São Pedro, 2800 – PE", mecAuthorization: "INEP: 26115441", phone: "(81) 98481-4448", contact: "Swelyn Neves", filial: "507" },
                      { name: "UNIDADE CABO", unit: "CABO", cnpj: "03.910.210/0011-87", email: "contato@exemplo.org.br", address: "BR 101 Sul, Km 36 – PE", mecAuthorization: "INEP: 26168820", phone: "(81) 3521-9192", contact: "Tatiane Sávia", filial: "510" },
                      { name: "UNIDADE ESCADA", unit: "ESCADA", cnpj: "03.910.210/0010-04", email: "contato@exemplo.org.br", address: "Av. Visconde de Utinga – PE", mecAuthorization: "INEP: 26098911", phone: "(81) 98678-8728", contact: "Rivaldo José", filial: "511" },
                      { name: "UNIDADE GOIANA", unit: "GOIANA", cnpj: "03.910.210/0014-20", email: "contato@exemplo.org.br", address: "Rua Poço do Rei – PE", mecAuthorization: "INEP: 26182879", phone: "(81) 98622-0060", contact: "Alzira Cristina", filial: "513" },
                      { name: "UNIDADE CARUARU", unit: "CARUARU", cnpj: "03.910.210/0017-72", email: "contato@exemplo.org.br", address: "Caruaru – PE", mecAuthorization: "INEP: 26151987", phone: "(81) 3722-6565", contact: "Administrativo", filial: "515" },
                      { name: "UNIDADE PETROLINA", unit: "PETROLINA", cnpj: "03.910.210/0019-34", email: "contato@exemplo.org.br", address: "Rua Projetada – PE", mecAuthorization: "INEP: 26036401", phone: "(87) 98827-7694", contact: "Tacianna de Oliveira", filial: "517" },
                      { name: "UNIDADE ARARIPINA", unit: "ARARIPINA", cnpj: "03.910.210/0018-53", email: "contato@exemplo.org.br", address: "Estrada Araripina-Gergelim – PE", mecAuthorization: "INEP: 26134332", phone: "(87) 99171-3533", contact: "Maria Danieli", filial: "518" },
                      { name: "UNIDADE MORENO", unit: "MORENO", cnpj: "03.910.210/0016-91", email: "contato@exemplo.org.br", address: "Av. Cleto Campelo, 2713 – PE", mecAuthorization: "INEP: 26185970", phone: "(81) 98877-0437", contact: "Gilvaneide Maria", filial: "524" },
                      { name: "UNIDADE BELO JARDIM", unit: "BELO JARDIM", cnpj: "03.910.210/0022-30", email: "contato@exemplo.org.br", address: "Rua Coronel Antonio Marinho – PE", mecAuthorization: "INEP: 26189143", phone: "(81) 99707-2172", contact: "Izabelle Araujo", filial: "501" }
                    ];

                    try {
                      setSaving(true);
                      
                      // Otimização: Busca todas as escolas de uma vez para comparar localmente
                      // Isso gasta apenas 1 leitura em vez de 12 consultas separadas (findByName)
                      const existingSchools = await api.schools.list();
                      const existingNames = new Set(existingSchools.map((s: any) => s.name.trim().toUpperCase()));
                      
                      let count = 0;
                      for (const school of schoolsToSeed) {
                        if (!existingNames.has(school.name.trim().toUpperCase())) {
                          await api.schools.create(school);
                          count++;
                        }
                      }
                      
                      if (count > 0) {
                        alert(`${count} novas unidades cadastradas com sucesso!`);
                        loadData();
                      } else {
                        alert("Todas as unidades já constam no cadastro oficial.");
                      }
                    } catch (err) {
                      console.error(err);
                      alert("Erro ao cadastrar unidades em massa: " + translateFirebaseError(err));
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="bg-sesi-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                  {saving ? 'Cadastrando...' : 'Cadastrar Unidades Padrão'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
