import React, { useState, useEffect } from "react";
import { Plus, Search, FileText, Download, Trash2, Eye, ChevronRight, School, User, Calendar as CalendarIcon, ClipboardCheck, FileCheck, FileSignature, FileWarning, X, Settings, TrendingUp, LayoutGrid, List, ChevronDown, ChevronUp, UserPlus, CheckCircle2, Users, GraduationCap } from "lucide-react";
import { api } from "../lib/api";
import { GoogleGenAI } from "@google/genai";
import { generateDocumentPDF } from "../lib/documentGenerator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUnit } from "../contexts/UnitContext";

const DOCUMENT_TYPES = [
  { id: 'school_diagnosis', name: 'Diagnóstico Escolar', icon: <School size={20} /> },
  { id: 'psychological_listening', name: 'Registro de Escuta Psicológica', icon: <User size={20} /> },
  { id: 'group_attendance', name: 'Atendimento em Grupo', icon: <Users size={20} /> },
  { id: 'pedagogical_participation', name: 'Participação em Ativ. Pedagógicas', icon: <GraduationCap size={20} /> },
  { id: 'classroom_evolution', name: 'Ficha de Evolução em Sala', icon: <TrendingUp size={20} /> },
  { id: 'referral', name: 'Encaminhamento', icon: <ChevronRight size={20} /> },
  { id: 'attendance_declaration', name: 'Declaração de Comparecimento', icon: <FileCheck size={20} /> },
  { id: 'authorization_term', name: 'Termo de Autorização', icon: <FileSignature size={20} /> },
];

