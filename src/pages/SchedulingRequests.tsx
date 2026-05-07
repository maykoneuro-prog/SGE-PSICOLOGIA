import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { ClipboardList, Check, X, Clock, Search, School, MessageCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { openWhatsApp } from "../lib/whatsapp";
import { useUnit } from "../contexts/UnitContext";

export default function SchedulingRequests({ user }: { user: any }) {
  const { activeUnit } = useUnit();
  const [requests, setRequests] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [activeUnit]);

  const loadData = async () => {
    try {
      const isSuperAdmin = user?.role === 'super-admin' || user?.id === 'super_admin' || user?.email === 'maykon.euro@gmail.com' || user?.email === 'administrador@exemplo.com';
      const allowedUnits = user?.units || [];
      const [reqs, schs, cats, studs] = await Promise.all([
        api.schedulingRequests.list({ unit: activeUnit, isAdmin: isSuperAdmin, allowedUnits }),
        api.schools.list({ isAdmin: isSuperAdmin, allowedUnits }),
        api.categories.list(),
        api.students.list({ unit: activeUnit, isAdmin: isSuperAdmin, allowedUnits })
      ]);
      setRequests(reqs || []);
      setSchools(schs || []);
      setCategories(cats || []);
      setStudents(studs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    setProcessingId(id);
    try {
      const req = requests.find(r => r.id === id);
      if (!req) return;

      await api.schedulingRequests.updateStatus(id, status, user?.id || 'unknown');
      
      if (status === 'approved') {
        const schoolName = getSchoolName(req.schoolId);
        const categoryName = getCategoryName(req.categoryId);
        
        // Tenta encontrar o aluno pelo RA para carregar o nome real
        const student = students.find(s => s.ra === req.studentRA);
        const studentName = student ? student.name : (req.studentName || `Solicitação (RA: ${req.studentRA})`);

        // Cria o registro na agenda (appointments)
        await api.appointments.create({
          studentId: student?.id || 'temp',
          studentName: studentName,
          studentRA: req.studentRA,
          studentPhone: req.studentPhone,
          schoolId: req.schoolId,
          schoolUnit: req.schoolUnit || schoolName,
          unit: activeUnit, // Garantir que apareça na agenda da unidade atual
          category: categoryName,
          type: 'Intervenção Individual',
          status: 'confirmed',
          date: format(new Date(), 'yyyy-MM-dd'), // Data atual como sugestão
          startTime: '08:00',
          professionalId: user?.id,
          professionalName: user?.name,
          notes: `Aprovado via solicitação em ${format(new Date(), 'dd/MM/yyyy')}. Detalhes: ${req.complaint || 'Não informada'}`,
          complaint: req.complaint || '',
          requestId: id
        });

        if (req.studentPhone && window.confirm("Solicitação aprovada! Deseja enviar uma mensagem de confirmação via WhatsApp agora?")) {
          const message = `Olá! Sua solicitação para a escola ${schoolName} foi APROVADA. Já criamos seu registro na agenda e em breve entraremos em contato para marcar o horário.`;
          openWhatsApp(req.studentPhone, message);
        }

        if (!req.studentPhone) {
          alert("Solicitação aprovada e atendimento criado na agenda!");
        }
      }
      
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar status");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja excluir esta solicitação permanentemente?")) return;
    setProcessingId(id);
    try {
      await api.schedulingRequests.delete(id);
      await loadData();
      alert("Solicitação excluída com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir solicitação");
    } finally {
      setProcessingId(null);
    }
  };

  const getSchoolName = (id: string) => schools.find(s => s.id === id)?.name || "N/A";
  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || "N/A";

  const filteredRequests = requests.filter(r => {
    const isCentral = activeUnit === 'Administração Central';
    
    // Tenta obter o nome da unidade do registro ou, se vazio, busca pelo schoolId na lista de escolas
    const schoolFromId = schools.find(s => s.id === r.schoolId);
    const reportUnit = (r.schoolUnit || r.unit || schoolFromId?.unit || schoolFromId?.name || "").trim().toLowerCase();
    const selectedUnit = (activeUnit || "").trim().toLowerCase();
    
    // Filtro flexível e seguro
    const matchesUnit = isCentral || (reportUnit !== "" && (
      reportUnit === selectedUnit || 
      reportUnit.includes(selectedUnit) || 
      selectedUnit.includes(reportUnit)
    ));
    
    if (!matchesUnit) return false;

    const matchesSearch = (r.studentRA || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (r.studentName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getSchoolName(r.schoolId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="p-8 text-center text-sesi-blue font-bold">Carregando solicitações...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="text-sesi-blue" size={28} />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Solicitações de Agendamento</h2>
            <p className="text-sm text-gray-500">Gerencie as solicitações enviadas via QR Code pelos alunos e responsáveis.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1 flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-lg">
          <Search className="text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por RA ou Escola..." 
            className="bg-transparent outline-none text-gray-600 w-full"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="bg-gray-50 px-4 py-2 rounded-lg outline-none text-gray-600"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos os Status</option>
          <option value="pending">Pendentes</option>
          <option value="approved">Aprovados</option>
          <option value="rejected">Recusados</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
              <th className="px-6 py-4 font-semibold">Data</th>
              <th className="px-6 py-4 font-semibold">Aluno / RA</th>
              <th className="px-6 py-4 font-semibold">WhatsApp</th>
              <th className="px-6 py-4 font-semibold">Escola</th>
              <th className="px-6 py-4 font-semibold">Categoria</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">Nenhuma solicitação encontrada.</td>
              </tr>
            ) : (
              filteredRequests.map(req => (
                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800">{req.studentName || 'Não informado'}</span>
                      <span className="text-xs text-gray-400">RA: {req.studentRA}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{req.studentPhone || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <School size={14} className="text-sesi-blue" />
                      {getSchoolName(req.schoolId)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{getCategoryName(req.categoryId)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit ${
                      req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      req.status === 'approved' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {req.status === 'pending' && <Clock size={12} />}
                      {req.status === 'approved' && <Check size={12} />}
                      {req.status === 'rejected' && <X size={12} />}
                      {req.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {req.studentPhone && (
                        <button 
                          disabled={processingId === req.id}
                          onClick={() => {
                            const schoolName = getSchoolName(req.schoolId);
                            const categoryName = getCategoryName(req.categoryId);
                            const message = `Olá! Gostaria de falar sobre sua solicitação de atendimento para a escola ${schoolName}.`;
                            openWhatsApp(req.studentPhone, message);
                          }}
                          className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Enviar WhatsApp"
                        >
                          <MessageCircle size={18} />
                        </button>
                      )}
                      {req.status === 'pending' && (
                        <>
                          <button 
                            disabled={processingId === req.id}
                            onClick={() => handleStatusUpdate(req.id, 'approved')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Aprovar"
                          >
                            <Check size={18} />
                          </button>
                          <button 
                            disabled={processingId === req.id}
                            onClick={() => handleStatusUpdate(req.id, 'rejected')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Recusar"
                          >
                            <X size={18} />
                          </button>
                        </>
                      )}
                      <button 
                        type="button"
                        disabled={processingId === req.id}
                        onClick={(e) => { 
                          e.preventDefault();
                          e.stopPropagation(); 
                          handleDelete(req.id); 
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Excluir Permanentemente"
                      >
                        {processingId === req.id ? (
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-red-600 rounded-full animate-spin"></div>
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
