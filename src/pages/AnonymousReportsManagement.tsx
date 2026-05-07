import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { ShieldAlert, Trash2, CheckCircle2, Phone, Filter, Search, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUnit } from "../contexts/UnitContext";

export default function AnonymousReportsManagement() {
  const { activeUnit } = useUnit();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [hasApiKey, setHasApiKey] = useState(true);

  useEffect(() => {
    loadData();
    // Check if API key exists (only for display/warning purposes)
    const key = process.env.GEMINI_API_KEY;
    setHasApiKey(!!key && key !== "undefined" && key !== "");
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const isSuperAdmin = user?.role === 'super-admin' || user?.id === 'super_admin' || user?.email === 'maykon.euro@gmail.com' || user?.email === 'administrador@exemplo.com';
      const allowedUnits = user?.units || [];

      const [reportsData, schoolsData] = await Promise.all([
        api.anonymousReports.list({ isAdmin: isSuperAdmin, allowedUnits }),
        api.schools.list({ isAdmin: isSuperAdmin, allowedUnits })
      ]);
      setReports(reportsData || []);
      setSchools(schoolsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este relato?")) return;
    try {
      await api.anonymousReports.delete(id);
      loadData();
    } catch (err) {
      alert("Erro ao excluir relato");
    }
  };

  const handleMarkAnalyzed = async (id: string) => {
    try {
      await api.anonymousReports.update(id, { analyzed: true });
      loadData();
    } catch (err) {
      alert("Erro ao marcar como analisado");
    }
  };

  const formatDate = (date: any) => {
    if (!date) return new Date();
    if (typeof date === 'string') return new Date(date);
    if (date.toDate && typeof date.toDate === 'function') return date.toDate();
    return new Date(date);
  };

  const filteredReports = reports.filter(r => {
    const isCentral = activeUnit === 'Administração Central';
    
    // Tenta obter o nome da unidade do registro ou, se vazio, busca pelo schoolId na lista de escolas
    const schoolFromId = schools.find(s => s.id === r.schoolId);
    const reportUnit = (r.schoolUnit || r.unit || schoolFromId?.unit || schoolFromId?.name || "").trim().toLowerCase();
    const selectedUnit = (activeUnit || "").trim().toLowerCase();
    
    // Filtro flexível e seguro:
    const matchesUnit = isCentral || (reportUnit !== "" && (
      reportUnit === selectedUnit || 
      reportUnit.includes(selectedUnit) || 
      selectedUnit.includes(reportUnit)
    ));
    
    if (!matchesUnit) return false;

    const isPendingAI = !r.aiAnalysis;
    const matchesFilter = filter === "all" || (filter === "PENDENTE" && isPendingAI) || r.aiAnalysis?.level === filter;
    const msg = r.message || r.content || "";
    const matchesSearch = msg.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  }).sort((a, b) => {
    // Treat undefined as false (not analyzed)
    const aAnalyzed = !!a.analyzed;
    const bAnalyzed = !!b.analyzed;
    
    if (aAnalyzed === bAnalyzed) {
      // If both same status, sort by most recent date
      const dateA = formatDate(a.timestamp || a.createdAt).getTime();
      const dateB = formatDate(b.timestamp || b.createdAt).getTime();
      return dateB - dateA;
    }
    // False (unanalyzed) first
    return aAnalyzed ? 1 : -1;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
       <div className="w-12 h-12 border-4 border-pedagogic-blue/20 border-t-pedagogic-blue rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="bg-gradient-to-br from-pedagogic-rose to-red-600 text-white p-4 rounded-[1.5rem] shadow-xl shadow-red-100">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Gestão de Escuta Ativa</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Análise de relatos anônimos</p>
          </div>
        </div>
      </div>

      {!hasApiKey && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-4 text-amber-800 animate-in slide-in-from-top-4 duration-500">
          <div className="bg-amber-100 p-2 rounded-xl">
            <ShieldAlert size={24} className="text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-sm">IA de Análise Desativada</p>
            <p className="text-xs opacity-80">A chave <code className="font-mono bg-amber-100 px-1 rounded">GEMINI_API_KEY</code> não foi configurada. Novos relatos não terão análise automática de prioridade.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4 group focus-within:ring-4 focus-within:ring-pedagogic-blue/5 transition-all">
          <Search className="text-slate-300 group-focus-within:text-pedagogic-blue transition-colors" size={24} />
          <input 
            type="text" 
            placeholder="Buscar por palavras-chave nos relatos..." 
            className="flex-1 outline-none text-slate-600 font-medium placeholder:text-slate-300"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
          <Filter className="text-slate-300" size={24} />
          <select 
            className="flex-1 outline-none text-slate-600 font-bold bg-transparent cursor-pointer"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="all">Filtro: Todos os níveis</option>
            <option value="CRÍTICO">Prioridade: Crítica</option>
            <option value="MODERADO">Prioridade: Moderada</option>
            <option value="NORMAL">Prioridade: Normal</option>
            <option value="PENDENTE">Aguardando IA</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {filteredReports.map(report => (
          <div 
            key={report.id} 
            className={`bg-white rounded-[2.5rem] shadow-sm border transition-all hover:shadow-2xl hover:-translate-y-1 overflow-hidden group ${
              report.aiAnalysis?.level === 'CRÍTICO' ? 'border-red-200 ring-8 ring-red-50/50' : 'border-slate-100'
            }`}
          >
            <div className="flex flex-col md:flex-row min-h-[300px]">
              <div className={`p-8 md:w-56 shrink-0 flex flex-col justify-center items-center text-center gap-4 relative overflow-hidden ${
                report.aiAnalysis?.level === 'CRÍTICO' ? 'bg-gradient-to-b from-pedagogic-rose to-red-600 text-white' : 
                report.aiAnalysis?.level === 'MODERADO' ? 'bg-gradient-to-b from-pedagogic-amber to-orange-500 text-white' : 
                report.aiAnalysis?.level === 'PENDENTE' ? 'bg-slate-200 text-slate-400' : 'bg-slate-50 text-slate-400'
              }`}>
                {report.aiAnalysis?.level === 'CRÍTICO' && (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent opacity-50 animate-pulse" />
                )}
                
                <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-sm shadow-inner relative z-10">
                  <ShieldAlert size={36} />
                </div>
                <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-1">Nível de Risco</p>
                  <p className="font-black text-xl tracking-tighter">{report.aiAnalysis?.level || 'NÃO ANALISADO'}</p>
                </div>
              </div>

              <div className="flex-1 p-10 relative">
                <div className="flex flex-wrap justify-between items-start gap-6 mb-8">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                       <span className="px-3 py-1 bg-pedagogic-blue/10 text-pedagogic-blue rounded-full text-[10px] font-black uppercase tracking-widest border border-pedagogic-blue/10">
                         {schools.find(s => s.id === report.schoolId)?.name || 'Unidade SESI'}
                       </span>
                    </div>
                    <p className="text-xs text-slate-400 font-bold flex items-center gap-2">
                      <Calendar size={14} />
                      {format(formatDate(report.timestamp || report.createdAt), "eeee, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleDelete(report.id)}
                      className="p-3 text-slate-300 hover:text-pedagogic-rose hover:bg-pedagogic-rose/5 rounded-2xl transition-all"
                      title="Excluir relato"
                    >
                      <Trash2 size={24} />
                    </button>
                  </div>
                </div>

                <div className="bg-[#f8fafc] p-8 rounded-[2rem] border border-slate-100 relative group-hover:bg-white transition-colors">
                   <p className="text-slate-700 leading-relaxed font-semibold italic text-lg select-all">
                     "{report.message || report.content}"
                   </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-4 items-center">
                  <div className="px-5 py-2.5 bg-white shadow-sm border border-slate-100 rounded-full flex items-center gap-2">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria:</span>
                     <span className="text-[10px] font-black text-pedagogic-blue uppercase tracking-widest">{report.aiAnalysis?.category || 'Geral'}</span>
                  </div>
                  
                  {report.aiAnalysis?.isEmergency && (
                    <div className="px-5 py-2.5 bg-pedagogic-rose text-white rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse flex items-center gap-2 shadow-lg shadow-rose-100 border border-white/20">
                       <ShieldAlert size={14} /> EMERGÊNCIA IDENTIFICADA
                    </div>
                  )}

                  <div className="ml-auto">
                    {report.analyzed ? (
                      <div className="flex items-center gap-2 px-6 py-3 bg-pedagogic-teal/10 text-pedagogic-teal rounded-2xl text-[10px] font-black uppercase tracking-widest border border-pedagogic-teal/20">
                        <CheckCircle2 size={16} /> Relato Analisado
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleMarkAnalyzed(report.id)}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-50 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-pedagogic-teal hover:text-white transition-all shadow-sm border border-slate-100 group/btn"
                      >
                        <CheckCircle2 size={16} className="group-hover/btn:animate-bounce" /> Marcar como Analisado
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredReports.length === 0 && (
          <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 shadow-inner">
            <div className="text-slate-200 mb-6 flex justify-center scale-150">
              <CheckCircle2 size={48} strokeWidth={1} />
            </div>
            <p className="text-slate-400 font-extrabold uppercase tracking-[0.4em] text-xs">Todos os relatos atendidos</p>
          </div>
        )}
      </div>
    </div>
  );
}
