import React from "react";
import { 
  HelpCircle, 
  LayoutDashboard, 
  Users, 
  Calendar, 
  FileText, 
  BarChart3, 
  Settings, 
  School, 
  ClipboardList,
  FileUp,
  Phone,
  User,
  ShieldAlert,
  GraduationCap,
  Sparkles,
  Zap,
  ArrowRight
} from "lucide-react";
import { motion } from "motion/react";

export default function Instructions() {
  const sections = [
    {
      title: "Dashboard",
      icon: <LayoutDashboard size={20} />,
      color: "bg-blue-500",
      description: "Visão geral estratégica com métricas em tempo real e atalhos rápidos para o dia a dia.",
      grid: "md:col-span-1"
    },
    {
      title: "Solicitações",
      icon: <ClipboardList size={20} />,
      color: "bg-orange-500",
      description: "Gerencie pedidos de agendamento. Aprove para criar um atendimento automático ou recuse com feedback.",
      grid: "md:col-span-1"
    },
    {
      title: "Escolas & QR Code",
      icon: <School size={20} />,
      color: "bg-indigo-500",
      description: "Gerencie suas unidades e gere cartazes personalizados com QR Code para o Portal do Aluno.",
      grid: "md:col-span-2"
    },
    {
      title: "Agendamentos",
      icon: <Calendar size={20} />,
      color: "bg-emerald-500",
      description: "Registro oficial de sessões. Controle datas, horários, categorias e envie avisos via WhatsApp.",
      grid: "md:col-span-1"
    },
    {
      title: "Alunos",
      icon: <Users size={20} />,
      color: "bg-sky-500",
      description: "Prontuário digital. Verifique laudos médico e histórico de atendimentos por unidade.",
      grid: "md:col-span-1"
    },
    {
      title: "Denúncias Anônimas",
      icon: <ShieldAlert size={20} />,
      color: "bg-rose-500",
      description: "Canal seguro e anônimo. Receba e analise escutas sensíveis com total sigilo e proteção.",
      grid: "md:col-span-1"
    },
    {
      title: "Documentos",
      icon: <FileText size={20} />,
      color: "bg-purple-500",
      description: "Gere declarações, encaminhamentos, registros de grupo e atividades pedagógicas em papel timbrado personalizado.",
      grid: "md:col-span-1"
    },
    {
      title: "Relatórios",
      icon: <BarChart3 size={20} />,
      color: "bg-violet-600",
      description: "Análise profunda de dados por escola, categoria e período para suporte à decisão.",
      grid: "md:col-span-1"
    },
      {
      title: "Planos & Limites",
      icon: <Zap size={20} />,
      color: "bg-amber-500",
      description: "Controle de assinaturas SaaS. Planos de 40 a 500 atendimentos ou personalizados para grandes volumes.",
      grid: "md:col-span-1"
    },
    {
      title: "Portal do Aluno",
      icon: <GraduationCap size={20} />,
      color: "bg-yellow-500",
      description: "Área externa onde alunos acessam agendamentos e denúncias através do QR Code da escola.",
      grid: "md:col-span-1"
    }
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 px-4">
      <div className="mb-12 text-center relative">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 bg-pedagogic-blue/10 text-pedagogic-blue rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-100"
        >
          <HelpCircle size={32} />
        </motion.div>
        <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-3">Guia de Jornada</h2>
        <p className="text-slate-500 font-medium max-w-lg mx-auto">
          Explore as funcionalidades do <span className="text-pedagogic-blue font-bold">SGE Psicologia</span> através deste mapa interativo.
        </p>

        {/* Decorative background sparks */}
        <div className="absolute top-0 left-1/4 -z-10 animate-pulse text-yellow-300">
          <Sparkles size={24} />
        </div>
        <div className="absolute bottom-0 right-1/4 -z-10 animate-bounce text-blue-300">
          <Zap size={20} />
        </div>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6"
      >
        {sections.map((section, idx) => (
          <motion.div 
            key={idx}
            variants={item}
            whileHover={{ y: -5, scale: 1.02 }}
            className={`${section.grid} group bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-default relative overflow-hidden`}
          >
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 ${section.color} opacity-[0.03] -mr-16 -mt-16 rounded-full blur-2xl group-hover:opacity-[0.08] transition-opacity`} />
            
            <div className="flex items-center gap-4 mb-4">
              <div className={`${section.color} text-white p-3 rounded-2xl shadow-lg ring-4 ring-white`}>
                {section.icon}
              </div>
              <h3 className="font-black text-slate-800 tracking-tight">{section.title}</h3>
            </div>
            
            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
              {section.description}
            </p>

            <div className="flex items-center text-[10px] font-black text-slate-300 group-hover:text-pedagogic-blue uppercase tracking-widest transition-colors">
              Explorar <ArrowRight size={12} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-16 bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] -mr-48 -mt-48" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-3xl font-black mb-4 tracking-tight flex items-center justify-center md:justify-start gap-3">
              <User size={32} className="text-blue-400" /> Suporte Especializado
            </h3>
            <p className="text-slate-400 font-medium text-lg leading-relaxed mb-6">
              Este sistema foi desenvolvido para otimizar a gestão da Psicologia Escolar, unindo tecnologia e escuta sensível para sua unidade.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="bg-slate-800 p-4 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold">MM</div>
                <div className="text-left">
                  <p className="font-bold text-sm">Maykon Morais</p>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Full Stack Master</p>
                </div>
              </div>
              <a 
                href="https://wa.me/5581983226721" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-pedagogic-teal hover:bg-teal-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3 shadow-xl shadow-teal-500/20 active:scale-95"
              >
                <Phone size={18} /> (81) 98322-6721
              </a>
            </div>
          </div>
          
          {/* Decorative stats or element */}
          <div className="hidden lg:block shrink-0">
            <div className="w-48 h-48 border-4 border-dashed border-slate-700 rounded-full flex items-center justify-center animate-spin-slow">
               <HelpCircle size={80} className="text-slate-700" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
