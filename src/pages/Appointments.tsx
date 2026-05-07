import React, { useState, useEffect } from "react";
import { Plus, Search, Calendar, Lock, Unlock, FileDown, FileText, LayoutGrid, List, MessageCircle, Trash2, CheckCircle2, XCircle, RefreshCcw, Bell, ShieldAlert, School } from "lucide-react";
import { api } from "../lib/api";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { exportToPDF, exportToWord } from "../lib/export";
import { openWhatsApp } from "../lib/whatsapp";
import { useUnit } from "../contexts/UnitContext";
import { usageService } from "../services/usageService";

export default function Appointments({ user }: any) {
  const { activeUnit } = useUnit();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [students, setStudents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateFilterMode, setDateFilterMode] = useState<'single' | 'upcoming' | 'all'>('single');
  const [isQuickAdd, setIsQuickAdd] = useState(false);
  
  const [formData, setFormData] = useState({
    studentId: "",
    categoryId: "",
    type: "",
    subtype: "",
    origin: "",
    gravity: "low",
    date: format(new Date(), 'yyyy-MM-dd'),
    time: "08:00",
    description: "",
    isConfidential: false,
    newName: "",
    newRA: "",
    newTurma: "",
    personType: "Aluno" as "Aluno" | "Responsável" | "Colaborador"
  });

  useEffect(() => {
    loadData();
  }, [activeUnit]);

  const loadData = async () => {
    try {
      const isSuperAdmin = user?.role === 'super-admin' || user?.id === 'super_admin' || user?.email === 'maykon.euro@gmail.com' || user?.email === 'administrador@exemplo.com';
      const isCentral = activeUnit === 'Administração Central' || activeUnit === 'Sede';
      
      const filters: any = { 
        isAdmin: isSuperAdmin,
        unit: isCentral ? undefined : activeUnit 
      };
      
      if (!isSuperAdmin) {
        filters.professionalId = user.id || user.uid;
        filters.allowedUnits = user?.units || [];
      }

      const [apps, studs, cats, typs] = await Promise.all([
        api.appointments.list(filters),
        api.students.list({ 
          unit: isCentral ? undefined : activeUnit, 
          isAdmin: isSuperAdmin,
          allowedUnits: user?.units || []
        }),
        api.categories.list(),
        api.appointmentTypes.list()
      ]);

      const filteredByUnit = (apps || []).filter((app: any) => {
        const isSuperUser = user?.role === 'super-admin' || user?.id === 'super_admin';
        if (isSuperUser && isCentral) return true;

        const sFromId = (studs as any[]).find((s: any) => s.id === app.studentId || (s as any).ra === app.studentRA);
        const itemUnit = (app.unit || app.schoolUnit || (sFromId as any)?.unit || (sFromId as any)?.name || "").trim().toLowerCase();
        const selectedUnit = (activeUnit || "").trim().toLowerCase();
        const userAllowedUnits = (user?.units || []).map((u: string) => u.trim().toLowerCase());

        if (isCentral) {
           return userAllowedUnits.some((allowed: string) => {
             const cleanAllowed = allowed.replace(/^(sesi|unidade|escola|centro|departamento)\s+/gi, "").trim();
             const cleanItem = itemUnit.replace(/^(sesi|unidade|escola|centro|departamento)\s+/gi, "").trim();
             return itemUnit === allowed || (cleanAllowed !== "" && cleanAllowed === cleanItem);
           });
        }

        return itemUnit === selectedUnit || itemUnit.includes(selectedUnit) || selectedUnit.includes(itemUnit);
      });

      setAppointments(filteredByUnit);
      setStudents(studs as any || []);
      setCategories(cats as any || []);
      setTypes(typs || []);
      
      if (!formData.type && typs && typs.length > 0) {
        const defaultType = user?.role === 'psychologist' ? 'psychological' : 
                          (user?.role === 'aee' || user?.role === 'pedagogue' ? 'pedagogical' : (typs[0] as any).name);
        setFormData(prev => ({ ...prev, type: defaultType }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    setProcessingId(id);
    try {
      await api.appointments.update(id, { status });
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar status");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      let finalStudentId = formData.studentId;

      if (isQuickAdd && !editingId) {
        const newPerson = await usageService.checkAndExecuteAction(
          activeUnit,
          () => api.students.create({
            name: formData.newName,
            ra: formData.personType === 'Aluno' ? formData.newRA : 'N/A',
            turma: formData.personType === 'Aluno' ? formData.newTurma : 'N/A',
            type: formData.personType,
            unit: activeUnit,
            schoolId: activeUnit
          }),
          "Cadastro de Pessoa (Rápido)"
        );
        if (newPerson && newPerson.id) {
          finalStudentId = newPerson.id;
        } else {
          throw new Error("Erro ao cadastrar nova pessoa ou limite atingido.");
        }
      }

      const scheduledDateTime = new Date(`${formData.date}T${formData.time}:00`).toISOString();

      if (editingId) {
        await api.appointments.update(editingId, {
          ...formData,
          studentId: finalStudentId,
          date: scheduledDateTime,
        });
      } else {
        await usageService.checkAndExecuteAction(
          activeUnit,
          () => api.appointments.create({
            ...formData,
            studentId: finalStudentId,
            professionalId: user?.id || "unknown",
            date: scheduledDateTime,
            status: 'confirmed',
            unit: activeUnit
          }),
          "Criação de Atendimento"
        );
      }

      setShowModal(false);
      setEditingId(null);
      setIsQuickAdd(false);
      loadData();
      setFormData({
        studentId: "",
        categoryId: "",
        type: user?.role === 'psychologist' ? 'psychological' : 'pedagogical',
        subtype: "",
        origin: "",
        gravity: "low",
        date: format(new Date(), 'yyyy-MM-dd'),
        time: "08:00",
        description: "",
        isConfidential: false,
        newName: "",
        newRA: "",
        newTurma: "",
        personType: "Aluno"
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (app: any) => {
    const appDate = new Date(app.date);
    setFormData({
      studentId: app.studentId || "",
      categoryId: app.categoryId || "",
      type: app.type || "",
      subtype: app.subtype || "",
      origin: app.origin || "",
      gravity: app.gravity || "low",
      date: format(appDate, 'yyyy-MM-dd'),
      time: format(appDate, 'HH:mm'),
      description: app.description || "",
      isConfidential: app.isConfidential || false,
      newName: "",
      newRA: "",
      newTurma: "",
      personType: "Aluno"
    });
    setEditingId(app.id);
    setShowModal(true);
  };

  const handleExportPDF = (app: any) => {
    const student = students.find((s: any) => s.id === app.studentId || (s as any).ra === app.studentId);
    
    // Fallback caso o aluno não esteja na lista (ex: agendamento de solicitação manual)
    const displayStudent = student || {
      name: app.studentName || 'Não informado',
      ra: app.studentRA || app.newRA || 'N/A',
      class: app.newTurma || app.studentClass || 'N/A',
      unit: app.unit || app.schoolUnit || activeUnit
    };

    exportToPDF(app, displayStudent, user);
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    
    const isAdmin = user?.role === 'admin' || user?.role === 'super-admin' || user?.role === 'superadmin';
    
    if (!isAdmin) {
      alert("Apenas administradores podem excluir registros.");
      return;
    }

    if (!window.confirm("Deseja excluir este registro permanentemente?")) return;
    
    setProcessingId(id);
    try {
      await api.appointments.delete(id);
      await loadData();
    } catch (err: any) {
      alert("Erro ao excluir: " + (err.message || "Erro desconhecido"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleNewAppointment = () => {
    setFormData({
      studentId: "",
      categoryId: "",
      type: user?.role === 'psychologist' ? 'psychological' : 'pedagogical',
      subtype: "",
      origin: "",
      gravity: "low",
      date: format(new Date(), 'yyyy-MM-dd'),
      time: "08:00",
      description: "",
      isConfidential: false,
      newName: "",
      newRA: "",
      newTurma: "",
      personType: "Aluno"
    });
    setEditingId(null);
    setShowModal(true);
  };

  const sortedAppointments = appointments
    .filter(a => {
      if (dateFilterMode === 'all') return true;
      
      // Normalizar a data do registro para comparação (YYYY-MM-DD)
      const appDateOnly = a.date?.split('T')[0];
      const todayDateOnly = format(new Date(), 'yyyy-MM-dd');

      if (dateFilterMode === 'upcoming') {
        return appDateOnly >= todayDateOnly;
      }
      
      return appDateOnly === filterDate;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-4">
          <div className="flex items-center gap-5">
             <div className="bg-gradient-to-br from-pedagogic-blue to-blue-700 text-white p-4 rounded-[1.5rem] shadow-xl shadow-blue-100">
               <Calendar size={32} />
             </div>
             <div>
               <h2 className="text-4xl font-black text-slate-800 tracking-tighter">Agenda da Unidade</h2>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Gestão de Atendimentos por Escola</p>
             </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
             <div className="flex p-1 bg-slate-100 rounded-2xl">
               <select 
                 value={dateFilterMode}
                 onChange={(e) => setDateFilterMode(e.target.value as any)}
                 className="bg-transparent border-none outline-none px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 cursor-pointer"
               >
                 <option value="single">Por Dia</option>
                 <option value="upcoming">De hoje em diante</option>
                 <option value="all">Ver Todas</option>
               </select>
               {dateFilterMode === 'single' && (
                 <input 
                   type="date" 
                   value={filterDate}
                   onChange={(e) => setFilterDate(e.target.value)}
                   className="bg-white rounded-xl border-none outline-none px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1"
                 />
               )}
             </div>
            <button 
              onClick={handleNewAppointment}
              className="bg-pedagogic-blue text-white px-10 py-5 rounded-[1.5rem] flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs hover:bg-blue-700 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 shadow-xl shadow-blue-100"
            >
              <Plus size={18} /> Novo Registro
            </button>
          </div>
        </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4 px-2">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Registros Encontrados</h3>
           <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
              <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-pedagogic-rose"></span> Sigiloso
              </div>
              <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-pedagogic-teal"></span> Normal
              </div>
           </div>
        </div>

        {sortedAppointments.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
             <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-slate-200">
                <Calendar size={40} />
             </div>
             <p className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Nenhum registro para esta data</p>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-black tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Horário / Data</th>
                    <th className="px-8 py-5">Pessoa / Aluno</th>
                    <th className="px-8 py-5">Status / Tipo</th>
                    <th className="px-8 py-5">Laudo / Registro</th>
                    <th className="px-8 py-5 text-right whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedAppointments.map((app: any) => {
                    const student = students.find((s: any) => s.id === app.studentId || (s as any).ra === app.studentId);
                    const studentPhone = student?.contact || app.studentPhone;
                    const appDate = new Date(app.date);

                    return (
                      <tr key={app.id} className="hover:bg-slate-50/50 transition-all group">
                        <td className="px-8 py-6">
                           <div className="flex flex-col">
                             <span className="font-black text-slate-800 text-lg tracking-tighter">
                               {format(appDate, "HH:mm")}
                             </span>
                             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                               {format(appDate, "dd/MM/yyyy")}
                             </span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 font-black uppercase text-xs">
                                {((student as any)?.name || app.studentName || '?').charAt(0)}
                              </div>
                              <div className="flex flex-col overflow-hidden max-w-[150px]">
                                <span className="font-bold text-slate-700 truncate">
                                  {(student as any)?.name || app.studentName || 'Não encontrado'}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                                  Doc: {(student as any)?.ra || app.studentRA || app.newRA || 'N/A'}
                                </span>
                              </div>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex flex-col gap-1">
                             <span className={`text-[9px] uppercase font-black px-3 py-1 rounded-full tracking-widest w-fit ${
                               app.status === 'cancelled' ? 'bg-slate-100 text-slate-400' :
                               app.status === 'rescheduling' ? 'bg-pedagogic-amber/10 text-pedagogic-amber' :
                               'bg-pedagogic-teal/10 text-pedagogic-teal'
                             }`}>
                               {app.status === 'cancelled' ? 'Cancelado' : app.status === 'rescheduling' ? 'Reagendamento' : 'Confirmado'}
                             </span>
                             <span className={`text-[8px] uppercase font-bold tracking-widest opacity-60 ${app.type === 'psychological' ? 'text-purple-600' : 'text-blue-600'}`}>
                               {types.find(t => t.name === app.type)?.label || app.type}
                             </span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                            <div className="max-w-[250px]">
                              <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-relaxed italic">
                                {app.description || "Nenhum laudo ou observação registrada."}
                              </p>
                              {app.isConfidential && (
                                <span className="flex items-center gap-1 text-[8px] font-black text-pedagogic-rose uppercase mt-1">
                                  <Lock size={10} /> Registro Sigiloso
                                </span>
                              )}
                            </div>
                        </td>
                        <td className="px-8 py-6 text-right whitespace-nowrap">
                           <div className="flex justify-end items-center gap-2">
                              <button 
                                onClick={() => handleEdit(app)}
                                className="p-2.5 text-slate-400 hover:text-pedagogic-blue hover:bg-slate-100 rounded-xl transition-all"
                                title="Ver Detalhes/Laudo"
                              >
                                <FileText size={18} />
                              </button>
                              
                              <div className="flex items-center bg-slate-100 rounded-xl p-0.5 mx-1">
                                <button 
                                  onClick={() => handleStatusUpdate(app.id, 'confirmed')} 
                                  className={`p-1.5 rounded-lg transition-all ${app.status === 'confirmed' ? 'bg-white text-pedagogic-teal shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                ><CheckCircle2 size={16} /></button>
                                <button 
                                  onClick={() => handleStatusUpdate(app.id, 'cancelled')} 
                                  className={`p-1.5 rounded-lg transition-all ${app.status === 'cancelled' ? 'bg-white text-pedagogic-rose shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                ><XCircle size={16} /></button>
                              </div>

                              <button onClick={() => handleExportPDF(app)} className="p-2.5 text-slate-400 hover:text-pedagogic-blue hover:bg-slate-100 rounded-xl transition-all"><FileDown size={18} /></button>
                              
                              {(user?.role === 'admin' || user?.role === 'super-admin') && (
                                <button 
                                  onClick={() => handleDelete(app.id)}
                                  className="p-2.5 text-slate-400 hover:text-pedagogic-rose hover:bg-pedagogic-rose/10 rounded-xl transition-all"
                                  title="Excluir"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Scheduling Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-[60] animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl p-12 shadow-2xl flex flex-col gap-8 max-h-[95vh] overflow-y-auto custom-scrollbar relative border border-white">
            <div>
              <h3 className="text-3xl font-black text-slate-800 tracking-tighter">{editingId ? "Editar Atendimento" : "Agendar Atendimento"}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Insira os detalhes do registro</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {!editingId && (
                <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
                   <button 
                     type="button"
                     onClick={() => setIsQuickAdd(false)}
                     className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isQuickAdd ? 'bg-white text-pedagogic-blue shadow-sm' : 'text-slate-400'}`}
                   >
                     Buscar Existente
                   </button>
                   <button 
                     type="button"
                     onClick={() => setIsQuickAdd(true)}
                     className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isQuickAdd ? 'bg-white text-pedagogic-blue shadow-sm' : 'text-slate-400'}`}
                   >
                     Cadastrar Novo
                   </button>
                </div>
              )}

              {isQuickAdd && !editingId ? (
                <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2 md:col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipo de Pessoa</label>
                      <select 
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none"
                        value={formData.personType}
                        onChange={(e) => setFormData({...formData, personType: e.target.value as any})}
                      >
                         <option value="Aluno">Aluno</option>
                         <option value="Responsável">Responsável</option>
                         <option value="Colaborador">Colaborador</option>
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome Completo</label>
                       <input 
                         type="text"
                         className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none"
                         placeholder="Digite o nome completo..."
                         value={formData.newName}
                         onChange={(e) => setFormData({...formData, newName: e.target.value})}
                       />
                    </div>
                  </div>

                  {formData.personType === 'Aluno' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                       <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">RA (Matrícula)</label>
                          <input 
                            type="text"
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none"
                            placeholder="Ex: 12345"
                            value={formData.newRA}
                            onChange={(e) => setFormData({...formData, newRA: e.target.value})}
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Turma</label>
                          <input 
                            type="text"
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none"
                            placeholder="Ex: 3º Ano A"
                            value={formData.newTurma}
                            onChange={(e) => setFormData({...formData, newTurma: e.target.value})}
                          />
                       </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pessoa / Estudante</label>
                  <select 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all"
                    value={formData.studentId}
                    onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                  >
                    <option value="">Escolher da lista...</option>
                    {students.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.type || 'Aluno'}{s.ra && s.ra !== 'N/A' ? ` - RA: ${s.ra}` : ''})</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipo de Atenção</label>
                  <select 
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all disabled:opacity-50"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    disabled={user?.role !== 'admin' && user?.role !== 'super-admin'}
                  >
                    {types.map(t => (
                      <option key={t.id} value={t.name}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Subtipo / Tema Principal</label>
                  <select 
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all cursor-pointer"
                    value={formData.subtype}
                    onChange={(e) => setFormData({...formData, subtype: e.target.value})}
                  >
                    <option value="">Selecione o subtipo...</option>
                    <option value="Conflito Familiar">Conflito Familiar</option>
                    <option value="Dificuldade de Aprendizado">Dificuldade de Aprendizado</option>
                    <option value="Transtorno Emocional">Transtorno Emocional (Ansiedade/Depressão)</option>
                    <option value="Bullying">Bullying / Conflito entre Pares</option>
                    <option value="Abuso ou Negligência">Abuso ou Negligência</option>
                    <option value="Orientação Profissional">Orientação Profissional</option>
                    <option value="Indisciplina">Indisciplina / Regras Escolares</option>
                    <option value="Luto">Luto / Perda</option>
                    <option value="Socialização">Socialização / Isolamento</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Origem da Demanda</label>
                  <select 
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all cursor-pointer"
                    value={formData.origin}
                    onChange={(e) => setFormData({...formData, origin: e.target.value})}
                  >
                    <option value="">Selecione a origem...</option>
                    <option value="Espontânea">Busca Espontânea (Próprio Aluno)</option>
                    <option value="Escola">Encaminhamento da Escola (Coordenação/Docente)</option>
                    <option value="Família">Encaminhamento da Família</option>
                    <option value="Judicial">Ordem Judicial</option>
                    <option value="Conselho Tutelar">Conselho Tutelar</option>
                    <option value="Rede de Saúde">Rede de Saúde (SUS/Clínica)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nível de Gravidade / Urgência</label>
                  <select 
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all cursor-pointer"
                    value={formData.gravity}
                    onChange={(e) => setFormData({...formData, gravity: e.target.value})}
                  >
                    <option value="low">Baixa - Acompanhamento de Rotina</option>
                    <option value="medium">Média - Necessita Intervenção Breve</option>
                    <option value="high">Alta - Risco à Aprendizagem ou Socialização</option>
                    <option value="critical">Crítica - Risco Imediato (Vida/Integridade)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Data</label>
                  <input 
                    type="date" required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Horário</label>
                  <input 
                    type="time" required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Laudo / Descrição do Atendimento</label>
                <textarea 
                  required
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all min-h-[150px]"
                  placeholder="Descreva o atendimento ou cole o laudo aqui..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>

               <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={formData.isConfidential}
                    onChange={(e) => setFormData({...formData, isConfidential: e.target.checked})}
                    id="isConfidential-modal"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pedagogic-rose"></div>
                </div>
                <label htmlFor="isConfidential-modal" className="text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer">
                  Marcar como Informação Sigilosa
                </label>
              </div>

              <div className="flex flex-col md:flex-row justify-end gap-4 mt-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all"
                >
                  Cancelar
                </button>
                <button className="bg-pedagogic-blue text-white px-12 py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-xs hover:bg-blue-700 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 shadow-xl shadow-blue-100">
                  {editingId ? "Salvar Alterações" : "Confirmar Registro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