export default function Documents({ user }: { user: any }) {
  const { activeUnit } = useUnit();
  const [documents, setDocuments] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [schoolsList, setSchoolsList] = useState<any[]>([]);
  const [letterheads, setLetterheads] = useState<any[]>([]);
  const [documentLayouts, setDocumentLayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [shouldGroup, setShouldGroup] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(DOCUMENT_TYPES.map(t => t.id));
  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [layoutToEdit, setLayoutToEdit] = useState<any>(null);
  const [layoutFormData, setLayoutFormData] = useState({
    letterheadId: "",
    showProfessionalSignature: true,
    showDate: true
  });
  
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<any>(null);
  const [docBeingEdited, setDocBeingEdited] = useState<any>(null);
  
  // Form states
  const [formData, setFormData] = useState<any>({});
  const [selectedStudentForDoc, setSelectedStudentForDoc] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [activeUnit]);

  const loadData = async () => {
    try {
      const isSuperAdmin = user?.role === 'super-admin' || user?.id === 'super_admin' || user?.email === 'maykon.euro@gmail.com' || user?.email === 'administrador@exemplo.com';
      const isCentral = activeUnit === 'Administração Central' || activeUnit === 'Sede';
      
      const filters: any = { 
        unit: isCentral ? undefined : activeUnit, 
        isAdmin: isSuperAdmin 
      };
      
      if (!isSuperAdmin) {
        filters.professionalId = user.id || user.uid;
        filters.allowedUnits = user?.units || [];
      }

      const [docs, studs, lheads, layouts, schools] = await Promise.all([
        api.documents.list(filters),
        api.students.list({ 
          unit: isCentral ? undefined : activeUnit, 
          isAdmin: isSuperAdmin, 
          allowedUnits: user?.units || [] 
        }),
        api.letterheads.listAvailable(user?.id || user?.uid, activeUnit),
        api.documentLayouts.list(),
        api.schools.list({ 
          isAdmin: isSuperAdmin, 
          allowedUnits: user?.units || [] 
        })
      ]);
      setDocuments(docs || []);
      setStudents(studs || []);
      setLetterheads(lheads || []);
      setDocumentLayouts(layouts || []);
      setSchoolsList(schools || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLayoutModal = (docType: string) => {
    const existing = documentLayouts.find(l => l.documentTypeId === docType);
    setLayoutToEdit(docType);
    setLayoutFormData({
      letterheadId: existing?.letterheadId || "",
      showProfessionalSignature: existing?.showProfessionalSignature ?? true,
      showDate: existing?.showDate ?? true
    });
    setShowLayoutModal(true);
  };

  const handleSaveLayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!layoutToEdit) return;

    try {
      await api.documentLayouts.upsert(layoutToEdit, layoutFormData);
      setShowLayoutModal(false);
      loadData();
    } catch (err: any) {
      alert("Erro ao salvar layout: " + err.message);
    }
  };

  const handleEdit = (doc: any) => {
    setDocBeingEdited(doc);
    setSelectedType(doc.type);
    // Ensure studentId and letterheadId are part of formData
    setFormData({ 
      ...(doc.data || {}), 
      studentId: doc.studentId,
      letterheadId: doc.letterheadId || "" 
    });
    const student = students.find(s => s.id === doc.studentId);
    setSelectedStudentForDoc(student || null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || saving) return;
    
    if (!['school_diagnosis', 'group_attendance', 'pedagogical_participation'].includes(selectedType) && !formData.studentId) {
      alert("Por favor, selecione um aluno antes de salvar.");
      return;
    }

    const isEditing = !!docBeingEdited;
    console.log('[Documentos] Iniciando salvamento...', { isEditing, selectedType, studentId: formData.studentId });

    setSaving(true);
    try {
      const student = students.find(s => s.id === formData.studentId);
      
      // Se não houver letterheadId no formData, usamos o default do layout se existir
      const defaultLayout = documentLayouts.find(l => l.documentTypeId === selectedType);
      const letterheadIdToSave = formData.letterheadId || defaultLayout?.letterheadId || "";

      const payload = {
        type: selectedType,
        typeName: DOCUMENT_TYPES.find(t => t.id === selectedType)?.name,
        studentId: formData.studentId || "",
        studentName: student?.name || (['group_attendance', 'pedagogical_participation'].includes(selectedType) ? 'Atividade Coletiva' : 'N/A'),
        studentRa: student?.ra || '',
        studentClass: student?.class || '',
        studentSchool: schoolsList.find(sc => sc.id === student?.schoolId)?.name || '',
        professionalId: user?.id || user?.uid || 'unknown',
        professionalName: user?.name || 'N/A',
        professionalCouncil: user?.professionalCouncil || '',
        unit: activeUnit,
        letterheadId: letterheadIdToSave,
        data: formData,
        date: isEditing ? docBeingEdited.date : new Date().toISOString()
      };

      if (isEditing) {
        await api.documents.update(docBeingEdited.id, payload);
      } else {
        await api.documents.create(payload);
      }
      
      setShowModal(false);
      setDocBeingEdited(null);
      setSelectedType(null);
      setFormData({});
      setSelectedStudentForDoc(null);
      await loadData();
      alert(isEditing ? "Registro atualizado com sucesso!" : "Registro criado com sucesso!");
    } catch (err: any) {
      alert("Erro ao salvar documento: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredDocs = documents.filter(doc => {
    const docDate = new Date(doc.date);
    const matchesSearch = String(doc.studentName || "").toLowerCase().includes(search.toLowerCase()) ||
                        String(doc.typeName || "").toLowerCase().includes(search.toLowerCase());
    
    const matchesDay = !filterDay || docDate.getDate() === parseInt(filterDay);
    const matchesMonth = !filterMonth || (docDate.getMonth() + 1) === parseInt(filterMonth);
    const matchesYear = !filterYear || docDate.getFullYear() === parseInt(filterYear);

    return matchesSearch && matchesDay && matchesMonth && matchesYear;
  });

  const toggleGroup = (typeId: string) => {
    setExpandedGroups(prev => 
      prev.includes(typeId) ? prev.filter(id => id !== typeId) : [...prev, typeId]
    );
  };

  const groupedDocs = DOCUMENT_TYPES.map(type => ({
    ...type,
    docs: filteredDocs.filter(doc => doc.type === type.id)
  })).filter(group => group.docs.length > 0);

  if (loading) return <div className="p-8 text-center flex flex-col items-center gap-4">
    <div className="w-12 h-12 border-4 border-sesi-blue/20 border-t-sesi-blue rounded-full animate-spin"></div>
    <p className="text-sesi-blue font-bold">Carregando documentos...</p>
  </div>;

  const handleDeleteDocument = async (docId: string) => {
    if (!docId) return;

    setProcessingId(docId);
    try {
      console.log("[DEBUG] Chamando api.documents.delete para:", docId);
      await api.documents.delete(docId);
      
      // Atualização otimista imediata
      setDocuments(prev => prev.filter(d => d.id !== docId));
      console.log("[DEBUG] Sucesso na exclusão do documento do estado local.");
      
      setDocToDelete(null);
      // Usar um tempo pequeno para o modal fechar antes do alert
      setTimeout(() => alert("Documento excluído com sucesso!"), 100);
      await loadData(); // Sincroniza com o servidor
    } catch (err: any) {
      console.error("[DEBUG] Erro catastrófico na exclusão:", err);
      let errorMsg = err.message;
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) errorMsg = parsed.error;
      } catch (e) {}
      alert("Erro técnico ao excluir: " + errorMsg + "\n\nPor favor, verifique sua conexão ou tente novamente.");
    } finally {
      setProcessingId(null);
    }
  };

  const renderDocumentCard = (doc: any) => (
    <div 
      key={doc.id} 
      onClick={() => handleEdit(doc)}
      className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="bg-blue-50 p-2 rounded-lg text-sesi-blue group-hover:bg-sesi-blue group-hover:text-white transition-colors">
          <FileText size={24} />
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
            {format(new Date(doc.date), 'dd/MM/yyyy')}
          </span>
          <span className="text-[9px] text-gray-400 mt-1">ID: {doc.id.substring(0, 8)}</span>
        </div>
      </div>
      <h3 className="font-bold text-gray-900 mb-1 truncate" title={doc.typeName}>{doc.typeName}</h3>
      <p className="text-sm text-gray-600 mb-4">Aluno: <span className="font-medium">{doc.studentName}</span></p>
      
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button 
            disabled={!!processingId}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setProcessingId(doc.id);
              try {
                const layout = documentLayouts.find(l => l.documentTypeId === doc.type);
                // Prioritize document's specific letterheadId, then fall back to layout default
                const targetLhId = doc.letterheadId || layout?.letterheadId;
                const letterhead = letterheads.find(lh => lh.id === targetLhId);
                
                // Injetar dados do profissional logado no momento da visualização/download conforme solicitado
                const docWithProfessional = {
                  ...doc,
                  professionalName: user?.name || doc.professionalName,
                  professionalCouncil: user?.professionalCouncil || doc.professionalCouncil
                };
                await generateDocumentPDF(docWithProfessional, layout, letterhead, 'preview');
              } catch (err) {
                console.error(err);
                alert("Erro ao visualizar documento.");
              } finally {
                setProcessingId(null);
              }
            }}
            className="flex-1 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {processingId === doc.id ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-gray-600 rounded-full animate-spin"></div>
            ) : 'Visualizar'}
          </button>
          <button 
            disabled={!!processingId}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setProcessingId(doc.id);
              try {
                const layout = documentLayouts.find(l => l.documentTypeId === doc.type);
                // Prioritize document's specific letterheadId, then fall back to layout default
                const targetLhId = doc.letterheadId || layout?.letterheadId;
                const letterhead = letterheads.find(lh => lh.id === targetLhId);
                
                // Injetar dados do profissional logado no momento da visualização/download conforme solicitado
                const docWithProfessional = {
                  ...doc,
                  professionalName: user?.name || doc.professionalName,
                  professionalCouncil: user?.professionalCouncil || doc.professionalCouncil
                };
                await generateDocumentPDF(docWithProfessional, layout, letterhead, 'download');
              } catch (err) {
                console.error(err);
                alert("Erro ao baixar documento.");
              } finally {
                setProcessingId(null);
              }
            }}
            className="flex-1 py-2 text-sesi-blue bg-blue-50 rounded-lg text-sm font-bold hover:bg-sesi-blue hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {processingId === doc.id ? (
              <div className="w-4 h-4 border-2 border-blue-200 border-t-sesi-blue rounded-full animate-spin"></div>
            ) : (
              <>
                <Download size={16} /> Baixar
              </>
            )}
          </button>
        </div>
        <div className="flex gap-2">
          {(user?.role === 'admin' || user?.permissions?.includes('admin')) && (
            <button 
              disabled={!!processingId}
              onClick={(e) => { e.stopPropagation(); handleOpenLayoutModal(doc.type); }}
              className="flex-1 py-2 text-gray-400 border border-gray-100 rounded-lg text-xs hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Settings size={14} /> Layout
            </button>
          )}
          <button 
            type="button"
            disabled={processingId === doc.id}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (user?.role !== 'admin' && !user?.permissions?.includes('admin')) {
                alert("Permissão insuficiente para excluir.");
                return;
              }
              setDocToDelete(doc);
            }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title={user?.role === 'admin' ? "Excluir Documento" : "Apenas administradores podem excluir"}
          >
            {processingId === doc.id ? (
              <div className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
            ) : (
              <Trash2 size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderDocumentRow = (doc: any) => (
    <tr 
      key={doc.id} 
      onClick={() => handleEdit(doc)}
      className="hover:bg-gray-50 transition-colors border-b border-gray-50 cursor-pointer group"
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <FileText size={18} className="text-sesi-blue group-hover:scale-110 transition-transform" />
          <div>
            <p className="font-bold text-gray-900 leading-tight">{doc.typeName}</p>
            <p className="text-[10px] text-gray-400">ID: {doc.id.substring(0, 8)}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="font-medium text-gray-700">{doc.studentName}</span>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">
        {format(new Date(doc.date), 'dd/MM/yyyy')}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex justify-end gap-2">
          <button 
            disabled={!!processingId}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setProcessingId(doc.id);
              try {
                const layout = documentLayouts.find(l => l.documentTypeId === doc.type);
                // Prioritize document's specific letterheadId, then fall back to layout default
                const targetLhId = doc.letterheadId || layout?.letterheadId;
                const letterhead = letterheads.find(lh => lh.id === targetLhId);
                
                // Injetar dados do profissional logado no momento da visualização/download conforme solicitado
                const docWithProfessional = {
                  ...doc,
                  professionalName: user?.name || doc.professionalName,
                  professionalCouncil: user?.professionalCouncil || doc.professionalCouncil
                };
                await generateDocumentPDF(docWithProfessional, layout, letterhead, 'preview');
              } catch (err) {
                console.error(err);
                alert("Erro ao visualizar documento.");
              } finally {
                setProcessingId(null);
              }
            }}
            className="p-2 text-gray-400 hover:text-sesi-blue hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            title="Visualizar"
          >
            {processingId === doc.id ? <div className="w-4 h-4 border-2 border-sesi-blue/20 border-t-sesi-blue rounded-full animate-spin" /> : <Eye size={18} />}
          </button>
          <button 
            disabled={!!processingId}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setProcessingId(doc.id);
              try {
                const layout = documentLayouts.find(l => l.documentTypeId === doc.type);
                // Prioritize document's specific letterheadId, then fall back to layout default
                const targetLhId = doc.letterheadId || layout?.letterheadId;
                const letterhead = letterheads.find(lh => lh.id === targetLhId);
                
                // Injetar dados do profissional logado
                const docWithProfessional = {
                  ...doc,
                  professionalName: user?.name || doc.professionalName,
                  professionalCouncil: user?.professionalCouncil || doc.professionalCouncil
                };
                await generateDocumentPDF(docWithProfessional, layout, letterhead, 'download');
              } catch (err) {
                console.error(err);
                alert("Erro ao baixar documento.");
              } finally { setProcessingId(null); }
            }}
            className="p-2 text-sesi-blue hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            title="Baixar"
          >
            {processingId === doc.id ? <div className="w-4 h-4 border-2 border-sesi-blue/20 border-t-sesi-blue rounded-full animate-spin" /> : <Download size={18} />}
          </button>
          <button 
            disabled={processingId === doc.id}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (user?.role !== 'admin' && !user?.permissions?.includes('admin')) {
                alert("Permissão insuficiente para excluir.");
                return;
              }
              setDocToDelete(doc);
            }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title={user?.role === 'admin' ? "Excluir" : "Apenas administradores podem excluir"}
          >
            {processingId === doc.id ? <div className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" /> : <Trash2 size={18} />}
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
           <div className="bg-gradient-to-br from-pedagogic-blue to-blue-700 text-white p-4 rounded-[1.5rem] shadow-xl shadow-blue-100">
             <FileText size={32} />
           </div>
           <div>
             <h2 className="text-3xl font-black text-slate-800 tracking-tight">Atendimentos</h2>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Registros de Evolução e Documentação</p>
           </div>
        </div>
        <button 
          onClick={() => { setDocBeingEdited(null); setSelectedType(null); setFormData({}); setSelectedStudentForDoc(null); setShowModal(true); }}
          className="bg-pedagogic-blue text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-black uppercase tracking-widest text-xs hover:bg-blue-700 hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-95 shadow-xl shadow-blue-100"
        >
          <Plus size={18} /> Novo Registro
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row gap-6 items-center">
        <div className="flex-1 flex items-center gap-3 bg-[#f8fafc] px-6 py-4 rounded-2xl border border-slate-100 focus-within:ring-4 focus-within:ring-pedagogic-blue/5 transition-all w-full">
          <Search size={20} className="text-slate-300" />
          <input 
            type="text" 
            placeholder="Buscar por aluno ou tipo..." 
            className="bg-transparent outline-none text-slate-600 font-bold placeholder:text-slate-300 flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            className="bg-[#f8fafc] px-4 py-3 rounded-xl border border-slate-100 outline-none text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all cursor-pointer hover:bg-slate-50"
          >
            <option value="">Dia</option>
            {Array.from({length: 31}, (_, i) => (
              <option key={i+1} value={i+1}>{i+1}</option>
            ))}
          </select>

          <select 
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-[#f8fafc] px-4 py-3 rounded-xl border border-slate-100 outline-none text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all cursor-pointer hover:bg-slate-50"
          >
            <option value="">Mês</option>
            {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>

          <select 
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="bg-[#f8fafc] px-4 py-3 rounded-xl border border-slate-100 outline-none text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all cursor-pointer hover:bg-slate-50"
          >
            <option value="">Ano</option>
            {Array.from({length: 5}, (_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex p-1 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
            <button 
              onClick={() => setViewMode("grid")}
              className={`p-2.5 rounded-xl transition-all ${viewMode === "grid" ? "bg-pedagogic-blue text-white shadow-lg shadow-blue-100" : "text-slate-400 hover:bg-white hover:text-pedagogic-blue"}`}
              title="Blocos"
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`p-2.5 rounded-xl transition-all ${viewMode === "list" ? "bg-pedagogic-blue text-white shadow-lg shadow-blue-100" : "text-slate-400 hover:bg-white hover:text-pedagogic-blue"}`}
              title="Lista"
            >
              <List size={20} />
            </button>
          </div>
          
          <button 
            onClick={() => setShouldGroup(!shouldGroup)}
            className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${shouldGroup ? 'bg-pedagogic-blue/5 border-pedagogic-blue/20 text-pedagogic-blue' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white'}`}
          >
            {shouldGroup ? 'Agrupado' : 'Simples'}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {shouldGroup ? (
          groupedDocs.map(group => (
            <div key={group.id} className="space-y-4">
              <button 
                onClick={() => toggleGroup(group.id)}
                className="flex items-center justify-between w-full p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-sesi-blue text-white p-2 rounded-lg">
                    {group.icon}
                  </div>
                  <h3 className="font-black text-sesi-blue uppercase tracking-wider text-sm">{group.name}</h3>
                  <span className="bg-sesi-blue/10 text-sesi-blue px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {group.docs.length}
                  </span>
                </div>
                {expandedGroups.includes(group.id) ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </button>

              {expandedGroups.includes(group.id) && (
                viewMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {group.docs.map(renderDocumentCard)}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-3">Documento</th>
                          <th className="px-6 py-3">Aluno</th>
                          <th className="px-6 py-3">Data</th>
                          <th className="px-6 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.docs.map(renderDocumentRow)}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          ))
        ) : (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map(renderDocumentCard)}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Documento</th>
                    <th className="px-6 py-3">Aluno</th>
                    <th className="px-6 py-3">Data</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map(renderDocumentRow)}
                </tbody>
              </table>
            </div>
          )
        )}

        {(filteredDocs.length === 0) && (
          <div className="p-20 text-center flex flex-col items-center justify-center gap-4 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <div className="bg-gray-50 p-6 rounded-full text-gray-300">
              <FileWarning size={48} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-400">Nenhum documento encontrado</p>
              <p className="text-sm text-gray-300">Tente buscar por outro termo ou remova os filtros.</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {docBeingEdited 
                  ? `Editando: ${docBeingEdited.typeName}`
                  : selectedType 
                    ? `Novo: ${DOCUMENT_TYPES.find(t => t.id === selectedType)?.name}` 
                    : 'Selecionar Tipo de Documento'
                }
              </h3>
              <button 
                onClick={() => { 
                  setShowModal(false); 
                  setDocBeingEdited(null);
                  setSelectedType(null); 
                  setFormData({}); 
                  setSelectedStudentForDoc(null); 
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            {!selectedType ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DOCUMENT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className="flex items-center gap-4 p-4 border rounded-xl hover:border-sesi-blue hover:bg-blue-50 transition-all text-left group"
                  >
                    <div className="bg-gray-100 p-3 rounded-lg text-gray-500 group-hover:bg-sesi-blue group-hover:text-white transition-colors">
                      {type.icon}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{type.name}</p>
                      <p className="text-xs text-gray-500">Clique para preencher o formulário</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                {/* Common Field: Student Selection */}
                {!['school_diagnosis', 'group_attendance', 'pedagogical_participation'].includes(selectedType) && (
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-sesi-blue uppercase tracking-tight">Identificação da Pessoa</label>
                    <StudentSelector 
                      students={students}
                      schools={schoolsList}
                      selectedStudent={selectedStudentForDoc}
                      onRefresh={loadData}
                      onSelect={(s: any) => {
                        setSelectedStudentForDoc(s);
                        setFormData({...formData, studentId: s.id});
                      }}
                    />
                  </div>
                )}

                {/* Letterhead Selection */}
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-sesi-blue mb-1">
                    <Settings size={18} />
                    <span className="text-sm font-bold uppercase tracking-tight">Modelo de Timbrado</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <select 
                        className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue text-sm font-medium"
                        value={formData.letterheadId || ""}
                        onChange={(e) => setFormData({...formData, letterheadId: e.target.value})}
                      >
                        <option value="">Usar padrão definido para este tipo</option>
                        {letterheads.map(lh => (
                          <option key={lh.id} value={lh.id}>
                            {lh.name} {lh.isDefault ? '(Padrão do Sistema)' : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-blue-600 mt-1">Este timbrado aparecerá no cabeçalho/rodapé do documento.</p>
                    </div>
                    {formData.letterheadId && (
                      <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-blue-200">
                        <img 
                          src={letterheads.find(l => l.id === formData.letterheadId)?.logoUrl || ""} 
                          alt="Preview" 
                          className="h-10 object-contain" 
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Prévia do Cabeçalho</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Specific Forms */}
                {selectedType === 'school_diagnosis' && <SchoolDiagnosisForm formData={formData} setFormData={setFormData} user={user} />}
                {selectedType === 'psychological_listening' && (
                  <PsychologicalListeningForm 
                    formData={formData} 
                    setFormData={setFormData} 
                    studentName={students.find(s => s.id === formData.studentId)?.name} 
                  />
                )}
                {selectedType === 'group_attendance' && (
                  <GroupAttendanceForm 
                    formData={formData} 
                    setFormData={setFormData}
                    studentName={students.find(s => s.id === formData.studentId)?.name}
                  />
                )}
                {selectedType === 'pedagogical_participation' && (
                  <PedagogicalParticipationForm 
                    formData={formData} 
                    setFormData={setFormData}
                    studentName={students.find(s => s.id === formData.studentId)?.name}
                  />
                )}
                {selectedType === 'classroom_evolution' && (
                  <ClassroomEvolutionForm 
                    formData={formData} 
                    setFormData={setFormData} 
                    studentName={students.find(s => s.id === formData.studentId)?.name}
                  />
                )}
                {selectedType === 'referral' && <ReferralForm formData={formData} setFormData={setFormData} />}
                {selectedType === 'attendance_declaration' && <AttendanceDeclarationForm formData={formData} setFormData={setFormData} user={user} />}
                {selectedType === 'authorization_term' && <AuthorizationTermForm formData={formData} setFormData={setFormData} />}

                <div className="flex justify-end gap-3 pt-6 border-t">
                  <button 
                    type="button"
                    onClick={() => {
                      if (docBeingEdited) {
                        setShowModal(false);
                        setDocBeingEdited(null);
                        setSelectedType(null);
                      } else {
                        setSelectedType(null);
                      }
                    }}
                    className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {docBeingEdited ? 'Voltar/Cancelar' : 'Voltar'}
                  </button>
                  <button 
                    disabled={saving}
                    type="submit"
                    className={`px-8 py-2 ${docBeingEdited ? 'bg-sesi-blue' : 'bg-sesi-green'} text-white font-bold rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2`}
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Salvando...
                      </>
                    ) : (docBeingEdited ? 'Salvar Alterações (Atualizar)' : 'Salvar e Gerar')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Layout Customization Modal */}
      {showLayoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">Personalizar Layout</h3>
              <button onClick={() => setShowLayoutModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveLayout} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selecionar Timbrado</label>
                <select 
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  value={layoutFormData.letterheadId}
                  onChange={(e) => setLayoutFormData({...layoutFormData, letterheadId: e.target.value})}
                >
                  <option value="">Selecione um timbrado...</option>
                  {letterheads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                {letterheads.length === 0 && (
                  <p className="text-[10px] text-red-500 mt-1">Nenhum timbrado cadastrado. Vá em Configurações para adicionar.</p>
                )}
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={layoutFormData.showProfessionalSignature}
                    onChange={(e) => setLayoutFormData({...layoutFormData, showProfessionalSignature: e.target.checked})}
                    className="w-4 h-4 text-sesi-blue rounded border-gray-300 focus:ring-sesi-blue"
                  />
                  <span className="text-sm text-gray-700">Mostrar campo de assinatura do profissional</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={layoutFormData.showDate}
                    onChange={(e) => setLayoutFormData({...layoutFormData, showDate: e.target.checked})}
                    className="w-4 h-4 text-sesi-blue rounded border-gray-300 focus:ring-sesi-blue"
                  />
                  <span className="text-sm text-gray-700">Mostrar data no documento</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t">
                <button 
                  type="button"
                  onClick={() => setShowLayoutModal(false)}
                  className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-8 py-2 bg-sesi-blue text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Salvar Layout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deletion */}
      {docToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-red-100 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            
            <h3 className="text-xl font-black text-gray-900 text-center mb-2">Confirmar Exclusão?</h3>
            <p className="text-gray-500 text-center text-sm mb-6">
              Você está prestes a excluir o documento de <span className="font-bold text-gray-800">{docToDelete.studentName}</span>.
              <br/>
              <span className="text-xs text-gray-400 mt-2 block">ID: {docToDelete.id}</span>
            </p>

            <div className="flex flex-col gap-3">
              <button
                disabled={processingId === docToDelete.id}
                onClick={() => handleDeleteDocument(docToDelete.id)}
                className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-red-700 transition shadow-lg shadow-red-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processingId === docToDelete.id ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  "Excluir Agora"
                )}
              </button>
              <button
                disabled={processingId === docToDelete.id}
                onClick={() => setDocToDelete(null)}
                className="w-full py-4 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition"
              >
                Manter Documento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components for Forms ---

const SchoolDiagnosisForm = ({ formData, setFormData, user }: any) => {
  const [generatingInsights, setGeneratingInsights] = useState(false);

  const POSITIVE_INDICATORS = [
    { id: 'gestao_apoio', label: 'Equipe gestora oferece suporte emocional ativo?', weight: 1.25 },
    { id: 'projeto_seo', label: 'Possui projeto de educação socioemocional estruturado?', weight: 1.25 },
    { id: 'rede_apoio', label: 'Rede de apoio externa (CRAS/CREAS) bem estabelecida?', weight: 1.25 },
    { id: 'ambiente_acolhedor', label: 'O ambiente físico da escola é percebido como acolhedor?', weight: 1.25 },
    { id: 'comunicacao_familia', label: 'Há canais de comunicação fluida e ativa com as famílias?', weight: 1.25 },
    { id: 'prevencao_bullying', label: 'Ações preventivas contra bullying são realizadas regularmente?', weight: 1.25 },
    { id: 'capacitacao_professores', label: 'Professores recebem capacitação periódica em saúde mental?', weight: 1.25 },
    { id: 'escuta_ativa', label: 'Há um serviço de escuta ativa acessível para os alunos?', weight: 1.25 },
  ];

  const DIFFICULTIES = [
    'Ansiedade', 'Automutilação', 'Dificuldades em relacionar-se com o outro e participar das atividades',
    'Dificuldades em resolver conflitos', 'Descontrole emocional', 'Comportamentos disruptivos',
    'Sintomas depressivos', 'Vítimas de qualquer tipo de violência (física, verbal, moral, psicológica, sexual)',
    'Envolvimento com álcool e outras drogas', 'Falta de apoio familiar', 'Sexualidade'
  ];

  const calculateScore = () => {
    const selected = formData.indicators || [];
    const score = POSITIVE_INDICATORS.reduce((acc, curr) => {
      return selected.includes(curr.id) ? acc + curr.weight : acc;
    }, 0);
    return Math.min(10, score).toFixed(1);
  };

  const handleGenerateInsights = async () => {
    if (!formData.school) {
      alert("Por favor, informe o nome da escola primeiro.");
      return;
    }
    
    setGeneratingInsights(true);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "undefined" || apiKey === "") {
        throw new Error("API Key não configurada. Se estiver no Vercel, adicione GEMINI_API_KEY às variáveis de ambiente do projeto.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        Aja como um especialista em Psicologia Escolar.
        Analise os dados deste Diagnóstico Escolar e sugira um plano de ação estratégico (3-5 pontos) para os itens que a escola NÃO atende.
        
        Dados da Escola: ${formData.school}
        Dificuldades registradas: ${(formData.dificuldades || []).join(', ')}
        Indicadores Positivos (Atendidos): ${POSITIVE_INDICATORS.filter(i => formData.indicators?.includes(i.id)).map(i => i.label).join(', ')}
        Indicadores Não Atendidos: ${POSITIVE_INDICATORS.filter(i => !formData.indicators?.includes(i.id)).map(i => i.label).join(', ')}
        
        Sua nota total de desenvolvimento ideal foi: ${calculateScore()}/10.
        
        Responda de forma profissional e direta, focada em melhoria do bem-estar psicossocial.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt
      });
      
      if (response.text) {
        setFormData({ ...formData, aiInsights: response.text });
      } else {
        throw new Error("Resposta da IA vazia");
      }
    } catch (err: any) {
      console.error("AI Insights Error:", err);
      alert("Erro ao gerar insights via IA: " + (err.message || "Tente novamente mais tarde."));
    } finally {
      setGeneratingInsights(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="md:col-span-2 bg-blue-50 p-4 rounded-xl mb-4">
        <h4 className="font-bold text-sesi-blue mb-2 flex items-center gap-2">
          <School size={18} /> Dados Institucionais
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Escola</label>
            <input required type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.school || ''} onChange={(e) => setFormData({...formData, school: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Diretor(a)</label>
            <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.director || ''} onChange={(e) => setFormData({...formData, director: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contato Diretor</label>
            <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.directorContact || ''} onChange={(e) => setFormData({...formData, directorContact: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Diretor(a) Adjunto(a)</label>
            <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.assistantDirector || ''} onChange={(e) => setFormData({...formData, assistantDirector: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contato Adjunto</label>
            <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.assistantDirectorContact || ''} onChange={(e) => setFormData({...formData, assistantDirectorContact: e.target.value})} />
          </div>
        </div>
      </div>

      <div className="md:col-span-2">
        <h4 className="font-bold text-gray-700 mb-4 border-b pb-2">Maiores Dificuldades dos Alunos</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DIFFICULTIES.map(opt => (
            <label key={opt} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
              <input type="checkbox" className="mt-1" checked={!!formData.dificuldades?.includes(opt)} onChange={(e) => {
                const diffs = formData.dificuldades || [];
                setFormData({...formData, dificuldades: e.target.checked ? [...diffs, opt] : diffs.filter((d: string) => d !== opt)});
              }} />
              <span className="text-sm text-gray-600 leading-tight">{opt}</span>
            </label>
          ))}
          <div className="md:col-span-2 mt-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Outros</label>
            <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.otherDifficulties || ''} onChange={(e) => setFormData({...formData, otherDifficulties: e.target.value})} />
          </div>
        </div>
      </div>

      <div className="md:col-span-2">
        <h4 className="font-bold text-gray-700 mb-4 border-b pb-2">Checklist de Desenvolvimento Ideal (Nota)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {POSITIVE_INDICATORS.map(ind => (
            <label key={ind.id} className="flex items-start gap-2 p-3 bg-white border border-gray-100 rounded-xl hover:border-sesi-green cursor-pointer transition-all">
              <input type="checkbox" className="mt-1" checked={!!formData.indicators?.includes(ind.id)} onChange={(e) => {
                const inds = formData.indicators || [];
                setFormData({...formData, indicators: e.target.checked ? [...inds, ind.id] : inds.filter((i: string) => i !== ind.id), score: calculateScore()});
              }} />
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-700 leading-tight">{ind.label}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">Peso: {ind.weight}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="bg-gray-100 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-600">Nota de Desenvolvimento</p>
            <p className="text-xs text-gray-400">Com base nos indicadores positivos atendidos</p>
          </div>
          <div className="text-3xl font-black text-sesi-blue bg-white px-6 py-2 rounded-lg shadow-sm border border-gray-200">
            {calculateScore()}<span className="text-sm text-gray-300 ml-1">/10</span>
          </div>
        </div>
      </div>

      <div className="md:col-span-2">
        <label className="block text-sm font-bold text-gray-700 mb-1">Temas já abordados pela escola</label>
        <textarea className="w-full px-4 py-2 border rounded-lg" rows={3} placeholder="Descreva os temas já trabalhados..." value={formData.themesSelected || ''} onChange={(e) => setFormData({...formData, themesSelected: e.target.value})}></textarea>
      </div>

      <div className="md:col-span-2">
        <label className="block text-sm font-bold text-gray-700 mb-1">Observações Gerais</label>
        <textarea className="w-full px-4 py-2 border rounded-lg" rows={3} value={formData.observations || ''} onChange={(e) => setFormData({...formData, observations: e.target.value})}></textarea>
      </div>

      {/* AI Insights Section */}
      <div className="md:col-span-2 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-6 rounded-2xl border border-indigo-100 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-200">
              <TrendingUp size={24} />
            </div>
            <div>
              <h4 className="font-bold text-indigo-900 text-lg">Análise Estratégica & Inteligência Artificial</h4>
              <p className="text-xs text-indigo-500 font-medium tracking-wide">Plano de ação personalizado baseado no diagnóstico</p>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <label className="flex items-center gap-2 cursor-pointer group bg-white/50 px-3 py-2 rounded-lg border border-indigo-100 hover:bg-white transition-colors">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded text-indigo-600 shadow-sm" 
                checked={!!formData.ocultarAI} 
                onChange={(e) => setFormData({...formData, ocultarAI: e.target.checked})} 
              />
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter group-hover:text-indigo-600">Não imprimir no PDF</span>
            </label>
            <button 
              type="button"
              disabled={generatingInsights}
              onClick={handleGenerateInsights}
              className="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 group"
            >
            {generatingInsights ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Processando...
              </>
            ) : (
              <>
                Gerar Insights Estratégicos
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>
      
      {formData.aiInsights ? (
          <div className="relative">
            <div className="absolute -left-2 top-0 bottom-0 w-1 bg-indigo-200 rounded-full"></div>
            <div className="bg-white/80 backdrop-blur-sm p-5 rounded-xl border border-indigo-50 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap italic">
              {formData.aiInsights}
            </div>
            <p className="text-[10px] text-indigo-300 mt-2 text-right italic">* Sugestões geradas por IA para fins pedagógicos e gerenciais.</p>
          </div>
        ) : (
          <div className="h-32 border-2 border-dashed border-indigo-100 rounded-2xl flex flex-col items-center justify-center text-indigo-300 text-center px-8">
            <p className="text-sm font-medium mb-1">Preencha os dados e os indicadores</p>
            <p className="text-xs opacity-70">A IA analisará as lacunas e sugerirá planos de ação para elevar a nota da escola.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const PsychologicalListeningForm = ({ formData, setFormData, studentName }: any) => {
  const [generatingInsights, setGeneratingInsights] = useState(false);

  const toggleCheckbox = (listName: string, value: string) => {
    const list = formData[listName] || [];
    setFormData({
      ...formData,
      [listName]: list.includes(value) ? list.filter((item: string) => item !== value) : [...list, value]
    });
  };

  const handleGenerateInsights = async () => {
    if (!studentName) {
      alert("Por favor, selecione um aluno primeiro.");
      return;
    }
    
    setGeneratingInsights(true);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "undefined" || apiKey === "") {
        throw new Error("API Key não configurada. Se estiver no Vercel, adicione GEMINI_API_KEY às variáveis de ambiente do projeto.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        Aja como um especialista em Psicologia Escolar Clínica e Educacional.
        Analise resumidamente os dados desta escuta psicológica e forneça um breve feedback/análise sobre a situação do aluno.
        
        Aluno: ${studentName}
        Motivos da Escuta: ${(formData.motivo || []).join(', ')} ${formData.motivoOutros || ''}
        Aspectos Comportamentais: ${(formData.aspectosComportamentais || []).join(', ')}
        Aspectos Sociais/Emocionais: ${(formData.aspectosSociais || []).join(', ')}
        Aspectos Aprendizagem/Cognitivos: ${(formData.aspectosAprendizagem || []).join(', ')} ${formData.outroTranstorno || ''}
        Orientações dadas: ${formData.orientacoes || 'Nenhuma registrada'}
        Encaminhamentos: ${(formData.encaminhamentos || []).join(', ')}
        
        Sua tarefa é cruzar esses dados e dar um feedback profissional de 3-4 lines sobre o perfil ou riscos identificados.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt
      });
      
      if (response.text) {
        setFormData({ ...formData, aiInsights: response.text });
      } else {
        throw new Error("Resposta da IA vazia");
      }
    } catch (err: any) {
      console.error("AI Analysis Error:", err);
      alert("Erro ao gerar análise via IA: " + (err.message || "Tente novamente mais tarde."));
    } finally {
      setGeneratingInsights(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 0. TRIAGEM E CLASSIFICAÇÃO */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
        <h4 className="font-black text-sesi-blue text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <div className="w-1.5 h-4 bg-sesi-blue rounded-full"></div>
          Triagem e Classificação
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5 ml-1">Origem da Demanda</label>
            <select 
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none text-sm font-bold text-gray-700"
              value={formData.origin || ''}
              onChange={(e) => setFormData({...formData, origin: e.target.value})}
            >
              <option value="">Selecione...</option>
              <option value="Aluno (Demanda Espontânea)">Aluno (Demanda Espontânea)</option>
              <option value="Família">Família</option>
              <option value="Professor">Professor</option>
              <option value="Coordenador/Gestor">Coordenador/Gestor</option>
              <option value="Conselho Tutelar">Conselho Tutelar</option>
              <option value="Encaminhamento Externo">Encaminhamento Externo</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5 ml-1">Urgência / Gravidade</label>
            <select 
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none text-sm font-bold text-gray-700"
              value={formData.gravity || ''}
              onChange={(e) => setFormData({...formData, gravity: e.target.value})}
            >
              <option value="">Selecione...</option>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5 ml-1">Subtipo / Tema Principal</label>
            <input 
              type="text" 
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none text-sm font-bold text-gray-700"
              placeholder="Ex: Ansiedade, Luto, Conflito..."
              value={formData.subtype || ''}
              onChange={(e) => setFormData({...formData, subtype: e.target.value})}
              list="subtypes-list"
            />
            <datalist id="subtypes-list">
              <option value="Ansiedade" />
              <option value="Depressão / Tristeza profunda" />
              <option value="Conflitos Familiares" />
              <option value="Dificuldade de Aprendizagem" />
              <option value="Comportamento Agressivo" />
              <option value="Luto" />
              <option value="Socialização" />
              <option value="Automutilação" />
              <option value="Ideação Suicida" />
              <option value="Bullying" />
            </datalist>
          </div>
        </div>
      </div>

      {/* 1. MOTIVO DA ESCUTA */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-sesi-blue/20">
        <h4 className="font-black text-sesi-blue text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-sesi-blue text-white rounded-lg flex items-center justify-center text-[10px]">01</span>
          Motivo da Escuta
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'Demanda espontânea do aluno',
            'Encaminhado pelo professor',
            'Encaminhado pela gestão/coordenador',
            'Solicitação da família'
          ].map(opt => (
            <label key={opt} className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-xl hover:bg-white hover:ring-2 hover:ring-sesi-blue/10 cursor-pointer transition-all border border-transparent">
              <input 
                type="checkbox" 
                className="mt-1 w-4 h-4 text-sesi-blue rounded border-gray-300 shadow-sm"
                checked={!!formData.motivo?.includes(opt)}
                onChange={() => toggleCheckbox('motivo', opt)}
              />
              <span className="text-sm font-medium text-gray-700">{opt}</span>
            </label>
          ))}
          <div className="md:col-span-2 mt-2">
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Outros motivos</label>
            <input 
              type="text" 
              className="w-full px-4 py-2 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none text-sm transition-all shadow-sm"
              placeholder="Descreva..."
              value={formData.motivoOutros || ''}
              onChange={(e) => setFormData({...formData, motivoOutros: e.target.value})}
            />
          </div>
        </div>
      </div>

      {/* 2. ASPECTOS OBSERVADOS */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-sesi-blue/20">
        <h4 className="font-black text-sesi-blue text-xs uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <span className="w-6 h-6 bg-sesi-blue text-white rounded-lg flex items-center justify-center text-[10px]">02</span>
          Aspectos Observados
        </h4>

        <div className="space-y-6">
          {/* Comportamentais */}
          <div>
            <div className="text-[10px] font-black uppercase text-sesi-blue mb-3 px-1 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-sesi-blue rounded-full"></div>
              Comportamentais
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                'Atento(a) às orientações',
                'Desatento(a)/disperso(a)',
                'Inquieto(a)/agitado(a)',
                'Silencioso(a)/retraído(a)',
                'Opositivo/desafiador'
              ].map(opt => (
                <label key={opt} className="flex items-center gap-3 p-2.5 bg-gray-50/50 rounded-xl hover:bg-white hover:ring-1 hover:ring-sesi-blue/20 cursor-pointer transition-all border border-transparent">
                  <input type="checkbox" className="w-4 h-4 rounded text-sesi-blue shadow-sm" checked={!!formData.aspectosComportamentais?.includes(opt)} onChange={() => toggleCheckbox('aspectosComportamentais', opt)} />
                  <span className="text-xs font-semibold text-gray-600">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sociais/Emocionais */}
          <div>
            <div className="text-[10px] font-black uppercase text-sesi-blue mb-3 px-1 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-sesi-blue rounded-full"></div>
              Sociais / Emocionais
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                'Interage positivamente com colegas',
                'Isolado(a) socialmente',
                'Demonstra ansiedade',
                'Demonstra autoestima positiva',
                'Apresenta sinais de tristeza/abatimento'
              ].map(opt => (
                <label key={opt} className="flex items-center gap-3 p-2.5 bg-gray-50/50 rounded-xl hover:bg-white hover:ring-1 hover:ring-sesi-blue/20 cursor-pointer transition-all border border-transparent">
                  <input type="checkbox" className="w-4 h-4 rounded text-sesi-blue shadow-sm" checked={!!formData.aspectosSociais?.includes(opt)} onChange={() => toggleCheckbox('aspectosSociais', opt)} />
                  <span className="text-xs font-semibold text-gray-600">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Aprendizagem / Cognitivos */}
          <div>
            <div className="text-[10px] font-black uppercase text-sesi-blue mb-3 px-1 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-sesi-blue rounded-full"></div>
              Aprendizagem / Cognitivos
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                'Não sabe ler', 'Não sabe escrever', 'Leitura silábica', 
                'Leitura lenta/dificuldade de fluência', 'Dificuldade de compreensão de texto',
                'Erros frequentes de ortografia/troca de letras', 'Escrita ilegível/desorganizada',
                'Dificuldade em sequenciar ideias/escrever frases', 'Dificuldade em copiar do quadro',
                'Dificuldade de raciocínio lógico-matemático', 'Problemas de memória/attention',
                'Dificuldade em iniciar ou finalizar atividades', 'Precisa de apoio constante para aprender',
                'Suspeita de dislexia', 'Suspeita de TDAH'
              ].map(opt => (
                <label key={opt} className="flex items-center gap-3 p-2.5 bg-gray-50/50 rounded-xl hover:bg-white hover:ring-1 hover:ring-sesi-blue/20 cursor-pointer transition-all border border-transparent">
                  <input type="checkbox" className="w-4 h-4 rounded text-sesi-blue shadow-sm" checked={!!formData.aspectosAprendizagem?.includes(opt)} onChange={() => toggleCheckbox('aspectosAprendizagem', opt)} />
                  <span className="text-[10px] font-bold text-gray-600 leading-tight">{opt}</span>
                </label>
              ))}
            </div>
            <div className="mt-3">
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-wider">Outro transtorno de aprendizagem</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none text-sm transition-all shadow-sm"
                placeholder="Ex: Discalculia..."
                value={formData.outroTranstorno || ''}
                onChange={(e) => setFormData({...formData, outroTranstorno: e.target.value})}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. ENCAMINHAMENTOS */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-sesi-blue/20">
        <h4 className="font-black text-sesi-blue text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-sesi-blue text-white rounded-lg flex items-center justify-center text-[10px]">03</span>
          Encaminhamentos
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {['AEE', 'Psicólogo(a)', 'Psiquiatra', 'Fonoaudiólogo(a)', 'Serviço Social'].map(opt => (
            <label key={opt} className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-xl hover:bg-white hover:ring-1 hover:ring-sesi-blue/20 cursor-pointer transition-all border border-transparent">
              <input type="checkbox" className="w-4 h-4 rounded text-sesi-blue shadow-sm" checked={!!formData.encaminhamentos?.includes(opt)} onChange={() => toggleCheckbox('encaminhamentos', opt)} />
              <span className="text-xs font-bold text-gray-600">{opt}</span>
            </label>
          ))}
          <div className="col-span-full">
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Outros encaminhamentos</label>
            <input 
              type="text" 
              className="w-full px-4 py-2 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none text-sm shadow-sm"
              value={formData.encaminhamentosOutros || ''}
              onChange={(e) => setFormData({...formData, encaminhamentosOutros: e.target.value})}
            />
          </div>
        </div>
      </div>

      {/* AI Insights Section */}
      <div className="bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-6 rounded-2xl border border-indigo-100 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-200">
              <TrendingUp size={24} />
            </div>
            <div>
              <h4 className="font-bold text-indigo-900 text-lg">Análise Preliminar & IA</h4>
              <p className="text-xs text-indigo-500 font-medium tracking-wide">Breve feedback sobre a situação do aluno</p>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <label className="flex items-center gap-2 cursor-pointer group bg-white/50 px-3 py-2 rounded-lg border border-indigo-100 hover:bg-white transition-colors">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded text-indigo-600 shadow-sm" 
                checked={!!formData.ocultarAI} 
                onChange={(e) => setFormData({...formData, ocultarAI: e.target.checked})} 
              />
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter group-hover:text-indigo-600">Não imprimir no PDF</span>
            </label>
            <button 
              type="button"
              disabled={generatingInsights}
              onClick={handleGenerateInsights}
              className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 group"
            >
              {generatingInsights ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Processando...
                </>
              ) : (
                <>
                  Gerar Breve Feedback
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>
        
        {formData.aiInsights ? (
          <div className="relative">
            <div className="absolute -left-2 top-0 bottom-0 w-1 bg-indigo-200 rounded-full"></div>
            <div className="bg-white/80 backdrop-blur-sm p-5 rounded-xl border border-indigo-50 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap italic shadow-sm">
              {formData.aiInsights}
            </div>
            <p className="text-[10px] text-indigo-300 mt-2 text-right italic">* Sugestões automáticas para apoio pedagógico.</p>
          </div>
        ) : (
          <div className="h-24 border-2 border-dashed border-indigo-100 rounded-2xl flex flex-col items-center justify-center text-indigo-300 text-center px-8">
            <p className="text-xs font-medium">Preencha os campos de escuta para gerar uma breve análise por IA.</p>
          </div>
        )}
      </div>

      {/* 4. ORIENTAÇÕES / OBSERVAÇÕES */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-sesi-blue/20">
        <h4 className="font-black text-sesi-blue text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-sesi-blue text-white rounded-lg flex items-center justify-center text-[10px]">04</span>
          Orientações / Observações
        </h4>
        <textarea 
          className="w-full px-5 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-sesi-blue outline-none text-sm min-h-[150px] leading-relaxed shadow-inner"
          placeholder="Registre aqui as orientações fornecidas e observações relevantes da escuta..."
          value={formData.orientacoes || ''}
          onChange={(e) => setFormData({...formData, orientacoes: e.target.value})}
        ></textarea>
      </div>

      {/* 5. AÇÕES POSTERIORES */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-sesi-blue/20">
        <h4 className="font-black text-sesi-blue text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-sesi-blue text-white rounded-lg flex items-center justify-center text-[10px]">05</span>
          Ações Posteriores
        </h4>
        <div className="space-y-4">
          {/* Nova Escuta */}
          <div className="p-4 bg-gray-50/50 rounded-2xl space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" className="w-5 h-5 rounded text-sesi-blue shadow-sm" checked={!!formData.acaoNovaEscuta} onChange={(e) => setFormData({...formData, acaoNovaEscuta: e.target.checked})} />
              <span className="text-sm font-black text-gray-700 group-hover:text-sesi-blue transition-colors">Nova Escuta</span>
            </label>
            {formData.acaoNovaEscuta && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-8 animate-in slide-in-from-left-2 duration-300">
                <input type="date" className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm" value={formData.dataNovaEscuta || ''} onChange={(e) => setFormData({...formData, dataNovaEscuta: e.target.value})} />
                <input type="text" className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm" placeholder="Anotações adicionais..." value={formData.obsNovaEscuta || ''} onChange={(e) => setFormData({...formData, obsNovaEscuta: e.target.value})} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50/50 rounded-2xl space-y-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" className="w-5 h-5 rounded text-sesi-blue shadow-sm" checked={!!formData.acaoOrientacao} onChange={(e) => setFormData({...formData, acaoOrientacao: e.target.checked})} />
                <span className="text-sm font-black text-gray-700 group-hover:text-sesi-blue transition-colors uppercase tracking-tight">Orientação a responsáveis</span>
              </label>
              {formData.acaoOrientacao && (
                <input type="date" className="ml-8 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm animate-in zoom-in-95 shadow-sm" value={formData.dataOrientacao || ''} onChange={(e) => setFormData({...formData, dataOrientacao: e.target.value})} />
              )}
            </div>

            <div className="p-4 bg-gray-50/50 rounded-2xl space-y-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" className="w-5 h-5 rounded text-sesi-blue shadow-sm" checked={!!formData.acaoObservacao} onChange={(e) => setFormData({...formData, acaoObservacao: e.target.checked})} />
                <span className="text-sm font-black text-gray-700 group-hover:text-sesi-blue transition-colors uppercase tracking-tight">Observação em sala de aula</span>
              </label>
              {formData.acaoObservacao && (
                <input type="date" className="ml-8 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm animate-in zoom-in-95 shadow-sm" value={formData.dataObservacao || ''} onChange={(e) => setFormData({...formData, dataObservacao: e.target.value})} />
              )}
            </div>

            <div className="p-4 bg-gray-50/50 rounded-2xl md:col-span-2 flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" className="w-5 h-5 rounded text-sesi-blue shadow-sm" checked={!!formData.acaoOficina} onChange={(e) => setFormData({...formData, acaoOficina: e.target.checked})} />
                <span className="text-sm font-black text-gray-700 group-hover:text-sesi-blue transition-colors uppercase tracking-tight">Oficina / Grupo terapêutico</span>
              </label>
              
              <div className="pt-2 border-t border-gray-200 mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="w-5 h-5 rounded text-red-500 shadow-sm" checked={!!formData.acaoRedeProtecao} onChange={(e) => setFormData({...formData, acaoRedeProtecao: e.target.checked})} />
                  <span className="text-xs font-black text-red-600 uppercase tracking-tight">Acionamento de Rede de Proteção / Conselho Tutelar</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="w-5 h-5 rounded text-sesi-blue shadow-sm" checked={!!formData.acaoArticulacaoRede} onChange={(e) => setFormData({...formData, acaoArticulacaoRede: e.target.checked})} />
                  <span className="text-xs font-black text-gray-700 uppercase tracking-tight">Articulação com Rede Externa (Saúde/Social)</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClassroomEvolutionForm = ({ formData, setFormData, studentName }: any) => {
  const [generating, setGenerating] = useState(false);

  const sections = [
    {
      id: 'behavior',
      title: '1. Aspectos Comportamentais',
      items: [
        { id: 'respeitaRegras', label: 'Respeita as regras de convivência' },
        { id: 'comportamentoAdequado', label: 'Apresenta comportamento adequado para o ambiente' },
        { id: 'resolveConflitos', label: 'Resolve conflitos de forma pacífica' },
      ]
    },
    {
      id: 'attention',
      title: '2. Atenção e Organização',
      items: [
        { id: 'mantemAtencao', label: 'Consegue manter a atenção durante a atividade' },
        { id: 'organizacaoMaterial', label: 'Demonstra organização no material/escrita' },
        { id: 'compreendeInstrucoes', label: 'Compreende instruções verbais e escritas' },
      ]
    },
    {
      id: 'participation',
      title: '3. Atitude e Participação',
      items: [
        { id: 'participaAtivamente', label: 'Participa ativamente das propostas' },
        { id: 'realizaEmpenho', label: 'Realiza as atividades com empenho' },
        { id: 'demonstraAutonomia', label: 'Demonstra autonomia na execução das tarefas' },
      ]
    },
    {
      id: 'social',
      title: '4. Aspectos Sociais',
      items: [
        { id: 'interagePositivamente', label: 'Interage com colegas de forma positiva' },
        { id: 'prefereIsolado', label: 'Prefere ficar isolado(a)' },
        { id: 'trabalhaGrupo', label: 'Consegue trabalhar em grupo' },
        { id: 'respeitaEspaco', label: 'Respeita o espaço e os colegas' },
        { id: 'estabeleceVinculos', label: 'Estabelece vínculos de amizade' },
      ]
    },
    {
      id: 'learning',
      title: '5. Aspectos de Aprendizagem',
      items: [
        { id: 'acompanhaRitmo', label: 'Acompanha o ritmo da turma' },
        { id: 'facilidadeLeitura', label: 'Apresenta facilidade em leitura' },
        { id: 'facilidadeEscrita', label: 'Apresenta facilidade em escrita' },
        { id: 'raciocinioLogico', label: 'Demonstra raciocínio lógico-matemático' },
        { id: 'apoioConstante', label: 'Precisa de apoio constante para realizar as atividades' },
      ]
    }
  ];

  const handleGenerateInsights = async () => {
    if (!studentName) {
      alert("Por favor, selecione um registro antes de gerar a análise.");
      return;
    }
    
    setGenerating(true);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "undefined" || apiKey === "") {
        throw new Error("API Key não configurada. Se estiver no Vercel, adicione GEMINI_API_KEY às variáveis de ambiente do projeto.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
        Aja como um Psicólogo Escolar experiente. 
        Analise os dados de evolução em sala do aluno(a) ${studentName}.
        
        Dados registrados:
        ${JSON.stringify(formData.evolutionData || {}, null, 2)}
        
        Observações adicionais:
        ${formData.observacoes || 'Nenhuma observação extra.'}
        
        Com base nesses dados (onde Sim/Não/Parcial), forneça uma breve análise da evolução escolar (pedagógica e comportamental) de forma técnica e empática.
        Limite a análise a 4 linhas de texto. 
        Não use marcadores ou introduções genéricas. Vá direto ao ponto.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
      });

      if (response.text) {
        setFormData({ ...formData, aiInsights: response.text });
      } else {
        throw new Error("Resposta da IA vazia");
      }
    } catch (error: any) {
      console.error("Erro ao gerar insights:", error);
      alert("Erro ao conectar com a IA: " + (error.message || "Verifique sua conexão e tente novamente."));
    } finally {
      setGenerating(false);
    }
  };

  const updateItem = (itemId: string, value: string) => {
    const currentData = formData.evolutionData || {};
    setFormData({
      ...formData,
      evolutionData: {
        ...currentData,
        [itemId]: value
      }
    });
  };

  return (
    <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <label className="block text-[10px] font-black uppercase text-sesi-blue mb-1 ml-1">Professor(a) Regente</label>
          <input 
            type="text" 
            className="w-full px-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none" 
            value={formData.teacher || ''} 
            onChange={(e) => setFormData({...formData, teacher: e.target.value})} 
            placeholder="Nome do professor..."
          />
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <label className="block text-[10px] font-black uppercase text-sesi-blue mb-1 ml-1">Data da Observação</label>
          <input 
            type="date" 
            className="w-full px-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none" 
            value={formData.obsDate || ''} 
            onChange={(e) => setFormData({...formData, obsDate: e.target.value})} 
          />
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="bg-sesi-blue px-6 py-3">
            <h4 className="text-white text-xs font-black uppercase tracking-widest">{section.title}</h4>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 font-bold text-gray-500 w-1/2">Item Avaliado</th>
                  <th className="px-4 py-3 text-center font-bold text-sesi-green">Sim</th>
                  <th className="px-4 py-3 text-center font-bold text-red-500">Não</th>
                  <th className="px-4 py-3 text-center font-bold text-amber-500">Parcial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {section.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-gray-700 font-medium">{item.label}</td>
                    {['sim', 'nao', 'parcial'].map((val) => (
                      <td key={val} className="px-4 py-4 text-center">
                        <label className="flex items-center justify-center cursor-pointer">
                          <input 
                            type="radio" 
                            name={`evol-${item.id}`}
                            className="w-5 h-5 cursor-pointer text-sesi-blue focus:ring-sesi-blue border-gray-200"
                            checked={formData.evolutionData?.[item.id] === val}
                            onChange={() => updateItem(item.id, val)}
                          />
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
        <label className="block text-xs font-black text-sesi-blue uppercase tracking-widest mb-3">Observações Adicionais</label>
        <textarea 
          className="w-full px-5 py-4 border-0 rounded-2xl outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-sesi-blue bg-white shadow-sm h-32 transition-all"
          placeholder="Registre aqui outras observações relevantes..."
          value={formData.observacoes || ''}
          onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
        />
      </div>

      <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-xl shadow-indigo-50/30 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <TrendingUp size={64} className="text-indigo-600" />
        </div>
        
        <div className="relative">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200 text-white">
                <TrendingUp size={20} />
              </div>
              <h4 className="text-indigo-900 font-black text-sm uppercase tracking-wider">Análise Preliminar & IA</h4>
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto">
              <label className="flex items-center gap-2 cursor-pointer group bg-white/50 px-3 py-2 rounded-lg border border-indigo-100 hover:bg-white transition-colors">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded text-indigo-600 shadow-sm" 
                  checked={!!formData.ocultarAI} 
                  onChange={(e) => setFormData({...formData, ocultarAI: e.target.checked})} 
                />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter group-hover:text-indigo-600">Não imprimir no PDF</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateInsights}
                disabled={generating}
                className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {generating ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processando...
                  </>
                ) : (
                  <>
                    <Settings size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                    Gerar Análise
                  </>
                )}
              </button>
            </div>
          </div>

          {!formData.aiInsights && !generating ? (
            <div className="text-center py-8 bg-indigo-50/30 rounded-xl border border-dashed border-indigo-100">
              <p className="text-xs font-medium text-indigo-400 text-pretty">Preencha os itens acima e clique em "Gerar Análise" para obter o feedback automático.</p>
            </div>
          ) : (
            <div className={`transition-all duration-500 ${generating ? 'opacity-30 blur-sm' : 'opacity-100 blur-0'}`}>
              <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100">
                <p className="text-sm text-indigo-900 leading-relaxed font-bold italic">
                  {formData.aiInsights || 'A aguardar análise...'}
                </p>
              </div>
              <p className="text-[10px] text-indigo-400 mt-3 font-bold uppercase tracking-widest text-center">
                Análise baseada em inteligência artificial para apoio pedagógico
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PedagogicalParticipationForm = ({ formData, setFormData }: any) => {
  const [generating, setGenerating] = useState(false);

  const handleGenerateAI = async () => {
    if (!formData.activityTitle || !formData.results) {
      alert("Por favor, preencha o título da atividade e os resultados observados para gerar o parecer.");
      return;
    }
    
    setGenerating(true);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "undefined" || apiKey === "") {
        throw new Error("API Key não configurada.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        Aja como um Psicólogo Escolar experiente.
        Com base nos registros de participação pedagógica abaixo, gere um parecer técnico sintetizado (máximo 4 linhas) sobre o desenvolvimento da atividade e participação geral.
        
        Atividade: ${formData.activityTitle}
        Objetivo: ${formData.objective}
        Nível de Participação: ${formData.participationLevel}
        Descrição: ${formData.activityDescription}
        Resultados: ${formData.results}
        
        Responda com um texto profissional, focado em evolução pedagógica e socioemocional.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt
      });
      
      if (response.text) {
        setFormData({ ...formData, aiParecer: response.text });
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro ao gerar parecer: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-gray-700 mb-2">Título da Atividade</label>
          <input 
            type="text" 
            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none transition-all"
            placeholder="Ex: Oficina de Emoções, Roda de Conversa..."
            value={formData.activityTitle || ''} 
            onChange={(e) => setFormData({...formData, activityTitle: e.target.value})} 
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Objetivo Pedagógico</label>
          <select 
            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none transition-all"
            value={formData.objective || ''} 
            onChange={(e) => setFormData({...formData, objective: e.target.value})}
          >
            <option value="">Selecione...</option>
            <option value="Socialização">Socialização</option>
            <option value="Autonomia">Autonomia</option>
            <option value="Foco/Atenção">Foco/Atenção</option>
            <option value="Gestão de Emoções">Gestão de Emoções</option>
            <option value="Outros">Outros</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Nível de Participação</label>
          <select 
            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none transition-all"
            value={formData.participationLevel || ''} 
            onChange={(e) => setFormData({...formData, participationLevel: e.target.value})}
          >
            <option value="">Selecione...</option>
            <option value="Ativo(a)">Ativo(a)</option>
            <option value="Passivo(a)">Passivo(a)</option>
            <option value="Resistente">Resistente</option>
            <option value="Interessado(a)">Interessado(a)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Descrição da Atividade</label>
        <textarea 
          className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none transition-all" 
          rows={3} 
          placeholder="Descreva brevemente o que foi realizado..."
          value={formData.activityDescription || ''} 
          onChange={(e) => setFormData({...formData, activityDescription: e.target.value})}
        ></textarea>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Resultados Observados</label>
        <textarea 
          className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none transition-all" 
          rows={3} 
          placeholder="Quais foram as reações e avanços percebidos?"
          value={formData.results || ''} 
          onChange={(e) => setFormData({...formData, results: e.target.value})}
        ></textarea>
      </div>

      <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500 text-white rounded-lg">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-900">Parecer Pedagógico (IA)</p>
              <p className="text-[10px] text-emerald-600 uppercase font-black">Análise automática de evolução</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer group bg-white/50 px-2 py-1 rounded border border-emerald-100 hover:bg-white transition-colors">
              <input 
                type="checkbox" 
                className="w-3 h-3 rounded text-emerald-600 shadow-sm" 
                checked={!!formData.ocultarAI} 
                onChange={(e) => setFormData({...formData, ocultarAI: e.target.checked})} 
              />
              <span className="text-[9px] font-black text-gray-400 uppercase group-hover:text-emerald-600">Ocultar impressão</span>
            </label>
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerateAI}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {generating ? 'Gerando...' : 'Gerar Parecer'}
            </button>
          </div>
        </div>
        
        {formData.aiParecer && (
          <div className="bg-white/80 p-4 rounded-xl border border-emerald-100 text-sm text-emerald-900 italic leading-relaxed">
            {formData.aiParecer}
          </div>
        )}
      </div>
    </div>
  );
};

const GroupAttendanceForm = ({ formData, setFormData }: any) => {
  const [generating, setGenerating] = useState(false);

  const handleGenerateAI = async () => {
    if (!formData.groupName && !formData.objective) {
      alert("Por favor, informe o nome do grupo ou o objetivo para gerar a dinâmica.");
      return;
    }
    
    setGenerating(true);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "undefined" || apiKey === "") {
        throw new Error("API Key não configurada.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        Aja como um facilitador de grupos e Psicólogo Escolar.
        Sugira uma dinâmica de grupo curta (quebra-gelo ou atividade principal) ou uma estratégia de abordagem para o seguinte grupo:
        
        Grupo: ${formData.groupName || 'Não especificado'}
        Objetivo: ${formData.objective || 'Não especificado'}
        
        Responda com um título para a dinâmica e um passo-a-passo resumido (máximo 5 itens).
      `;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt
      });
      
      if (response.text) {
        setFormData({ ...formData, aiDynamic: response.text });
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro ao gerar dinâmica: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-gray-700 mb-2">Nome do Grupo / Projeto</label>
          <input 
            type="text" 
            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none transition-all"
            placeholder="Ex: Grupo de Liderança, Oficina de Convivência..."
            value={formData.groupName || ''} 
            onChange={(e) => setFormData({...formData, groupName: e.target.value})} 
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-gray-700 mb-2">Outros Participantes</label>
          <textarea 
            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none transition-all" 
            rows={2} 
            placeholder="Liste os demais nomes dos participantes..."
            value={formData.otherParticipants || ''} 
            onChange={(e) => setFormData({...formData, otherParticipants: e.target.value})}
          ></textarea>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Objetivo do Atendimento</label>
        <textarea 
          className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none transition-all" 
          rows={3} 
          placeholder="Qual a finalidade deste encontro em grupo?"
          value={formData.objective || ''} 
          onChange={(e) => setFormData({...formData, objective: e.target.value})}
        ></textarea>
      </div>

      <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <Users size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-900">Sugestão de Dinâmica (IA)</p>
              <p className="text-[10px] text-indigo-500 uppercase font-black">IA auxiliando no planejamento</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer group bg-white/50 px-2 py-1 rounded border border-indigo-100 hover:bg-white transition-colors">
              <input 
                type="checkbox" 
                className="w-3 h-3 rounded text-indigo-600 shadow-sm" 
                checked={!!formData.ocultarAI} 
                onChange={(e) => setFormData({...formData, ocultarAI: e.target.checked})} 
              />
              <span className="text-[9px] font-black text-gray-400 uppercase group-hover:text-indigo-600">Ocultar impressão</span>
            </label>
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerateAI}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {generating ? 'Gerando...' : 'Gerar Dinâmica'}
            </button>
          </div>
        </div>
        
        {formData.aiDynamic && (
          <div className="bg-white/80 p-4 rounded-xl border border-indigo-100 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {formData.aiDynamic}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Síntese do Atendimento</label>
        <textarea 
          className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none transition-all" 
          rows={4} 
          placeholder="O que foi discutido ou trabalhado?"
          value={formData.synthesis || ''} 
          onChange={(e) => setFormData({...formData, synthesis: e.target.value})}
        ></textarea>
      </div>
    </div>
  );
};


const ReferralForm = ({ formData, setFormData }: any) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo do Acompanhamento</label>
      <textarea className="w-full px-4 py-2 border rounded-lg" rows={3} value={formData.objective || ''} onChange={(e) => setFormData({...formData, objective: e.target.value})}></textarea>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Destino do Encaminhamento</label>
      <input type="text" placeholder="Ex: Neuropediatra, Fonoaudiólogo..." className="w-full px-4 py-2 border rounded-lg" value={formData.destination || ''} onChange={(e) => setFormData({...formData, destination: e.target.value})} />
    </div>
  </div>
);

const AttendanceDeclarationForm = ({ formData, setFormData, user }: any) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
      <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.sector || 'Psicologia Escolar'} onChange={(e) => setFormData({...formData, sector: e.target.value})} />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
      <input type="time" className="w-full px-4 py-2 border rounded-lg" value={formData.time || ''} onChange={(e) => setFormData({...formData, time: e.target.value})} />
    </div>
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">Realizado por</label>
      <input 
        type="text" 
        className="w-full px-4 py-2 border rounded-lg" 
        value={formData.professional || user?.name || ''} 
        onChange={(e) => setFormData({...formData, professional: e.target.value})} 
      />
    </div>
  </div>
);

const AuthorizationTermForm = ({ formData, setFormData }: any) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Responsável</label>
      <input type="text" className="w-full px-4 py-2 border rounded-lg" value={formData.guardianName || ''} onChange={(e) => setFormData({...formData, guardianName: e.target.value})} />
    </div>
    <div className="bg-blue-50 p-4 rounded-xl">
      <p className="text-sm text-blue-800">
        Este documento autoriza o acompanhamento pela Psicóloga da escola para Escutas, Oficinas, Grupos Terapêuticos e outras atividades durante o ano letivo.
      </p>
    </div>
  </div>
);

// Componente de Seleção Avançada de Pessoa
const StudentSelector = ({ students, schools, onSelect, selectedStudent, onRefresh }: any) => {
  const [filters, setFilters] = useState({
    ra: selectedStudent?.ra || "",
    name: selectedStudent?.name || "",
    class: selectedStudent?.class || "",
    schoolId: selectedStudent?.schoolId || "",
  });

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({
    name: "",
    ra: "",
    class: "",
    schoolId: "",
  });
  const [savingQuick, setSavingQuick] = useState(false);

  useEffect(() => {
    if (selectedStudent) {
      setFilters({
        ra: selectedStudent.ra,
        name: selectedStudent.name,
        class: selectedStudent.class,
        schoolId: selectedStudent.schoolId,
      });
    } else {
      setFilters({ ra: "", name: "", class: "", schoolId: "" });
    }
  }, [selectedStudent]);

  const filtered = students.filter((s: any) => {
    return (!filters.ra || s.ra?.toLowerCase().includes(filters.ra.toLowerCase())) &&
           (!filters.name || s.name?.toLowerCase().includes(filters.name.toLowerCase())) &&
           (!filters.class || s.class?.toLowerCase().includes(filters.class.toLowerCase())) &&
           (!filters.schoolId || s.schoolId === filters.schoolId);
  });

  const hasActiveSearch = filters.ra.length > 2 || filters.name.length > 2 || filters.class.length > 1;

  const handleSelect = (s: any) => {
    onSelect(s);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddForm.name || !quickAddForm.schoolId) {
      alert("Nome e Unidade são obrigatórios.");
      return;
    }

    setSavingQuick(true);
    try {
      const newPerson = await api.students.create({
        ...quickAddForm,
        age: 0,
        studentType: 'external',
        observations: "Cadastro rápido via emissão de documento"
      });
      
      if (onRefresh) await onRefresh();
      
      // Tenta encontrar o registro recém criado com ID correto se necessário, 
      // mas o newPerson retornado já tem o ID do firestore
      onSelect(newPerson);
      setShowQuickAdd(false);
      setQuickAddForm({ name: "", ra: "", class: "", schoolId: "" });
    } catch (err: any) {
      alert("Erro ao realizar cadastro rápido: " + err.message);
    } finally {
      setSavingQuick(false);
    }
  };

  const getSchoolName = (id: string) => schools.find(s => s.id === id)?.name || "Unidade não encontrada";

  return (
    <div className="bg-gray-50/80 p-5 rounded-2xl border border-gray-100 space-y-4 shadow-inner">
      <div className="flex items-center justify-between px-1">
        <h5 className="text-[10px] font-black uppercase text-sesi-blue tracking-widest">Localizar Registro</h5>
        <button 
          type="button"
          onClick={() => setShowQuickAdd(!showQuickAdd)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${showQuickAdd ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-sesi-blue text-white hover:bg-blue-800 shadow-lg shadow-blue-100'}`}
        >
          {showQuickAdd ? <X size={14} /> : <Plus size={14} />}
          {showQuickAdd ? 'Cancelar Cadastro' : 'Cadastrar Pessoa Nova'}
        </button>
      </div>

      {showQuickAdd ? (
        <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm animate-in slide-in-from-top-2 duration-300">
          <p className="text-xs font-bold text-gray-500 mb-4 flex items-center gap-2">
            <UserPlus size={14} className="text-sesi-blue" />
            Cadastro Rápido (Se não encontrado na busca)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Nome Completo</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none"
                value={quickAddForm.name}
                onChange={(e) => setQuickAddForm({...quickAddForm, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">RA (Se aluno)</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none"
                value={quickAddForm.ra}
                onChange={(e) => setQuickAddForm({...quickAddForm, ra: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Turma / Função</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none"
                value={quickAddForm.class}
                placeholder="Ex: 3º Ano B ou Professor"
                onChange={(e) => setQuickAddForm({...quickAddForm, class: e.target.value})}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 text-red-500">Unidade Escolar *</label>
              <select 
                required
                className="w-full px-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-sesi-blue outline-none"
                value={quickAddForm.schoolId}
                onChange={(e) => setQuickAddForm({...quickAddForm, schoolId: e.target.value})}
              >
                <option value="">Selecione a Unidade...</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button 
                type="button"
                disabled={savingQuick}
                onClick={handleQuickAdd}
                className="bg-sesi-blue text-white px-6 py-2 rounded-xl text-xs font-black uppercase hover:bg-blue-800 transition-all disabled:opacity-50"
              >
                {savingQuick ? 'Salvando...' : 'Confirmar e Selecionar'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <label className="block text-[10px] font-black uppercase text-sesi-blue mb-1">Pesquisar RA</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                className="w-full pl-9 pr-4 py-2.5 text-sm border-0 rounded-xl outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-sesi-blue bg-white shadow-sm transition-all"
                value={filters.ra}
                placeholder="Número..."
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters({...filters, ra: val});
                  const match = students.find(s => s.ra === val);
                  if (match) handleSelect(match);
                }}
              />
            </div>
          </div>
          <div className="md:col-span-1">
            <label className="block text-[10px] font-black uppercase text-sesi-blue mb-1">Nome</label>
            <input 
              type="text" 
              className="w-full px-4 py-2.5 text-sm border-0 rounded-xl outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-sesi-blue bg-white shadow-sm transition-all"
              value={filters.name}
              placeholder="Pesquisar registro..."
              onChange={(e) => setFilters({...filters, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-sesi-blue mb-1">Turma / Ano</label>
            <input 
              type="text" 
              className="w-full px-4 py-2.5 text-sm border-0 rounded-xl outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-sesi-blue bg-white shadow-sm transition-all"
              value={filters.class}
              placeholder="Filtro de turma..."
              onChange={(e) => setFilters({...filters, class: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-sesi-blue mb-1">Unidade</label>
            <select 
              className="w-full px-4 py-2.5 text-sm border-0 rounded-xl outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-sesi-blue bg-white shadow-sm transition-all cursor-pointer"
              value={filters.schoolId}
              onChange={(e) => setFilters({...filters, schoolId: e.target.value})}
            >
              <option value="">Todas</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {selectedStudent && (
          <div className="px-1 py-1">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-sesi-green">
              <CheckCircle2 size={12} />
              Registro Selecionado
            </span>
          </div>
        )}
        
        {hasActiveSearch && !showQuickAdd && (
          <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-2xl bg-white divide-y divide-gray-50 shadow-sm custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
            {filtered.length > 0 ? (
              filtered.slice(0, 50).map((s: any) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className={`w-full text-left px-5 py-4 hover:bg-blue-50/50 transition-all flex items-center justify-between group ${selectedStudent?.id === s.id ? 'bg-blue-50/80 ring-2 ring-inset ring-sesi-blue/5' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${selectedStudent?.id === s.id ? 'bg-sesi-blue text-white shadow-md' : 'bg-gray-100 text-gray-400 group-hover:bg-sesi-blue group-hover:text-white group-hover:shadow-md'}`}>
                      <User size={18} />
                    </div>
                    <div>
                      <p className={`font-bold text-sm tracking-tight ${selectedStudent?.id === s.id ? 'text-sesi-blue' : 'text-gray-900'}`}>{s.name}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] font-bold text-gray-400">
                        {s.ra && <span>RA: {s.ra}</span>}
                        {s.class && <span>Turma/Função: {s.class}</span>}
                        <span>Unidade: {getSchoolName(s.schoolId)}</span>
                      </div>
                    </div>
                  </div>
                  {selectedStudent?.id === s.id ? (
                    <div className="bg-sesi-blue text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100">
                      Selecionado
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-sesi-blue hover:text-white transition-all text-sesi-blue">
                      <Plus size={16} />
                    </div>
                  )}
                </button>
              ))
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                <Search size={24} className="text-gray-200" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-400">Nenhum registro encontrado...</p>
                  <button 
                    type="button"
                    onClick={() => setShowQuickAdd(true)}
                    className="text-[10px] font-black uppercase text-sesi-blue hover:underline"
                  >
                    Cadastrar nova pessoa agora
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
