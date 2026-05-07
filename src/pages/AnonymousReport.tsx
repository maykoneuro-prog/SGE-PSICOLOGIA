import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { ShieldAlert, Send, ArrowLeft, CheckCircle2 } from "lucide-react";
import { GoogleGenAI } from "@google/genai";

export default function AnonymousReport() {
  const [searchParams] = useSearchParams();
  const schoolId = searchParams.get("schoolId");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [school, setSchool] = useState<any>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (schoolId) {
      api.schools.list({ public: true }).then(schools => {
        const found = (schools || []).find((s: any) => s.id === schoolId);
        setSchool(found);
      });
    }
  }, [schoolId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    let aiData = { level: 'PENDENTE', isEmergency: false, category: 'outro' };

    try {
      // AI Analysis
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        const { GoogleGenAI, Type } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey });
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Analise este relato escolar anônimo: "${message}"`,
          config: {
            systemInstruction: `Você é um especialista em segurança escolar. Classifique o relato conforme as regras:
            - CRÍTICO: Risco imediato à vida ou integridade física grave.
            - MODERADO: Bullying persistente, brigas frequentes, comportamento preocupante.
            - NORMAL: Reclamações comuns, relatos sem urgência.
            
            Identifique também se é uma EMERGÊNCIA e a categoria predominante.`,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                level: { type: Type.STRING, enum: ["CRÍTICO", "MODERADO", "NORMAL"] },
                isEmergency: { type: Type.BOOLEAN },
                category: { type: Type.STRING }
              },
              required: ["level", "isEmergency", "category"]
            }
          }
        });
        
        if (response.text) {
          const parsed = JSON.parse(response.text);
          aiData = {
            level: parsed.level || 'NORMAL',
            isEmergency: !!parsed.isEmergency,
            category: parsed.category || 'outro'
          };
        }
      }
    } catch (err) {
      console.error("AI Analysis failed:", err);
      // Fallback already set to PENDENTE
    }

    try {
      await api.anonymousReports.create({
        schoolId,
        schoolUnit: school?.unit || school?.name || "",
        unit: school?.unit || school?.name || "",
        ownerId: school?.ownerId || "",
        message,
        aiAnalysis: aiData,
        status: 'new',
        timestamp: new Date().toISOString()
      });

      setIsSuccess(true);
    } catch (err) {
      console.error("Firestore creation failed:", err);
      alert("Desculpe, houve um erro ao registrar sua mensagem. Tente novamente em instantes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 text-center">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl max-w-sm w-full border border-slate-100">
          <div className="w-24 h-24 bg-pedagogic-teal/10 text-pedagogic-teal rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 mb-4 tracking-tight">Relato Recebido</h2>
          <p className="text-slate-500 mb-10 leading-relaxed font-medium">
            Obrigado por sua coragem! Sua mensagem foi guardada com total sigilo. Nossa equipe acolhedora irá analisar com todo cuidado.
          </p>
          <button 
            onClick={() => navigate(`/student-portal?schoolId=${schoolId}`)}
            className="w-full bg-pedagogic-blue text-white py-5 rounded-[1.5rem] font-extrabold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-pedagogic-rose/10 via-[#f8fafc] to-pedagogic-amber/10 flex items-center justify-center p-6">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-10 relative overflow-hidden border border-white/50">
        <div className="absolute top-0 right-0 w-64 h-64 bg-pedagogic-rose/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
        
        <button 
          onClick={() => navigate(-1)}
          className="relative z-10 flex items-center gap-2 text-slate-400 hover:text-slate-600 mb-8 transition-colors group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-extrabold uppercase tracking-widest">Voltar</span>
        </button>

        <div className="relative z-10 flex items-center gap-5 mb-10">
          <div className="bg-pedagogic-rose text-white p-4 rounded-[1.5rem] shadow-xl shadow-red-100">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Espaço Seguro</h1>
            <p className="text-xs text-slate-400 font-extrabold uppercase tracking-[0.2em] mt-1">100% Anônimo • 100% Protegido</p>
          </div>
        </div>

        <div className="bg-pedagogic-amber/10 border border-pedagogic-amber/20 p-6 rounded-[2rem] mb-10 flex gap-4 items-start shadow-sm">
          <div className="text-pedagogic-amber shrink-0 mt-1">
            <ShieldAlert size={24} />
          </div>
          <p className="text-sm text-amber-900 leading-relaxed font-semibold">
            Sua identidade é um segredo só seu. Relate aqui qualquer situação de bullying, desrespeito ou riscos à segurança da nossa escola. Sua ajuda é fundamental para cuidarmos uns dos outros.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="relative z-10 space-y-8">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pedagogic-rose"></div>
              O que você gostaria de relatar?
            </label>
            <textarea 
              className="w-full h-56 px-6 py-6 bg-slate-50/50 border border-slate-100 rounded-[2.5rem] outline-none focus:ring-4 focus:ring-pedagogic-rose/10 focus:bg-white transition-all text-slate-700 resize-none font-semibold text-base leading-relaxed shadow-inner"
              placeholder="Fique à vontade para escrever... Conte detalhes como locais, situações ou preocupações que você tem."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit"
            disabled={isSubmitting || !message.trim()}
            className="w-full bg-pedagogic-rose hover:bg-rose-600 text-white py-6 rounded-[1.75rem] font-black uppercase tracking-[0.2em] text-sm transition-all shadow-2xl shadow-rose-100 disabled:opacity-50 flex items-center justify-center gap-4 active:scale-95 group"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                Enviando com segurança...
              </>
            ) : (
              <>
                <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                Enviar Mensagem de Apoio
              </>
            )}
          </button>
        </form>

        <div className="mt-12 flex flex-col items-center gap-2 relative z-10">
           <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.3em]">Ambiente Acolhedor</p>
           <div className="w-16 h-1 bg-slate-100 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
