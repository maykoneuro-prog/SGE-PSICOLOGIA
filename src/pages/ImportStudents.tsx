import React, { useState } from "react";
import { FileUp, FileDown, AlertCircle, CheckCircle2, Loader2, Zap } from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";
import { translateFirebaseError } from "../lib/errorTranslations";
import { useUnit } from "../contexts/UnitContext";

export default function ImportStudents({ user }: { user: any }) {
  const { activeUnit } = useUnit();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importType, setImportType] = useState<"students" | "schools">("students");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ success: number; updated: number; errors: string[] } | null>(null);

  const studentHeaders = [
    "Nome do Aluno", "RA", "Turma", "Idade", "Pai", "Mãe", "Escola", "Contato", "Email", 
    "Período Letivo", "Unidade", "Observações", "Tipo de Aluno (veterano/novato)", 
    "Possui Laudo (Sim/Não)", "Tipo de Laudo"
  ];

  const schoolHeaders = [
    "Nome da Escola", "Unidade", "CNPJ", "Email", "Telefone", "Endereço", "Autorização MEC"
  ];

  const downloadTemplate = () => {
    const headers = importType === "students" ? studentHeaders : schoolHeaders;
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo Importação");
    XLSX.writeFile(wb, `modelo_importacao_${importType === "students" ? "alunos" : "escolas"}.xlsx`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);
    setProgress({ current: 0, total: 0 });
    const errors: string[] = [];
    let successCount = 0;
    let updatedCount = 0;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

          setProgress({ current: 0, total: jsonData.length });

          if (importType === "students") {
            const isSuperAdmin = user?.role === 'super-admin' || user?.id === 'super_admin' || user?.email === 'maykon.euro@gmail.com';
            const schoolsList = await api.schools.list({ 
              isAdmin: isSuperAdmin,
              allowedUnits: (user?.units || []).map((u: string) => u.trim().toUpperCase())
            }) as any[];
            const schoolMap = new Map((schoolsList || []).map(s => [s.name.trim().toLowerCase(), s]));

            // OTIMIZAÇÃO: Busca todos os alunos da unidade de uma vez para comparar RAs
            // Isso evita uma consulta por linha da planilha
            const existingStudents = await api.students.list({ 
              unit: activeUnit, 
              isAdmin: isSuperAdmin,
              allowedUnits: (user?.units || []).map((u: string) => u.trim().toUpperCase())
            }) as any[];
            const existingRAMap = new Map(existingStudents.map(s => [String(s.ra), s.id]));

            const chunkSize = 20;
            for (let i = 0; i < jsonData.length; i += chunkSize) {
              const chunk = jsonData.slice(i, i + chunkSize);
              await Promise.all(chunk.map(async (row) => {
                try {
                  const hasLaudoStr = String(row["Possui Laudo (Sim/Não)"] || "").toLowerCase();
                  const studentTypeStr = String(row["Tipo de Aluno (veterano/novato)"] || "").toLowerCase();
                  const schoolName = String(row["Escola"] || row["escola"] || "").trim().toLowerCase();
                  const schoolObj = schoolMap.get(schoolName);
                  const schoolId = schoolObj?.id || "";
                  const ra = String(row["RA"] || row["ra"] || "");

                  // Normalização da unidade: prioriza a planilha, depois a unidade da escola, depois a unidade ativa
                  let rowUnit = String(row["Unidade"] || row["unidade"] || "").trim().toUpperCase();
                  if (!rowUnit && schoolObj?.unit) {
                    rowUnit = String(schoolObj.unit).trim().toUpperCase();
                  }
                  if (!rowUnit && activeUnit !== 'Administração Central' && activeUnit !== 'Sede') {
                    rowUnit = activeUnit.trim().toUpperCase();
                  }

                  const studentData = {
                    name: String(row["Nome do Aluno"] || row["nome"] || "").trim(),
                    ra: ra,
                    class: String(row["Turma"] || row["turma"] || "").trim(),
                    age: Number(row["Idade"] || row["idade"] || 0),
                    fatherName: String(row["Pai"] || row["pai"] || "").trim(),
                    motherName: String(row["Mãe"] || row["mãe"] || "").trim(),
                    schoolId: schoolId,
                    contact: String(row["Contato"] || row["contato"] || "").trim(),
                    email: String(row["Email"] || row["email"] || "").trim(),
                    schoolYear: String(row["Período Letivo"] || row["periodo_letivo"] || "").trim(),
                    unit: rowUnit,
                    schoolUnit: rowUnit,
                    observations: String(row["Observações"] || row["observacoes"] || "").trim(),
                    studentType: studentTypeStr.includes("veteran") || studentTypeStr.includes("veterano") ? "veteran" : "newcomer",
                    hasMedicalReport: hasLaudoStr === "sim" || hasLaudoStr === "yes" || hasLaudoStr === "s",
                    medicalReportType: String(row["Tipo de Laudo"] || "").trim()
                  };

                  if (!studentData.name || !studentData.ra) {
                    errors.push(`Linha com RA ${studentData.ra || 'vazio'}: Nome e RA são obrigatórios.`);
                    return;
                  }

                  // Validação de segurança: o usuário tem permissão para importar nesta unidade?
                  if (!isSuperAdmin) {
                    const unitToCheck = rowUnit.toUpperCase();
                    const allowedUnits = (user?.units || []).map((u: string) => u.trim().toUpperCase());
                    const isAllowed = allowedUnits.some(u => {
                      const cleanAllowed = u.replace(/^(SESI|UNIDADE|ESCOLA|CENTRO|DEPARTAMENTO)\s+/gi, "").trim();
                      const cleanItem = unitToCheck.replace(/^(SESI|UNIDADE|ESCOLA|CENTRO|DEPARTAMENTO)\s+/gi, "").trim();
                      return u === unitToCheck || (cleanAllowed !== "" && cleanAllowed === cleanItem);
                    });
                    
                    if (!isAllowed) {
                      errors.push(`Linha com RA ${ra}: Você não tem permissão para importar dados na unidade ${rowUnit}.`);
                      return;
                    }
                  }

                  const existingId = existingRAMap.get(ra);
                  if (existingId) {
                    await api.students.update(existingId, studentData);
                    updatedCount++;
                  } else {
                    await api.students.create(studentData);
                    successCount++;
                  }
                } catch (err: any) {
                  errors.push(`Erro ao processar RA ${row["RA"]}: ${translateFirebaseError(err)}`);
                }
              }));
              setProgress(prev => ({ ...prev, current: Math.min(i + chunkSize, jsonData.length) }));
            }
          } else {
            // Import Schools logic
            const isSuperAdmin = user?.role === 'super-admin' || user?.id === 'super_admin' || user?.email === 'maykon.euro@gmail.com';
            const existingSchools = await api.schools.list({ 
              isAdmin: isSuperAdmin,
              allowedUnits: (user?.units || []).map((u: string) => u.trim().toUpperCase())
            }) as any[];
            const existingNamesMap = new Map(existingSchools.map(s => [s.name.trim().toLowerCase(), s.id]));

            const chunkSize = 10;
            for (let i = 0; i < jsonData.length; i += chunkSize) {
              const chunk = jsonData.slice(i, i + chunkSize);
              await Promise.all(chunk.map(async (row) => {
                try {
                  const schoolName = row["Nome da Escola"] || row["nome"] || "";
                  if (!schoolName) {
                    errors.push("Nome da escola é obrigatório.");
                    return;
                  }

                  const unitName = String(row["Unidade"] || row["unidade"] || schoolName).trim().toUpperCase();

                  const schoolData = {
                    name: schoolName,
                    unit: unitName,
                    cnpj: row["CNPJ"] || row["cnpj"] || "",
                    email: row["Email"] || row["email"] || "",
                    phone: row["Telefone"] || row["telefone"] || "",
                    address: row["Endereço"] || row["endereco"] || "",
                    mecAuthorization: row["Autorização MEC"] || row["autorizacao_mec"] || ""
                  };

                  const existingId = existingNamesMap.get(schoolName.trim().toLowerCase());
                  if (existingId) {
                    await api.schools.update(existingId, schoolData);
                    updatedCount++;
                  } else {
                    await api.schools.create(schoolData);
                    successCount++;
                  }
                } catch (err: any) {
                  errors.push(`Erro ao processar escola ${row["Nome da Escola"]}: ${translateFirebaseError(err)}`);
                }
              }));
              setProgress(prev => ({ ...prev, current: Math.min(i + chunkSize, jsonData.length) }));
            }
          }

          setResult({ success: successCount, updated: updatedCount, errors });
        } catch (err: any) {
          console.error("FileReader onload error:", err);
          setResult({ success: 0, updated: 0, errors: ["Falha ao processar arquivo: " + err.message] });
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setResult({ success: 0, updated: 0, errors: ["Erro na leitura do arquivo."] });
        setLoading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      console.error("handleImport error:", err);
      setResult({ success: successCount, updated: updatedCount, errors: [...errors, err.message] });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Centro de Importação</h2>
          <p className="text-slate-500 font-medium">Suba planilhas para atualização em massa do sistema.</p>
        </div>
        <button 
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-6 py-3 bg-white text-pedagogic-blue border border-pedagogic-blue/20 rounded-2xl hover:bg-pedagogic-blue/5 transition-all font-bold shadow-sm"
        >
          <FileDown size={20} /> Baixar Modelo Excel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-100 rounded-2xl mb-8 w-fit">
        <button
          onClick={() => { setImportType("students"); setResult(null); setFile(null); }}
          className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${importType === "students" ? "bg-white text-pedagogic-blue shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
        >
          Alunos
        </button>
        <button
          onClick={() => { setImportType("schools"); setResult(null); setFile(null); }}
          className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${importType === "schools" ? "bg-white text-pedagogic-blue shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
        >
          Escolas
        </button>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="border-4 border-dashed border-slate-50 rounded-[1.5rem] p-12 text-center hover:border-pedagogic-blue/20 transition-all group">
          <input 
            type="file" 
            id="fileInput" 
            className="hidden" 
            accept=".xlsx, .xls"
            onChange={handleFileChange}
          />
          <label 
            htmlFor="fileInput"
            className="cursor-pointer flex flex-col items-center"
          >
            <div className="w-20 h-20 bg-slate-50 text-slate-300 group-hover:bg-pedagogic-blue group-hover:text-white rounded-3xl flex items-center justify-center mb-6 transition-all shadow-inner">
              <FileUp size={32} />
            </div>
            <p className="text-xl font-black text-slate-800 tracking-tight">
              {file ? file.name : "Arraste sua planilha aqui"}
            </p>
            <p className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest">
              Importação de {importType === "students" ? "Alunos" : "Escolas"}
            </p>
          </label>
        </div>

        <div className={loading ? "mt-12" : "mt-12 flex justify-center"}>
          {loading ? (
            <div className="w-full space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Processando registros...</p>
                  <p className="text-2xl font-black text-pedagogic-blue">
                    {Math.round((progress.current / progress.total) * 100)}%
                  </p>
                </div>
                <Loader2 className="animate-spin text-pedagogic-blue" size={32} />
              </div>
              <div className="w-full bg-slate-50 rounded-full h-4 overflow-hidden border border-slate-100 shadow-inner">
                <div 
                  className="bg-gradient-to-r from-pedagogic-blue to-blue-400 h-full transition-all duration-300 shadow-lg"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>
              <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                {progress.current} de {progress.total} {importType === "students" ? "alunos" : "escolas"} processados
              </p>
            </div>
          ) : (
            <button 
              onClick={handleImport}
              disabled={!file || loading}
              className={`px-12 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3 shadow-xl ${
                !file || loading ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-pedagogic-blue text-white hover:bg-blue-800 shadow-blue-100'
              }`}
            >
              <FileUp size={20} /> Iniciar Importação
            </button>
          )}
        </div>

        {result && (
          <div className="mt-12 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-5">
                <div className="w-14 h-14 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-100">
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Novos Registros</p>
                  <p className="text-3xl font-black text-slate-800 tracking-tight">{result.success}</p>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-5">
                <div className="w-14 h-14 bg-pedagogic-blue text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100">
                  <Zap size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Atualizados</p>
                  <p className="text-3xl font-black text-slate-800 tracking-tight">{result.updated}</p>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-rose-50 p-8 rounded-[2rem] border border-rose-100">
                <div className="flex items-center gap-3 text-rose-800 font-black uppercase tracking-widest text-xs mb-6">
                  <AlertCircle size={20} />
                  {result.errors.length} Erros encontrados
                </div>
                <ul className="space-y-3">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i} className="flex gap-3 text-sm font-medium text-rose-700 bg-white/50 p-3 rounded-xl border border-rose-100/50">
                      <span className="w-5 h-5 bg-rose-100 text-rose-600 rounded-md flex items-center justify-center shrink-0 text-[10px] font-black">{i+1}</span>
                      {err}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <p className="text-xs font-bold text-rose-400 pt-2 italic text-center">... e mais {result.errors.length - 10} erros</p>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-pedagogic-blue/5 p-8 rounded-[2.5rem] border border-pedagogic-blue/10">
          <h4 className="font-black text-pedagogic-blue uppercase tracking-widest text-xs mb-4">Dicas de Importação</h4>
          <ul className="text-sm text-slate-600 space-y-3 font-medium">
            <li className="flex gap-3 items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-pedagogic-blue mt-1.5 shrink-0"></div>
              <span>Use sempre o <strong>modelo oficial</strong> para evitar erros de leitura das colunas.</span>
            </li>
            <li className="flex gap-3 items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-pedagogic-blue mt-1.5 shrink-0"></div>
              <span>O sistema identifica duplicados pelo <strong>{importType === "students" ? "RA" : "Nome da Escola"}</strong>.</span>
            </li>
          </ul>
        </div>
        <div className="bg-pedagogic-teal/5 p-8 rounded-[2.5rem] border border-pedagogic-teal/10">
          <h4 className="font-black text-pedagogic-teal uppercase tracking-widest text-xs mb-4">Campos Obrigatórios</h4>
          <div className="flex flex-wrap gap-2">
            {importType === "students" ? ['Nome', 'RA'].map(tag => (
              <span key={tag} className="px-3 py-1 bg-white rounded-lg text-[10px] font-black uppercase text-pedagogic-teal border border-pedagogic-teal/20">{tag}</span>
            )) : ['Nome da Escola'].map(tag => (
              <span key={tag} className="px-3 py-1 bg-white rounded-lg text-[10px] font-black uppercase text-pedagogic-teal border border-pedagogic-teal/20">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
