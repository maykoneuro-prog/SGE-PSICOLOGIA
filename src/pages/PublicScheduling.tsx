import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { ClipboardCheck, AlertCircle, CheckCircle2 } from "lucide-react";

export default function PublicScheduling() {
  const [searchParams] = useSearchParams();
  const schoolId = searchParams.get("schoolId");
  
  const [school, setSchool] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    studentName: "",
    studentRA: "",
    studentPhone: "",
    categoryId: "",
    notes: ""
  });

  useEffect(() => {
    const loadData = async () => {
      if (!schoolId) {
        setError("Escola não identificada. Por favor, utilize o QR Code correto.");
        setLoading(false);
        return;
      }

      try {
        const [schools, cats] = await Promise.all([
          api.schools.list(),
          api.categories.list()
        ]);
        
        const foundSchool = schools.find((s: any) => s.id === schoolId);
        if (!foundSchool) {
          setError("Escola não encontrada.");
        } else {
          setSchool(foundSchool);
        }
        setCategories(cats || []);
      } catch (err) {
        console.error(err);
        setError("Erro ao carregar dados da escola.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [schoolId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentRA || !formData.categoryId) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await api.schedulingRequests.create({
        ...formData,
        schoolId,
        unit: school?.unit || school?.name || "", 
        schoolUnit: school?.unit || school?.name || "",
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError("Erro ao enviar solicitação. Tente novamente mais tarde.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-sesi-blue animate-pulse font-bold">Carregando...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Solicitação Enviada!</h2>
          <p className="text-gray-600 mt-4">
            Sua solicitação de atendimento para a escola <strong>{school?.name}</strong> foi enviada com sucesso. 
            Aguarde o contato da secretaria para confirmação do horário.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 w-full bg-sesi-blue text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
          >
            Nova Solicitação
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sesi-blue flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-sesi-blue">Agendamento</h2>
          <p className="text-gray-500 mt-2">
            {school ? `Solicitação para: ${school.name}` : "Solicitação de Atendimento"}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-start gap-3 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!school && !loading ? (
          <div className="text-center text-gray-500 py-8">
            Não foi possível identificar a escola. Por favor, utilize o QR Code oficial da sua secretaria.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seu Nome Completo</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                placeholder="Digite seu nome completo"
                value={formData.studentName}
                onChange={(e) => setFormData({...formData, studentName: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seu RA (Registro Acadêmico)</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                placeholder="Digite seu RA"
                value={formData.studentRA}
                onChange={(e) => setFormData({...formData, studentRA: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp para Contato</label>
              <input 
                type="tel" 
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                placeholder="(81) 99999-9999"
                value={formData.studentPhone}
                onChange={(e) => setFormData({...formData, studentPhone: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria do Atendimento</label>
              <select 
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                value={formData.categoryId}
                onChange={(e) => setFormData({...formData, categoryId: e.target.value})}
              >
                <option value="">Selecione uma categoria</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações (Opcional)</label>
              <textarea 
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-sesi-blue outline-none"
                rows={3}
                placeholder="Conte-nos brevemente o motivo do atendimento"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              ></textarea>
            </div>
            <button 
              type="submit"
              disabled={submitting}
              className={`w-full bg-sesi-green hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {submitting ? "Enviando..." : (
                <>
                  <ClipboardCheck size={20} />
                  Solicitar Atendimento
                </>
              )}
            </button>
          </form>
        )}
      </div>
      
      <div className="mt-8 text-white/60 text-sm text-center max-w-xs">
        Este serviço é exclusivo para alunos devidamente matriculados. 
        Seus dados estão protegidos conforme a LGPD.
      </div>
    </div>
  );
}
