import React, { useState, useEffect } from "react";
import { Check, X, ShieldAlert, Plus, Edit2, Trash2, Save, LayoutGrid, List, User, Mail, Briefcase, MapPin, Calendar as CalendarIcon, Zap, CreditCard, History, Clock, Download, Upload } from "lucide-react";
import { api } from "../lib/api";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AVAILABLE_PERMISSIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'students', label: 'Alunos' },
  { id: 'import_students', label: 'Importar Alunos' },
  { id: 'appointments', label: 'Atendimentos' },
  { id: 'documents', label: 'Documentos' },
  { id: 'reports', label: 'Relatórios' },
  { id: 'schools', label: 'Escolas' },
  { id: 'scheduling_requests', label: 'Solicitações' },
  { id: 'psychological_listening', label: 'Gestão de Denúncias' },
  { id: 'bilingual', label: 'Bilíngue' },
  { id: 'settings', label: 'Configurações' },
  { id: 'admin', label: 'Gestão de Usuários' },
];

const ROLES = [
  { id: 'psychologist', label: 'Psicólogo' },
  { id: 'aee', label: 'AEE' },
  { id: 'pedagogue', label: 'Pedagogo' },
  { id: 'admin', label: 'Administrador' },
];

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "plans" | "subscriptions">("users");
  const [showModal, setShowModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "psychologist",
    units: [] as string[],
    permissions: [] as string[],
    professionalCouncil: "",
    status: "active" as "active" | "inactive",
    expiresAt: ""
  });

  const [planData, setPlanData] = useState({
    name: "",
    limit: 40,
    price: 0,
    overagePrice: 0,
    allowOverage: false,
    autoBlock: true
  });

  const [subData, setSubData] = useState({
    unitId: "",
    planId: "",
    status: "active"
  });

  useEffect(() => {
    loadUsers();
    loadSchools();
    loadPlans();
  }, []);

  const handleFullBackup = async () => {
    try {
      setIsExporting(true);
      const isAdmin = true;
      const [
        usersData,
        schoolsData,
        plansData,
        subscriptionsData,
        studentsData,
        appointmentsData,
        requestsData,
        reportsData,
        documentsData,
        appointmentTypesData,
        categoriesData,
        appSettingsData,
        letterheadsData,
        documentLayoutsData
      ] = await Promise.all([
        api.users.list(),
        api.schools.list({ isAdmin }),
        api.plans.list(),
        api.subscriptions.list ? api.subscriptions.list() : [],
        api.students.list({ isAdmin }),
        api.appointments.list({ isAdmin }),
        api.schedulingRequests?.list ? api.schedulingRequests.list({ isAdmin }) : [],
        api.anonymousReports?.list ? api.anonymousReports.list() : [],
        api.documents?.list ? api.documents.list({ isAdmin }) : [],
        api.appointmentTypes?.list ? api.appointmentTypes.list() : [],
        api.categories?.list ? api.categories.list() : [],
        api.appSettings?.get ? api.appSettings.get() : null,
        api.letterheads?.list ? api.letterheads.list() : [],
        api.documentLayouts?.list ? api.documentLayouts.list() : []
      ]);

      const backupData = {
        version: "1.1",
        exportedAt: new Date().toISOString(),
        collections: {
          users: usersData,
          schools: schoolsData,
          plans: plansData,
          subscriptions: subscriptionsData,
          students: studentsData,
          appointments: appointmentsData,
          scheduling_requests: requestsData,
          anonymous_reports: reportsData,
          documents: documentsData,
          appointment_types: appointmentTypesData,
          categories: categoriesData,
          app_settings: appSettingsData ? [appSettingsData] : [],
          letterheads: letterheadsData,
          document_layouts: documentLayoutsData
        }
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_sge_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      console.error("Erro ao gerar backup:", err);
      alert("Falha ao gerar backup de dados.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("ATENÇÃO: Restaurar um backup irá sobrescrever dados existentes com o mesmo ID. Deseja continuar?")) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.collections) {
        throw new Error("Formato de backup inválido.");
      }

      const collections = backup.collections;
      let totalRestored = 0;

      // Iterar sobre as coleções e restaurar documentos em lotes para evitar sobrecarga
      const CHUNK_SIZE = 25; // Tamanho do lote para restauração
      
      for (const [colName, docs] of Object.entries(collections)) {
        if (Array.isArray(docs)) {
          console.log(`Restaurando coleção: ${colName} (${docs.length} documentos)`);
          
          let targetCollection = colName;
          if (colName === 'scheduling_requests') targetCollection = 'scheduling_requests';
          if (colName === 'anonymous_reports') targetCollection = 'anonymous_reports';
          if (colName === 'appointment_types') targetCollection = 'appointment_types';
          if (colName === 'app_settings') targetCollection = 'app_settings';
          if (colName === 'document_layouts') targetCollection = 'document_layouts';

          // Processar em chunks
          for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
            const chunk = docs.slice(i, i + CHUNK_SIZE);
            const promises = chunk.map((doc: any) => 
              api.utils.restore(targetCollection, doc.id, doc)
            );
            await Promise.all(promises);
            totalRestored += chunk.length;
          }
        }
      }

      alert(`Backup restaurado com sucesso! ${totalRestored} registros processados.`);
      loadUsers();
      loadSchools();
      loadPlans();
      if (activeTab === "subscriptions") loadSubscriptions();
    } catch (err: any) {
      console.error("Erro na restauração:", err);
      alert("Falha ao restaurar backup: " + err.message);
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (activeTab === "subscriptions") {
      loadSubscriptions();
    }
  }, [activeTab]);

  const loadPlans = async () => {
    try {
      const data = await api.plans.list();
      setPlans(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSubscriptions = async () => {
    try {
      // OTIMIZAÇÃO: Busca todas as assinaturas de uma vez só
      // Em vez de fazer uma consulta por escola (schools.map)
      const allSubs = await api.subscriptions.list();
      setSubscriptions(allSubs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSchools = async () => {
    try {
      const data = await api.schools.list({ isAdmin: true });
      setSchools(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api.users.list();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenModal = (user?: any) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: user.password || "",
        role: user.role,
        units: (user.units || []).map((u: string) => u.trim().toUpperCase()),
        permissions: user.permissions || [],
        professionalCouncil: user.professionalCouncil || "",
        status: user.status || "active",
        expiresAt: user.expiresAt ? new Date(user.expiresAt).toISOString().split('T')[0] : ""
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: "",
        email: "",
        password: "",
        role: "psychologist",
        units: [],
        permissions: [],
        professionalCouncil: "",
        status: "active",
        expiresAt: ""
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...formData,
        units: (formData.units || []).map(u => u.trim().toUpperCase()),
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null
      };
      if (editingUser) {
        await api.users.update(editingUser.id, dataToSave);
      } else {
        await api.users.create(dataToSave);
      }
      setShowModal(false);
      loadUsers();
    } catch (err: any) {
      console.error("Erro completo ao salvar usuário:", err);
      const errorMessage = err.message || "Erro desconhecido";
      alert(`Falha ao salvar profissional: ${errorMessage}\n\nVerifique se o domínio da aplicação está autorizado no Console do Firebase.`);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir o acesso de ${user.name}? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.users.delete(user.id);
      loadUsers();
    } catch (err: any) {
      alert(`Erro ao excluir usuário: ${err.message}`);
    }
  };

  const handleSyncPlans = async () => {
    if (!window.confirm("Isso atualizará os limites de TODOS os planos existentes para a nova tabela (40, 120, 500). Continuar?")) return;
    
    try {
      const currentPlans = await api.plans.list();
      const updates = currentPlans.map((p: any) => {
        let newLimit = p.limit;
        let newPrice = p.price;
        
        if (p.name.toLowerCase().includes('básico')) { newLimit = 40; newPrice = 79.90; }
        else if (p.name.toLowerCase().includes('profissional')) { newLimit = 120; newPrice = 199.90; }
        else if (p.name.toLowerCase().includes('premium')) { newLimit = 500; newPrice = 499.90; }
        
        return api.plans.update(p.id, { ...p, limit: newLimit, price: newPrice });
      });
      
      await Promise.all(updates);
      alert("Planos sincronizados com sucesso!");
      loadPlans();
    } catch (err) {
      console.error(err);
      alert("Erro ao sincronizar planos.");
    }
  };

  const handleOpenPlanModal = (plan?: any) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanData({
        name: plan.name,
        limit: plan.limit,
        price: plan.price || 0,
        overagePrice: plan.overagePrice || 0,
        allowOverage: plan.allowOverage || false,
        autoBlock: plan.autoBlock || false
      });
    } else {
      setEditingPlan(null);
      setPlanData({
        name: "",
        limit: 100,
        price: 0,
        overagePrice: 0,
        allowOverage: false,
        autoBlock: true
      });
    }
    setShowPlanModal(true);
  };

  const handleSubmitPlan = async (e: any) => {
    e.preventDefault();
    try {
      if (editingPlan) {
        await api.plans.update(editingPlan.id, planData);
      } else {
        await api.plans.create(planData);
      }
      setShowPlanModal(false);
      loadPlans();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmitSub = async (e: any) => {
    e.preventDefault();
    try {
      const existing = await api.subscriptions.getByUnit(subData.unitId);
      if (existing) {
        await api.subscriptions.update(existing.id, { planId: subData.planId, status: subData.status });
      } else {
        await api.subscriptions.create(subData);
      }
      setShowSubModal(false);
      loadSubscriptions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const toggleUnit = (unitName: string) => {
    const standardized = unitName.trim().toUpperCase();
    setFormData(prev => ({
      ...prev,
      units: prev.units.includes(standardized)
        ? prev.units.filter(u => u !== standardized)
        : [...prev.units, standardized]
    }));
  };

  const availableUnitsList = Array.from(new Set([
    'Administração Central',
    ...schools.map(s => s.name).filter(Boolean)
  ])).sort();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight">Painel de Controle</h1>
            <p className="text-gray-500 font-medium italic">Gerencie o ecossistema SGE com super poderes</p>
          </div>
          
          <div className="flex items-center gap-4">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleRestoreBackup} 
              className="hidden" 
              accept=".json"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isRestoring || isExporting}
              className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
            >
              <Upload size={14} />
              {isRestoring ? "Restaurando..." : "Restaurar Backup"}
            </button>
            <button 
              onClick={handleFullBackup}
              disabled={isExporting || isRestoring}
              className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 bg-sesi-blue text-white hover:bg-blue-800 shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              <Download size={14} />
              {isExporting ? "Exportando..." : "Backup Completo"}
            </button>
            <div className="flex p-1 bg-gray-100/50 backdrop-blur rounded-2xl border border-gray-200/50">
              {[
                { id: "users", label: "Profissionais", icon: User },
                { id: "plans", label: "Planos SaaS", icon: Zap },
                { id: "subscriptions", label: "Uso Unitário", icon: CreditCard }
              ].map((tab) => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                    activeTab === tab.id 
                      ? "bg-white text-sesi-blue shadow-sm ring-1 ring-black/5" 
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activeTab === "users" && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-sesi-blue/10 text-sesi-blue rounded-2xl">
                <Briefcase size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-800 tracking-tight">Equipe Técnica</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Total de {users.length} membros</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="bg-white border border-gray-100 rounded-xl p-1 flex gap-1 h-12 shadow-sm">
                <button 
                  onClick={() => setViewMode("list")}
                  className={`px-3 rounded-lg transition-all ${viewMode === "list" ? "bg-sesi-blue text-white shadow-lg shadow-blue-100" : "text-gray-400 hover:bg-gray-50"}`}
                >
                  <List size={18} />
                </button>
                <button 
                  onClick={() => setViewMode("grid")}
                  className={`px-3 rounded-lg transition-all ${viewMode === "grid" ? "bg-sesi-blue text-white shadow-lg shadow-blue-100" : "text-gray-400 hover:bg-gray-50"}`}
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
              
              <button 
                onClick={() => handleOpenModal()}
                className="flex-1 md:flex-none h-12 bg-sesi-green text-white px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-green-700 transition-all font-black uppercase tracking-widest text-[10px] shadow-lg shadow-green-100"
              >
                <Plus size={18} /> Novo profissional
              </button>
            </div>
          </div>

          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.map((user: any) => (
                <div key={user.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all p-6 group relative overflow-hidden">
                  <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 group-hover:scale-150 transition-transform ${user.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}`} />
                  
                  <div className="flex items-start gap-4 mb-6 relative">
                    <div className="w-16 h-16 bg-gradient-to-br from-sesi-blue to-blue-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100 font-black text-xl">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-800 leading-tight">{user.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                        <Briefcase size={10} />
                        {ROLES.find(r => r.id === user.role)?.label || user.role}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                        <Mail size={14} />
                      </div>
                      <span className="truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                        <CalendarIcon size={14} />
                      </div>
                      <span className={user.expiresAt && new Date(user.expiresAt) < new Date() ? "text-red-500 font-bold" : "font-medium"}>
                        {user.expiresAt ? `Expira em ${new Date(user.expiresAt).toLocaleDateString('pt-BR')}` : 'Acesso Vitalício'}
                      </span>
                    </div>
                    <div className="flex items-start gap-3 text-sm text-gray-600">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 mt-1 shrink-0">
                        <MapPin size={14} />
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        {user.units?.length > 0 ? user.units.map((unit: string, i: number) => (
                          <span key={i} className="bg-blue-50 text-sesi-blue text-[9px] font-black uppercase px-2 py-0.5 rounded-md border border-blue-100/50">
                            {unit === 'Administração Central' ? 'Central' : unit}
                          </span>
                        )) : <span className="text-gray-400 italic text-[10px]">Sem unidades vinculadas</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleOpenModal(user)}
                      className="flex-1 h-12 bg-gray-50 text-sesi-blue rounded-xl text-xs font-black uppercase tracking-widest hover:bg-sesi-blue hover:text-white transition-all flex items-center justify-center gap-2 border border-gray-100"
                    >
                      <Edit2 size={14} /> Editar
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(user)}
                      className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-100"
                      title="Excluir Usuário"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Nome & Email</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Papel</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Acesso até</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((user: any) => (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-sesi-blue/5 rounded-xl flex items-center justify-center text-sesi-blue font-black shadow-inner">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800">{user.name}</p>
                              <p className="text-xs text-gray-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                            {ROLES.find(r => r.id === user.role)?.label || user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                            <CalendarIcon size={12} className="text-gray-400" />
                            <span className={user.expiresAt && new Date(user.expiresAt) < new Date() ? "text-red-500" : ""}>
                              {user.expiresAt ? new Date(user.expiresAt).toLocaleDateString('pt-BR') : 'Sem expiração'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleOpenModal(user)}
                              className="p-2 text-gray-400 hover:text-sesi-blue hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(user)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "plans" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div>
              <h2 className="text-3xl font-black text-gray-800 tracking-tight">Planos SaaS</h2>
              <p className="text-gray-500 font-medium">Configure as limitações e valores de cada nível de serviço</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleSyncPlans}
                className="bg-amber-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 font-bold"
              >
                <Zap size={20} /> Sincronizar Tabela
              </button>
              <button 
                onClick={() => handleOpenPlanModal()}
                className="bg-sesi-green text-white px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-100 font-bold"
              >
                <Plus size={20} /> Novo Plano
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-sesi-blue/10 rounded-2xl flex items-center justify-center text-sesi-blue">
                    <Zap size={24} />
                  </div>
                  <span className="px-3 py-1 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 rounded-full italic">SaaS Level</span>
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-2 uppercase tracking-tight">{plan.name}</h3>
                <p className="text-4xl font-black text-sesi-blue mb-6">
                  {plan.limit} <span className="text-sm font-normal text-gray-400">Atendimentos/mês</span>
                </p>
                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check size={16} className="text-green-500" />
                    <span>{plan.autoBlock ? "Bloqueio Automático" : "Sem Bloqueio"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check size={16} className="text-green-500" />
                    <span>{plan.allowOverage ? "Cobrança de Excedente" : "Sem Excedente"}</span>
                  </div>
                  {plan.overagePrice > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Plus size={16} className="text-orange-500" />
                      <span>Excedente: R$ {plan.overagePrice.toFixed(2)} / cada</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CreditCard size={16} className="text-gray-400" />
                    <span>Investimento: R$ {plan.price?.toFixed(2) || "0,00"}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleOpenPlanModal(plan)}
                  className="w-full py-3 bg-gray-50 text-gray-500 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-sesi-blue hover:text-white transition-all border border-gray-100"
                >
                  Editar Detalhes
                </button>
              </div>
            ))}
            {plans.length === 0 && (
              <div className="md:col-span-3 py-12 flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <ShieldAlert size={48} className="text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">Nenhum plano cadastrado. Comece criando o primeiro!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "subscriptions" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Uso de Recursos por Unidade</h2>
            <button 
              onClick={() => {
                setSubData({ unitId: "", planId: "", status: "active" });
                setShowSubModal(true);
              }}
              className="bg-sesi-blue text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-800"
            >
              <Zap size={20} /> Vincular Plano
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Unidade Escola</th>
                  <th className="px-6 py-4">Plano Atual</th>
                  <th className="px-6 py-4">Limite Mensal</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schools.map(school => {
                  const sub = subscriptions.find(s => s.unitId === school.name);
                  const plan = plans.find(p => p.id === sub?.planId);
                  return (
                    <tr key={school.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900">{school.name}</td>
                      <td className="px-6 py-4">
                        {plan ? (
                          <span className="px-3 py-1 bg-blue-50 text-sesi-blue rounded-full text-xs font-bold">
                            {plan.name}
                          </span>
                        ) : <span className="text-gray-400 italic">Sem plano</span>}
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-gray-700">
                        {plan?.limit || "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${sub?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {sub?.status || 'Não Definido'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => {
                            setSubData({ unitId: school.name, planId: sub?.planId || "", status: sub?.status || "active" });
                            setShowSubModal(true);
                          }}
                          className="p-1 text-sesi-blue hover:bg-blue-50 rounded"
                        >
                          <Edit2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showSubModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-6 font-black uppercase tracking-tight">Vincular Plano à Unidade</h3>
            <form onSubmit={handleSubmitSub} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">Unidade Escola</label>
                <select 
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-sesi-blue font-bold"
                  value={subData.unitId}
                  onChange={(e) => setSubData({...subData, unitId: e.target.value})}
                >
                  <option value="">Selecione uma Escola</option>
                  {availableUnitsList.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">Plano SaaS</label>
                <select 
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-sesi-blue font-bold"
                  value={subData.planId}
                  onChange={(e) => setSubData({...subData, planId: e.target.value})}
                >
                  <option value="">Selecione um Plano</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.limit} atendimentos)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">Status da Assinatura</label>
                <select 
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-sesi-blue font-bold"
                  value={subData.status}
                  onChange={(e) => setSubData({...subData, status: e.target.value})}
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Pausado / Inativo</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowSubModal(false)} className="px-6 py-2 text-gray-500 font-bold">Cancelar</button>
                <button className="px-8 py-3 bg-sesi-blue text-white font-black uppercase tracking-widest rounded-xl hover:bg-blue-800 shadow-xl shadow-blue-100">Vincular Plano</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-6 font-black uppercase tracking-tight">
              {editingPlan ? "Editar Plano SaaS" : "Configurar Novo Plano"}
            </h3>
            <form onSubmit={handleSubmitPlan} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">Nome do Plano</label>
                <input 
                  type="text" required placeholder="Ex: Premium 500"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-sesi-blue"
                  value={planData.name}
                  onChange={(e) => setPlanData({...planData, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">Limite Mensal</label>
                  <input 
                    type="number" required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-sesi-blue font-black"
                    value={planData.limit}
                    onChange={(e) => setPlanData({...planData, limit: parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">Preço (R$)</label>
                  <input 
                    type="number" step="0.01" required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-sesi-blue"
                    value={planData.price}
                    onChange={(e) => setPlanData({...planData, price: parseFloat(e.target.value)})}
                  />
                </div>
              </div>

              {planData.allowOverage && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">Valor do Excedente (R$ por Atendimento)</label>
                  <input 
                    type="number" step="0.01" required
                    className="w-full px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl outline-none focus:ring-2 focus:ring-sesi-blue font-bold text-orange-700"
                    value={planData.overagePrice}
                    onChange={(e) => setPlanData({...planData, overagePrice: parseFloat(e.target.value)})}
                  />
                </div>
              )}

              <div className="space-y-4 pt-4">
                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" className="w-5 h-5 rounded text-sesi-blue"
                    checked={planData.allowOverage}
                    onChange={(e) => setPlanData({...planData, allowOverage: e.target.checked})}
                  />
                  <div>
                    <p className="text-sm font-bold text-gray-800">Permitir Excedente</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Cobrança adicional após limite</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" className="w-5 h-5 rounded text-sesi-blue"
                    checked={planData.autoBlock}
                    onChange={(e) => setPlanData({...planData, autoBlock: e.target.checked})}
                  />
                  <div>
                    <p className="text-sm font-bold text-gray-800">Bloqueio Automático</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Interrompe serviço no limite</p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t">
                <button type="button" onClick={() => setShowPlanModal(false)} className="px-6 py-2 text-gray-500 font-bold">Cancelar</button>
                <button className="px-8 py-3 bg-sesi-green text-white font-black uppercase tracking-widest rounded-xl hover:bg-green-700 shadow-xl shadow-green-100">
                  {editingPlan ? "Salvar Alterações" : "Criar Plano"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl flex flex-col md:flex-row overflow-hidden my-4">
            {/* Sidebar Decorativa */}
            <div className="md:w-1/3 bg-sesi-blue p-8 text-white flex flex-col justify-between relative overflow-hidden">
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur">
                  <User size={32} />
                </div>
                <h3 className="text-2xl font-black tracking-tight leading-tight mb-2">
                  {editingUser ? "Editar Perfil" : "Novo Membro"}
                </h3>
                <p className="text-blue-100 text-sm font-medium italic">
                  {editingUser ? "Atualize as credenciais e permissões do profissional." : "Cadastre um novo profissional na rede."}
                </p>
              </div>

              <div className="relative z-10 pt-8 border-t border-white/10 space-y-4">
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest opacity-60">
                  <ShieldAlert size={14} /> Sistema SGE Cloud
                </div>
              </div>

              {/* Decor Circles */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-sesi-green/20 rounded-full -ml-24 -mb-24 blur-2xl" />
            </div>

            {/* Formulário Principal */}
            <div className="md:w-2/3 p-8 md:p-12 max-h-[85vh] overflow-y-auto custom-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Dados de Acesso</h4>
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Nome Completo</label>
                      <input 
                        type="text" required
                        className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-sesi-blue focus:ring-4 focus:ring-sesi-blue/5 outline-none transition-all font-bold"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">E-mail Corporativo</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                        <input 
                          type="email" required
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-sesi-blue focus:ring-4 focus:ring-sesi-blue/5 outline-none transition-all font-bold"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Senha de Acesso</label>
                      <input 
                        type="password" required={!editingUser}
                        placeholder={editingUser ? "Deixe em branco para manter" : "••••••••"}
                        className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-sesi-blue focus:ring-4 focus:ring-sesi-blue/5 outline-none transition-all font-bold"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Configuração Técnica</h4>
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Função Principal</label>
                      <select 
                        className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-sesi-blue focus:ring-4 focus:ring-sesi-blue/5 outline-none transition-all font-bold"
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                      >
                        {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Conselho Profissional (Ex: CRP)</label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-sesi-blue focus:ring-4 focus:ring-sesi-blue/5 outline-none transition-all font-bold"
                        value={formData.professionalCouncil}
                        onChange={(e) => setFormData({...formData, professionalCouncil: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Expiração do Acesso</label>
                      <div className="relative">
                        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                        <input 
                          type="date"
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-sesi-blue focus:ring-4 focus:ring-sesi-blue/5 outline-none transition-all font-bold"
                          value={formData.expiresAt}
                          onChange={(e) => setFormData({...formData, expiresAt: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Escolas Vinculadas</h4>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {availableUnitsList.map((unit) => (
                        <label 
                          key={unit}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${
                            formData.units.includes(unit) 
                              ? "bg-sesi-blue/5 border-sesi-blue/20 text-sesi-blue" 
                              : "bg-white border-gray-200 text-gray-500 grayscale hover:grayscale-0"
                          }`}
                        >
                          <input 
                            type="checkbox" className="w-4 h-4 rounded text-sesi-blue hidden"
                            checked={formData.units.includes(unit)}
                            onChange={() => toggleUnit(unit)}
                          />
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.units.includes(unit) ? "border-sesi-blue bg-sesi-blue" : "border-gray-300"}`}>
                            {formData.units.includes(unit) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-tight truncate">{unit}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Privilégios de Acesso</h4>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_PERMISSIONS.map((perm) => (
                      <button
                        key={perm.id}
                        type="button"
                        onClick={() => togglePermission(perm.id)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                          formData.permissions.includes(perm.id)
                            ? "bg-sesi-green text-white border-sesi-green shadow-lg shadow-green-100"
                            : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                        }`}
                      >
                        {perm.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 border-t border-gray-100">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-12 h-6 rounded-full relative transition-all ${formData.status === 'active' ? 'bg-sesi-green' : 'bg-gray-200'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.status === 'active' ? 'left-7' : 'left-1'}`} />
                      </div>
                      <input 
                        type="checkbox" className="hidden"
                        checked={formData.status === 'active'}
                        onChange={(e) => setFormData({...formData, status: e.target.checked ? 'active' : 'inactive'})}
                      />
                      <span className="text-xs font-black uppercase text-gray-400 group-hover:text-gray-600">Acesso Ativo</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button 
                      type="button" 
                      onClick={() => setShowModal(false)}
                      className="flex-1 sm:flex-none px-6 py-3 text-gray-400 font-bold uppercase tracking-widest text-[10px]"
                    >
                      Descartar
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 sm:flex-none px-10 py-4 bg-sesi-blue text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-blue-800 shadow-2xl shadow-blue-100 active:scale-95 transition-all"
                    >
                      {editingUser ? "Atualizar Membro" : "Salvar Profissional"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
