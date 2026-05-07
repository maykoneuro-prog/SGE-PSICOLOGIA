import React, { useState, useEffect, useRef } from "react";
import { Plus, Search, GraduationCap, LayoutGrid, List, User, School, Calendar as CalendarIcon, FileText, Camera, X as CloseIcon, MessageCircle, Trash2, FileSpreadsheet, Download as DownloadIcon, Upload } from "lucide-react";
import * as XLSX from 'xlsx';
import { api } from "../lib/api";
import { translateFirebaseError } from "../lib/errorTranslations";
import { openWhatsApp } from "../lib/whatsapp";
import { useUnit } from "../contexts/UnitContext";

export default function Students({ user }: { user: any }) {
  const { activeUnit } = useUnit();
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [students, setStudents] = useState([]);
  const [studentToDelete, setStudentToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [schoolsList, setSchoolsList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSchoolYear, setFilterSchoolYear] = useState("");
  const [filterSchoolId, setFilterSchoolId] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [formData, setFormData] = useState({
    name: "",
    ra: "",
    class: "",
    age: "",
    fatherName: "",
    motherName: "",
    schoolId: "",
    contact: "",
    email: "",
    schoolYear: "",
    unit: "",
    observations: "",
    studentType: "newcomer",
    hasMedicalReport: false,
    medicalReportType: "",
    medicalReportUrl: "",
    medicalReports: [] as any[],
    photoUrl: ""
  });

  useEffect(() => {
    loadData();
  }, [activeUnit]);

  const loadData = async () => {
    try {
      const isSuperAdmin = user?.role === 'super-admin' || user?.id === 'super_admin' || user?.email === 'maykon.euro@gmail.com';
      const isCentral = isSuperAdmin && (activeUnit === 'Administração Central' || activeUnit === 'Sede');
      const allowedUnits = user?.units || [];
      
      const [studentsData, schoolsData] = await Promise.all([
        api.students.list({ 
          unit: isCentral ? undefined : activeUnit, 
          isAdmin: isSuperAdmin,
          allowedUnits
        }),
        api.schools.list({ 
          isAdmin: isSuperAdmin,
          allowedUnits
        })
      ]);
      setStudents(studentsData || []);
      setSchoolsList(schoolsData || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const selectedSchoolRecord = schoolsList.find(s => s.id === formData.schoolId);
      const unitName = (selectedSchoolRecord?.unit || selectedSchoolRecord?.name || formData.unit || activeUnit).toUpperCase();
      
      await api.students.create({
        ...formData,
        age: Number(formData.age),
        unit: unitName,
        schoolUnit: unitName
      });
      setShowModal(false);
      loadData();
      setFormData({ 
        name: "", ra: "", class: "", age: "", fatherName: "", motherName: "", 
        schoolId: "", contact: "", email: "", schoolYear: "", unit: "", observations: "",
        studentType: "newcomer", hasMedicalReport: false, medicalReportType: "", 
        medicalReportUrl: "", medicalReports: [], photoUrl: ""
      });
    } catch (err: any) {
      alert(translateFirebaseError(err));
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!studentId) return;

    setIsDeleting(true);
    try {
      await api.students.delete(studentId);
      setStudentToDelete(null);
      setShowDetailsModal(false);
      setTimeout(() => alert("Aluno excluído com sucesso!"), 100);
      await loadData();
    } catch (err: any) {
      alert("Erro ao excluir aluno: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

    const isSuperAdmin = user?.role === 'super-admin' || user?.id === 'super_admin' || user?.email === 'maykon.euro@gmail.com' || user?.email === 'administrador@exemplo.com';
    const isCentral = isSuperAdmin && (['Administração Central', 'Sede', 'ADMINISTRAÇÃO CENTRAL', 'SEDE'].includes(activeUnit.trim().toUpperCase()));
    
    const filteredStudents = students.filter((s: any) => {
    const sFromId = schoolsList.find((sch: any) => sch.id === s.schoolId);
    
    // Strict isolation for standard and trial users
    if (!isSuperAdmin) {
      const isOwner = s.ownerId === user?.id || s.ownerId === user?.uid;
      const isProfessional = s.professionalId === user?.id || s.professionalId === user?.uid;
      
      const userUnits = (user?.units || []).map((u: string) => String(u).trim().toUpperCase());
      const studentUnit = String(s.unit || s.schoolUnit || sFromId?.unit || sFromId?.name || "").trim().toUpperCase();
      
      const hasUnitAccess = studentUnit !== "" && userUnits.some((u: string) => {
        const cleanAllowed = u.replace(/^(SESI|UNIDADE|ESCOLA|CENTRO|DEPARTAMENTO)\s+/gi, "").trim();
        const cleanItem = studentUnit.replace(/^(SESI|UNIDADE|ESCOLA|CENTRO|DEPARTAMENTO)\s+/gi, "").trim();
        return studentUnit === u || (cleanAllowed !== "" && cleanAllowed === cleanItem);
      });

      if (!isOwner && !isProfessional && !hasUnitAccess) return false;
    }
    
    const terms = [
      String(s.unit || "").trim().toLowerCase(),
      String(s.schoolUnit || "").trim().toLowerCase(),
      String(sFromId?.unit || "").trim().toLowerCase(),
      String(sFromId?.name || "").trim().toLowerCase(),
    ].filter(v => v !== "" && v !== "undefined");

    const targetUnit = (activeUnit || "").trim().toLowerCase();
    const cleanSelected = targetUnit.replace(/^(sesi|unidade)\s+/g, "").trim();

    const matchesUnit = isCentral || terms.some(val => {
      const cleanVal = val.replace(/^(sesi|unidade|escola|centro|departamento)\s+/g, "").trim();
      
      // Match exato
      if (val === targetUnit || cleanVal === cleanSelected) return true;
      
      // Match parcial se não for vazio
      if (cleanSelected !== "") {
        return cleanVal.includes(cleanSelected) || cleanSelected.includes(cleanVal);
      }
      
      return val.includes(targetUnit) || targetUnit.includes(val);
    });

    if (!matchesUnit) return false;
    
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.ra.includes(search);
    const matchesSchoolYear = !filterSchoolYear || s.schoolYear === filterSchoolYear;
    const matchesSchool = !filterSchoolId || s.schoolId === filterSchoolId;
    const matchesClass = !filterClass || s.class === filterClass;
    return matchesSearch && matchesSchoolYear && matchesSchool && matchesClass;
  });

  // Get unique values for filters
  const schoolYears = Array.from(new Set(students.map((s: any) => s.schoolYear))).filter(Boolean);
  const classes = Array.from(new Set(students.map((s: any) => s.class))).filter(Boolean);

  const getSchoolName = (id: string) => {
    return schoolsList.find(s => s.id === id)?.name || "Escola não encontrada";
  };

  const handleFileClick = (type: 'report' | 'photo') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'report' ? '.pdf,.doc,.docx,image/*' : 'image/*';
    if (type === 'photo') input.capture = 'environment';
    
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          if (type === 'report') {
            const newReport = {
              name: file.name,
              type: file.type,
              url: event.target.result,
              date: new Date().toISOString()
            };
            setFormData({ 
              ...formData, 
              medicalReports: [...(formData.medicalReports || []), newReport],
              hasMedicalReport: true 
            });
          } else {
            setFormData({ ...formData, photoUrl: event.target.result });
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const openDetails = (student: any) => {
    setSelectedStudent(student);
    setEditFormData(student);
    setIsEditing(false);
    setShowDetailsModal(true);
  };

  const handleUpdateStudent = async (id: string, data: any) => {
    try {
      await api.students.update(id, data);
      loadData();
      if (selectedStudent?.id === id) {
        setSelectedStudent({ ...selectedStudent, ...data });
        setEditFormData({ ...selectedStudent, ...data });
      }
    } catch (err: any) {
      alert("Erro ao atualizar aluno: " + translateFirebaseError(err));
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    
    try {
      const dataToUpdate = {
        ...editFormData,
        age: Number(editFormData.age)
      };
      delete dataToUpdate.id; // Don't send ID in the update body
      delete dataToUpdate.createdAt;
      delete dataToUpdate.updatedAt;

      await handleUpdateStudent(selectedStudent.id, dataToUpdate);
      setIsEditing(false);
    } catch (err: any) {
      alert("Erro ao salvar alterações: " + translateFirebaseError(err));
    }
  };

  const handleFileClickDetails = (type: 'report' | 'photo', studentId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'report' ? '.pdf,.doc,.docx,image/*' : 'image/*';
    if (type === 'photo') input.capture = 'environment';
    
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          const updateData: any = {};
          if (type === 'report') {
            const newReport = {
              name: file.name,
              type: file.type,
              url: event.target.result,
              date: new Date().toISOString()
            };
            const currentReports = selectedStudent.medicalReports || [];
            updateData.medicalReports = [...currentReports, newReport];
            updateData.hasMedicalReport = true;
          } else {
            updateData.photoUrl = event.target.result;
          }
          handleUpdateStudent(studentId, updateData);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
           <div className="bg-gradient-to-br from-pedagogic-blue to-blue-700 text-white p-4 rounded-[1.5rem] shadow-xl shadow-blue-100">
             <GraduationCap size={32} />
           </div>
           <div>
             <h2 className="text-3xl font-black text-slate-800 tracking-tight">Comunidade Escolar</h2>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Gestão de Estudantes e Professores</p>
           </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <button 
              onClick={() => setViewMode("list")}
              className={`p-2.5 rounded-xl transition-all ${viewMode === "list" ? "bg-pedagogic-blue text-white shadow-lg shadow-blue-100" : "text-slate-400 hover:bg-slate-50"}`}
              title="Lista"
            >
              <List size={20} />
            </button>
            <button 
              onClick={() => setViewMode("grid")}
              className={`p-2.5 rounded-xl transition-all ${viewMode === "grid" ? "bg-pedagogic-blue text-white shadow-lg shadow-blue-100" : "text-slate-400 hover:bg-slate-50"}`}
              title="Blocos"
            >
              <LayoutGrid size={20} />
            </button>
          </div>

          {(user?.role === 'admin' || user?.permissions?.includes('create_student')) && (
            <button 
              onClick={() => setShowModal(true)}
              className="bg-pedagogic-blue text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs hover:bg-blue-700 hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-95 shadow-xl shadow-blue-100"
            >
              <Plus size={18} /> Cadastrar Novo
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 bg-[#f8fafc] px-6 py-4 rounded-2xl border border-slate-100 focus-within:ring-4 focus-within:ring-pedagogic-blue/5 transition-all">
          <Search size={20} className="text-slate-300" />
          <input 
            type="text" 
            placeholder="Nome ou RA..." 
            className="bg-transparent outline-none text-slate-600 font-bold placeholder:text-slate-300 flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="relative">
          <select 
            className="w-full bg-[#f8fafc] px-6 py-4 rounded-2xl border border-slate-100 outline-none text-slate-600 font-bold focus:ring-4 focus:ring-pedagogic-blue/5 transition-all appearance-none cursor-pointer"
            value={filterSchoolYear}
            onChange={(e) => setFilterSchoolYear(e.target.value)}
          >
            <option value="">Todos os Anos</option>
            {schoolYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>

        <div className="relative">
          <select 
            className="w-full bg-[#f8fafc] px-6 py-4 rounded-2xl border border-slate-100 outline-none text-slate-600 font-bold focus:ring-4 focus:ring-pedagogic-blue/5 transition-all appearance-none cursor-pointer"
            value={filterSchoolId}
            onChange={(e) => setFilterSchoolId(e.target.value)}
          >
            <option value="">Todas as Unidades</option>
            {schoolsList.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
        </div>

        <div className="relative">
          <select 
            className="w-full bg-[#f8fafc] px-6 py-4 rounded-2xl border border-slate-100 outline-none text-slate-600 font-bold focus:ring-4 focus:ring-pedagogic-blue/5 transition-all appearance-none cursor-pointer"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="">Todas as Turmas</option>
            {classes.map(cls => <option key={cls} value={cls}>{cls}</option>)}
          </select>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">RA</th>
                <th className="px-6 py-4">Turma</th>
                <th className="px-6 py-4">Escola</th>
                <th className="px-6 py-4">Período</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.map((student: any) => (
                <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                  <td className="px-6 py-4 text-gray-600">{student.ra}</td>
                  <td className="px-6 py-4 text-gray-600">{student.class}</td>
                  <td className="px-6 py-4 text-gray-600">{getSchoolName(student.schoolId)}</td>
                  <td className="px-6 py-4 text-gray-600">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${student.studentType === 'veteran' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {student.studentType === 'veteran' ? 'Veterano' : 'Novato'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{student.schoolYear}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-3">
                      {student.contact && (
                        <button 
                          onClick={() => openWhatsApp(student.contact, `Olá! Gostaria de falar sobre o aluno ${student.name}.`)}
                          className="text-green-500 hover:text-green-600 transition-colors"
                          title="Enviar WhatsApp"
                        >
                          <MessageCircle size={18} />
                        </button>
                      )}
                      <button 
                        onClick={() => openDetails(student)}
                        className="text-sesi-blue hover:underline text-sm font-medium"
                      >
                        Ver Detalhes
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredStudents.length === 0 && (
            <div className="p-8 text-center text-gray-400">Nenhum aluno encontrado com os filtros aplicados.</div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStudents.map((student: any) => (
            <div key={student.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-blue-50 p-2 rounded-lg text-sesi-blue">
                  <User size={24} />
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                  RA: {student.ra}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 mb-1 truncate" title={student.name}>{student.name}</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <GraduationCap size={14} className="text-gray-400" />
                  <span>{student.class}</span>
                </div>
                <div className="flex items-center gap-2">
                  <School size={14} className="text-gray-400" />
                  <span className="truncate">{getSchoolName(student.schoolId)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${student.studentType === 'veteran' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {student.studentType === 'veteran' ? 'Veterano' : 'Novato'}
                  </span>
                  {student.hasMedicalReport && (
                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Laudo</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <CalendarIcon size={14} className="text-gray-400" />
                  <span>{student.schoolYear}</span>
                </div>
              </div>
              <button 
                onClick={() => openDetails(student)}
                className="w-full mt-4 py-2 text-sesi-blue bg-blue-50 rounded-lg text-sm font-bold hover:bg-sesi-blue hover:text-white transition-colors"
              >
                Ver Detalhes
              </button>
            </div>
          ))}
          {filteredStudents.length === 0 && (
            <div className="col-span-full p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
              Nenhum aluno encontrado com os filtros aplicados.
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Cadastrar Novo Aluno</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input 
                  type="text" required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RA (Registro Acadêmico)</label>
                <input 
                  type="text" required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  value={formData.ra}
                  onChange={(e) => setFormData({...formData, ra: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Turma</label>
                <input 
                  type="text" required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  value={formData.class}
                  onChange={(e) => setFormData({...formData, class: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Idade</label>
                <input 
                  type="number"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Período Letivo</label>
                <input 
                  type="text" required
                  placeholder="Ex: 2024"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  value={formData.schoolYear}
                  onChange={(e) => setFormData({...formData, schoolYear: e.target.value})}
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Aluno</label>
                <select 
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  value={formData.studentType}
                  onChange={(e) => setFormData({...formData, studentType: e.target.value})}
                >
                  <option value="newcomer">Novato</option>
                  <option value="veteran">Veterano</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Escola</label>
                <select 
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  value={formData.schoolId}
                  onChange={(e) => setFormData({...formData, schoolId: e.target.value})}
                >
                  <option value="">Selecione a Escola</option>
                  {schoolsList.map(school => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Possui Laudo?</label>
                <div className="flex items-center gap-4 py-2">
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      checked={formData.hasMedicalReport} 
                      onChange={() => setFormData({...formData, hasMedicalReport: true})}
                    /> Sim
                  </label>
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      checked={!formData.hasMedicalReport} 
                      onChange={() => setFormData({...formData, hasMedicalReport: false})}
                    /> Não
                  </label>
                </div>
              </div>
              {formData.hasMedicalReport && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Laudo</label>
                  <input 
                    type="text"
                    placeholder="Ex: TEA, TDAH, etc."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    value={formData.medicalReportType}
                    onChange={(e) => setFormData({...formData, medicalReportType: e.target.value})}
                  />
                </div>
              )}
              <div className="md:col-span-3 grid grid-cols-1 gap-4">
                <div 
                  onClick={() => handleFileClick('report')}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer border-slate-200 text-slate-500 hover:border-pedagogic-blue hover:text-pedagogic-blue hover:bg-blue-50/30 group`}
                >
                  <FileText size={28} className="mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black uppercase tracking-widest leading-none">Anexar Novo Laudo</span>
                  <p className="text-[10px] mt-2 opacity-60">PDF, Word ou Imagem</p>
                </div>
                
                {formData.medicalReports && formData.medicalReports.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Laudos Selecionados:</p>
                    {formData.medicalReports.map((report, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <FileText size={16} className="text-pedagogic-blue" />
                          <span className="text-xs font-bold text-slate-600 truncate max-w-[200px]">{report.name}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newReports = [...formData.medicalReports];
                            newReports.splice(idx, 1);
                            setFormData({...formData, medicalReports: newReports, hasMedicalReport: newReports.length > 0});
                          }}
                          className="text-pedagogic-rose p-1 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div 
                  onClick={() => handleFileClick('photo')}
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-colors cursor-pointer ${formData.photoUrl ? 'border-pedagogic-teal text-pedagogic-teal bg-teal-50' : 'border-slate-200 text-slate-500 hover:border-pedagogic-blue hover:text-pedagogic-blue'}`}
                >
                  {formData.photoUrl ? (
                    <img src={formData.photoUrl} alt="Preview" className="w-10 h-10 rounded-full object-cover mb-1" referrerPolicy="no-referrer" />
                  ) : (
                    <Camera size={24} className="mb-2" />
                  )}
                  <span className="text-xs font-medium">{formData.photoUrl ? 'Foto Capturada' : 'Tirar Foto (1ª Consulta)'}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Pai</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  value={formData.fatherName}
                  onChange={(e) => setFormData({...formData, fatherName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Mãe</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  value={formData.motherName}
                  onChange={(e) => setFormData({...formData, motherName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contato</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  value={formData.contact}
                  onChange={(e) => setFormData({...formData, contact: e.target.value})}
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
                  type="email"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea 
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                  rows={3}
                  value={formData.observations}
                  onChange={(e) => setFormData({...formData, observations: e.target.value})}
                ></textarea>
              </div>
              <div className="md:col-span-3 flex justify-end gap-3 mt-4">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button className="px-6 py-2 bg-sesi-green text-white font-bold rounded-lg hover:bg-green-700 transition-colors">
                  Salvar Aluno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showDetailsModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                {selectedStudent.photoUrl ? (
                  <img src={selectedStudent.photoUrl} alt={selectedStudent.name} className="w-16 h-16 rounded-full object-cover border-2 border-sesi-blue" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-sesi-blue">
                    <User size={32} />
                  </div>
                )}
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">{selectedStudent.name}</h3>
                  <p className="text-gray-500">RA: {selectedStudent.ra} | {selectedStudent.class}</p>
                </div>
              </div>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <>
                      {user?.role === 'admin' && (
                        <button 
                          onClick={() => setStudentToDelete(selectedStudent)}
                          className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors flex items-center gap-2"
                        >
                          <Trash2 size={16} /> Excluir
                        </button>
                      )}
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="bg-sesi-blue text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-800 transition-colors"
                      >
                        Editar
                      </button>
                    </>
                  )}
                  <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600">
                    <CloseIcon size={24} />
                  </button>
                </div>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RA (Registro Acadêmico)</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    value={editFormData.ra}
                    onChange={(e) => setEditFormData({...editFormData, ra: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Turma</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    value={editFormData.class}
                    onChange={(e) => setEditFormData({...editFormData, class: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Idade</label>
                  <input 
                    type="number"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    value={editFormData.age}
                    onChange={(e) => setEditFormData({...editFormData, age: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Período Letivo</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    value={editFormData.schoolYear}
                    onChange={(e) => setEditFormData({...editFormData, schoolYear: e.target.value})}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Aluno</label>
                  <select 
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    value={editFormData.studentType}
                    onChange={(e) => setEditFormData({...editFormData, studentType: e.target.value})}
                  >
                    <option value="newcomer">Novato</option>
                    <option value="veteran">Veterano</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Escola</label>
                  <select 
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    value={editFormData.schoolId}
                    onChange={(e) => setEditFormData({...editFormData, schoolId: e.target.value})}
                  >
                    <option value="">Selecione a Escola</option>
                    {schoolsList.map(school => (
                      <option key={school.id} value={school.id}>{school.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Possui Laudo?</label>
                  <div className="flex items-center gap-4 py-2">
                    <label className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        checked={editFormData.hasMedicalReport} 
                        onChange={() => setEditFormData({...editFormData, hasMedicalReport: true})}
                      /> Sim
                    </label>
                    <label className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        checked={!editFormData.hasMedicalReport} 
                        onChange={() => setEditFormData({...editFormData, hasMedicalReport: false})}
                      /> Não
                    </label>
                  </div>
                </div>
                {editFormData.hasMedicalReport && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Laudo</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                      value={editFormData.medicalReportType}
                      onChange={(e) => setEditFormData({...editFormData, medicalReportType: e.target.value})}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    value={editFormData.unit}
                    onChange={(e) => setEditFormData({...editFormData, unit: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Pai</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    value={editFormData.fatherName}
                    onChange={(e) => setEditFormData({...editFormData, fatherName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Mãe</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    value={editFormData.motherName}
                    onChange={(e) => setEditFormData({...editFormData, motherName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contato</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    value={editFormData.contact}
                    onChange={(e) => setEditFormData({...editFormData, contact: e.target.value})}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input 
                    type="email"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea 
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                    rows={3}
                    value={editFormData.observations}
                    onChange={(e) => setEditFormData({...editFormData, observations: e.target.value})}
                  ></textarea>
                </div>
                <div className="md:col-span-3 flex justify-end gap-3 mt-4">
                  <button 
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="px-6 py-2 bg-sesi-green text-white font-bold rounded-lg hover:bg-green-700 transition-colors">
                    Salvar Alterações
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-bold text-sesi-blue border-b pb-2">Informações Acadêmicas</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Escola:</strong> {getSchoolName(selectedStudent.schoolId)}</p>
                    <p><strong>Período Letivo:</strong> {selectedStudent.schoolYear}</p>
                    <p><strong>Unidade:</strong> {selectedStudent.unit || "N/A"}</p>
                    <p>
                      <strong>Tipo:</strong> 
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${selectedStudent.studentType === 'veteran' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {selectedStudent.studentType === 'veteran' ? 'Veterano' : 'Novato'}
                      </span>
                    </p>
                  </div>

                  <h4 className="font-bold text-sesi-blue border-b pb-2 mt-6">Saúde e Laudos</h4>
                  <div className="space-y-4 text-sm">
                    <p><strong>Possui Laudo:</strong> {selectedStudent.hasMedicalReport ? "Sim" : "Não"}</p>
                    {selectedStudent.hasMedicalReport && (
                      <p><strong>Tipo de Laudo Principal:</strong> {selectedStudent.medicalReportType || "Não informado"}</p>
                    )}
                    
                    <div className="space-y-3 mt-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Documentos e Laudos:</p>
                      
                      <div className="grid grid-cols-1 gap-2">
                        {/* Legacy Link */}
                        {selectedStudent.medicalReportUrl && (
                          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-2xl border border-blue-100 group">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-pedagogic-blue shadow-sm">
                                <FileText size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-700">Laudo Principal</p>
                                <p className="text-[10px] text-slate-400 font-medium">Arquivo Base</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                const newWindow = window.open();
                                if (newWindow) {
                                  newWindow.document.write(`<iframe src="${selectedStudent.medicalReportUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                }
                              }}
                              className="px-4 py-2 bg-pedagogic-blue text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                            >
                              Abrir
                            </button>
                          </div>
                        )}

                        {/* Multi-reports */}
                        {selectedStudent.medicalReports?.map((report: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-pedagogic-blue shadow-sm border border-slate-100">
                                <FileText size={16} />
                              </div>
                              <div className="max-w-[150px]">
                                <p className="text-xs font-bold text-slate-700 truncate" title={report.name}>{report.name}</p>
                                <p className="text-[10px] text-slate-400 font-medium italic">
                                  {report.date ? new Date(report.date).toLocaleDateString() : 'Anexo'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  const newWindow = window.open();
                                  if (newWindow) {
                                    newWindow.document.write(`<iframe src="${report.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                  }
                                }}
                                className="px-4 py-2 bg-pedagogic-blue text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                              >
                                Abrir
                              </button>
                              <button 
                                onClick={async () => {
                                  if (!confirm("Deseja remover este laudo?")) return;
                                  const newReports = selectedStudent.medicalReports.filter((_: any, i: number) => i !== idx);
                                  await handleUpdateStudent(selectedStudent.id, { medicalReports: newReports, hasMedicalReport: newReports.length > 0 || !!selectedStudent.medicalReportUrl });
                                }}
                                className="p-2 text-pedagogic-rose hover:bg-rose-50 rounded-xl transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4">
                        <button 
                          onClick={() => handleFileClickDetails('report', selectedStudent.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-pedagogic-blue/5 text-pedagogic-blue rounded-2xl hover:bg-pedagogic-blue hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group"
                        >
                          <Plus size={16} className="group-hover:rotate-90 transition-transform" /> Adicionar Novo Laudo
                        </button>
  
                        <button 
                          onClick={() => handleFileClickDetails('photo', selectedStudent.id)}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-all text-[10px] font-black uppercase tracking-widest"
                        >
                          <Camera size={16} /> Atualizar Foto
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-sesi-blue border-b pb-2">Informações Pessoais</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Idade:</strong> {selectedStudent.age || "N/A"}</p>
                    <p><strong>Mãe:</strong> {selectedStudent.motherName || "N/A"}</p>
                    <p><strong>Pai:</strong> {selectedStudent.fatherName || "N/A"}</p>
                    <p className="flex items-center gap-2">
                      <strong>Contato:</strong> {selectedStudent.contact || "N/A"}
                      {selectedStudent.contact && (
                        <button 
                          onClick={() => openWhatsApp(selectedStudent.contact, `Olá! Gostaria de falar sobre o aluno ${selectedStudent.name}.`)}
                          className="text-green-500 hover:text-green-600 transition-colors"
                        >
                          <MessageCircle size={16} />
                        </button>
                      )}
                    </p>
                    <p><strong>Email:</strong> {selectedStudent.email || "N/A"}</p>
                  </div>

                  <h4 className="font-bold text-sesi-blue border-b pb-2 mt-6">Observações</h4>
                  <p className="text-sm text-gray-600 italic">
                    {selectedStudent.observations || "Nenhuma observação registrada."}
                  </p>
                </div>
              </div>
            )}

            {!isEditing && (
              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deletion */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-red-100 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            
            <h3 className="text-xl font-black text-gray-900 text-center mb-2">Excluir Aluno?</h3>
            <p className="text-gray-500 text-center text-sm mb-6">
              Deseja excluir permanentemente o cadastro de <span className="font-bold text-gray-800">{studentToDelete.name}</span>?
              <br/>
              <span className="text-xs text-red-500 mt-2 block font-medium">Esta ação não pode ser desfeita e excluirá todos os documentos vinculados.</span>
            </p>

            <div className="flex flex-col gap-3">
              <button
                disabled={isDeleting}
                onClick={() => handleDeleteStudent(studentToDelete.id)}
                className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-red-700 transition shadow-lg shadow-red-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  "Confirmar Exclusão"
                )}
              </button>
              <button
                disabled={isDeleting}
                onClick={() => setStudentToDelete(null)}
                className="w-full py-4 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
