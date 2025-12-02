import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { CandidateReportData, RecruiterReportData } from './resumeAnalysis';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const colors = {
  primary: [41, 128, 185],
  secondary: [52, 73, 94],
  accent: [241, 196, 15],
  success: [39, 174, 96],
  warning: [230, 126, 34],
  danger: [231, 76, 60],
  light: [236, 240, 241],
  text: [44, 62, 80]
};

function initializePDF(title: string): jsPDF {
  const PDFConstructor = (jsPDF as any).default || jsPDF;
  const doc = new PDFConstructor();
  
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(title, doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });
  
  return doc;
}

function addPageBreak(doc: jsPDF, yPos: number, threshold: number = 30): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPos > pageHeight - threshold) {
    doc.addPage();
    return 25;
  }
  return yPos;
}

function addSection(doc: jsPDF, title: string, yPos: number): number {
  yPos = addPageBreak(doc, yPos, 35);
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 40;
  
  doc.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
  doc.rect(15, yPos - 8, contentWidth + 10, 20, 'F');
  
  doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setLineWidth(0.8);
  doc.rect(15, yPos - 8, contentWidth + 10, 20);
  
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, yPos + 5);
  
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  return yPos + 25;
}

function addScoreBar(doc: jsPDF, label: string, score: number, yPos: number): number {
  yPos = addPageBreak(doc, yPos);
  const barWidth = 120;
  const barHeight = 8;
  const scorePercentage = (score / 10) * 100;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(label, 20, yPos);
  
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(20, yPos + 3, barWidth, barHeight);
  
  const fillColor = score >= 7 ? colors.success : score >= 4 ? colors.warning : colors.danger;
  doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
  doc.rect(20, yPos + 3, (barWidth * score) / 10, barHeight, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.text(`${score.toFixed(1)}/10`, 145, yPos + 9);
  
  return yPos + 18;
}

function addBulletList(doc: jsPDF, items: string[], yPos: number): number {
  items.forEach(item => {
    yPos = addPageBreak(doc, yPos);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('•', 20, yPos);
    
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(item, 160);
    lines.forEach((line: string, index: number) => {
      if (index > 0) yPos = addPageBreak(doc, yPos + 6);
      doc.text(line, 30, yPos);
      if (index < lines.length - 1) yPos += 6;
    });
    yPos += 10;
  });
  return yPos;
}

export function generateCandidateReport(
  data: CandidateReportData,
  candidateName: string = "Candidate",
  interviewDate: Date = new Date()
): Uint8Array {
  const doc = initializePDF('Interview Performance Report - Candidate');
  let yPos = 50;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.text(`Report Date: ${interviewDate.toLocaleDateString()}`, 20, yPos);
  yPos += 20;
  
  yPos = addSection(doc, 'Overall Performance', yPos);
  yPos = addScoreBar(doc, 'Overall Score', data.overallScore, yPos);
  yPos += 5;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryLines = doc.splitTextToSize(data.summary, 160);
  summaryLines.forEach((line: string) => {
    yPos = addPageBreak(doc, yPos);
    doc.text(line, 20, yPos);
    yPos += 6;
  });
  yPos += 10;
  
  yPos = addSection(doc, 'Skills Assessment', yPos);
  yPos = addScoreBar(doc, 'Skills Demonstration Score', data.skillsDemonstration.score, yPos);
  yPos += 5;
  
  if (data.skillsDemonstration.claimedSkills.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Resume Skills:', 20, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.text(data.skillsDemonstration.claimedSkills.join(', '), 20, yPos, { maxWidth: 160 });
    yPos += 15;
  }
  
  if (data.skillsDemonstration.demonstratedSkills.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Skills Demonstrated in Interview:', 20, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.text(data.skillsDemonstration.demonstratedSkills.join(', '), 20, yPos, { maxWidth: 160 });
    yPos += 15;
  }
  
  yPos = addSection(doc, 'Resume Consistency Check', yPos);
  yPos = addScoreBar(doc, 'Consistency Score', data.consistencyCheck.score, yPos);
  yPos += 5;
  
  if (data.consistencyCheck.inconsistencies.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Areas Requiring Clarification:', 20, yPos);
    yPos += 8;
    yPos = addBulletList(doc, data.consistencyCheck.inconsistencies, yPos);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text('Your responses were consistent with your resume. Well done!', 20, yPos);
    yPos += 15;
  }
  
  yPos = addSection(doc, 'Communication Assessment', yPos);
  yPos = addScoreBar(doc, 'Clarity', data.communicationRating.clarity, yPos);
  yPos = addScoreBar(doc, 'Confidence', data.communicationRating.confidence, yPos);
  yPos = addScoreBar(doc, 'Depth of Answers', data.communicationRating.depth, yPos);
  yPos += 10;
  
  yPos = addSection(doc, 'Key Strengths', yPos);
  yPos = addBulletList(doc, data.strengths.length > 0 ? data.strengths : ['Continue building on your foundation'], yPos);
  
  yPos = addSection(doc, 'Areas for Improvement', yPos);
  yPos = addBulletList(doc, data.areasForImprovement.length > 0 ? data.areasForImprovement : ['Keep up the good work'], yPos);
  
  yPos = addPageBreak(doc, yPos + 20);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('This report is AI-generated and intended for developmental purposes.', 20, yPos);
  
  return new Uint8Array(doc.output('arraybuffer'));
}

export function generateRecruiterReport(
  data: RecruiterReportData,
  recruiterName: string = "Recruiter",
  interviewDate: Date = new Date()
): Uint8Array {
  const doc = initializePDF('Interview Quality Report - Recruiter');
  let yPos = 50;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.text(`Report Date: ${interviewDate.toLocaleDateString()}`, 20, yPos);
  yPos += 20;
  
  yPos = addSection(doc, 'Interview Effectiveness', yPos);
  yPos = addScoreBar(doc, 'Overall Effectiveness Score', data.overallScore, yPos);
  yPos += 5;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryLines = doc.splitTextToSize(data.summary, 160);
  summaryLines.forEach((line: string) => {
    yPos = addPageBreak(doc, yPos);
    doc.text(line, 20, yPos);
    yPos += 6;
  });
  yPos += 10;
  
  yPos = addSection(doc, 'Question Quality Analysis', yPos);
  yPos = addScoreBar(doc, 'Resume Relevance', data.questionQuality.resumeRelevance, yPos);
  yPos = addScoreBar(doc, 'Question Depth', data.questionQuality.depth, yPos);
  yPos = addScoreBar(doc, 'Candidate Engagement', data.questionQuality.engagement, yPos);
  yPos += 10;
  
  yPos = addSection(doc, 'Interview Coverage', yPos);
  
  if (data.interviewCoverage.experienceCovered.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Experience Areas Covered:', 20, yPos);
    yPos += 8;
    yPos = addBulletList(doc, data.interviewCoverage.experienceCovered, yPos);
  }
  
  if (data.interviewCoverage.skillsCovered.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Skills Assessed:', 20, yPos);
    yPos += 8;
    yPos = addBulletList(doc, data.interviewCoverage.skillsCovered, yPos);
  }
  
  if (data.interviewCoverage.missedOpportunities.length > 0) {
    yPos = addSection(doc, 'Missed Opportunities', yPos);
    doc.setFont('helvetica', 'normal');
    doc.text('Consider exploring these areas in future interviews:', 20, yPos);
    yPos += 8;
    yPos = addBulletList(doc, data.interviewCoverage.missedOpportunities, yPos);
  }
  
  yPos = addSection(doc, 'Interview Strengths', yPos);
  yPos = addBulletList(doc, data.effectiveness.strengths.length > 0 ? data.effectiveness.strengths : ['Good foundation for interviews'], yPos);
  
  yPos = addSection(doc, 'Recommendations for Improvement', yPos);
  yPos = addBulletList(doc, data.effectiveness.improvements.length > 0 ? data.effectiveness.improvements : ['Continue current approach'], yPos);
  
  yPos = addPageBreak(doc, yPos + 20);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('This report is AI-generated to help improve interview quality and candidate assessment.', 20, yPos);
  
  return new Uint8Array(doc.output('arraybuffer'));
}
