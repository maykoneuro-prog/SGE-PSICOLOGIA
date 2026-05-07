import React, { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { Plus, Trash2, School as SchoolIcon, Search, Edit2, QrCode, Download, X as CloseIcon, Smartphone, ClipboardCheck, ShieldAlert, ArrowRight, MousePointer2, CheckCircle2, Upload, Download as DownloadIcon } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { toPng } from "html-to-image";
import * as XLSX from 'xlsx';

export default function Schools({ user }: { user: any }) {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedSchoolForQR, setSelectedSchoolForQR] = useState<any>(null);
  const [editingSchool, setEditingSchool] = useState<any>(null);
  const [appSettings, setAppSettings] = useState({ name: "SGE Psicologia", logoUrl: "https://images.weserv.nl/?url=i.imgur.com/NR6kaz6.png" });
  const posterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSchoolForImport, setSelectedSchoolForImport] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState({ success: 0, error: 0, total: 0 });
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    email: "",
    address: "",
    mecAuthorization: "",
    phone: "",
    unit: ""
  });

  useEffect(() => {
    loadSchools();
    
    // Fetch settings for the poster
    const fetchSettings = async () => {
      try {
        const settings = await api.appSettings.get();
        if (settings) setAppSettings(settings);
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const loadSchools = async () => {
    try {
      const isSuperAdmin = user?.role === 'super-admin' || user?.id === 'super_admin' || user?.email === 'maykon.euro@gmail.com' || user?.email === 'administrador@exemplo.com';
      const allowedUnits = user?.units || [];
      const data = await api.schools.list({ isAdmin: isSuperAdmin, allowedUnits });
      setSchools(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isTrial = user?.planId === 'trial' || user?.isTrial;
    if (isTrial && !editingSchool && schools.length >= 1) {
      alert("No seu teste grátis você pode cadastrar apenas 1 unidade escolar.");
      return;
    }
    try {
      const unitName = (formData.unit || formData.name).trim().toUpperCase();
      const dataToSave = { ...formData, unit: unitName, name: formData.name.trim() };
      if (editingSchool) {
        await api.schools.update(editingSchool.id, dataToSave);
      } else {
        await api.schools.create(dataToSave);
      }
      setIsModalOpen(false);
      setEditingSchool(null);
      setFormData({ 
      name: "", 
      cnpj: "", 
      email: "", 
      address: "", 
      mecAuthorization: "", 
      phone: "",
      unit: ""
    });
      loadSchools();
    } catch (err) {
      alert("Erro ao salvar escola");
    }
  };

  const handleEdit = (school: any) => {
    setEditingSchool(school);
    setFormData({
      name: school.name,
      cnpj: school.cnpj,
      email: school.email,
      address: school.address || "",
      mecAuthorization: school.mecAuthorization || "",
      phone: school.phone || "",
      unit: school.unit || ""
    });
    setIsModalOpen(true);
  };

  const handleQR = (school: any) => {
    setSelectedSchoolForQR(school);
    setIsQRModalOpen(true);
  };

  const downloadPoster = async () => {
    if (!posterRef.current) return;
    try {
      await document.fonts.ready;
      const dataUrl = await toPng(posterRef.current, { 
        quality: 1.0, 
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `Cartaz_SGE_${selectedSchoolForQR.name.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating image:', err);
      alert('Não foi possível gerar a imagem decorada. Tente baixar o QR Code simples ou tirar um print da tela.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta escola?")) return;
    try {
      await api.schools.delete(id);
      loadSchools();
    } catch (err) {
      alert("Erro ao excluir escola");
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSchoolForImport) return;

    setIsImporting(true);
    setImportProgress(0);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        const wb = XLSX.read(dataBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // Get rows as arrays of strings for better header mapping
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!rows || rows.length < 2) {
          console.warn("No data or headers found in the Excel sheet");
          alert("A planilha parece estar vazia ou sem cabeçalhos.");
          setIsImporting(false);
          setSelectedSchoolForImport(null);
          return;
        }

        const headers = rows[0].map(h => String(h).trim().toLowerCase());
        const dataRows = rows.slice(1);
        
        let successCount = 0;
        let errorCount = 0;
        const total = dataRows.length;
        setImportStats({ success: 0, error: 0, total });

        console.log(`Headers found: ${headers.join(', ')}`);
        console.log(`Starting import of ${total} students for ${selectedSchoolForImport.name}`);

        for (let i = 0; i < dataRows.length; i++) {
          const rowValues = dataRows[i];
          if (!rowValues || rowValues.length === 0) continue;

          // Helper to find column index by name
          const getIdx = (possibleNames: string[]) => {
            return headers.findIndex(h => possibleNames.some(pn => pn.toLowerCase() === h));
          };

          const rawVal = (possibleNames: string[]) => {
            const idx = getIdx(possibleNames);
            return idx !== -1 ? rowValues[idx] : undefined;
          };

          try {
            const studentData = {
              name: String(rawVal(['Nome', 'Student Name', 'FullName', 'Aluno']) || '').trim(),
              ra: String(rawVal(['RA', 'Registro', 'ID', 'Matrícula', 'Matricula']) || '').trim(),
              class: String(rawVal(['Turma', 'Class', 'Grade', 'Série', 'Serie']) || '').trim(),
              schoolId: selectedSchoolForImport.id,
              schoolUnit: selectedSchoolForImport.name,
              unit: selectedSchoolForImport.name,
              age: Number(rawVal(['Idade', 'Age']) || 0),
              fatherName: String(rawVal(['Pai', 'Father']) || '').trim(),
              motherName: String(rawVal(['Mãe', 'Mother', 'Mae']) || '').trim(),
              contact: String(rawVal(['Contato', 'Contact', 'Phone', 'Telefone', 'Celular']) || '').trim(),
              email: String(rawVal(['Email', 'E-mail']) || '').trim(),
              schoolYear: String(rawVal(['Ano Letivo', 'Year', 'SchoolYear', 'Ano']) || new Date().getFullYear()),
              studentType: String(rawVal(['Tipo', 'Type', 'Situação']) || '').toLowerCase().includes('vet') ? 'veteran' : 'newcomer',
              observations: String(rawVal(['Observações', 'Notes', 'Observations', 'Obs']) || '').trim(),
            };

            if (studentData.name && (studentData.ra || studentData.name !== "")) {
              // If RA is missing, we still try to create but it's better if it has one
              if (!studentData.ra) studentData.ra = `TEMP-${Date.now()}-${i}`;
              
              const result = await api.students.create(studentData);
              if (result && result.id) {
                successCount++;
              } else {
                errorCount++;
              }
            } else {
              errorCount++;
            }
          } catch (err) {
            console.error(`Error importing student at row ${i}:`, err);
            errorCount++;
          }
          
          const currentProgress = Math.round(((i + 1) / total) * 100);
          setImportProgress(currentProgress);
          setImportStats({ success: successCount, error: errorCount, total });
        }

        console.log(`Import finished. Success: ${successCount}, Error: ${errorCount}`);
        alert(`Importação concluída!\nSucessos: ${successCount}\nErros: ${errorCount}\nTotal: ${total}`);
      } catch (err) {
        console.error("Critical error during Excel processing:", err);
        alert("Erro ao processar arquivo Excel. Verifique se o formato é válido.");
      } finally {
        setTimeout(() => {
          setIsImporting(false);
          setSelectedSchoolForImport(null);
          setImportProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }, 3000);
      }
    };
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
      setIsImporting(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = (school: any) => {
    const template = [
      {
        'Nome': 'Exemplo Silva',
        'RA': '123456',
        'Turma': '7º Ano A',
        'Idade': 13,
        'Tipo': 'Novato',
        'Pai': 'João Silva',
        'Mãe': 'Maria Silva',
        'Contato': '(11) 99999-9999',
        'Email': 'email@exemplo.com',
        'Ano Letivo': '2024',
        'Observações': 'Alguma observação'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo Alunos");
    XLSX.writeFile(wb, `modelo_alunos_${school.name.replace(/\s+/g, '_')}.xlsx`);
  };

  const filteredSchools = schools.filter(s => {
    const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';
    
    // Admins see all
    if (isAdmin) {
      return s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             (s.cnpj && s.cnpj.includes(searchTerm));
    }
    
    // Regular users and Trial users see only their own records
    const isOwner = s.ownerId === user?.id || s.ownerId === user?.uid;
    const userUnits = user?.units || [];
    const hasUnitAccess = userUnits.includes(s.name);
    
    if (!isOwner && !hasUnitAccess) return false;

    return s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           s.cnpj.includes(searchTerm);
  });

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SchoolIcon className="text-sesi-blue" size={28} />
          <h2 className="text-2xl font-bold text-gray-800">Gestão de Escolas</h2>
        </div>
        {(user?.role === 'admin' || user?.planId === 'trial' || user?.isTrial) && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-sesi-blue text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Nova Escola
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
        <Search className="text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por nome ou CNPJ..." 
          className="flex-1 outline-none text-gray-600"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportExcel} 
        accept=".xlsx,.xls,.csv" 
        className="hidden" 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSchools.map(school => (
          <div key={school.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-lg text-gray-800">{school.name}</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setSelectedSchoolForImport(school);
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }}
                  className="p-2 text-slate-400 hover:text-sesi-green hover:bg-sesi-green/5 rounded-lg transition-all"
                  title="Importar Alunos"
                  disabled={isImporting}
                >
                  <Upload size={18} />
                </button>
                <button 
                  onClick={() => downloadTemplate(school)} 
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                  title="Baixar Modelo de Alunos"
                >
                  <DownloadIcon size={18} />
                </button>
                <button 
                  onClick={() => handleQR(school)} 
                  className="p-2 text-slate-400 hover:text-pedagogic-teal hover:bg-pedagogic-teal/5 rounded-lg transition-all"
                  title="Gerar QR Code"
                >
                  <QrCode size={18} />
                </button>
                {(user?.role === 'admin' || user?.planId === 'trial' || user?.isTrial) && (
                  <>
                    <button 
                      onClick={() => handleEdit(school)} 
                      className="p-2 text-slate-400 hover:text-pedagogic-blue hover:bg-pedagogic-blue/5 rounded-lg transition-all"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(school.id)} 
                      className="p-2 text-slate-400 hover:text-pedagogic-rose hover:bg-pedagogic-rose/5 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>CNPJ:</strong> {school.cnpj}</p>
              <p><strong>Email:</strong> {school.email}</p>
              <p><strong>Telefone:</strong> {school.phone || "N/A"}</p>
              <p><strong>MEC:</strong> {school.mecAuthorization || "N/A"}</p>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">{editingSchool ? "Editar Escola" : "Nova Escola"}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Escola</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue"
                    value={formData.cnpj}
                    onChange={e => setFormData({...formData, cnpj: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
                  type="email" 
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Autorização MEC</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sesi-blue"
                  value={formData.mecAuthorization}
                  onChange={e => setFormData({...formData, mecAuthorization: e.target.value})}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-sesi-blue text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isImporting && selectedSchoolForImport && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl border border-slate-100"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-sesi-blue/10 text-sesi-blue flex items-center justify-center mb-6 animate-pulse">
                  <Upload size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Importando Alunos</h3>
                <p className="text-sm text-slate-500 mb-8">Processando arquivo para <span className="font-bold text-slate-700">{selectedSchoolForImport.name}</span></p>
                
                <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden mb-4 border border-slate-200">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${importProgress}%` }}
                    className="h-full bg-sesi-blue shadow-lg shadow-blue-200"
                  />
                </div>
                
                <div className="flex justify-between w-full mb-8 px-1">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{importProgress}% Concluído</span>
                  <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{importStats.success + importStats.error} / {importStats.total}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="bg-sesi-green/5 p-4 rounded-2xl border border-sesi-green/10">
                    <p className="text-[10px] font-black text-sesi-green uppercase tracking-widest mb-1">Sucessos</p>
                    <p className="text-2xl font-black text-sesi-green">{importStats.success}</p>
                  </div>
                  <div className="bg-pedagogic-rose/5 p-4 rounded-2xl border border-pedagogic-rose/10">
                    <p className="text-[10px] font-black text-pedagogic-rose uppercase tracking-widest mb-1">Erros</p>
                    <p className="text-2xl font-black text-pedagogic-rose">{importStats.error}</p>
                  </div>
                </div>

                {importProgress === 100 && (
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 text-sm font-bold text-sesi-green flex items-center gap-2"
                  >
                    <CheckCircle2 size={16} /> Importação finalizada!
                  </motion.p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {isQRModalOpen && selectedSchoolForQR && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <QrCode size={24} className="text-pedagogic-blue" />
                  Cartaz de Divulgação
                </h3>
                <button 
                  onClick={() => setIsQRModalOpen(false)} 
                  className="p-2 text-slate-400 hover:text-pedagogic-rose hover:bg-white rounded-xl transition-all shadow-sm"
                >
                  <CloseIcon size={24} />
                </button>
              </div>

              <div className="p-8">
                {/* Poster Preview */}
                <div className="relative group">
                  <div 
                    ref={posterRef}
                    className="bg-white border-[12px] border-slate-50 shadow-inner rounded-[2rem] p-10 overflow-hidden relative"
                    style={{ minHeight: '600px' }}
                  >
                    {/* Timbrado Background Decor */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-pedagogic-blue/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-pedagogic-teal/5 rounded-full -ml-24 -mb-24 blur-2xl opacity-50" />
                    
                    {/* Header Timbrado */}
                    <div className="flex flex-col items-center mb-12 relative z-10">
                      <img 
                        src={appSettings.logoUrl} 
                        alt="Logo" 
                        className="h-16 w-auto mb-4 object-contain" 
                        referrerPolicy="no-referrer" 
                        crossOrigin="anonymous"
                      />
                      <div className="h-1 w-24 bg-gradient-to-r from-transparent via-pedagogic-blue to-transparent opacity-20 mb-4" />
                      <h4 className="text-2xl font-black text-slate-800 tracking-tight text-center">
                        {selectedSchoolForQR.name}
                      </h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Portal do Aluno</p>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
                      {/* Step by Step - Mapa Animado */}
                      <div className="flex-1 space-y-8 text-left">
                        <div className="relative">
                          {/* Map Line Connector */}
                          <div className="absolute left-6 top-8 bottom-0 w-0.5 border-l-2 border-dashed border-pedagogic-blue/20 -z-10" />
                          
                          <motion.div 
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="flex items-start gap-4"
                          >
                            <div className="w-12 h-12 rounded-2xl bg-pedagogic-blue text-white flex items-center justify-center shadow-lg shadow-blue-100 shrink-0">
                              <Smartphone size={24} />
                            </div>
                            <div>
                              <p className="text-xs font-black text-pedagogic-blue uppercase tracking-widest mb-1">Passo 01</p>
                              <p className="text-sm font-bold text-slate-700 leading-tight">Escaneie o código abaixo com a câmera do seu celular.</p>
                            </div>
                          </motion.div>

                          <motion.div 
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="flex items-start gap-4 mt-10"
                          >
                            <div className="w-12 h-12 rounded-2xl bg-pedagogic-teal text-white flex items-center justify-center shadow-lg shadow-teal-100 shrink-0">
                              <MousePointer2 size={24} />
                            </div>
                            <div>
                              <p className="text-xs font-black text-pedagogic-teal uppercase tracking-widest mb-1">Passo 02</p>
                              <p className="text-sm font-bold text-slate-700 leading-tight">Ao entrar no Portal do Aluno, confira as opções disponíveis.</p>
                            </div>
                          </motion.div>

                          <motion.div 
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="flex items-start gap-4 mt-10"
                          >
                            <div className="w-12 h-12 rounded-2xl bg-pedagogic-amber text-white flex items-center justify-center shadow-lg shadow-amber-100 shrink-0">
                              <ClipboardCheck size={24} />
                            </div>
                            <div>
                              <p className="text-xs font-black text-pedagogic-amber uppercase tracking-widest mb-1">Passo 03</p>
                              <p className="text-sm font-bold text-slate-700 leading-tight">Selecione entre Agendamento ou Denúncia Anônima.</p>
                            </div>
                          </motion.div>
                        </div>
                      </div>

                      {/* QR Code Container */}
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.8, type: "spring" }}
                        className="shrink-0 p-6 bg-white rounded-[2rem] shadow-2xl border-2 border-slate-50 relative group"
                      >
                        <div className="absolute -inset-2 bg-gradient-to-tr from-pedagogic-blue via-pedagogic-teal to-pedagogic-amber rounded-[2.5rem] opacity-20 blur-xl group-hover:opacity-40 transition-opacity" />
                        <div className="relative bg-white p-4 rounded-3xl">
                          <QRCodeSVG 
                            id="school-qr-code-final"
                            value={`${window.location.origin}/student-portal?schoolId=${selectedSchoolForQR.id}`}
                            size={180}
                            level="H"
                            includeMargin={false}
                          />
                        </div>
                        <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-slate-50">
                          <CheckCircle2 className="text-pedagogic-teal" size={24} />
                        </div>
                      </motion.div>
                    </div>

                    {/* Footer Timbrado */}
                    <div className="mt-16 pt-8 border-t border-slate-50 relative z-10 flex flex-col items-center">
                       <p className="text-[10px] font-black text-slate-400 flex items-center gap-2 mb-2 uppercase tracking-widest">
                        <ShieldAlert size={12} className="text-pedagogic-rose" /> 
                        Serviço Exclusivo SESI-PE | Sigilo Absoluto
                       </p>
                       <div className="flex gap-4">
                         <div className="w-3 h-3 rounded-full bg-pedagogic-blue opacity-20" />
                         <div className="w-3 h-3 rounded-full bg-pedagogic-teal opacity-20" />
                         <div className="w-3 h-3 rounded-full bg-pedagogic-amber opacity-20" />
                         <div className="w-3 h-3 rounded-full bg-pedagogic-rose opacity-20" />
                       </div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => setIsQRModalOpen(false)}
                    className="px-6 py-4 bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Fechar
                  </button>
                  <button 
                    onClick={() => {
                      const svg = document.getElementById('school-qr-code-final');
                      if (!svg) return;
                      const svgData = new XMLSerializer().serializeToString(svg);
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      const img = new Image();
                      img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx?.drawImage(img, 0, 0);
                        const pngUrl = canvas.toDataURL('image/png');
                        const downloadLink = document.createElement('a');
                        downloadLink.href = pngUrl;
                        downloadLink.download = `QR_Code_${selectedSchoolForQR.name.replace(/\s+/g, '_')}.png`;
                        downloadLink.click();
                      };
                      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                    }}
                    className="px-6 py-4 bg-white border-2 border-slate-100 text-slate-600 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    <QrCode size={18} />
                    Apenas QR
                  </button>
                  <button 
                    onClick={downloadPoster}
                    className="flex-1 px-6 py-4 bg-pedagogic-blue text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-blue-700 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 shadow-xl shadow-blue-100 flex items-center justify-center gap-3"
                  >
                    <Download size={18} />
                    Baixar Cartaz Completo
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
