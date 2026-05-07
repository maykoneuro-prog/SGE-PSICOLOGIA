import React from "react";
import { Check, Zap, Target, Rocket, ChevronRight } from "lucide-react";
import { motion } from "motion/react";

export default function PricingBanner() {
  const plans = [
    {
      name: "Plano Básico",
      limit: "40 atendimentos/mês",
      features: [
        "1 Escola",
        "1 Psicólogo",
        "40 atendimentos/mês",
        "Bloqueio automático",
        "Sem excedente"
      ],
      price: "R$ 79,90",
      icon: <Target className="text-blue-500" size={24} />,
      highlight: false,
      supportText: "Ideal para começar",
      cta: "Entrar em contato"
    },
    {
      name: "Plano Profissional",
      limit: "120 atendimentos/mês",
      features: [
        "1 Escola",
        "Até 2 Psicólogos",
        "120 atendimentos/mês",
        "Sem bloqueio",
        "Excedente: R$ 1,00/unid."
      ],
      price: "R$ 199,90",
      icon: <Zap className="text-amber-500" size={24} />,
      highlight: true,
      tag: "Recomendado",
      cta: "Entrar em contato"
    },
    {
      name: "Plano Premium",
      limit: "500 atendimentos/mês",
      features: [
        "1 Escola",
        "Vários Psicólogos",
        "500 atendimentos/mês",
        "Sem bloqueio",
        "Excedente: R$ 0,50/unid."
      ],
      price: "R$ 499,90",
      icon: <Rocket className="text-indigo-600" size={24} />,
      highlight: false,
      footerNote: "Mais de uma escola sob orçamento",
      cta: "Entrar em contato"
    },
    {
      name: "Plano Personalizado",
      limit: "Sob Consulta",
      features: [
        "Escolas Ilimitadas",
        "Psicólogos Ilimitados",
        "Mais de 500 atendimentos",
        "Suporte Prioritário 24h",
        "Dashboards Customizados"
      ],
      price: "Consulte-nos",
      icon: <ChevronRight className="text-emerald-500" size={24} />,
      highlight: false,
      supportText: "Para grandes redes",
      cta: "Falar com consultor"
    }
  ];

  const handleContact = (planName: string) => {
    const message = encodeURIComponent(`Olá! Gostaria de saber mais sobre o ${planName} do SGE Psicologia.`);
    window.open(`https://wa.me/5581983226721?text=${message}`, '_blank');
  };

  return (
    <div className="w-full bg-white rounded-[3rem] p-8 md:p-12 border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full -mr-48 -mt-48 blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50 rounded-full -ml-32 -mb-32 blur-3xl opacity-50" />

      <div className="relative z-10 text-center mb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-pedagogic-teal/10 text-pedagogic-teal rounded-full text-xs font-black uppercase tracking-widest mb-6 border border-pedagogic-teal/20"
        >
          <Zap size={14} className="animate-pulse" /> FLEXIBILIDADE E CONTROLE PARA SUA ROTINA
        </motion.div>

        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-4"
        >
          Escolha o plano ideal para você
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg text-slate-500 font-medium max-w-2xl mx-auto"
        >
          Flexibilidade, controle e economia para sua rotina profissional
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
        {plans.map((plan, idx) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`flex flex-col p-8 rounded-[2.5rem] transition-all duration-500 hover:-translate-y-2 ${
              plan.highlight 
                ? "bg-slate-900 text-white shadow-2xl shadow-blue-200 ring-8 ring-blue-50/50 scale-105" 
                : "bg-white border border-slate-100 shadow-sm hover:shadow-xl text-slate-800"
            }`}
          >
            {plan.tag && (
              <div className="inline-block self-start px-4 py-1 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-6">
                {plan.tag}
              </div>
            )}

            <div className="flex items-center gap-4 mb-6">
              <div className={`p-3 rounded-2xl ${plan.highlight ? "bg-white/10" : "bg-slate-50"}`}>
                {plan.icon}
              </div>
              <div>
                <h3 className="text-xl font-black">{plan.name}</h3>
                {plan.supportText && (
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40">{plan.supportText}</p>
                )}
              </div>
            </div>

            <div className="mb-8">
              <p className={`text-4xl font-black mb-1 ${plan.highlight ? "text-white" : "text-slate-800"}`}>
                {plan.price}
              </p>
              <p className={`text-sm font-bold uppercase tracking-widest opacity-60`}>
                / Mês
              </p>
            </div>

            <div className={`mb-8 p-4 rounded-2xl ${plan.highlight ? "bg-white/5" : "bg-blue-50/50"} border border-transparent`}>
              <p className="text-sm font-black uppercase tracking-tighter mb-1">Capacidade mensal</p>
              <p className="text-lg font-bold">{plan.limit}</p>
            </div>

            <div className="flex-1 space-y-4 mb-10 text-left">
              {plan.features.map((feature, fidx) => (
                <div key={fidx} className="flex items-center gap-3">
                  <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${plan.highlight ? "bg-blue-400/20 text-blue-400" : "bg-blue-50 text-blue-500"}`}>
                    <Check size={12} strokeWidth={4} />
                  </div>
                  <span className={`text-sm font-semibold opacity-90`}>{feature}</span>
                </div>
              ))}
            </div>

            {plan.footerNote && (
              <p className="text-[10px] font-bold text-center mb-4 opacity-50 italic">{plan.footerNote}</p>
            )}

            <button 
              onClick={() => handleContact(plan.name)}
              className={`w-full py-5 px-6 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95 ${
                plan.highlight 
                  ? "bg-blue-500 hover:bg-blue-400 text-white shadow-xl shadow-blue-500/20" 
                  : "bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-100 shadow-sm"
              }`}
            >
              CONTRATAR AGORA
              <ChevronRight size={16} />
            </button>
          </motion.div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">
          Fale conosco e encontre o plano ideal para sua necessidade
        </p>
      </div>
    </div>
  );
}
