import React, { useState } from 'react';
import { 
  Zap, Shield, Clock, BarChart3, Users, MessageSquare, 
  ChevronRight, ArrowRight, CheckCircle2, Star, 
  LayoutDashboard, BrainCircuit, Smartphone, HelpCircle,
  ChevronDown
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

const FeatureCard = ({ icon, title, description, color }: any) => (
  <motion.div 
    whileHover={{ y: -8 }}
    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-200/20 transition-all group"
  >
    <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
      {React.cloneElement(icon, { size: 28, className: "text-white" })}
    </div>
    <h3 className="text-xl font-black text-slate-800 mb-3 tracking-tight">{title}</h3>
    <p className="text-slate-500 text-sm leading-relaxed font-medium">{description}</p>
  </motion.div>
);

const PlanCard = ({ name, price, description, features, highlighted, ctaText, capacity, capacityLabel, pricePrefix = "R$", priceSuffix = "/mês" }: any) => (
  <motion.div 
    whileHover={{ scale: highlighted ? 1.02 : 1 }}
    className={`p-10 rounded-[3rem] border transition-all flex flex-col ${
      highlighted 
        ? 'bg-[#0f172a] border-pedagogic-blue shadow-2xl relative z-10 text-white' 
        : 'bg-white border-slate-100 shadow-sm'
    }`}
  >
    {highlighted && (
      <div className="absolute top-0 left-10 -translate-y-1/2 bg-pedagogic-blue text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">
        Recomendado
      </div>
    )}
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${highlighted ? 'bg-white/10' : 'bg-blue-50'}`}>
          {highlighted ? <Zap size={24} className="text-pedagogic-amber" /> : <Shield size={24} className="text-pedagogic-blue" />}
        </div>
        <div>
          <h3 className={`text-xl font-black tracking-tight ${highlighted ? 'text-white' : 'text-slate-800'}`}>
            Plano {name}
          </h3>
          <p className={`text-[10px] font-black uppercase tracking-widest ${highlighted ? 'text-slate-400' : 'text-slate-400'}`}>
            {description}
          </p>
        </div>
      </div>

      <div className="flex flex-col mb-6">
        <div className="flex items-baseline gap-1">
          {price === "Consulte-nos" ? (
            <span className={`text-4xl font-black tracking-tighter ${highlighted ? 'text-white' : 'text-slate-800'}`}>Consulte-nos</span>
          ) : (
            <>
              <span className={`text-4xl font-black tracking-tighter ${highlighted ? 'text-white' : 'text-slate-800'}`}>{pricePrefix} {price}</span>
            </>
          )}
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest mt-1 ${highlighted ? 'text-slate-400' : 'text-slate-400'}`}>{priceSuffix}</span>
      </div>

      <div className={`${highlighted ? 'bg-white/5' : 'bg-slate-50'} p-6 rounded-2xl mb-8`}>
        <p className={`text-[8px] font-black uppercase tracking-[0.2em] mb-2 ${highlighted ? 'text-slate-400' : 'text-slate-400'}`}>Capacidade Mensal</p>
        <p className={`text-lg font-black tracking-tight ${highlighted ? 'text-white' : 'text-slate-800'}`}>{capacity}</p>
        <p className={`text-xs font-bold ${highlighted ? 'text-slate-400' : 'text-slate-500'}`}>{capacityLabel}</p>
      </div>
    </div>
    
    <div className="space-y-4 mb-10 flex-1">
      {features.map((feature: string, idx: number) => (
        <div key={idx} className="flex items-center gap-3">
          <CheckCircle2 size={16} className="text-pedagogic-blue shrink-0" />
          <span className={`text-xs font-bold ${highlighted ? 'text-slate-300' : 'text-slate-600'}`}>{feature}</span>
        </div>
      ))}
    </div>

    <Link 
      to="/register"
      className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all text-center flex items-center justify-center gap-2 group ${
        highlighted 
          ? 'bg-pedagogic-blue text-white shadow-xl shadow-blue-500/20 hover:bg-blue-600' 
          : 'bg-slate-50 text-slate-800 border border-slate-100 hover:bg-slate-100'
      }`}
    >
      CONTRATAR AGORA <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
    </Link>
  </motion.div>
);

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState('ia');

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden selection:bg-pedagogic-blue selection:text-white">
      {/* Decorative Blur */}
      <div className="fixed top-0 right-0 w-[800px] h-[800px] bg-blue-50 rounded-full blur-[120px] -mr-96 -mt-96 -z-10 opacity-60" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-teal-50 rounded-full blur-[100px] -ml-64 -mb-64 -z-10 opacity-60" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-24 bg-white/80 backdrop-blur-xl border-b border-slate-100 z-50 flex items-center px-8 md:px-16 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pedagogic-blue rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <BrainCircuit className="text-white" size={24} />
          </div>
          <span className="text-2xl font-black text-slate-800 tracking-tighter">SGE Psicologia</span>
        </div>
        
        <div className="hidden md:flex items-center gap-10">
          <a href="#features" className="text-sm font-black text-slate-500 uppercase tracking-widest hover:text-pedagogic-blue transition-colors">Funcionalidades</a>
          <a href="#plans" className="text-sm font-black text-slate-500 uppercase tracking-widest hover:text-pedagogic-blue transition-colors">Preços</a>
          <a href="#faq" className="text-sm font-black text-slate-500 uppercase tracking-widest hover:text-pedagogic-blue transition-colors">Ajuda</a>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/login" className="hidden sm:block text-sm font-black text-slate-800 uppercase tracking-widest px-6 py-3 hover:bg-slate-50 rounded-xl transition-all">Login</Link>
          <Link to="/register" className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black hover:shadow-2xl transition-all">Começar Agora</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-48 pb-24 px-8 md:px-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-100 mb-8">
              <Zap size={14} className="text-pedagogic-blue" />
              <span className="text-[10px] font-black text-pedagogic-blue uppercase tracking-widest">Nova Versão 2.0 com IA</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black text-slate-900 leading-[0.9] tracking-tighter mb-8">
              A Psicologia Escolar <span className="text-transparent bg-clip-text bg-gradient-to-r from-pedagogic-blue to-pedagogic-teal">no Próximo Nível</span>
            </h1>
            <p className="text-xl text-slate-500 font-medium leading-relaxed mb-10 max-w-lg">
              Simplifique documentos, automatize agendamentos e gere insights clínicos inteligentes. O SGE é a ferramenta definitiva para sua gestão escolar.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link to="/register" className="w-full sm:w-auto bg-pedagogic-blue text-white px-10 py-6 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-sm hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all flex items-center justify-center gap-3 group">
                Explorar Solução <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
              </Link>
              <a href="#features" className="w-full sm:w-auto px-10 py-6 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-sm text-slate-500 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                Ver Funcionalidades <ChevronRight size={18} />
              </a>
            </div>
            
            <div className="mt-16 flex items-center gap-8 border-t border-slate-100 pt-10">
              <div>
                <p className="text-2xl font-black text-slate-800">100%</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Unidades Ativas</p>
              </div>
              <div className="w-px h-10 bg-slate-100" />
              <div>
                <p className="text-2xl font-black text-slate-800">20k+</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Alunos Impactados</p>
              </div>
              <div className="w-px h-10 bg-slate-100" />
              <div className="flex -space-x-3">
                {[1,2,3,4].map(idx => (
                  <div key={idx} className="w-10 h-10 bg-slate-200 rounded-full border-2 border-white flex items-center justify-center shadow-sm overflow-hidden">
                    <img src={`https://i.pravatar.cc/150?u=${idx}`} alt="User" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative"
          >
            <div className="aspect-square bg-gradient-to-br from-blue-100 to-teal-50 rounded-[4rem] relative overflow-hidden shadow-inner border border-white">
              {/* Dynamic Dashboard Pattern */}
              <div className="absolute inset-0 p-12 flex flex-col gap-6">
                <div className="h-24 w-full bg-white rounded-3xl shadow-lg shadow-blue-100/50 flex items-center px-8 border border-slate-100 animate-pulse">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl mr-4" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-32 bg-slate-100 rounded" />
                    <div className="h-3 w-48 bg-slate-50 rounded" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6 h-full">
                  <div className="bg-white rounded-3xl shadow-xl shadow-teal-100/30 p-8 border border-teal-50 flex flex-col justify-end">
                    <BarChart3 className="text-pedagogic-teal mb-4" size={40} />
                    <div className="h-4 w-full bg-slate-100 rounded mb-2" />
                    <div className="h-3 w-2/3 bg-slate-50 rounded" />
                  </div>
                  <div className="grid grid-rows-2 gap-6">
                    <div className="bg-slate-900 rounded-3xl p-6 flex flex-col justify-center items-center text-center">
                      <Zap className="text-yellow-400 mb-2" size={24} />
                      <p className="text-white text-[10px] font-black uppercase tracking-widest">IA Ativa</p>
                    </div>
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-blue-100/20 border border-slate-50 flex flex-col justify-center items-center">
                      <Smartphone className="text-pedagogic-blue mb-2" size={24} />
                      <p className="text-slate-800 text-[10px] font-black uppercase tracking-widest">Portal Móvel</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floaties */}
            <motion.div 
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute -top-10 -right-10 bg-white p-6 rounded-[2rem] shadow-2xl border border-slate-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pedagogic-rose rounded-xl flex items-center justify-center">
                  <Users className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800">Novo Aluno</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Solicitação pendente</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Trust Bar */}
      <div className="bg-slate-50 py-12 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-8 flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale hover:grayscale-0 transition-all">
          <p className="text-xl font-black text-slate-800 tracking-tighter">EDUCAÇÃO</p>
          <p className="text-xl font-black text-slate-800 tracking-tighter">ENSINO</p>
          <p className="text-xl font-black text-slate-800 tracking-tighter">GESTOR</p>
          <p className="text-xl font-black text-slate-800 tracking-tighter">PSICOLOGIA</p>
        </div>
      </div>

      {/* Features Grid */}
      <section id="features" className="py-32 px-8 md:px-16 bg-white relative">
        <div className="max-w-7xl mx-auto text-center mb-20">
          <p className="text-[10px] font-black text-pedagogic-blue uppercase tracking-[0.4em] mb-4">Poder do Sistema</p>
          <h2 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none mb-6">
            Tudo o que você precisa<br />para uma gestão de impacto
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">
            Desenvolvido especificamente para o fluxo de trabalho de psicólogos escolares e coordenadores, focando em redução de carga administrativa.
          </p>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard 
            icon={<BrainCircuit />} 
            color="bg-pedagogic-blue shadow-lg shadow-blue-200"
            title="Insights Clínicos com IA" 
            description="Utilize o poder do Gemini para analisar sentimentos e gerar resumos cognitivos a partir dos prontuários." 
          />
          <FeatureCard 
            icon={<MessageSquare />} 
            color="bg-pedagogic-teal shadow-lg shadow-teal-200"
            title="WhatsApp Integrado" 
            description="Notificações automáticas de agendamento para alunos e pais, reduzindo faltas em até 60%." 
          />
          <FeatureCard 
            icon={<Shield />} 
            color="bg-pedagogic-rose shadow-lg shadow-rose-200"
            title="Denúncias Sigilosas" 
            description="Canal de escuta anônimo seguro com criptografia de ponta a ponta para proteção do aluno." 
          />
          <FeatureCard 
            icon={<Smartphone />} 
            color="bg-pedagogic-amber shadow-lg shadow-amber-200"
            title="Portal do Aluno" 
            description="Página personalizada para cada unidade SESI facilitando o acesso ao atendimento via QR Code." 
          />
          <FeatureCard 
            icon={<BarChart3 />} 
            color="bg-purple-500 shadow-lg shadow-purple-200"
            title="Analytics em Tempo Real" 
            description="Painéis de monitoramento por unidade para coordenação central com exportação de relatórios." 
          />
          <FeatureCard 
            icon={<LayoutDashboard />} 
            color="bg-slate-800 shadow-lg shadow-slate-300"
            title="Timbrado Configurável" 
            description="Geração de documentos em PDF seguindo rigorosamente os padrões visuais da sua escola." 
          />
        </div>
      </section>

      {/* IA Feature Deep Dive */}
      <section className="py-24 px-8 md:px-16 overflow-hidden">
        <div className="max-w-7xl mx-auto bg-slate-900 rounded-[4rem] p-12 md:p-24 relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-pedagogic-blue/20 rounded-full blur-[100px] -mr-32 -mt-32" />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-lg">
                  <Star className="text-yellow-400" size={20} />
                </div>
                <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Exclusividade Gemini AI</span>
              </div>
              <h2 className="text-5xl md:text-6xl font-black text-white leading-none tracking-tight mb-8">
                Não apenas armazene dados. <span className="text-pedagogic-teal">Entenda a evolução.</span>
              </h2>
              
              <div className="space-y-6">
                {[
                  { title: "Sumarização de Histórico", desc: "IA resume meses de atendimento em parágrafos executivos." },
                  { title: "Detecção de Alerta", desc: "Identificação proativa de palavras-chave críticas em denúncias." },
                  { title: "Sugestões de Encaminhamento", desc: "Auxílio na redação de encaminhamentos baseados em evidências." }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4 group">
                    <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center shrink-0 mt-1 group-hover:bg-pedagogic-teal transition-colors">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                    <div>
                      <h4 className="text-white font-black text-sm uppercase tracking-wider mb-1">{item.title}</h4>
                      <p className="text-slate-400 text-sm font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-slate-800" />
                  <div className="h-3 w-24 bg-white/10 rounded" />
                </div>
                <div className="space-y-3">
                  <div className="h-2 w-full bg-white/5 rounded" />
                  <div className="h-2 w-full bg-white/5 rounded" />
                  <div className="h-2 w-2/3 bg-white/5 rounded" />
                </div>
                <div className="mt-8 pt-8 border-t border-white/10 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <BrainCircuit size={16} className="text-pedagogic-teal" />
                    <span className="text-[10px] font-black text-pedagogic-teal uppercase tracking-widest">Análise de IA Concluída</span>
                  </div>
                  <CheckCircle2 size={16} className="text-pedagogic-teal" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="plans" className="py-32 px-8 md:px-16 bg-slate-50/50">
        <div className="max-w-7xl mx-auto text-center mb-20">
          <p className="text-[10px] font-black text-purple-600 uppercase tracking-[0.4em] mb-4">Escolha sua Escala</p>
          <h2 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none mb-6">
            Planos feitos para crescer
          </h2>
          <p className="text-lg text-slate-500 font-medium">Controle de atendimentos robusto com transparência total.</p>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <PlanCard 
            name="Básico"
            price="79,90"
            description="IDEAL PARA COMEÇAR"
            capacity="40"
            capacityLabel="atendimentos/mês"
            features={[
              "1 Escola",
              "1 Psicólogo",
              "40 atendimentos/mês",
              "Bloqueio automático",
              "Sem excedente"
            ]}
          />
          <PlanCard 
            name="Profissional"
            price="199,90"
            highlighted={true}
            description="MAIS ESCOLHIDO"
            capacity="120"
            capacityLabel="atendimentos/mês"
            features={[
              "1 Escola",
              "Até 2 Psicólogos",
              "120 atendimentos/mês",
              "Sem bloqueio",
              "Excedente: R$ 1,00/unid."
            ]}
          />
          <PlanCard 
            name="Premium"
            price="499,90"
            description="PARA UNIDADES MAIORES"
            capacity="500"
            capacityLabel="atendimentos/mês"
            features={[
              "1 Escola",
              "Vários Psicólogos",
              "500 atendimentos/mês",
              "Sem bloqueio",
              "Excedente: R$ 0,50/unid."
            ]}
          />
          <PlanCard 
            name="Personalizado"
            price="Consulte-nos"
            description="PARA GRANDES REDES"
            capacity="Sob Consulta"
            capacityLabel="Capacidade Recomendada"
            priceSuffix="/ sob medida"
            features={[
              "Escolas Ilimitadas",
              "Psicólogos Ilimitados",
              "Mais de 500 atendimentos",
              "Suporte Prioritário 24h",
              "Dashboards Customizados"
            ]}
          />
        </div>
        
        <div className="mt-16 text-center">
          <div className="bg-white inline-flex flex-col md:flex-row items-center gap-6 px-10 py-6 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-sm font-bold text-slate-600">Precisa de mais de 500 atendimentos?</p>
            <Link to="/register" className="text-sm font-black text-pedagogic-blue uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all">
              Consulte plano Personalizado <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-32 px-8 md:px-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-4">Perguntas Frequentes</h2>
            <p className="text-slate-500 font-medium">Tudo o que você precisa saber sobre a segurança e uso do SGE.</p>
          </div>
          
          <div className="space-y-4">
            {[
              {
                q: "A análise com IA é segura para dados sensíveis?",
                a: "Sim. O SGE utiliza o protocolo de segurança enterprise do Google Gemini. Os dados não são usados para treinamento público e permanecem confidenciais dentro da sua instância."
              },
              {
                q: "Como funciona a contagem de atendimentos?",
                a: "A contagem é feita por documentos editados e agendamentos concluídos no mês vigente. O sistema avisa quando você atinge 90% da franquia."
              },
              {
                q: "Posso exportar meus dados a qualquer momento?",
                a: "Sim. Todos os registros, alunos e históricos podem ser exportados em CSV ou PDF timbrado pela própria interface administrativa."
              }
            ].map((item, idx) => (
              <details key={idx} className="group bg-slate-50 rounded-3xl p-8 cursor-pointer transition-all hover:bg-slate-100">
                <summary className="flex items-center justify-between font-black text-slate-800 uppercase tracking-widest text-xs list-none">
                  {item.q}
                  <ChevronDown size={18} className="group-open:rotate-180 transition-transform" />
                </summary>
                <div className="mt-6 text-slate-600 text-sm leading-relaxed font-medium">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-24 px-8 md:px-16 text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-8 border border-white/10">
            <BrainCircuit className="text-pedagogic-teal" size={32} />
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
            Comece a transformar sua<br />unidade escolar hoje.
          </h2>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-20">
            <Link to="/register" className="w-full sm:w-auto bg-white text-slate-900 px-10 py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-100 transition-all">
              Criar Conta Grátis
            </Link>
            <Link to="/login" className="w-full sm:w-auto px-10 py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-xs border border-white/10 hover:bg-white/5 transition-all">
              Falar com Suporte
            </Link>
          </div>
          
          <div className="w-full pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <span className="text-sm font-black tracking-tighter">SGE Psicologia</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">© 2026 Sistema de Gestão</span>
            </div>
            
            <div className="flex gap-8">
              <a href="#" className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">Termos</a>
              <a href="#" className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">Privacidade</a>
              <a href="#" className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">LGPD</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
