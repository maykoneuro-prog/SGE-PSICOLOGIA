import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const globalPdfMake: any = (pdfMake as any)?.default || pdfMake;
const globalPdfFonts: any = (pdfFonts as any)?.default || pdfFonts;

if (globalPdfMake && globalPdfFonts) {
  const vfs = globalPdfFonts.pdfMake?.vfs || globalPdfFonts.vfs;
  if (vfs) {
    globalPdfMake.vfs = vfs;
  }
}

export const exportToPDF = (appointment: any, student: any, professional: any) => {
  const docDefinition = {
    content: [
      { text: 'SGE Psicologia', style: 'header' },
      { text: 'Relatório de Atendimento', style: 'subheader' },
      { text: '\n' },
      {
        table: {
          widths: ['*'],
          body: [
            [{ text: 'DADOS DO ALUNO', fillcolor: '#004b93', color: 'white', bold: true }],
            [`Nome: ${student.name}`],
            [`RA: ${student.ra}`],
            [`Turma: ${student.class}`],
            [`Unidade: ${student.unit}`],
          ]
        }
      },
      { text: '\n' },
      {
        table: {
          widths: ['*'],
          body: [
            [{ text: 'DETALHES DO ATENDIMENTO', fillcolor: '#00a859', color: 'white', bold: true }],
            [`Data: ${format(new Date(appointment.date), "dd/MM/yyyy")}`],
            [`Tipo: ${appointment.type === 'psychological' ? 'Psicológico' : 'Pedagógico'}`],
            [`Profissional: ${professional.name}`],
          ]
        }
      },
      { text: '\n' },
      { text: 'DESCRIÇÃO:', bold: true },
      { text: appointment.description },
      { text: '\n\n\n' },
      { text: '__________________________________________', alignment: 'center' },
      { text: professional.name, alignment: 'center', bold: true },
      { text: professional.professionalCouncil || 'Responsável Técnico', alignment: 'center' },
    ],
    styles: {
      header: { fontSize: 18, bold: true, color: '#004b93', alignment: 'center' },
      subheader: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 5, 0, 15] }
    }
  };

  globalPdfMake.createPdf(docDefinition as any).download(`atendimento_${student.ra}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

export const exportToWord = async (appointment: any, student: any, professional: any) => {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: "SGE Psicologia", bold: true, size: 32, color: "004b93" })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: "Relatório de Atendimento", bold: true, size: 24 })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun({ text: "DADOS DO ALUNO", bold: true })] }),
        new Paragraph({ text: `Nome: ${student.name}` }),
        new Paragraph({ text: `RA: ${student.ra}` }),
        new Paragraph({ text: `Turma: ${student.class}` }),
        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun({ text: "DETALHES DO ATENDIMENTO", bold: true })] }),
        new Paragraph({ text: `Data: ${format(new Date(appointment.date), "dd/MM/yyyy")}` }),
        new Paragraph({ text: `Tipo: ${appointment.type === 'psychological' ? 'Psicológico' : 'Pedagógico'}` }),
        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun({ text: "DESCRIÇÃO:", bold: true })] }),
        new Paragraph({ text: appointment.description }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [new TextRun({ text: "__________________________________________" })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: professional.name, bold: true })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `atendimento_${student.ra}_${format(new Date(), 'yyyyMMdd')}.docx`;
  link.click();
};
