import { useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { api } from "../lib/api";
import { 
  Users, Calendar, School, TrendingUp, 
  AlertCircle, BrainCircuit, FileDown,
  Filter, Activity, Target
} from "lucide-react";
import { format, eachDayOfInterval, isSameDay, subMonths, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUnit } from "../contexts/UnitContext";
import { GoogleGenAI } from "@google/genai";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Reports({ user }: { user: any }) {
  const { activeUnit } = useUnit();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(3); // Months
  const [selectedSchool, setSelectedSchool] = useState<string>("all");
  const [schools, setSchools] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [activeUnit, selectedPeriod, selectedSchool]);

  const loadData = async () => {
    try {
      setLoading(true);
      const isGlobalAdmin = (user?.role === 'admin' || user?.role === 'super-admin') && !(user?.planId === 'trial' || user?.isTrial);
      const allowedUnits = user?.units || [];
      
      const filters: any = { isAdmin: isGlobalAdmin };
      if (!isGlobalAdmin) {
        filters.unit = activeUnit;
        filters.allowedUnits = allowedUnits;
      } else if (selectedSchool !== 'all') {
        filters.unit = selectedSchool;
      }

      const results = await Promise.all([
        api.appointments.list(filters),
        api.appointmentTypes.list(),
        api.students.list({ 
          unit: isGlobalAdmin && selectedSchool === 'all' ? undefined : (selectedSchool === 'all' ? activeUnit : selectedSchool), 
          isAdmin: isGlobalAdmin,
          allowedUnits
        }),
        api.schools.list({
          isAdmin: isGlobalAdmin,
          allowedUnits
        }),
        api.users.list(),
        api.documents.list(filters)
      ]);

      const appointments = (results[0] || []) as any[];
      const types = (results[1] || []) as any[];
      const students = (results[2] || []) as any[];
      const schoolsData = (results[3] || []) as any[];
      const professionals = (results[4] || []) as any[];
      const docs = (results[5] || []) as any[];
      
      setSchools(schoolsData);

      // Filtering by period
      const startDate = startOfDay(subMonths(new Date(), selectedPeriod));
      const endDate = endOfDay(new Date());

      // Merge Appointments and all clinical/pedagogical documents
      const relevantDocTypes = [
        'psychological_listening', 
        'school_diagnosis', 
        'group_attendance', 
        'pedagogical_participation', 
        'classroom_evolution',
        'referral',
        'attendance_declaration',
        'authorization_term'
      ];

      const reportDocs = docs
        .filter(d => relevantDocTypes.includes(d.type))
        .map(d => {
          let label = d.type;
          if (d.type === 'psychological_listening') label = 'Escuta Psicológica';
          else if (d.type === 'school_diagnosis') label = 'Diagnóstico Escolar';
          else if (d.type === 'group_attendance') label = 'Atendimento em Grupo';
          else if (d.type === 'pedagogical_participation') label = 'Part. Pedagógica';
          else if (d.type === 'classroom_evolution') label = 'Evolução em Sala';
          else if (d.type === 'referral') label = 'Encaminhamento';
          else if (d.type === 'attendance_declaration') label = 'Declaração de Comparecimento';
          else if (d.type === 'authorization_term') label = 'Termo de Autorização';

          return {
            ...d,
            gravity: d.data?.gravity || 'low',
            origin: d.data?.origin || 'Espontânea',
            subtype: d.data?.subtype || d.data?.category || 'Geral',
            typeLabel: label
          };
        });

      const allAttendance = [
        ...appointments.map(a => ({ ...a, typeLabel: types.find(t => t.name === a.type)?.label || a.type })), 
        ...reportDocs
      ].filter(app => {
        const d = app.date?.toDate ? app.date.toDate() : new Date(app.date);
        return isWithinInterval(d, { start: startDate, end: endDate });
      });

      // 1. Quantitative Counts
      const stats = {
        totalAppointments: allAttendance.length,
        totalStudents: students.length,
        totalSchools: isGlobalAdmin ? schoolsData.length : 1,
        criticalCases: allAttendance.filter(app => app.gravity === 'critical' || app.gravity === 'high').length,
      };

      // 2. Appointments by Professional
      const profCounts: Record<string, number> = {};
      allAttendance.forEach(app => {
        const prof = professionals.find(p => p.id === app.professionalId || p.uid === app.professionalId);
        const name = prof?.name || app.professionalName || 'Não identificado';
        profCounts[name] = (profCounts[name] || 0) + 1;
      });
      const byProfessional = Object.entries(profCounts).map(([name, value]) => ({ name, value }));

      // 3. Appointments by Type & Subtype
      const typeCounts: Record<string, number> = {};
      const subtypeCounts: Record<string, number> = {};
      allAttendance.forEach(app => {
        const title = app.typeLabel || 'Atendimento';
        typeCounts[title] = (typeCounts[title] || 0) + 1;
        
        if (app.subtype) {
          subtypeCounts[app.subtype] = (subtypeCounts[app.subtype] || 0) + 1;
        }
      });
      const byType = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
      const bySubtype = Object.entries(subtypeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10) // Show more subtypes
        .map(([name, value]) => ({ name, value }));

      // 4. Appointments by Origin & Gravity
      const originCounts: Record<string, number> = {};
      const gravityCounts: Record<string, number> = {
        'Baixa': allAttendance.filter(a => a.gravity === 'low' || !a.gravity).length,
        'Média': allAttendance.filter(a => a.gravity === 'medium').length,
        'Alta': allAttendance.filter(a => a.gravity === 'high').length,
        'Crítica': allAttendance.filter(a => a.gravity === 'critical').length,
      };
      allAttendance.forEach(app => {
        if (app.origin) {
          originCounts[app.origin] = (originCounts[app.origin] || 0) + 1;
        }
      });
      const byOrigin = Object.entries(originCounts).map(([name, value]) => ({ name, value }));
      const byGravity = Object.entries(gravityCounts).map(([name, value]) => ({ name, value }));

      // 5. Temporal Evolution
      const intervalDays = eachDayOfInterval({ start: startDate, end: endDate });
      const timeData: any[] = [];
      if (selectedPeriod > 1) {
        const monthCounts: Record<string, number> = {};
        allAttendance.forEach(app => {
          const d = app.date?.toDate ? app.date.toDate() : new Date(app.date);
          const monthYear = format(d, 'MMM/yy', { locale: ptBR });
          monthCounts[monthYear] = (monthCounts[monthYear] || 0) + 1;
        });
        Object.entries(monthCounts).forEach(([date, value]) => timeData.push({ date, value }));
      } else {
        intervalDays.forEach(day => {
          const count = allAttendance.filter(app => {
            const d = app.date?.toDate ? app.date.toDate() : new Date(app.date);
            return isSameDay(d, day);
          }).length;
          timeData.push({ date: format(day, 'dd/MM'), value: count });
        });
      }

      setData({ 
        stats, 
        byProfessional, 
        byType, 
        bySubtype, 
        byOrigin, 
        byGravity,
        timeData,
        raw: allAttendance
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateAIStrategicAnalysis = async () => {
    const key = process.env.GEMINI_API_KEY;
    if (!data || !key || key === "undefined" || key === "") {
       alert("A chave GEMINI_API_KEY não foi configurada. Não é possível gerar análise por IA.");
       return;
    }
    
    setGeneratingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: key });

      const contextData = {
        totalAtendimentos: data.stats.totalAppointments,
        tipos: data.byType,
        subtipos: data.bySubtype,
        gravidade: data.byGravity,
        origem: data.byOrigin,
        casosCriticos: data.stats.criticalCases
      };

      const prompt = `
        Aja como um consultor sênior em psicologia escolar e gestão educacional.
        Analise os seguintes dados agregados de atendimentos de uma escola/unidade em um período de ${selectedPeriod} meses:
        ${JSON.stringify(contextData)}

        Sua tarefa é gerar um relatório estratégico em JSON com:
        1. "diagnostico": Um parágrafo resumindo a situação atual, identificando o padrão mais preocupante.
        2. "problemasPrincipais": Uma lista de 3 principais desafios detectados nos dados.
        3. "planoAcao": Uma lista de 4 recomendações práticas e estratégicas para a escola seguir.
        4. "metricaSucesso": Como medir se essas ações estão funcionando.

        Responda APENAS o JSON válido.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt
      });
      
      let text = result.text;
      
      if (text.includes("```json")) {
        text = text.split("```json")[1].split("```")[0];
      } else if (text.includes("```")) {
        text = text.split("```")[1].split("```")[0];
      }

      const analysis = JSON.parse(text);
      setAiAnalysis(analysis);
    } catch (err) {
      console.error("Erro AI:", err);
      alert("Não foi possível gerar a análise por IA neste momento.");
    } finally {
      setGeneratingAI(false);
    }
  };

  const exportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [0, 75, 147]; // SESI Blue

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("Relatório Estratégico de Atendimentos", 15, 25);
    doc.setFontSize(10);
    doc.text(`Unidade: ${selectedSchool === 'all' ? activeUnit : selectedSchool} | Período: Últimos ${selectedPeriod} meses`, 15, 33);
    
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(14);
    doc.text("1. Resumo Quantitativo", 15, 55);

    autoTable(doc, {
      startY: 60,
      head: [['Métrica', 'Volume']],
      body: [
        ['Total de Atendimentos', data.stats.totalAppointments.toString()],
        ['Casos Críticos', data.stats.criticalCases.toString()],
        ['Pessoas Únicas (Estudantes)', data.stats.totalStudents.toString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: primaryColor }
    });

    doc.text("2. Distribuição por Subtipo (Top 5)", 15, (doc as any).lastAutoTable.finalY + 15);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Subtipo', 'Ocorrências']],
      body: data.bySubtype.map((s: any) => [s.name, s.value.toString()]),
      theme: 'grid'
    });

    if (aiAnalysis) {
      doc.addPage();
      doc.setFillColor(248, 250, 252);
      doc.rect(10, 10, 190, 277, 'F');
      
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(16);
      doc.text("3. Diagnóstico e Plano de Ação (IA)", 15, 25);
      
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(11);
      doc.text("Diagnóstico:", 15, 40);
      
      const splitDiagnostico = doc.splitTextToSize(aiAnalysis.diagnostico || "", 180);
      let currentY = 47;
      
      // Better loop for diagnosis to handle long text
      splitDiagnostico.forEach((line: string) => {
        if (currentY > 275) {
          doc.addPage();
          doc.setFillColor(248, 250, 252);
          doc.rect(10, 10, 190, 277, 'F');
          currentY = 25;
        }
        doc.text(line, 15, currentY);
        currentY += 6;
      });

      currentY += 8;

      // Check if currentY is getting close to the bottom
      const checkPageBreak = (needed: number) => {
        if (currentY + needed > 270) {
          doc.addPage();
          currentY = 25;
          doc.setFillColor(248, 250, 252);
          doc.rect(10, 10, 190, 277, 'F');
          return true;
        }
        return false;
      };

      doc.text("Problemas Principais:", 15, currentY);
      currentY += 8;
      (aiAnalysis.problemasPrincipais || []).forEach((p: string) => {
        const splitP = doc.splitTextToSize(`• ${p}`, 175);
        checkPageBreak(splitP.length * 6);
        doc.text(splitP, 20, currentY);
        currentY += (splitP.length * 6) + 2;
      });

      currentY += 8;
      checkPageBreak(25);
      doc.text("Plano de Ação Recomendado:", 15, currentY);
      currentY += 8;
      (aiAnalysis.planoAcao || []).forEach((p: string, i: number) => {
        const splitP = doc.splitTextToSize(`${i + 1}. ${p}`, 175);
        checkPageBreak(splitP.length * 6);
        doc.text(splitP, 20, currentY);
        currentY += (splitP.length * 6) + 3;
      });

      currentY += 10;
      checkPageBreak(20);
      doc.text("Métrica de Sucesso:", 15, currentY);
      const splitMetrica = doc.splitTextToSize(aiAnalysis.metricaSucesso || "", 175);
      doc.text(splitMetrica, 20, currentY + 8);
    }

    doc.save(`Relatorio_Estrategico_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
  const GRAVITY_COLORS = {
    'Baixa': '#10b981',
    'Média': '#f59e0b',
    'Alta': '#f97316',
    'Crítica': '#ef4444'
  };

  if (loading && !data) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pedagogic-blue"></div>
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Compilando Dados Estratégicos...</p>
    </div>
  );

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row justify-between gap-8 pt-4">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter">Relatório de Impacto</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Visão Estratégica e Tomada de Decisão</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 p-1 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100">
              <Filter size={14} /> Filtros
            </div>
            
            {(user?.role === 'admin' || user?.role === 'super-admin') && (
              <select 
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="bg-transparent border-none outline-none px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 cursor-pointer"
              >
                <option value="all">Todas as Unidades</option>
                {schools.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            )}

            <select 
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(Number(e.target.value))}
              className="bg-transparent border-none outline-none px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 cursor-pointer ml-2"
            >
              <option value={1}>Último Mês</option>
              <option value={3}>Último Trimestre</option>
              <option value={6}>Último Semestre</option>
              <option value={12}>Último Ano</option>
            </select>
          </div>

          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:-translate-y-1 transition-all active:scale-95"
          >
            <FileDown size={18} /> Exportar PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <MetricCard title="Total de Atendimentos" value={data.stats.totalAppointments} icon={<Calendar />} color="text-blue-600" bg="bg-blue-50" />
        <MetricCard title="Escolas Abrangidas" value={data.stats.totalSchools} icon={<School />} color="text-indigo-600" bg="bg-indigo-50" />
        <MetricCard title="Alunos Atendidos" value={data.stats.totalStudents} icon={<Users />} color="text-teal-600" bg="bg-teal-50" />
        <MetricCard title="Casos Críticos" value={data.stats.criticalCases} icon={<AlertCircle />} color="text-rose-600" bg="bg-rose-50" sub="Necessitam Atenção Imediata" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm shadow-slate-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-800">Evolução dos Atendimentos</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Comparativo de demanda no período</p>
            </div>
            <Activity className="text-slate-200" size={32} />
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeData}>
                <defs>
                   <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                     <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                   </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 900, color: '#1e293b' }}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm shadow-slate-100 flex flex-col h-full">
           <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-800">Crivo de Gravidade</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Classificação de urgência clínica</p>
            </div>
            <Target className="text-slate-200" size={32} />
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.byGravity}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {data.byGravity.map((entry: any, index: number) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={GRAVITY_COLORS[entry.name as keyof typeof GRAVITY_COLORS] || '#cbd5e1'} 
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-6">
            {data.byGravity.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: GRAVITY_COLORS[item.name as keyof typeof GRAVITY_COLORS] }} 
                  />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{item.name}</span>
                </div>
                <span className="text-sm font-black text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm shadow-slate-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-800">Ranking: Temas Recorrentes</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Subtipos mais frequentes no período</p>
            </div>
          </div>
          <div className="space-y-4">
             {data.bySubtype.length === 0 ? (
               <p className="text-center py-10 text-slate-400 font-bold uppercase text-[10px]">Sem dados de subtipos</p>
             ) : data.bySubtype.map((item: any, index: number) => (
               <div key={index} className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${index === 0 ? 'bg-pedagogic-blue text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{item.name}</span>
                      <span>{item.value}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                       <div 
                         className="h-full bg-pedagogic-blue transition-all duration-1000"
                         style={{ width: `${(item.value / data.stats.totalAppointments * 100)}%` }}
                       />
                    </div>
                  </div>
               </div>
             ))}
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm shadow-slate-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-800">Origem das Demandas</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Portas de entrada dos atendimentos</p>
            </div>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byOrigin}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 700}} />
                <YAxis hide />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '15px' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={40}>
                   {data.byOrigin.map((entry: any, index: number) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 bg-slate-900 rounded-[3rem] shadow-2xl -rotate-1 scale-105 opacity-5" />
        <div className="relative bg-white rounded-[3rem] p-12 border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
          <div className="absolute top-0 right-0 p-12 flex flex-col items-end opacity-20 pointer-events-none">
            <BrainCircuit size={120} className="text-pedagogic-blue" />
          </div>

          <div className="max-w-4xl space-y-8 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl">
                 <BrainCircuit size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Inteligência Estratégica AI</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagnóstico Automatizado e Plano de Ação</p>
              </div>
            </div>

            {!aiAnalysis ? (
              <div className="space-y-6 pt-4">
                <p className="text-lg text-slate-500 font-medium leading-relaxed">
                  Utilize o motor de inteligência artificial do SGE Psicologia para analisar os padrões de dados deste período. 
                  A IA irá cruzará informações de tipos, gravidade e volume para sugerir intervenções práticas para a escola.
                </p>
                <button 
                  onClick={generateAIStrategicAnalysis}
                  disabled={generatingAI}
                  className="flex items-center gap-3 px-10 py-6 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all disabled:opacity-50 shadow-2xl shadow-slate-300"
                >
                  {generatingAI ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                      Processando Dados...
                    </>
                  ) : (
                    <>
                      <TrendingUp size={18} className="mr-2" /> Gerar Diagnóstico Estratégico
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in slide-in-from-bottom-4 duration-700">
                <div className="space-y-8">
                  <div className="space-y-3">
                    <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">Diagnóstico do Período</span>
                    <p className="text-slate-600 font-medium leading-relaxed italic">
                      "{aiAnalysis.diagnostico}"
                    </p>
                  </div>

                  <div className="space-y-3">
                    <span className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest">Pontos Críticos Detectados</span>
                    <ul className="space-y-2">
                       {aiAnalysis.problemasPrincipais.map((p: string, i: number) => (
                         <li key={i} className="flex items-start gap-2 text-sm font-bold text-slate-700">
                           <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                           {p}
                         </li>
                       ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-8 p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                   <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="px-4 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">Plano de Ação Recomendado</span>
                       <button onClick={() => setAiAnalysis(null)} className="text-[10px] font-black text-slate-300 uppercase underline">Recalcular</button>
                    </div>
                    <div className="space-y-4">
                       {aiAnalysis.planoAcao.map((p: string, i: number) => (
                         <div key={i} className="flex gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <span className="text-xl font-black text-slate-200">{i + 1}</span>
                            <p className="text-xs font-bold text-slate-700 leading-relaxed">{p}</p>
                         </div>
                       ))}
                    </div>
                    <div className="pt-4 border-t border-slate-200">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Métrica de Sucesso Sugerida</p>
                       <p className="text-xs font-bold text-pedagogic-blue">{aiAnalysis.metricaSucesso}</p>
                    </div>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, color, bg, sub }: any) {
  return (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm shadow-slate-100/50 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all group">
      <div className={`p-4 rounded-2xl ${bg} ${color} w-fit mb-6 transition-transform group-hover:scale-110`}>
        {icon}
      </div>
      <div>
        <h4 className="text-4xl font-black text-slate-800 tracking-tighter mb-1">{value}</h4>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        {sub && <p className="text-[9px] font-bold text-slate-300 italic mt-2">{sub}</p>}
      </div>
    </div>
  );
}
