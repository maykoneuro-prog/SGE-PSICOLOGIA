import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Calendar, ShieldAlert, MessageSquare, ArrowLeft } from "lucide-react";

export default function StudentPortal() {
  const [searchParams] = useSearchParams();
  const schoolId = searchParams.get("schoolId");
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [appSettings, setAppSettings] = useState({ name: "SGE Psicologia", logoUrl: "https://images.weserv.nl/?url=i.imgur.com/NR6kaz6.png" });
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch App Settings
    api.appSettings.get().then(settings => {
      if (settings) setAppSettings(settings);
    });

    if (schoolId) {
      loadSchool();
    } else {
      setLoading(false);
    }
  }, [schoolId]);

  const loadSchool = async () => {
    try {
      const schools = await api.schools.list();
      const found = schools.find((s: any) => s.id === schoolId);
      setSchool(found);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="text-sesi-blue animate-pulse font-bold">Carregando portal do estudante...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-pedagogic-blue/20 via-[#f8fafc] to-pedagogic-teal/20 p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 overflow-hidden relative border border-white/50">
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-pedagogic-blue/5 rounded-full -mr-24 -mt-24 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-pedagogic-teal/5 rounded-full -ml-16 -mb-16 blur-2xl" />
        
        <div className="relative text-center mb-10">
          <div className="inline-flex p-4 rounded-3xl mb-6 bg-gradient-to-br from-white to-gray-50 shadow-md ring-1 ring-gray-100 group">
             {appSettings.logoUrl && (
               <img 
                 src={appSettings.logoUrl} 
                 alt="Logo SGE" 
                 className="h-14 w-auto group-hover:scale-110 transition-transform object-contain" 
                 referrerPolicy="no-referrer"
               />
             )}
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 mb-3 tracking-tight outline-none">Portal do Aluno</h1>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-pedagogic-teal animate-pulse"></div>
            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">{appSettings.name}</p>
          </div>
          <p className="text-slate-600 font-medium px-4 leading-relaxed mt-4">
            {school ? (
              <>Olá! Como podemos apoiar você hoje na <span className="text-pedagogic-blue font-bold">Unidade {school.name}</span>?</>
            ) : "Estamos aqui para ouvir e cuidar de você."}
          </p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={() => navigate(`/agendar?schoolId=${schoolId}`)}
            className="w-full group flex items-center gap-5 p-6 bg-white border border-slate-100 rounded-[1.75rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-pedagogic-blue/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500" />
            <div className="bg-pedagogic-blue/10 text-pedagogic-blue p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-inner">
              <Calendar size={28} />
            </div>
            <div className="relative z-10">
              <h3 className="font-extrabold text-slate-800 text-lg">Agendar Atendimento</h3>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Quer conversar com o psicólogo?</p>
            </div>
          </button>

          <button 
            onClick={() => navigate(`/denuncia-anonima?schoolId=${schoolId}`)}
            className="w-full group flex items-center gap-5 p-6 bg-white border border-slate-100 rounded-[1.75rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 w-24 h-24 bg-pedagogic-rose/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500" />
            <div className="bg-pedagogic-rose/10 text-pedagogic-rose p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-inner">
              <ShieldAlert size={28} />
            </div>
            <div className="relative z-10">
              <h3 className="font-extrabold text-slate-800 text-lg">Reportar Situação</h3>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Denúncia anônima e segura</p>
            </div>
          </button>
        </div>

        <div className="mt-12 text-center p-6 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
          <div className="flex justify-center mb-3">
             <MessageSquare size={20} className="text-slate-400" />
          </div>
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.2em] mb-2 font-black">Canais de Escuta</p>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Sua identidade será preservada. Não tenha medo de pedir ajuda ou relatar algo.
          </p>
        </div>
      </div>
      
      <div className="mt-10 flex flex-col items-center gap-3">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{appSettings.name} • Portal de Apoio</p>
        <div className="flex gap-4">
           <div className="w-12 h-1 bg-pedagogic-blue/20 rounded-full"></div>
           <div className="w-12 h-1 bg-pedagogic-teal/20 rounded-full"></div>
           <div className="w-12 h-1 bg-pedagogic-amber/20 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
