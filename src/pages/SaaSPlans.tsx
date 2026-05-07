import React from "react";
import PricingBanner from "../components/PricingBanner";
import { ShieldCheck, ArrowRight, Zap, GraduationCap } from "lucide-react";
import { motion } from "motion/react";

export default function SaaSPlans() {
  return (
    <div className="space-y-12 pb-20 animate-in fade-in duration-700">
      <div className="max-w-4xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-black uppercase tracking-widest border border-blue-100">
          <Zap size={14} /> Atualize sua Experiência
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight">
          Poder e Escalabilidade para sua Gestão
        </h1>
        <p className="text-lg text-slate-500 font-medium">
          Descubra o plano que melhor se adapta ao volume de atendimentos da sua unidade e aproveite recursos exclusivos.
        </p>
      </div>

      <PricingBanner />

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col gap-6"
        >
          <div className="w-16 h-16 bg-pedagogic-teal/10 text-pedagogic-teal rounded-3xl flex items-center justify-center shadow-inner">
            <ShieldCheck size={32} />
          </div>
          <h3 className="text-2xl font-black text-slate-800">Compromisso com Segurança</h3>
          <p className="text-slate-500 font-medium leading-relaxed">
            Todos os nossos planos incluem criptografia de ponta a ponta e conformidade total com a LGPD, garantindo que os dados sensíveis dos seus alunos estejam sempre protegidos.
          </p>
          <div className="flex items-center gap-2 text-pedagogic-teal font-black uppercase tracking-widest text-[10px] mt-auto">
            Saiba mais sobre segurança <ArrowRight size={14} />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-6 h-full">
            <div className="w-16 h-16 bg-white/10 text-white rounded-3xl flex items-center justify-center backdrop-blur-sm">
              <GraduationCap size={32} />
            </div>
            <h3 className="text-2xl font-black">Suporte Educacional</h3>
            <p className="text-slate-400 font-medium leading-relaxed">
              Não oferecemos apenas um software. Oferecemos uma metodologia validada para a psicologia escolar do futuro. Nossa equipe está pronta para auxiliar na sua implantação.
            </p>
            <a 
              href="https://wa.me/5581983226721?text=Olá! Gostaria de falar com um consultor sobre o SGE Psicologia."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-400 font-black uppercase tracking-widest text-[10px] mt-auto hover:text-blue-300 transition-colors"
            >
              Fale com um consultor <ArrowRight size={14} />
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
