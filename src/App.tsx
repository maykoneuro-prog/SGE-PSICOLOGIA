import React, { useState, useEffect, Component, ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, Users, UserCircle, LogOut, GraduationCap, 
  Calendar, FileText, BarChart3, ClipboardCheck, FileUp, 
  Menu, X, Settings as SettingsIcon, School, 
  ClipboardList, Plus, HelpCircle, ShieldAlert, TrendingUp, ChevronRight, User, ChevronDown, MapPin,
  Zap, ArrowRight, ArrowLeft, MousePointer2
} from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { collection, query, where, onSnapshot, doc, getDocFromServer, limit, getDocs } from "firebase/firestore";
import { db, auth, googleProvider } from "./firebase";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { motion } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "./lib/api";
import { usageService } from "./services/usageService";
import { UnitProvider, useUnit } from "./contexts/UnitContext";
import LandingPage from "./pages/LandingPage";
import Students from "./pages/Students";
import ImportStudents from "./pages/ImportStudents";
import Appointments from "./pages/Appointments";
import Admin from "./pages/Admin";
import Reports from "./pages/Reports";
import Documents from "./pages/Documents";
import Settings from "./pages/Settings";
import Schools from "./pages/Schools";
import SchoolRegistration from "./pages/SchoolRegistration";
import PublicScheduling from "./pages/PublicScheduling";
import SchedulingRequests from "./pages/SchedulingRequests";
import Instructions from "./pages/Instructions";
import StudentPortal from "./pages/StudentPortal";
import AnonymousReport from "./pages/AnonymousReport";
import AnonymousReportsManagement from "./pages/AnonymousReportsManagement";
import Profile from "./pages/Profile";
import SaaSPlans from "./pages/SaaSPlans";

// --- Error Boundary ---
class ErrorBoundary extends Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Ops! Algo deu errado.</h2>
            <p className="text-gray-600 mb-6">Ocorreu um erro inesperado no sistema.</p>
            <pre className="text-xs bg-gray-100 p-4 rounded text-left overflow-auto max-h-40 mb-6">
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="bg-sesi-blue text-white px-6 py-2 rounded-lg font-bold"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// --- Components ---

const isSuperUser = (user: any) => {
  if (!user) return false;
  return user?.role === 'super-admin' || user?.id === 'super_admin' || user?.email === 'maykon.euro@gmail.com' || user?.email === 'administrador@exemplo.com';
};

