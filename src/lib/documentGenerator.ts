import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Initialize pdfMake fonts
// @ts-ignore
if (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) {
  // @ts-ignore
  (pdfMake as any).vfs = pdfFonts.pdfMake.vfs;
}

// SESI Logo (Base64 or URL)
const SESI_LOGO_URL = "https://www.pe.sesi.org.br/wp-content/themes/sesi-pe/assets/images/logo-sesi.png";

const getBase64ImageFromURL = (url: string, timeout = 5000): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = ""; // Stop loading
      reject(new Error("Timeout loading image"));
    }, timeout);

    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      clearTimeout(timer);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL("image/png");
      resolve(dataURL);
    };
    img.onerror = (error) => {
      clearTimeout(timer);
      reject(error);
    };
    img.src = url;
  });
};

export const generateDocumentPDF = async (doc: any, layout?: any, letterhead?: any, mode: 'download' | 'preview' = 'download') => {
  const { type, studentName, studentRa, studentClass, studentSchool, data, date, professionalName } = doc;
  const formattedDate = date ? format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  let logoBase64: string = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  
  try {
    const targetLogo = letterhead?.logoUrl || SESI_LOGO_URL;
    logoBase64 = await getBase64ImageFromURL(targetLogo);
  } catch (err) {
    console.error("Erro ao carregar logo:", err);
    try {
      logoBase64 = await getBase64ImageFromURL(SESI_LOGO_URL);
    } catch (e) {
      console.error("Erro ao carregar logo fallback:", e);
    }
  }

  let content: any[] = [
    { text: (doc.typeName || 'Documento').toUpperCase(), style: 'title', alignment: 'center', margin: [0, 0, 0, 20] as [number, number, number, number] },
  ];

  if (type === 'attendance_declaration') {
    content.push(
      { text: '\n\nDECLARAÇÃO\n\n', style: 'title', alignment: 'center' },
      { 
        text: [
          'Declaramos para os devidos fins que o(a) aluno(a) ',
          { text: studentName || '____________________', bold: true },
          `, compareceu ao setor de ${data?.sector || 'Psicologia Escolar'} no dia `,
          { text: date ? format(new Date(date), 'dd/MM/yyyy') : '--/--/----', bold: true },
          ' no horário das ',
          { text: data?.time || '--:--', bold: true },
          '.\n\n'
        ],
        alignment: 'justify',
        lineHeight: 1.5
      }
    );
    
    if (layout?.showDate !== false) {
      content.push({ text: `Recife, ${formattedDate}.\n\n`, alignment: 'right', margin: [0, 20, 0, 0] as [number, number, number, number] });
    }

    if (layout?.showProfessionalSignature !== false) {
      content.push(
        { text: '__________________________________________', alignment: 'center', margin: [0, 30, 0, 0] as [number, number, number, number] },
        { text: doc.professionalName || 'Responsável pelo Atendimento', alignment: 'center', bold: true, fontSize: 10 },
        { text: doc.professionalCouncil || '', alignment: 'center', style: 'small' }
      );
    }
  } else if (type === 'school_diagnosis') {
    content.push(
      { text: `ESCOLA: ${data?.school || '____________________'}`, style: 'field', bold: true, margin: [0, 5] },
      {
        columns: [
          { text: `DIRETOR(A): ${data?.director || '__________'}`, width: '60%', fontSize: 10 },
          { text: `CONTATO: ${data?.directorContact || '__________'}`, width: '40%', fontSize: 10 }
        ],
        margin: [0, 2]
      },
      {
        columns: [
          { text: `DIR. ADJUNTO(A): ${data?.assistantDirector || '__________'}`, width: '60%', fontSize: 10 },
          { text: `CONTATO: ${data?.assistantDirectorContact || '__________'}`, width: '40%', fontSize: 10 }
        ],
        margin: [0, 2, 0, 15]
      },
      { text: 'DIAGNÓSTICO SITUACIONAL', style: 'sectionHeader' },
      { text: 'MAIORES DIFICULDADES APRESENTADAS PELOS ALUNOS:', bold: true, fontSize: 11, margin: [0, 10, 0, 5] },
      {
        ul: (data?.dificuldades || []).length > 0 ? data.dificuldades : ['Nenhuma dificuldade registrada'],
        fontSize: 10,
        margin: [0, 0, 0, 10]
      },
      data?.otherDifficulties ? { text: `OUTROS: ${data.otherDifficulties}`, fontSize: 10, margin: [0, 0, 0, 10] } : {},

      { text: 'TEMAS JÁ ABORDADOS PELA ESCOLA:', bold: true, fontSize: 11, margin: [0, 10, 0, 5] },
      { text: data?.themesSelected || 'Não informado', fontSize: 10, margin: [0, 0, 0, 15] },

      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              { text: 'NOTA DE DESENVOLVIMENTO (MATURIDADE SOCIOEMOCIONAL)', bold: true, fontSize: 12, fillOpacity: 0.1, fillColor: '#f3f4f6' },
              { text: `${data?.score || '0.0'}/10`, bold: true, fontSize: 18, color: '#004a99', alignment: 'center' }
            ]
          ]
        },
        margin: [0, 10, 0, 20]
      }
    );

    if (data?.aiInsights && !data?.ocultarAI) {
      content.push(
        { text: 'PLANO DE AÇÃO ESTRATÉGICO (INSIGHTS IA)', style: 'sectionHeader', color: '#4f46e5' },
        {
          table: {
            widths: ['*'],
            body: [
              [{ 
                text: data.aiInsights, 
                fontSize: 10, 
                lineHeight: 1.4,
                margin: [5, 5, 5, 5]
              }]
            ]
          },
          layout: 'noBorders',
          fillColor: '#f5f7ff',
          margin: [0, 10]
        }
      );
    }

    if (data?.observations) {
      content.push(
        { text: 'OBSERVAÇÕES:', bold: true, fontSize: 11, margin: [0, 10, 0, 5] },
        { text: data?.observations, fontSize: 10 }
      );
    }

    if (layout?.showProfessionalSignature !== false) {
      content.push(
        { text: '', margin: [0, 30] },
        { text: '__________________________________________', alignment: 'center' },
        { text: doc.professionalName || 'Responsável pelo Atendimento', alignment: 'center', bold: true, fontSize: 10 },
        { text: doc.professionalCouncil || 'Registro não informado', alignment: 'center', style: 'small' }
      );
    }
  } else if (type === 'referral') {
    content.push(
      { text: `ALUNO: ${studentName || '____________________'}`, style: 'field', bold: true },
      { text: `RA: ${studentRa || '__________'}`, fontSize: 10, margin: [0, 2] },
      { text: `TURMA: ${studentClass || '__________'}`, fontSize: 10, margin: [0, 2] },
      { text: `ESCOLA: ${studentSchool || '__________'}`, fontSize: 10, margin: [0, 2, 0, 10] },
      { text: `DATA: ${date ? format(new Date(date), 'dd/MM/yyyy') : '--/--/----'}`, style: 'field', margin: [0, 0, 0, 20] as [number, number, number, number] },
      { text: 'ENCAMINHAMENTO', style: 'sectionHeader' },
      { text: `Ao: ${data?.destination || '____________________'}`, margin: [0, 10] as [number, number] },
      { text: 'Prezados,', margin: [0, 10] as [number, number] },
      { text: data?.objective || 'Solicitamos acompanhamento/avaliação para o referido aluno.', margin: [0, 10, 0, 40] as [number, number, number, number] },
      { text: 'Atenciosamente,', margin: [0, 20] as [number, number] }
    );

    if (layout?.showProfessionalSignature !== false) {
      content.push(
        { text: '__________________________________________', alignment: 'center', margin: [0, 30, 0, 0] as [number, number, number, number] },
        { text: doc.professionalName || 'Equipe de Psicologia Escolar - SESI/PE', alignment: 'center', bold: true, fontSize: 10 },
        { text: doc.professionalCouncil || '', alignment: 'center', style: 'small' }
      );
    }
  } else if (type === 'authorization_term') {
    content.push(
      { text: `ALUNO: ${studentName || '____________________'}`, style: 'field', bold: true },
      { text: `RA: ${studentRa || '__________'}`, fontSize: 10, margin: [0, 2] },
      { text: `TURMA: ${studentClass || '__________'}`, fontSize: 10, margin: [0, 2] },
      { text: `ESCOLA: ${studentSchool || '__________'}`, fontSize: 10, margin: [0, 2, 0, 15] },
      {
        text: [
          'Eu, ',
          { text: data?.guardianName || '__________________________________________', bold: true },
          ', responsável legal pelo(a) aluno(a) ',
          { text: studentName || '____________________', bold: true },
          ', autorizo a participação do referido estudante nas atividades de acompanhamento psicológico escolar (escutas, oficinas, grupos) realizadas pelo SESI/PE durante o ano letivo de ',
          { text: new Date().getFullYear().toString(), bold: true },
          '.\n\n'
        ],
        alignment: 'justify',
        lineHeight: 1.5
      }
    );

    if (layout?.showDate !== false) {
      content.push({ text: `Data: ${date ? format(new Date(date), 'dd/MM/yyyy') : '--/--/----'}`, margin: [0, 40] as [number, number] });
    }

    content.push(
      { text: '\n\n__________________________________________', alignment: 'center' },
      { text: 'Assinatura do Responsável', alignment: 'center', style: 'small' }
    );
  } else if (type === 'group_attendance') {
    const headerTitle = studentName === 'Atividade Coletiva' ? 'REGISTRO DE ATIVIDADE COLETIVA' : `MEDIADOR/PONTO FOCAL: ${studentName || '____________________'}`;
    content.push(
      { text: headerTitle, style: 'field', bold: true },
      { text: `DATA: ${date ? format(new Date(date), 'dd/MM/yyyy') : '--/--/----'}`, style: 'field', margin: [0, 2, 0, 15] as [number, number, number, number] },
      
      { text: 'DADOS DO GRUPO', style: 'sectionHeader' },
      { text: `NOME DO GRUPO: ${data?.groupName || 'Não informado'}`, fontSize: 11, bold: true, margin: [0, 5] },
      { text: `PARTICIPANTES: ${data?.otherParticipants || 'Somente o referencial'}`, fontSize: 10, margin: [0, 5, 0, 15] },

      { text: 'OBJETIVO', style: 'sectionHeader' },
      { text: data?.objective || 'Não reportado.', fontSize: 10, margin: [0, 5, 0, 15] },

      { text: 'SÍNTESE DO ATENDIMENTO', style: 'sectionHeader' },
      { text: data?.synthesis || 'Nenhum detalhe adicional registrado.', fontSize: 10, margin: [0, 5, 0, 30], lineHeight: 1.4 }
    );

    if (data?.aiDynamic && !data?.ocultarAI) {
      content.push(
        { text: 'SUGESTÃO DE DINÂMICA (IA)', style: 'sectionHeader', color: '#4f46e5' },
        { 
          table: {
            widths: ['*'],
            body: [[{
              text: data.aiDynamic,
              fontSize: 9,
              color: '#4f46e5',
              italics: true,
              margin: [10, 10, 10, 10] as [number, number, number, number]
            }]]
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#e2e8f0',
            vLineColor: () => '#e2e8f0',
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 8,
            paddingBottom: () => 8,
          },
          margin: [0, 5, 0, 20] as [number, number, number, number]
        }
      );
    }

    if (layout?.showProfessionalSignature !== false) {
      content.push(
        { text: '__________________________________________', alignment: 'center', margin: [0, 30, 0, 0] as [number, number, number, number] },
        { text: doc.professionalName || 'Profissional Responsável', alignment: 'center', bold: true, fontSize: 10 },
        { text: doc.professionalCouncil || '', alignment: 'center', style: 'small' }
      );
    }
  } else if (type === 'pedagogical_participation') {
    if (studentName === 'Atividade Coletiva') {
      content.push(
        { text: 'PARTICIPAÇÃO EM ATIVIDADE PEDAGÓGICA COLETIVA', style: 'field', bold: true },
        { text: `DATA: ${date ? format(new Date(date), 'dd/MM/yyyy') : '--/--/----'}`, style: 'field', margin: [0, 2, 0, 15] as [number, number, number, number] }
      );
    } else {
      content.push(
        { text: `ALUNO: ${studentName || '____________________'}`, style: 'field', bold: true },
        { text: `RA: ${studentRa || '__________'}`, fontSize: 10, margin: [0, 2] },
        { text: `TURMA: ${studentClass || '__________'}`, fontSize: 10, margin: [0, 2] },
        { text: `ESCOLA: ${studentSchool || '__________'}`, fontSize: 10, margin: [0, 2, 0, 10] },
        { text: `DATA: ${date ? format(new Date(date), 'dd/MM/yyyy') : '--/--/----'}`, style: 'field', margin: [0, 0, 0, 15] as [number, number, number, number] }
      );
    }
      
    content.push(
      { text: 'ATIVIDADE PEDAGÓGICA', style: 'sectionHeader' },
      { text: `TÍTULO: ${data?.activityTitle || 'Não especificado'}`, fontSize: 11, bold: true, margin: [0, 5] },
      
      { 
        columns: [
          { text: `OBJETIVO: ${data?.objective || 'N/A'}`, width: '50%', fontSize: 10 },
          { text: `NÍVEL DE PARTICIPAÇÃO: ${data?.participationLevel || 'N/A'}`, width: '50%', fontSize: 10 }
        ],
        margin: [0, 5, 0, 15]
      },

      { text: 'DESCRIÇÃO', style: 'sectionHeader' },
      { text: data?.activityDescription || 'Sem descrição.', fontSize: 10, margin: [0, 5, 0, 15] },

      { text: 'RESULTADOS E OBSERVAÇÕES', style: 'sectionHeader' },
      { text: data?.results || 'Sem resultados registrados.', fontSize: 10, margin: [0, 5, 0, 30], lineHeight: 1.4 }
    );

    if (data?.aiParecer && !data?.ocultarAI) {
      content.push(
        { text: 'PARECER PEDAGÓGICO (IA)', style: 'sectionHeader', color: '#059669' },
        { 
          table: {
            widths: ['*'],
            body: [[{
              text: data.aiParecer,
              fontSize: 9,
              color: '#059669',
              italics: true,
              margin: [10, 10, 10, 10] as [number, number, number, number]
            }]]
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#ecfdf5',
            vLineColor: () => '#ecfdf5',
            fillColor: () => '#f0fdf4',
          },
          margin: [0, 5, 0, 20] as [number, number, number, number]
        }
      );
    }

    if (layout?.showProfessionalSignature !== false) {
      content.push(
        { text: '__________________________________________', alignment: 'center', margin: [0, 30, 0, 0] as [number, number, number, number] },
        { text: doc.professionalName || 'Responsável', alignment: 'center', bold: true, fontSize: 10 },
        { text: doc.professionalCouncil || '', alignment: 'center', style: 'small' }
      );
    }
  } else if (type === 'psychological_listening') {
    content.push(
      { text: `ALUNO: ${studentName || '____________________'}`, style: 'field', bold: true },
      { text: `RA: ${studentRa || '__________'}`, fontSize: 10, margin: [0, 2] },
      { text: `TURMA: ${studentClass || '__________'}`, fontSize: 10, margin: [0, 2] },
      { text: `ESCOLA: ${studentSchool || '__________'}`, fontSize: 10, margin: [0, 2, 0, 10] },
      { text: `DATA: ${date ? format(new Date(date), 'dd/MM/yyyy') : '--/--/----'}`, style: 'field', margin: [0, 0, 0, 20] as [number, number, number, number] },
      
      { text: '1. MOTIVO DA ESCUTA', style: 'sectionHeader' },
      { 
        ul: [
          ...(data?.motivo || []),
          ...(data?.motivoOutros ? [`Outros: ${data.motivoOutros}`] : [])
        ].length > 0 ? [
          ...(data?.motivo || []),
          ...(data?.motivoOutros ? [`Outros: ${data.motivoOutros}`] : [])
        ] : ['Não informado'],
        fontSize: 10, margin: [0, 5, 0, 10]
      },

      { text: '2. ASPECTOS OBSERVADOS', style: 'sectionHeader' },
      { text: 'Comportamentais:', bold: true, fontSize: 10, margin: [0, 5, 0, 2] },
      { text: (data?.aspectosComportamentais || []).join(', ') || 'Nenhum registrado', fontSize: 9, margin: [0, 0, 0, 5] },
      
      { text: 'Sociais / Emocionais:', bold: true, fontSize: 10, margin: [0, 5, 0, 2] },
      { text: (data?.aspectosSociais || []).join(', ') || 'Nenhum registrado', fontSize: 9, margin: [0, 0, 0, 5] },
      
      { text: 'Aprendizagem / Cognitivos:', bold: true, fontSize: 10, margin: [0, 5, 0, 2] },
      { 
        text: [
          (data?.aspectosAprendizagem || []).join(', '),
          data?.outroTranstorno ? ` | Outro: ${data.outroTranstorno}` : ''
        ].filter(Boolean).join('') || 'Nenhum registrado', 
        fontSize: 9, margin: [0, 0, 0, 10] 
      },

      { text: '3. ENCAMINHAMENTOS', style: 'sectionHeader' },
      { 
        text: [
          (data?.encaminhamentos || []).join(', '),
          data?.encaminhamentosOutros ? ` | Outros: ${data.encaminhamentosOutros}` : ''
        ].filter(Boolean).join('') || 'Nenhum encaminhamento registrado',
        fontSize: 10, margin: [0, 5, 0, 10]
      },

      { text: '4. ORIENTAÇÕES / OBSERVAÇÕES', style: 'sectionHeader' },
      { text: data?.orientacoes || 'Sem observações registradas.', fontSize: 10, margin: [0, 5, 0, 10], lineHeight: 1.3 },

      { text: '5. AÇÕES POSTERIORES', style: 'sectionHeader' },
      {
        ul: [
          data?.acaoNovaEscuta ? `Nova Escuta - Data: ${data.dataNovaEscuta ? format(new Date(data.dataNovaEscuta), 'dd/MM/yyyy') : '___/___/___'} ${data.obsNovaEscuta ? `(${data.obsNovaEscuta})` : ''}` : null,
          data?.acaoOrientacao ? `Orientação a responsáveis - Data: ${data.dataOrientacao ? format(new Date(data.dataOrientacao), 'dd/MM/yyyy') : '___/___/___'}` : null,
          data?.acaoObservacao ? `Observação em sala de aula - Data: ${data.dataObservacao ? format(new Date(data.dataObservacao), 'dd/MM/yyyy') : '___/___/___'}` : null,
          data?.acaoOficina ? `Oficina / Grupo terapêutico` : null,
        ].filter(Boolean) as string[],
        fontSize: 10, margin: [0, 5, 0, 20]
      }
    );

    if (data?.aiInsights && !data?.ocultarAI) {
      content.push(
        { text: 'ANÁLISE PRELIMINAR (IA)', style: 'sectionHeader', color: '#4f46e5' },
        {
          table: {
            widths: ['*'],
            body: [
              [{ 
                text: data.aiInsights, 
                fontSize: 10, 
                lineHeight: 1.4,
                margin: [5, 5, 5, 5]
              }]
            ]
          },
          layout: 'noBorders',
          fillColor: '#f5f7ff',
          margin: [0, 10]
        }
      );
    }

    if (layout?.showProfessionalSignature !== false) {
      content.push(
        { text: '__________________________________________', alignment: 'center', margin: [0, 30, 0, 0] as [number, number, number, number] },
        { text: doc.professionalName || 'Responsável pelo Atendimento', alignment: 'center', bold: true, fontSize: 10 },
        { text: doc.professionalCouncil || '', alignment: 'center', style: 'small' }
      );
    }
  } else if (type === 'classroom_evolution') {
    content.push(
      { text: `ALUNO: ${studentName || '____________________'}`, style: 'field', bold: true },
      { text: `RA: ${studentRa || '__________'}`, fontSize: 10, margin: [0, 2] },
      { text: `TURMA: ${studentClass || '__________'}`, fontSize: 10, margin: [0, 2] },
      { text: `ESCOLA: ${studentSchool || '__________'}`, fontSize: 10, margin: [0, 2, 0, 10] },
      { text: `DATA: ${date ? format(new Date(date), 'dd/MM/yyyy') : '--/--/----'}`, style: 'field', margin: [0, 0, 0, 15] as [number, number, number, number] },
      { text: `PROFESSOR(A): ${data?.teacher || '____________________'}`, fontSize: 10, margin: [0, 0, 0, 20] }
    );

    const sections = [
      {
        title: '1. ASPECTOS COMPORTAMENTAIS',
        items: [
          { id: 'respeitaRegras', label: 'Respeita as regras de convivência' },
          { id: 'comportamentoAdequado', label: 'Apresenta comportamento adequado para o ambiente' },
          { id: 'resolveConflitos', label: 'Resolve conflitos de forma pacífica' },
        ]
      },
      {
        title: '2. ATENÇÃO E ORGANIZAÇÃO',
        items: [
          { id: 'mantemAtencao', label: 'Consegue manter a atenção durante a atividade' },
          { id: 'organizacaoMaterial', label: 'Demonstra organização no material/escrita' },
          { id: 'compreendeInstrucoes', label: 'Compreende instruções verbais e escritas' },
        ]
      },
      {
        title: '3. ATITUDE E PARTICIPAÇÃO',
        items: [
          { id: 'participaAtivamente', label: 'Participa ativamente das propostas' },
          { id: 'realizaEmpenho', label: 'Realiza as atividades com empenho' },
          { id: 'demonstraAutonomia', label: 'Demonstra autonomia na execução das tarefas' },
        ]
      },
      {
        title: '4. ASPECTOS SOCIAIS',
        items: [
          { id: 'interagePositivamente', label: 'Interage com colegas de forma positiva' },
          { id: 'prefereIsolado', label: 'Prefere ficar isolado(a)' },
          { id: 'trabalhaGrupo', label: 'Consegue trabalhar em grupo' },
          { id: 'respeitaEspaco', label: 'Respeita o espaço e os colegas' },
          { id: 'estabeleceVinculos', label: 'Estabelece vínculos de amizade' },
        ]
      },
      {
        title: '5. ASPECTOS DE APRENDIZAGEM',
        items: [
          { id: 'acompanhaRitmo', label: 'Acompanha o ritmo da turma' },
          { id: 'facilidadeLeitura', label: 'Apresenta facilidade em leitura' },
          { id: 'facilidadeEscrita', label: 'Apresenta facilidade em escrita' },
          { id: 'raciocinioLogico', label: 'Demonstra raciocínio lógico-matemático' },
          { id: 'apoioConstante', label: 'Precisa de apoio constante para realizar as atividades' },
        ]
      }
    ];

    sections.forEach(section => {
      content.push({ text: section.title, style: 'sectionHeader' });
      
      const tableBody = [
        [
          { text: 'Item', bold: true, fontSize: 9, fillColor: '#f9fafb' },
          { text: 'Sim', bold: true, fontSize: 9, alignment: 'center', fillColor: '#f9fafb' },
          { text: 'Não', bold: true, fontSize: 9, alignment: 'center', fillColor: '#f9fafb' },
          { text: 'Parcial', bold: true, fontSize: 9, alignment: 'center', fillColor: '#f9fafb' }
        ]
      ];

      section.items.forEach(item => {
        const val = data?.evolutionData?.[item.id];
        tableBody.push([
          { text: item.label, fontSize: 8 } as any,
          { text: val === 'sim' ? 'X' : '', alignment: 'center', fontSize: 10 } as any,
          { text: val === 'nao' ? 'X' : '', alignment: 'center', fontSize: 10 } as any,
          { text: val === 'parcial' ? 'X' : '', alignment: 'center', fontSize: 10 } as any
        ]);
      });

      content.push({
        table: {
          headerRows: 1,
          widths: ['61%', '13%', '13%', '13%'],
          body: tableBody
        },
        margin: [0, 5, 0, 10]
      });
    });

    if (data?.observacoes) {
      content.push(
        { text: 'OBSERVAÇÕES ADICIONAIS', style: 'sectionHeader' },
        { text: data.observacoes, fontSize: 10, margin: [0, 5, 0, 10] }
      );
    }

    if (data?.aiInsights && !data?.ocultarAI) {
      content.push(
        { text: 'ANÁLISE PRELIMINAR (IA)', style: 'sectionHeader', color: '#4f46e5' },
        {
          table: {
            widths: ['*'],
            body: [
              [{ 
                text: data.aiInsights, 
                fontSize: 10, 
                lineHeight: 1.4,
                margin: [5, 5, 5, 5]
              }]
            ]
          },
          layout: 'noBorders',
          fillColor: '#f5f7ff',
          margin: [0, 10]
        }
      );
    }

    if (layout?.showProfessionalSignature !== false) {
      content.push(
        { text: '__________________________________________', alignment: 'center', margin: [0, 30, 0, 0] as [number, number, number, number] },
        { text: doc.professionalName || 'Responsável pelo Atendimento', alignment: 'center', bold: true, fontSize: 10 },
        { text: doc.professionalCouncil || '', alignment: 'center', style: 'small' }
      );
    }
  } else {
    // Generic layout for others (Registro de Escuta, Observação, etc.)
    content.push(
      { text: `ALUNO: ${studentName || '____________________'}`, style: 'field', bold: true },
      { text: `RA: ${studentRa || '__________'}`, fontSize: 10, margin: [0, 2] },
      { text: `TURMA: ${studentClass || '__________'}`, fontSize: 10, margin: [0, 2] },
      { text: `ESCOLA: ${studentSchool || '__________'}`, fontSize: 10, margin: [0, 2, 0, 10] },
      { text: `DATA: ${date ? format(new Date(date), 'dd/MM/yyyy') : '--/--/----'}`, style: 'field', margin: [0, 0, 0, 20] as [number, number, number, number] },
      { text: 'DADOS DO DOCUMENTO', style: 'sectionHeader' }
    );

    if (data) {
      Object.entries(data).forEach(([key, value]: [string, any]) => {
        if (key === 'studentId') return;
        const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
        content.push({
          columns: [
            { text: label, width: '30%', bold: true, fontSize: 10 },
            { text: Array.isArray(value) ? value.join(', ') : String(value), width: '70%', fontSize: 10 }
          ],
          margin: [0, 5] as [number, number]
        });
      });
    }

    if (professionalName && layout?.showProfessionalSignature !== false) {
      content.push(
        { text: '\n\n__________________________________________', alignment: 'center', margin: [0, 40, 0, 0] as [number, number, number, number] },
        { text: professionalName, alignment: 'center', style: 'small' },
        { text: doc.professionalCouncil || '', alignment: 'center', style: 'small' }
      );
    }
  }

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [40, 140, 40, 60], // Aumentado para dar espaço ao timbrado no topo
    background: (currentPage: number) => {
      return {
        image: 'logo',
        width: 595, // Largura total da folha A4
        absolutePosition: { x: 0, y: 0 }
      };
    },
    content: content,
    images: {
      logo: logoBase64
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        stack: [
          { 
            columns: [
              { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', fontSize: 8, margin: [0, 0, 40, 0], width: '100%' }
            ]
          }
        ],
        margin: [0, 0, 0, 20]
      };
    },
    styles: {
      header: { fontSize: 11, bold: true, color: '#004a99' },
      subheader: { fontSize: 9, bold: true, color: '#004a99' },
      title: { fontSize: 16, bold: true, color: '#004a99', margin: [0, 20, 0, 20] },
      sectionHeader: { fontSize: 12, bold: true, background: '#f3f4f6', margin: [0, 10, 0, 5] },
      field: { fontSize: 11, margin: [0, 2] },
      small: { fontSize: 10, color: '#666666' }
    },
    defaultStyle: {
      fontSize: 11,
      lineHeight: 1.2
    }
  };

  try {
    const pdf = pdfMake.createPdf(docDefinition);
    if (mode === 'download') {
      pdf.download(`${type || 'documento'}_${(studentName || 'aluno').replace(/\s+/g, '_')}.pdf`);
    } else {
      pdf.open();
    }
  } catch (pdfError) {
    console.error("Erro ao gerar PDF com pdfMake:", pdfError);
    alert("Erro ao gerar o arquivo PDF. Por favor, verifique os dados e tente novamente.");
  }
};