const Layout = ({ children, user, onLogout }: any) => {
  const { activeUnit, setActiveUnit, availableUnits } = useUnit();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['overview', 'pedagogic']);
  const [unreadReportsCount, setUnreadReportsCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [tomorrowAppointmentsCount, setTomorrowAppointmentsCount] = useState(0);
  const [schools, setSchools] = useState<any[]>([]);
  const [appSettings, setAppSettings] = useState({ name: "SGE Psicologia", logoUrl: "https://images.weserv.nl/?url=i.imgur.com/NR6kaz6.png" });
  const navigate = useNavigate();

  useEffect(() => {
    // Real-time listener for App Settings
    const settingsRef = doc(db, 'app_settings', 'global');
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setAppSettings(docSnap.data() as any);
      }
    });

    // Load schools for ID resolution in badges - Get once to reduce reads
    const loadSchools = async () => {
      try {
        const schoolsData = await api.schools.list({ isAdmin: user?.role === 'admin' });
        setSchools(schoolsData || []);
      } catch (error) {
        console.error("Error loading schools for badges:", error);
      }
    };
    loadSchools();

    return () => {
      unsubscribeSettings();
    };
  }, []);

  useEffect(() => {
    if (!activeUnit) return;

    // Real-time listener for unread reports - FILTERED BY UNIT
    const isCentral = activeUnit === 'Administração Central' || activeUnit === 'Sede';
    let reportsQuery;
    
    const isSuperAdmin = isSuperUser(user);
    const allowedUnits = (user?.units || []).map((u: string) => u.trim().toUpperCase());
    const userId = user?.id || user?.uid;

    const baseReportsQuery = query(collection(db, 'anonymous_reports'), where('analyzed', '!=', true));
    
    if (isSuperAdmin) {
      if (!isCentral) {
        reportsQuery = query(baseReportsQuery, where('unit', '==', activeUnit.trim().toUpperCase()));
      } else {
        reportsQuery = baseReportsQuery;
      }
    } else {
      if (!isCentral && allowedUnits.includes(activeUnit.trim().toUpperCase())) {
        reportsQuery = query(baseReportsQuery, where('unit', '==', activeUnit.trim().toUpperCase()));
      } else if (allowedUnits.length > 0 && allowedUnits.length <= 30) {
        reportsQuery = query(baseReportsQuery, where('unit', 'in', allowedUnits));
      } else {
        reportsQuery = query(baseReportsQuery, where('ownerId', '==', userId));
      }
    }

    const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
      setUnreadReportsCount(snapshot.size);
    }, (error) => {
      console.warn("Unread reports listener failed:", error);
      setUnreadReportsCount(0);
    });

    // Real-time listener for pending scheduling requests - FILTERED BY STATUS
    const baseRequestsQuery = query(collection(db, 'scheduling_requests'), where('status', '==', 'pending'));
    let requestsQuery;

    if (isSuperAdmin) {
      if (!isCentral) {
        requestsQuery = query(baseRequestsQuery, where('unit', '==', activeUnit.trim().toUpperCase()));
      } else {
        requestsQuery = baseRequestsQuery;
      }
    } else {
      if (!isCentral && allowedUnits.includes(activeUnit.trim().toUpperCase())) {
        requestsQuery = query(baseRequestsQuery, where('unit', '==', activeUnit.trim().toUpperCase()));
      } else if (allowedUnits.length > 0 && allowedUnits.length <= 30) {
        requestsQuery = query(baseRequestsQuery, where('unit', 'in', allowedUnits));
      } else {
        requestsQuery = query(baseRequestsQuery, where('ownerId', '==', userId));
      }
    }

    const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
      setPendingRequestsCount(snapshot.size);
    }, (error) => {
      console.warn("Pending requests listener failed:", error);
      setPendingRequestsCount(0);
    });

    // Real-time listener for appointments (Today and Tomorrow)
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    
    const baseAppointmentsQuery = query(
      collection(db, 'appointments'), 
      where('date', '>=', todayStr)
    );

    let finalAppointmentsQuery;
    if (isSuperAdmin) {
      if (!isCentral) {
        finalAppointmentsQuery = query(baseAppointmentsQuery, where('unit', '==', activeUnit.trim().toUpperCase()));
      } else {
        finalAppointmentsQuery = baseAppointmentsQuery;
      }
    } else {
      if (!isCentral && allowedUnits.includes(activeUnit.trim().toUpperCase())) {
        finalAppointmentsQuery = query(baseAppointmentsQuery, where('unit', '==', activeUnit.trim().toUpperCase()));
      } else if (allowedUnits.length > 0 && allowedUnits.length <= 30) {
        finalAppointmentsQuery = query(baseAppointmentsQuery, where('unit', 'in', allowedUnits));
      } else {
        finalAppointmentsQuery = query(baseAppointmentsQuery, where('ownerId', '==', userId));
      }
    }

    const unsubscribeAppointments = onSnapshot(finalAppointmentsQuery, (snapshot) => {
      const todayItems = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data.date?.startsWith(todayStr) && data.status !== 'cancelled' && (isSuperAdmin || data.professionalId === userId || data.ownerId === userId);
      });
      
      const tomorrowItems = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data.date?.startsWith(tomorrowStr) && data.status === 'confirmed' && (isSuperAdmin || data.professionalId === userId || data.ownerId === userId);
      });

      setTodayAppointmentsCount(todayItems.length);
      setTomorrowAppointmentsCount(tomorrowItems.length);
    }, (error) => {
       console.warn("Appointments listener failed:", error);
       setTodayAppointmentsCount(0);
       setTomorrowAppointmentsCount(0);
    });

    return () => {
      unsubscribeReports();
      unsubscribeRequests();
      unsubscribeAppointments();
    };
  }, [activeUnit, schools]);

  const hasNotifications = unreadReportsCount > 0 || pendingRequestsCount > 0 || todayAppointmentsCount > 0 || tomorrowAppointmentsCount > 0;

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const menuCategories = [
    {
      id: 'overview',
      label: 'Visão Geral',
      roles: ['admin', 'psychologist', 'aee', 'pedagogue'],
      items: [
        { icon: <TrendingUp size={18} />, label: 'Dashboard', path: '/', permission: 'dashboard' },
        { icon: <BarChart3 size={18} />, label: 'Relatórios', path: '/relatorios', permission: 'reports' },
      ]
    },
    {
      id: 'pedagogic',
      label: 'Atendimento',
      roles: ['admin', 'psychologist', 'aee', 'pedagogue'],
      items: [
        { icon: <Calendar size={18} />, label: 'Agenda', path: '/atendimentos', permission: 'appointments' },
        { icon: <ClipboardList size={18} />, label: 'Solicitações', path: '/solicitacoes', permission: 'scheduling_requests' },
        { icon: <FileText size={18} />, label: 'Registros', path: '/documentos', permission: 'documents' },
        { icon: <ShieldAlert size={18} />, label: 'Denúncias', path: '/gestao-denuncias', permission: 'psychological_listening' },
      ]
    },
    {
      id: 'management',
      label: 'Gestão Escolar',
      roles: ['admin', 'psychologist', 'aee', 'pedagogue'],
      items: [
        { icon: <GraduationCap size={18} />, label: 'Estudantes', path: '/alunos', permission: 'students' },
        { icon: <School size={18} />, label: 'Escolas', path: '/escolas', permission: 'schools' },
        { icon: <FileUp size={18} />, label: 'Importar', path: '/importar', permission: 'import_students' },
      ]
    },
    {
      id: 'system',
      label: 'Configurações',
      roles: ['admin', 'psychologist', 'aee', 'pedagogue'],
      items: [
        { icon: <SettingsIcon size={18} />, label: 'Sistema', path: '/configuracoes', permission: 'settings' },
        { icon: <Zap size={18} />, label: 'Planos', path: '/planos', hiddenForTrial: false }, // Let them see plans to upgrade
        { icon: <Users size={18} />, label: 'Profissionais', path: '/admin', permission: 'admin', hiddenForTrial: true },
        { icon: <HelpCircle size={18} />, label: 'Instruções', path: '/instrucoes' },
      ]
    }
  ];

  const filteredCategories = menuCategories
    .map(cat => ({
      ...cat,
      items: cat.items.filter(item => {
        const isTrial = user?.planId === 'trial' || user?.isTrial;
        if (isTrial && (item as any).hiddenForTrial) return false;
        
        if (user?.role === 'admin' || isTrial) return true;
        if (!item.permission) return true; // Items without permission (like Instructions) are visible to all
        return user?.permissions?.includes(item.permission);
      })
    }))
    .filter(cat => cat.items.length > 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex relative overflow-x-hidden">
      {/* Decorative Background Elements */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-pedagogic-blue/5 rounded-full blur-[120px] -mr-64 -mt-64 -z-10 animate-pulse" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-pedagogic-teal/5 rounded-full blur-[100px] -ml-48 -mb-48 -z-10" />
      
      {/* Grid Pattern */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none -z-10" 
           style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
      />

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          {appSettings.logoUrl && <img src={appSettings.logoUrl} alt="Logo" className="h-8" referrerPolicy="no-referrer" />}
          <span className="font-extrabold text-slate-800 text-sm tracking-tight">{appSettings.name}</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-all">
          {isSidebarOpen ? <X size={24} /> : (
            <div className="relative">
              <Menu size={24} />
              {hasNotifications && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-pedagogic-rose rounded-full border-2 border-white"></span>
              )}
            </div>
          )}
        </button>
      </header>

      {/* Floating Help Button */}
      {!isSidebarOpen && window.location.pathname !== '/login' && window.location.pathname !== '/register' && (
        <Link 
          to="/instrucoes" 
          className="fixed bottom-8 right-8 w-16 h-16 bg-pedagogic-blue text-white rounded-[2rem] shadow-2xl shadow-blue-200 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 group border-4 border-white"
        >
          <HelpCircle size={24} />
          <span className="absolute right-full mr-4 px-3 py-1.5 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Precisa de Ajuda?
          </span>
        </Link>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 h-screen w-72 bg-white border-r border-slate-100 z-50 transition-transform duration-500
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col h-full py-6 px-6">
          <div className="mb-8 flex flex-col items-center gap-2 shrink-0">
            <div className="p-3 bg-slate-50 rounded-[1.5rem] border border-slate-100 shadow-inner group overflow-hidden">
               {appSettings.logoUrl && (
                <img 
                  src={appSettings.logoUrl} 
                  alt="Logo SGE" 
                  className="h-8 w-auto group-hover:scale-110 transition-transform object-contain" 
                  referrerPolicy="no-referrer"
                />
               )}
            </div>
            <p className="text-[9px] font-black text-pedagogic-blue uppercase tracking-[0.3em] mt-2 text-center">{appSettings.name}</p>
            
            <div className="mt-3 w-full px-1">
              <div className="bg-white border-2 border-slate-50 rounded-[1.2rem] p-2.5 flex flex-col gap-1.5 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-20 h-20 bg-pedagogic-blue/5 rounded-full -mr-10 -mt-10 group-hover:bg-pedagogic-blue/10 transition-colors" />
                <div className="flex items-center gap-2 relative z-10">
                  <div className="p-1 bg-blue-50 rounded text-pedagogic-blue">
                    <MapPin size={10} />
                  </div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Escola Local</span>
                </div>
                <div className="relative z-10">
                  {availableUnits.length > 1 ? (
                    <select 
                      className="bg-transparent border-none outline-none text-[11px] font-black text-slate-800 cursor-pointer w-full focus:ring-0 appearance-none"
                      value={activeUnit}
                      onChange={(e) => setActiveUnit(e.target.value)}
                    >
                      {availableUnits.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[11px] font-black text-slate-800">{activeUnit}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1 -mr-2">
            {filteredCategories.map((cat) => (
              <div key={cat.id} className="space-y-1.5">
                <button 
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-pedagogic-blue transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span>{cat.label}</span>
                    {cat.id === 'pedagogic' && hasNotifications && (
                      <span className="w-1.5 h-1.5 bg-pedagogic-rose rounded-full animate-pulse"></span>
                    )}
                  </div>
                  <div className={`transition-transform duration-300 ${expandedCategories.includes(cat.id) ? 'rotate-180' : ''}`}>
                    <ChevronDown size={12} className="opacity-50 group-hover:opacity-100" />
                  </div>
                </button>
                
                {expandedCategories.includes(cat.id) && (
                  <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                    {cat.items.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          window.location.pathname === item.path 
                            ? 'bg-pedagogic-blue text-white shadow-lg shadow-blue-100 translate-x-1' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-pedagogic-blue hover:translate-x-1'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`transition-colors ${window.location.pathname === item.path ? 'text-white' : 'text-pedagogic-blue/40'}`}>
                            {React.cloneElement(item.icon as React.ReactElement, { size: 16 })}
                          </span>
                          {item.label}
                        </div>
                        {item.path === '/atendimentos' && (todayAppointmentsCount > 0 || tomorrowAppointmentsCount > 0) && (
                          <div className="flex gap-1">
                            {todayAppointmentsCount > 0 && (
                              <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                                window.location.pathname === item.path 
                                  ? 'bg-white text-pedagogic-blue' 
                                  : 'bg-pedagogic-teal text-white'
                              }`}>
                                {todayAppointmentsCount}
                              </span>
                            )}
                            {tomorrowAppointmentsCount > 0 && (
                              <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                                window.location.pathname === item.path 
                                  ? 'bg-white text-pedagogic-blue' 
                                  : 'bg-pedagogic-amber text-white'
                              }`}>
                                {tomorrowAppointmentsCount}
                              </span>
                            )}
                          </div>
                        )}
                        {item.path === '/solicitacoes' && pendingRequestsCount > 0 && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                            window.location.pathname === item.path 
                              ? 'bg-white text-pedagogic-blue' 
                              : 'bg-pedagogic-amber text-white animate-bounce'
                          }`}>
                            {pendingRequestsCount}
                          </span>
                        )}
                        {item.path === '/gestao-denuncias' && unreadReportsCount > 0 && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                            window.location.pathname === item.path 
                              ? 'bg-white text-pedagogic-blue' 
                              : 'bg-pedagogic-rose text-white animate-bounce'
                          }`}>
                            {unreadReportsCount}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="mt-6 pt-4 border-t border-slate-50 shrink-0">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center gap-3 group relative">
              <Link 
                to="/perfil"
                className="flex items-center gap-2.5 flex-1 overflow-hidden"
                onClick={() => setIsSidebarOpen(false)}
              >
                <div className="w-9 h-9 bg-white shadow-sm border border-slate-100 rounded-xl flex items-center justify-center font-black text-pedagogic-blue group-hover:bg-pedagogic-blue group-hover:text-white transition-all shrink-0">
                  {user?.name?.charAt(0)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-[11px] font-black text-slate-800 truncate leading-none group-hover:text-pedagogic-blue transition-colors">{user?.name}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-70 truncate">{user?.role}</p>
                </div>
              </Link>
              <button 
                onClick={() => { onLogout(); navigate('/login'); }} 
                className="text-slate-300 hover:text-pedagogic-rose transition-colors pl-2 border-l border-slate-100"
                title="Sair"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 mt-16 md:mt-0 max-w-7xl mx-auto w-full transition-all duration-700">
        {children}
      </main>
    </div>
  );
};

// --- Pages ---

const Login = ({ onLogin }: any) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [appSettings, setAppSettings] = useState({ name: "SGE Psicologia", logoUrl: "https://images.weserv.nl/?url=i.imgur.com/NR6kaz6.png" });
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch App Settings once in Login instead of listening
    const fetchSettings = async () => {
      try {
        const settingsData = await api.appSettings.get();
        if (settingsData) {
          setAppSettings(settingsData);
        }
      } catch (error) {
        console.warn("Could not fetch app settings from Firestore:", error);
        // Fallback to default settings
        setAppSettings({ 
          name: "SGE Psicologia", 
          logoUrl: "https://images.weserv.nl/?url=i.imgur.com/NR6kaz6.png" 
        });
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      // Check Firestore for user first (this allows overriding super-admin password)
      let firestoreUser: any = null;
      try {
        firestoreUser = await api.users.findByEmail(email);
      } catch (dbErr) {
        console.warn("Firestore user check failed, proceeding to fallback:", dbErr);
      }

      if (firestoreUser) {
        if (firestoreUser.password === password) {
          if (firestoreUser.status === 'inactive') {
            setError("Sua conta está inativa. Entre em contato com o administrador.");
            return;
          }

          if (firestoreUser.expiresAt && new Date(firestoreUser.expiresAt) < new Date()) {
            setError("Sua assinatura expirou. Entre em contato com o administrador para renovar.");
            return;
          }

          // Force super_admin ID if it's the administrator email
          const userToLogin = email === "administrador" ? { ...firestoreUser, id: "super_admin" } : firestoreUser;
          onLogin(userToLogin);
          navigate("/");
          return;
        } else {
          setError("Usuário ou senha incorretos.");
          return;
        }
      }

      // Hardcoded super-admin fallback for initial setup
      if ((email === "administrador" || email === "maykon.euro@gmail.com") && password === "12345678") {
        const superAdmin = { 
          id: "super_admin", 
          name: "Super Administrador", 
          role: "admin", 
          email: email,
          password: "12345678",
          permissions: ['dashboard', 'students', 'import_students', 'appointments', 'documents', 'reports', 'settings', 'admin']
        };
        onLogin(superAdmin);
        navigate("/");
        return;
      }

      setError("Usuário ou senha incorretos.");
    } catch (err: any) {
      setError("Ocorreu um erro ao tentar fazer login.");
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError("");
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Initialize or retrieve user trial
      const trialUser = await (api.users as any).initializeTrial(user);
      
      if (trialUser) {
        onLogin(trialUser);
        navigate("/");
      }
    } catch (err: any) {
      console.error("Google login error:", err);
      setError("Falha ao entrar com Google. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-white to-blue-50 flex items-center justify-center p-6 bg-fixed">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-700">
        <div className="bg-white rounded-[3rem] shadow-2xl p-12 border border-white relative overflow-hidden">
          {/* Decor */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-pedagogic-blue/5 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-pedagogic-teal/5 rounded-full -ml-12 -mb-12 blur-xl" />
          
          <div className="text-center relative z-10">
            <div className="inline-flex p-5 rounded-[2rem] bg-slate-50 border border-slate-100 shadow-inner mb-8 group">
               {appSettings.logoUrl && (
                 <img 
                   src={appSettings.logoUrl} 
                   alt="Logo" 
                   className="h-16 w-auto group-hover:scale-110 transition-transform object-contain" 
                   referrerPolicy="no-referrer" 
                 />
               )}
            </div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter mb-2">{appSettings.name}</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-12">Portal do Profissional</p>
          </div>

          {error && (
            <div className="bg-pedagogic-rose/10 text-pedagogic-rose p-4 rounded-2xl mb-8 text-xs font-bold text-center border border-pedagogic-rose/10 transition-all">
              {error}
            </div>
          )}

          <div className="space-y-6 relative z-10">
            <button 
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-xs text-slate-600 hover:bg-slate-50 hover:border-pedagogic-blue/20 transition-all shadow-sm"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Entrar com Google
            </button>

            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Ou use E-mail</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">E-mail</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all placeholder:text-slate-300"
                  placeholder="Seu e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Senha</label>
                <input 
                  type="password" 
                  required
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all placeholder:text-slate-300"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              
              <button 
                type="submit" 
                className="w-full bg-pedagogic-blue text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-700 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 shadow-xl shadow-blue-100"
              >
                Login Administrativo
              </button>
            </form>
          </div>

          <p className="text-center mt-10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Novo por aqui? <Link to="/register" className="text-pedagogic-blue hover:underline">Ativar Teste Grátis</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

const Register = ({ onLogin }: any) => {
  const [error, setError] = useState("");
  const [phone, setPhone] = useState(() => localStorage.getItem("temp_lead_phone") || "");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhone(val);
    localStorage.setItem("temp_lead_phone", val);
  };

  const handleGoogleSignIn = async () => {
    if (!phone || phone.length < 10) {
      setError("Por favor, informe seu WhatsApp para continuar.");
      return;
    }

    setLoading(true);
    try {
      setError("");
      
      // Captura o Lead IMEDIATAMENTE (Garante o contato mesmo se o Google falhar depois)
      await (api as any).leads.create({
        phoneNumber: phone,
        source: 'registration_page',
        userAgent: navigator.userAgent,
        capturedAt: new Date().toISOString()
      });

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const trialUser = await (api.users as any).initializeTrial(user, { phoneNumber: phone });
      
      if (trialUser) {
        onLogin(trialUser);
        navigate("/");
      }
    } catch (err: any) {
      console.error("Google registration error:", err);
      if (err.code === "auth/unauthorized-domain") {
        setError("ESTE DOMÍNIO NÃO ESTÁ AUTORIZADO NO FIREBASE. No console do Firebase, adicione '" + window.location.hostname + "' em Autenticação > Configurações > Domínios Autorizados.");
      } else if (err.code === "auth/popup-blocked") {
        setError("O POP-UP FOI BLOQUEADO. Por favor, permita pop-ups para este site para continuar.");
      } else {
        setError("FALHA AO AUTENTICAR COM GOOGLE. Verifique se o domínio '" + window.location.hostname + "' está autorizado no console do Firebase.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sesi-blue flex items-center justify-center p-6">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-12 relative overflow-hidden">
        {/* Decor */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-sesi-blue/5 rounded-full -mr-20 -mt-20 blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-sesi-green/5 rounded-full -ml-20 -mb-20 blur-3xl opacity-50" />

        <Link 
          to="/login" 
          className="absolute top-8 right-8 text-slate-400 hover:text-pedagogic-blue transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-widest group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Voltar
        </Link>

        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-50 text-pedagogic-blue rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Zap size={40} className="fill-pedagogic-blue animate-pulse" />
          </div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-4">Acesso Instantâneo</h2>
          <p className="text-slate-500 font-medium">Inicie seu teste grátis de 7 dias ou 10 atendimentos agora mesmo.</p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-2xl mb-8 text-xs font-bold text-center border border-red-100">
            {error}
          </div>
        )}

        <div className="space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-start gap-4">
                 <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-pedagogic-blue mt-1">
                    <Calendar size={18} />
                 </div>
                 <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-1">7 Dias Livres</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Acesso completo</p>
                 </div>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-start gap-4">
                 <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-pedagogic-teal mt-1">
                    <MousePointer2 size={18} />
                 </div>
                 <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-1">10 Registros</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Limite de teste</p>
                 </div>
              </div>
           </div>

           <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">WhatsApp de Contato</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-pedagogic-blue focus:ring-4 focus:ring-pedagogic-blue/5 font-bold text-slate-700 transition-all placeholder:text-slate-300 shadow-sm"
                  placeholder="(00) 9 0000-0000"
                  value={phone}
                  onChange={handlePhoneChange}
                />
              </div>

              <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50 text-center backdrop-blur-sm">
                 <p className="text-[10px] font-black text-pedagogic-blue uppercase tracking-widest mb-4">Autenticação Segura via Google</p>
                 <button 
                   onClick={handleGoogleSignIn}
                   disabled={!phone || phone.length < 10 || loading}
                   className="w-full bg-white border-2 border-transparent hover:border-pedagogic-blue text-slate-700 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-4 transition-all shadow-xl hover:shadow-2xl hover:shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:grayscale"
                 >
                   {loading ? (
                     <>
                       <div className="w-5 h-5 border-4 border-pedagogic-blue border-t-transparent rounded-full animate-spin" />
                       Validando Acesso...
                     </>
                   ) : (
                     <>
                       <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
                       Ativar SGE Psicologia
                     </>
                   )}
                 </button>
                 <p className="mt-4 text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Ao prosseguir, você concorda com nossos <span className="text-pedagogic-blue underline cursor-pointer">termos de uso</span>.</p>
              </div>
           </div>
        </div>

        <p className="text-center mt-10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Ao prosseguir, você concorda com nossos <span className="text-pedagogic-blue cursor-pointer">Termos de Uso</span>.
        </p>
      </div>
    </div>
  );
};

const Dashboard = ({ user }: { user: any }) => {
  const { activeUnit } = useUnit();
  const [stats, setStats] = useState({ students: 0, appointments: 0, requests: 0, criticalReports: 0, todayAppointments: 0 });
  const [reports, setReports] = useState<any[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [studentsPerSchool, setStudentsPerSchool] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);

  const isTrial = user?.planId === 'trial' || user?.isTrial;
  const trialDaysLeft = user?.expiresAt ? Math.max(0, Math.ceil((new Date(user.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;

  useEffect(() => {
    const loadStats = async () => {
      try {
        const isSuperAdmin = isSuperUser(user);
        const filters: any = { unit: activeUnit, isAdmin: isSuperAdmin };
        
        // Strict isolation for standard users and trials
        if (!isSuperAdmin) {
          filters.professionalId = user.id || user.uid;
          filters.allowedUnits = (user?.units || []).map((u: string) => u.trim().toUpperCase());
        }

        const now = new Date();
        const startOfMonthISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const todayStr = format(now, 'yyyy-MM-dd');

        // Parallel stats fetching
        const [
          studentCount,
          appointmentCount,
          todayCount,
          pendingRequestsCount,
          criticalReportsCount,
          reportsData,
          appointmentsToday,
          appointmentsMonthData,
          pendingReqsData,
          schoolsData,
          studentsData,
          documentsMonthData,
          usageStatus
        ] = await Promise.all([
          api.students.count({ ...filters }),
          api.appointments.count({ ...filters, startDate: startOfMonthISO }),
          api.appointments.count({ ...filters, startDate: todayStr }),
          api.schedulingRequests.count({ ...filters, status: 'pending' }),
          api.anonymousReports.count({ ...filters, analyzed: false }),
          api.anonymousReports.list({ ...filters }),
          api.appointments.list({ ...filters, startDate: todayStr, endDate: todayStr }),
          api.appointments.list({ ...filters, startDate: startOfMonthISO }),
          api.schedulingRequests.list({ ...filters, status: 'pending' }),
          api.schools.list({ ...filters }),
          api.students.list({ ...filters }),
          api.documents.list({ ...filters, startDate: startOfMonthISO }),
          usageService.getSubscriptionStatus(activeUnit, (!isSuperAdmin) ? (user.id || user.uid) : undefined)
        ]);
        
        setUsage(usageStatus);
        
        // Internal filter for visual items
        const filterByUnit = (item: any) => {
          const selectedUnit = activeUnit.trim().toUpperCase();
          const isSuperUserVal = isSuperUser(user);
          const userAllowedUnits = (user?.units || []).map((u: string) => u.trim().toUpperCase());
          
          const sFromId = (schoolsData || []).find((s: any) => s.id === (item.schoolId || item.unitId)) as any;
          const itemUnits = [
            String(item.schoolUnit || "").trim().toUpperCase(),
            String(item.unit || "").trim().toUpperCase(),
            String(sFromId?.unit || "").trim().toUpperCase(),
            String(sFromId?.name || "").trim().toUpperCase(),
          ].filter(v => v !== "" && v !== "undefined");

          // For global views, we must still respect professional assignment if not a super-admin
          const isGlobalUnit = selectedUnit === 'ADMINISTRAÇÃO CENTRAL' || selectedUnit === 'SEDE';
          
          if (isGlobalUnit) {
            if (isSuperUserVal) return true;
            // For a regular professional, they only see items belonging to one of their assigned units
            return itemUnits.some(itemUnit => 
              userAllowedUnits.some((allowed: string) => {
                const cleanAllowed = allowed.replace(/^(SESI|UNIDADE|ESCOLA|CENTRO|DEPARTAMENTO)\s+/gi, "").trim();
                const cleanItem = itemUnit.replace(/^(SESI|UNIDADE|ESCOLA|CENTRO|DEPARTAMENTO)\s+/gi, "").trim();
                return itemUnit === allowed || (cleanAllowed !== "" && cleanAllowed === cleanItem);
              })
            );
          }

          // If a specific unit is selected:
          const cleanSelected = selectedUnit.replace(/^(SESI|UNIDADE|ESCOLA|CENTRO|DEPARTAMENTO)\s+/gi, "").trim();

          return itemUnits.some(val => {
            const cleanVal = val.replace(/^(SESI|UNIDADE|ESCOLA|CENTRO|DEPARTAMENTO)\s+/gi, "").trim();
            if (val === selectedUnit || (cleanVal !== "" && cleanVal === cleanSelected)) return true;
            if (cleanSelected !== "" && cleanVal !== "") {
              return cleanVal.includes(cleanSelected) || cleanSelected.includes(cleanVal);
            }
            return val.includes(selectedUnit) || selectedUnit.includes(val);
          });
        };

        const filteredReports = (reportsData || []).filter(filterByUnit);
        const filteredUpcoming = (appointmentsToday || []).filter(filterByUnit);
        const filteredPendingReqs = (pendingReqsData || []).filter(filterByUnit);
        const filteredStudents = (studentsData || []).filter(filterByUnit);
        const filteredAppointmentsMonth = (appointmentsMonthData || []).filter(filterByUnit);
        const filteredDocumentsMonth = (documentsMonthData || []).filter(filterByUnit);
        
        const isCentralView = isSuperAdmin && (activeUnit === 'Administração Central' || activeUnit === 'Sede');

        setStats({
          students: filteredStudents.length,
          appointments: filteredAppointmentsMonth.length + filteredDocumentsMonth.length,
          requests: filteredPendingReqs.length,
          criticalReports: filteredReports.length,
          todayAppointments: filteredUpcoming.length
        });

        // Debug log for production-like monitoring
        if (isTrial) {
          console.log(`[Trial Debug] Usage: ${usageStatus?.current}/${usageStatus?.limit} (${usageStatus?.percentage}%)`);
        }

        setReports(filteredReports
          .filter((r: any) => (r.aiAnalysis?.level === 'CRÍTICO' || r.aiAnalysis?.level === 'MODERADO' || r.aiAnalysis?.level === 'PENDENTE' || !r.aiAnalysis) && r.analyzed !== true)
          .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5)
        );

        setUpcomingAppointments(filteredUpcoming
          .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''))
          .slice(0, 3)
        );

        setPendingRequests(filteredPendingReqs
          .sort((a: any, b: any) => {
             const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
             const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
             return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 3)
        );

        // Prepare chart data: Students per School
        const schoolCounts: {[key: string]: number} = {};
        filteredStudents.forEach((student: any) => {
          const schoolRef = schoolsData.find((s: any) => s.id === student.schoolId);
          const schoolName = (schoolRef as any)?.name || student.schoolUnit || student.unit || 'Sem Unidade';
          schoolCounts[schoolName] = (schoolCounts[schoolName] || 0) + 1;
        });

        const chartData = Object.keys(schoolCounts).map(name => ({
          name: name.length > 15 ? name.substring(0, 15) + '...' : name,
          fullLabel: name,
          count: schoolCounts[name]
        })).sort((a, b) => b.count - a.count);

        setStudentsPerSchool(chartData);
        setSchools(schoolsData || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [activeUnit, user]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-12 h-12 border-4 border-pedagogic-blue/20 border-t-pedagogic-blue rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-12 pb-20">
      {/* Trial Banner */}
      {isTrial && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-pedagogic-blue to-blue-600 p-6 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden mb-8"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center backdrop-blur-md border border-white/30">
                   <Zap size={32} className="fill-white" />
                </div>
                <div>
                   <h3 className="text-2xl font-black tracking-tight">Período de Teste Grátis</h3>
                   <p className="text-white/80 font-bold text-xs uppercase tracking-widest mt-1">
                    Você tem <span className="text-white font-black underline underline-offset-4">{trialDaysLeft} dias</span> livres e <span className="text-white font-black underline underline-offset-4">10 registros</span> disponíveis.
                   </p>
                </div>
             </div>
             <div className="flex items-center gap-4 bg-white/10 p-4 rounded-3xl backdrop-blur-sm border border-white/10">
                <div className="text-center px-4">
                   <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Dias de Teste (7)</p>
                   <div className="bg-white/20 w-32 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-white transition-all duration-1000" style={{ width: `${Math.min(100, (trialDaysLeft / 7) * 100)}%` }} />
                   </div>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div className="text-center px-4">
                   <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Uso de Registros (10)</p>
                   <div className="bg-white/20 w-32 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-pedagogic-teal transition-all duration-1000" style={{ width: `${Math.min(100, ((usage?.current || 0) / (usage?.limit || 10)) * 100)}%` }} />
                   </div>
                </div>
                <Link 
                  to="/planos"
                  className="px-6 py-3 bg-white text-pedagogic-blue rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  Fazer Upgrade
                </Link>
             </div>
          </div>
        </motion.div>
      )}

      <div className="relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
             <div className="w-2 h-10 bg-pedagogic-blue rounded-full shadow-lg shadow-blue-100"></div>
             <div>
               <h2 className="text-4xl font-black text-slate-800 tracking-tight">Dashboard Escolar</h2>
               <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Status da Unidade: <span className="text-pedagogic-blue">{activeUnit}</span></p>
             </div>
          </div>
          
          <div className="flex items-center gap-4 bg-white p-2 rounded-3xl border border-slate-100 shadow-sm">
             {usage && (
               <div className="flex items-center gap-4 pr-4 border-r border-slate-100">
                  <div className="flex flex-col items-end">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Uso do Plano</p>
                    <p className={`text-xs font-black mt-1 ${usage.percentage > 90 ? 'text-red-500' : usage.percentage > 70 ? 'text-amber-500' : 'text-pedagogic-teal'}`}>
                      {usage.current}/{usage.limit}
                    </p>
                  </div>
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${usage.percentage > 90 ? 'bg-red-500' : usage.percentage > 70 ? 'bg-amber-500' : 'bg-pedagogic-teal'}`}
                      style={{ width: `${Math.min(usage.percentage, 100)}%` }}
                    />
                  </div>
               </div>
             )}
             <div className="flex -space-x-2">
               <div className="w-8 h-8 rounded-full bg-pedagogic-blue border-2 border-white flex items-center justify-center text-[10px] font-black text-white">1</div>
               <div className="w-8 h-8 rounded-full bg-pedagogic-teal border-2 border-white flex items-center justify-center text-[10px] font-black text-white">2</div>
               <div className="w-8 h-8 rounded-full bg-pedagogic-amber border-2 border-white flex items-center justify-center text-[10px] font-black text-white">3</div>
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-4 border-r border-slate-100">Equipe On</p>
             <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-2xl">
               <Zap size={14} className="text-yellow-400 fill-yellow-400" />
               <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Nível 5</span>
             </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:shadow-blue-200/20 transition-all group overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
              <User size={80} className="text-pedagogic-blue" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Total de Alunos</p>
            <div className="flex items-baseline gap-2">
              <p className="text-6xl font-black text-pedagogic-blue tabular-nums tracking-tighter">{stats.students}</p>
              <TrendingUp size={24} className="text-pedagogic-teal mb-2" />
            </div>
            <div className="mt-6 w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
               <div className="w-2/3 h-full bg-pedagogic-blue rounded-full"></div>
            </div>
          </motion.div>
          
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:shadow-teal-200/20 transition-all group overflow-hidden relative"
          >
             <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-500">
              <Calendar size={80} className="text-pedagogic-teal" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Agenda do Mês</p>
            <p className="text-6xl font-black text-pedagogic-teal tabular-nums tracking-tighter">{stats.appointments}</p>
            <div className="mt-6 flex items-center gap-2">
               <div className="flex gap-1">
                 {[1,2,3].map(i => <div key={i} className="w-2 h-2 rounded-full bg-pedagogic-teal/30"></div>)}
               </div>
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sessões registradas</span>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:shadow-amber-200/20 transition-all group overflow-hidden relative"
          >
             <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
              <ClipboardList size={80} className="text-pedagogic-amber" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Solicitações</p>
            <p className="text-6xl font-black text-pedagogic-amber tabular-nums tracking-tighter">{stats.requests}</p>
            <div className="mt-6">
               <span className="px-3 py-1 rounded-full bg-pedagogic-amber/10 text-pedagogic-amber text-[10px] font-black uppercase tracking-widest">Aguardando Triagem</span>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            className={`p-8 rounded-[2.5rem] shadow-xl border overflow-hidden relative group transition-all ${stats.criticalReports > 0 ? 'bg-pedagogic-rose text-white border-transparent' : 'bg-white border-slate-100'}`}
          >
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 transition-transform duration-700">
              <ShieldAlert size={80} />
            </div>
            <p className={`text-xs font-black uppercase tracking-[0.2em] mb-4 ${stats.criticalReports > 0 ? 'text-white/80' : 'text-slate-400'}`}>Alertas Críticos</p>
            <div className="flex items-baseline gap-3">
              <p className="text-6xl font-black tabular-nums tracking-tighter">{stats.criticalReports}</p>
              {stats.criticalReports > 0 && <Zap size={24} className="animate-pulse text-white mb-2" />}
            </div>
            <div className="mt-6">
               <div className={`h-1.5 w-full rounded-full overflow-hidden ${stats.criticalReports > 0 ? 'bg-white/20' : 'bg-slate-50'}`}>
                 <div className={`h-full rounded-full ${stats.criticalReports > 0 ? 'bg-white w-full' : 'bg-pedagogic-rose w-0'}`}></div>
               </div>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:shadow-purple-200/20 transition-all group overflow-hidden relative"
          >
             <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500">
              <Zap size={80} className="text-purple-500" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Uso de Franquia</p>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-black text-purple-600 tabular-nums tracking-tighter">{usage?.current || 0}</p>
              <span className="text-xs font-black text-slate-400 uppercase">/ {usage?.limit || 40}</span>
            </div>
            <div className="mt-4 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
               <div 
                 className={`h-full rounded-full transition-all duration-1000 ${usage?.percentage >= 90 ? 'bg-pedagogic-rose' : usage?.percentage >= 70 ? 'bg-pedagogic-amber' : 'bg-purple-500'}`}
                 style={{ width: `${Math.min(usage?.percentage || 0, 100)}%` }}
               ></div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Chart Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm"
      >
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-pedagogic-blue/10 text-pedagogic-blue flex items-center justify-center shadow-inner">
              <BarChart3 size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Distribuição de Alunos</h3>
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-0.5">Alunos Ativos por Unidade Escolar</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-3 h-3 rounded-full bg-pedagogic-blue" />
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Total: {stats.students}</span>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={studentsPerSchool}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              barGap={0}
            >
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                angle={-45}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                allowDecimals={false}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ 
                  borderRadius: '1.5rem', 
                  border: 'none', 
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                  padding: '1rem'
                }}
                itemStyle={{ fontBold: '900', color: '#1e293b' }}
                labelStyle={{ fontWeight: '900', color: '#64748b', marginBottom: '0.5rem', fontSize: '10px', textTransform: 'uppercase' }}
                formatter={(value: any) => [`${value} Alunos`, 'Total']}
                labelFormatter={(label, payload) => payload[0]?.payload?.fullLabel || label}
              />
              <Bar 
                dataKey="count" 
                radius={[12, 12, 4, 4]} 
                barSize={40}
                animationDuration={1500}
                animationEasing="ease-out"
              >
                {studentsPerSchool.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#barGradient)`} 
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl group flex flex-col justify-between">
           <div className="absolute top-0 right-0 w-64 h-64 bg-pedagogic-blue/20 rounded-full blur-[80px] -mr-32 -mt-32" />
           
           <div className="relative z-10">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                <Zap className="text-pedagogic-blue fill-pedagogic-blue" size={28} />
              </div>
              <h3 className="text-3xl font-black tracking-tight mb-4 leading-tight">Missão do Dia:<br/><span className="text-pedagogic-blue">Acolhimento</span></h3>
              <p className="text-slate-400 font-medium mb-8">Confira seus atendimentos e pendências antes de iniciar a jornada.</p>
           </div>

           <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer border border-white/5 group/quest">
                 <div className="w-10 h-10 rounded-xl bg-pedagogic-blue/20 flex items-center justify-center">
                    <Calendar size={20} className="text-pedagogic-blue" />
                 </div>
                 <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-300">Hoje</p>
                    <p className="font-bold text-white tracking-tight">{stats.todayAppointments} Agendamentos</p>
                 </div>
                 <ArrowRight size={18} className="text-slate-600 group-hover/quest:translate-x-1 group-hover/quest:text-white transition-all" />
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer border border-white/5 group/quest">
                 <div className="w-10 h-10 rounded-xl bg-pedagogic-rose/20 flex items-center justify-center">
                    <ShieldAlert size={20} className="text-pedagogic-rose" />
                 </div>
                 <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-300">Escuta</p>
                    <p className="font-bold text-white tracking-tight">{stats.criticalReports} Casos Críticos</p>
                 </div>
                 <ArrowRight size={18} className="text-slate-600 group-hover/quest:translate-x-1 group-hover/quest:text-white transition-all" />
              </div>
           </div>
        </div>

        <div className="lg:col-span-8 space-y-8">
            {stats.criticalReports > 0 && (
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-pedagogic-rose text-white flex items-center justify-center">
                          <ShieldAlert size={20} />
                       </div>
                       <h3 className="text-xl font-black text-slate-800 tracking-tight">Alertas de Urgência</h3>
                    </div>
                    <Link to="/gestao-denuncias" className="text-[10px] font-black uppercase tracking-widest text-pedagogic-blue hover:underline">Ver Todos</Link>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {reports.filter(r => (r.aiAnalysis?.level === 'CRÍTICO' || r.aiAnalysis?.level === 'PENDENTE' || !r.aiAnalysis) && r.analyzed !== true).slice(0, 2).map(report => (
                     <div key={report.id} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 hover:border-pedagogic-rose/30 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                           <div className="px-3 py-1 bg-white border border-slate-100 rounded-full">
                             <p className={`text-[10px] font-black uppercase tracking-widest ${report.aiAnalysis?.level === 'CRÍTICO' ? 'text-pedagogic-rose' : 'text-slate-400'}`}>
                               {schools.find(s => s.id === report.schoolId)?.name || 'Unidade Geral'}
                             </p>
                           </div>
                           <p className="text-[10px] font-bold text-slate-400">
                             {report.timestamp ? format(new Date(report.timestamp), "dd/MM/yyyy", { locale: ptBR }) : 'Agora'}
                           </p>
                        </div>
                        <p className="text-slate-700 font-bold leading-relaxed italic line-clamp-2 mb-6 bg-white p-4 rounded-2xl border border-slate-50">
                           "{report.message}"
                        </p>
                        <Link 
                          to="/gestao-denuncias" 
                          className={`inline-flex items-center gap-2 text-[10px] font-black uppercase hover:gap-3 transition-all ${report.aiAnalysis?.level === 'CRÍTICO' ? 'text-pedagogic-rose' : 'text-pedagogic-blue'}`}
                        >
                          {report.aiAnalysis?.level === 'CRÍTICO' ? 'Ação Crítica' : 'Analisar Relato'} <ChevronRight size={14} />
                        </Link>
                     </div>
                   ))}
                 </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Resumo da Agenda</h3>
                    <div className="w-8 h-8 rounded-full bg-pedagogic-blue/10 text-pedagogic-blue flex items-center justify-center">
                       <Calendar size={14} />
                    </div>
                  </div>
                  
                  <div className="space-y-4 flex-1">
                     {upcomingAppointments.length === 0 ? (
                       <div className="text-center py-6">
                          <p className="text-[10px] font-black text-slate-300 uppercase">Nenhum atendimento para hoje</p>
                       </div>
                     ) : (
                       upcomingAppointments.map(app => (
                         <div key={app.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                            <div className="text-center">
                               <p className="text-sm font-black text-slate-800">{app.startTime}</p>
                            </div>
                            <div className="h-8 w-px bg-slate-200"></div>
                            <div className="flex-1 overflow-hidden">
                               <p className="text-xs font-bold text-slate-700 truncate">{app.studentName || 'Estudante'}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">{app.type}</p>
                            </div>
                         </div>
                       ))
                     )}
                  </div>
                  <Link to="/atendimentos" className="mt-6 text-[10px] font-black text-center uppercase tracking-widest text-pedagogic-blue hover:underline">Agenda Completa</Link>
               </div>

               <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Novas Solicitações</h3>
                    <div className="w-8 h-8 rounded-full bg-pedagogic-amber/10 text-pedagogic-amber flex items-center justify-center">
                       <ClipboardList size={14} />
                    </div>
                  </div>
                  
                  <div className="space-y-4 flex-1">
                     {pendingRequests.length === 0 ? (
                       <div className="text-center py-6">
                          <p className="text-[10px] font-black text-slate-300 uppercase">Sem solicitações pendentes</p>
                       </div>
                     ) : (
                       pendingRequests.map(req => (
                         <div key={req.id} className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                            <div className="flex justify-between items-center mb-2">
                               <p className="text-[10px] font-black text-pedagogic-amber uppercase">{req.studentName || 'Novo Aluno'}</p>
                               <p className="text-[9px] font-bold text-slate-400">RA: {req.studentRA}</p>
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-1 italic">"{req.complaint || 'Sem detalhes'}"</p>
                         </div>
                       ))
                     )}
                  </div>
                  <Link to="/atendimentos" className="mt-6 text-[10px] font-black text-center uppercase tracking-widest text-pedagogic-amber hover:underline">Gerenciar Triagem</Link>
               </div>
            </div>

            {stats.criticalReports === 0 && upcomingAppointments.length === 0 && pendingRequests.length === 0 && (
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                 <div className="w-24 h-24 bg-pedagogic-teal/10 text-pedagogic-teal rounded-full flex items-center justify-center mb-8">
                    <ClipboardCheck size={48} />
                 </div>
                 <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-3">Tudo sob controle!</h3>
                 <p className="text-slate-400 font-medium max-w-sm">Você não possui alertas ou pendências urgentes no momento.</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Connection test
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    };
    testConnection();

    // Check for saved session
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      
      // Check if session user is expired
      if (parsedUser.expiresAt && new Date(parsedUser.expiresAt) < new Date() && parsedUser.role !== 'admin') {
        localStorage.removeItem("user");
        setUser(null);
      } else {
        setUser(parsedUser);
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <UnitProvider user={user}>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
            <Route path="/register" element={user ? <Navigate to="/" /> : <Register onLogin={handleLogin} />} />
            <Route path="/agendar" element={<PublicScheduling />} />
            <Route path="/student-portal" element={<StudentPortal />} />
            <Route path="/denuncia-anonima" element={<AnonymousReport />} />
            <Route path="/gestao-denuncias" element={
              (user?.role === 'admin' || user?.permissions?.includes('psychological_listening')) ? (
                <Layout user={user} onLogout={handleLogout}>
                  <AnonymousReportsManagement />
                </Layout>
              ) : <Navigate to="/" />
            } />
            
            <Route path="/" element={
              user ? (
                (user?.permissions?.includes('dashboard') || user?.role === 'admin') ? (
                  <Layout user={user} onLogout={handleLogout}>
                    <Dashboard user={user} />
                  </Layout>
                ) : <Navigate to="/alunos" />
              ) : <LandingPage />
            } />

            <Route path="/alunos" element={
              (user?.permissions?.includes('students') || user?.role === 'admin') ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Students user={user} />
                </Layout>
              ) : user ? <Navigate to="/" /> : <Navigate to="/login" />
            } />

            <Route path="/importar" element={
              (user?.permissions?.includes('import_students') || user?.role === 'admin') ? (
                <Layout user={user} onLogout={handleLogout}>
                  <ImportStudents user={user} />
                </Layout>
              ) : user ? <Navigate to="/" /> : <Navigate to="/login" />
            } />

            <Route path="/atendimentos" element={
              (user?.permissions?.includes('appointments') || user?.role === 'admin') ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Appointments user={user} />
                </Layout>
              ) : user ? <Navigate to="/" /> : <Navigate to="/login" />
            } />

            <Route path="/documentos" element={
              (user?.permissions?.includes('documents') || user?.role === 'admin') ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Documents user={user} />
                </Layout>
              ) : user ? <Navigate to="/" /> : <Navigate to="/login" />
            } />

            <Route path="/relatorios" element={
              (user?.permissions?.includes('reports') || user?.role === 'admin') ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Reports user={user} />
                </Layout>
              ) : user ? <Navigate to="/" /> : <Navigate to="/login" />
            } />

            <Route path="/escolas" element={
              (user?.permissions?.includes('schools') || user?.role === 'admin') ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Schools user={user} />
                </Layout>
              ) : user ? <Navigate to="/" /> : <Navigate to="/login" />
            } />

            <Route path="/escolas/cadastro" element={
              (user?.permissions?.includes('schools') || user?.role === 'admin') ? (
                <Layout user={user} onLogout={handleLogout}>
                  <SchoolRegistration />
                </Layout>
              ) : user ? <Navigate to="/" /> : <Navigate to="/login" />
            } />

            <Route path="/solicitacoes" element={
              (user?.permissions?.includes('scheduling_requests') || user?.role === 'admin') ? (
                <Layout user={user} onLogout={handleLogout}>
                  <SchedulingRequests user={user} />
                </Layout>
              ) : user ? <Navigate to="/" /> : <Navigate to="/login" />
            } />

            <Route path="/configuracoes" element={
              (user?.permissions?.includes('settings') || user?.role === 'admin') ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Settings user={user} />
                </Layout>
              ) : user ? <Navigate to="/" /> : <Navigate to="/login" />
            } />

            <Route path="/perfil" element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Profile user={user} onUpdateUser={(u: any) => setUser(u)} />
                </Layout>
              ) : <Navigate to="/login" />
            } />

            <Route path="/instrucoes" element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Instructions />
                </Layout>
              ) : <Navigate to="/login" />
            } />

            <Route path="/planos" element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <SaaSPlans />
                </Layout>
              ) : <Navigate to="/login" />
            } />

            <Route path="/admin" element={
              user?.permissions?.includes('admin') ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Admin />
                </Layout>
              ) : user ? <Navigate to="/" /> : <Navigate to="/login" />
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </UnitProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
