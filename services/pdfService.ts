import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { TpSession, LevelCode, CompetencyDef, ExamDef, Student, CompetencyCode, LevelDetails, StudentInternship, InternshipPeriod, ActivityDefWithTasks } from "../types";

// FIX: Replaced LevelCode.EA with LevelCode.IA and updated colors for consistency with the application.
const levelColors: Record<string, string> = {
    [LevelCode.NA]: '#ef4444', // red-500
    [LevelCode.IA]: '#fb923c', // orange-400
    [LevelCode.PA]: '#facc15', // yellow-400
    [LevelCode.TA]: '#059669', // emerald-600
    [LevelCode.NE]: '#e5e7eb', // gray-200
};

// --- PRIVATE HELPER FUNCTIONS ---

const _checkPageBreak = (doc: jsPDF, currentY: number, heightNeeded: number): number => {
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20; // Increased margin for safety
    if (currentY + heightNeeded > pageHeight - margin) {
        doc.addPage();
        return 20; // New Y position
    }
    return currentY;
};

const _drawSignatureBlock = (doc: jsPDF, margin: number, contentWidth: number, currentY: number): number => {
    let y = _checkPageBreak(doc, currentY, 45);
    
    y += 5;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(0, 0, 0);
    doc.text(`Date : ${new Date().toLocaleDateString()}`, margin, y);
    y += 8;

    const colWidth = contentWidth / 2;
    const rowHeight = 20;
    const headerHeight = 8;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    
    // Left header
    doc.rect(margin, y, colWidth, headerHeight, 'S');
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text("Nom(s) Prénom(s) professeurs d'Atelier", margin + colWidth / 2, y + 5.5, { align: "center" });
    
    // Right header
    doc.rect(margin + colWidth, y, colWidth, headerHeight, 'S');
    doc.text("Signature(s)", margin + colWidth + colWidth / 2, y + 5.5, { align: "center" });
    
    y += headerHeight;

    // Empty boxes
    doc.rect(margin, y, colWidth, rowHeight, 'S');
    doc.rect(margin + colWidth, y, colWidth, rowHeight, 'S');
    
    return y + rowHeight;
};

/**
 * Draws text that may contain {{marked answers}} in red.
 * Handles word wrapping to ensure text stays within maxWidth.
 */
const _drawMarkedupText = (doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number = 5): number => {
    const redColor = [220, 38, 38]; // #dc2626
    const blackColor = [0, 0, 0];

    // Split by {{ and }} to separate normal text from answers
    // Example: "Question {{Answer}} end." -> ["Question ", "{{Answer}}", " end."]
    const parts = text.split(/(\{\{.*?\}\})/g);
    
    let currentX = x;
    let currentY = y;
    const startX = x;
    
    // Helper to check if a string is a marked answer
    const isAnswer = (str: string) => str.startsWith('{{') && str.endsWith('}}');

    parts.forEach(part => {
        if (!part) return;

        let content = part;
        let isMarked = false;

        if (isAnswer(part)) {
            isMarked = true;
            content = part.slice(2, -2);
            doc.setTextColor(redColor[0], redColor[1], redColor[2]);
            doc.setFont("helvetica", "bold");
        } else {
            doc.setTextColor(blackColor[0], blackColor[1], blackColor[2]);
            doc.setFont("helvetica", "normal");
        }

        // Split content into words/spaces to manage wrapping
        // We split by space but keep the delimiter to preserve exact spacing
        const tokens = content.split(/(\s+)/);
        
        tokens.forEach(token => {
            if (!token) return;
            
            const tokenWidth = doc.getTextWidth(token);
            
            // Check if adding this token exceeds the max width
            if (currentX + tokenWidth > startX + maxWidth) {
                // Move to next line
                currentY += lineHeight;
                currentX = startX;
                
                // If it's a space at the start of a new line, ignore it (visual cleanup)
                if (/^\s+$/.test(token)) {
                    return; 
                }
                
                doc.text(token, currentX, currentY);
                currentX += tokenWidth;
            } else {
                doc.text(token, currentX, currentY);
                currentX += tokenWidth;
            }
        });
    });

    // Reset to default style
    doc.setTextColor(blackColor[0], blackColor[1], blackColor[2]);
    doc.setFont("helvetica", "normal");

    // Return the Y position of the *next* line after this block
    // We add extra line height only if we actually drew something
    return currentY + lineHeight; 
};

const _drawEvaluationGrid = (
    doc: jsPDF,
    startY: number,
    session: TpSession,
    competencies: CompetencyDef[] = [],
    type: 'student' | 'teacher' | 'student-response'
): number => {
    let y = startY;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    y = _checkPageBreak(doc, y, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("GRILLE D'ÉVALUATION", margin, y);
    y += 10;

    const colWidths = { 
        criterion: contentWidth - 80, 
        competency: 20, 
        grade: 12 
    };
    const grades = [LevelCode.NA, LevelCode.IA, LevelCode.PA, LevelCode.TA, LevelCode.NE];
    const headerHeight = 10;

    doc.setFillColor("#F0F0F0");
    doc.rect(margin, y, contentWidth, headerHeight, 'F');
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    
    let currentX = margin;
    doc.text("Critères d'évaluation", currentX + 2, y + 6);
    currentX += colWidths.criterion;
    
    doc.text("Comp.", currentX + (colWidths.competency - doc.getTextWidth("Comp.")) / 2, y + 6);
    currentX += colWidths.competency;

    grades.forEach((g) => {
        const textWidth = doc.getTextWidth(g);
        const textX = currentX + (colWidths.grade - textWidth) / 2;
        doc.text(g, textX, y + 5);
        const color = levelColors[g];
        if (color) {
            doc.setFillColor(color);
            doc.rect(currentX + 2, y + 7, colWidths.grade - 4, 1.5, 'F');
        }
        currentX += colWidths.grade;
    });
    y += headerHeight;

    doc.setFont("helvetica", "normal");
    (session.evaluations || []).forEach(ev => {
        const criteriaLines = doc.setFontSize(9).splitTextToSize(ev.comment || "...", colWidths.criterion - 4);
        const rowHeight = Math.max(10, criteriaLines.length * 4 + 4);
        y = _checkPageBreak(doc, y, rowHeight);
        
        doc.setTextColor(50, 50, 50);
        doc.text(criteriaLines, margin + 2, y + 6);

        currentX = margin + colWidths.criterion;
        doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(0,0,0);
        doc.text(ev.competencyCode, currentX + (colWidths.competency - doc.getTextWidth(ev.competencyCode)) / 2, y + rowHeight / 2 + 3);
        currentX += colWidths.competency;
        
        doc.setFont("helvetica", "normal");
        grades.forEach((g) => {
            const x = currentX + colWidths.grade / 2;
            const cy = y + (rowHeight / 2);
            doc.setDrawColor("#969696");
            if ((type === 'teacher' && ev.level === g)) {
                doc.setFillColor("#323232");
                doc.circle(x, cy, 2, 'FD');
            } else {
                doc.setFillColor("#FFFFFF");
                doc.circle(x, cy, 2, 'S');
            }
            currentX += colWidths.grade;
        });

        doc.setDrawColor("#E6E6E6");
        doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
        y += rowHeight;
    });
    return y;
};


// --- PUBLIC EXPORTED FUNCTIONS ---

export const generateInternshipReportPdf = (
    student: Student,
    internship: StudentInternship,
    period: InternshipPeriod,
    allCompetencies: CompetencyDef[],
    levels: Record<LevelCode, LevelDetails>,
    observationCriteria: any[]
) => {
    try {
        const doc = new jsPDF();
        let y = 20;
        const margin = 15;
        const pageWidth = doc.internal.pageSize.width;
        const contentWidth = pageWidth - margin * 2;

        // --- PDF Header ---
        doc.setFontSize(22).setFont("helvetica", "bold").setTextColor(49, 46, 129); // indigo-900
        doc.text(`Bilan de Stage - ${period.title}`, margin, y);
        y += 10;
        doc.setFontSize(16).setFont("helvetica", "normal").setTextColor(31, 41, 55); // gray-800
        doc.text(`${student.lastName} ${student.firstName}`, margin, y);
        y += 8;
        doc.setFontSize(12).setTextColor(107, 114, 128); // gray-500
        doc.text(internship.companyName || "Entreprise non renseignée", margin, y);
        y += 15;

        const drawSectionHeader = (title: string) => {
            y = _checkPageBreak(doc, y, 15);
            doc.setFillColor(243, 244, 246); // gray-100
            doc.rect(margin, y, contentWidth, 10, 'F');
            doc.setFontSize(12).setFont("helvetica", "bold").setTextColor(17, 24, 39); // gray-900
            doc.text(title, margin + 5, y + 7);
            y += 15;
        };

        // --- Informations Stage ---
        drawSectionHeader("Informations sur le Stage");
        doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(55, 65, 81); // gray-700
        const info = [
            { label: "Entreprise:", value: internship.companyName },
            { label: "Adresse:", value: internship.companyAddress },
            { label: "Tuteur:", value: internship.tutorName },
            { label: "Téléphone:", value: internship.tutorPhone },
        ];
        info.forEach(item => {
            if (item.value) {
                doc.setFont("helvetica", "bold").text(item.label, margin, y);
                doc.setFont("helvetica", "normal").text(item.value, margin + 35, y);
                y += 7;
            }
        });
        y += 5;

        // --- Évaluation par Compétences ---
        drawSectionHeader("Évaluation par Compétences");
        if (internship.preEvaluation || internship.tutorEvaluation) {
            const col1X = margin;
            const col2X = margin + contentWidth - 60;
            const col3X = margin + contentWidth - 30;

            doc.setFontSize(9).setFont("helvetica", "bold").setTextColor(107, 114, 128);
            doc.text("Compétence", col1X, y);
            doc.text("Pos. Prof", col2X, y);
            doc.text("Éval. Tuteur", col3X, y);
            y += 5;
            doc.setDrawColor(229, 231, 235).line(margin, y, margin + contentWidth, y);
            y += 5;

            doc.setFontSize(9).setFont("helvetica", "normal");
            allCompetencies.forEach(compDef => {
                const preEvalItem = internship.preEvaluation?.competencies.find(c => c.competencyCode === compDef.code);
                const tutorEvalItem = internship.tutorEvaluation?.competencies.find(c => c.competencyCode === compDef.code);

                if (preEvalItem || tutorEvalItem) {
                    const lines = doc.splitTextToSize(`${compDef.code}: ${compDef.label}`, col2X - col1X - 5);
                    const rowHeight = Math.max(10, lines.length * 4);
                    y = _checkPageBreak(doc, y, rowHeight);
                    doc.setTextColor(55, 65, 81);
                    doc.text(lines, col1X, y + 4);
                    doc.setFont("helvetica", "bold");

                    [
                        { eval: preEvalItem, x: col2X },
                        { eval: tutorEvalItem, x: col3X }
                    ].forEach(({ eval: evalItem, x }) => {
                        const level = evalItem?.level ?? LevelCode.NE;
                        doc.setFillColor(levelColors[level] || '#FFFFFF');
                        const textColor = (level === LevelCode.PA || level === LevelCode.IA) ? '#000000' : '#FFFFFF';
                        doc.setTextColor(level === LevelCode.NE ? '#6b7280' : textColor);
                        doc.roundedRect(x - 5, y, 22, 7, 3, 3, 'FD');
                        doc.text(level, x + 6, y + 5, { align: 'center' });
                    });

                    doc.setTextColor(0, 0, 0);
                    y += rowHeight + 2;
                }
            });

            if (internship.tutorEvaluation?.tutorComment) {
                y += 5;
                doc.setFont("helvetica", "bold").text("Commentaire Tuteur:", margin, y);
                y += 5;
                doc.setFont("helvetica", "normal").setTextColor(55, 65, 81);
                const commentLines = doc.splitTextToSize(internship.tutorEvaluation.tutorComment, contentWidth);
                y = _checkPageBreak(doc, y, commentLines.length * 5);
                doc.text(commentLines, margin, y);
                y += commentLines.length * 4;
            }
            y += 5;
        } else {
            doc.setFontSize(10).setFont("helvetica", "italic").setTextColor(107, 114, 128).text("L'évaluation n'a pas encore commencé.", margin, y);
            y += 10;
        }
        
        // --- Signature ---
        if (internship.tutorEvaluation?.tutorSignature) {
            drawSectionHeader("Signature du Tuteur");
            try {
                let format = internship.tutorEvaluation.tutorSignature.includes('image/png') ? 'PNG' : 'JPEG';
                doc.addImage(internship.tutorEvaluation.tutorSignature, format, margin, y, 60, 30);
                y += 35;
            } catch(e) { console.error("Could not add signature image to PDF"); }
        }


        // --- Compte Rendu de Visite ---
        if(internship.visitReport) {
            y = _checkPageBreak(doc, y, 30);
            if (y < 200) { doc.addPage(); y = 20;}

            drawSectionHeader("Compte Rendu de Visite");
            const drawTextAreaContent = (label: string, content: string | undefined) => {
                if (!content) return;
                y = _checkPageBreak(doc, y, 20);
                doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(55, 65, 81);
                doc.text(label, margin, y);
                y += 7;
                doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(75, 85, 99);
                const lines = doc.splitTextToSize(content, contentWidth);
                const boxHeight = lines.length * 5 + 8;
                y = _checkPageBreak(doc, y, boxHeight);
                doc.setFillColor(249, 250, 251).setDrawColor(229, 231, 235).rect(margin, y, contentWidth, boxHeight, 'FD');
                doc.text(lines, margin + 3, y + 5);
                y += boxHeight + 7;
            };
            drawTextAreaContent("Activités de l'élève", internship.visitReport?.studentActivities);
            drawTextAreaContent("Appréciation générale", internship.visitReport?.generalAppreciation);

            y += 5;
            doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(55, 65, 81);
            doc.text("Observations du Tuteur", margin, y);
            y += 10;
            const optionWidth = contentWidth / 3;
            observationCriteria.forEach((criterion: any) => {
                y = _checkPageBreak(doc, y, 15);
                doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(107, 114, 128).text(criterion.label, margin, y);
                y += 7;

                const selectedOption = internship.visitReport?.tutorObservations?.[criterion.key];
                criterion.options.forEach((option: string, index: number) => {
                    const x = margin + (index * optionWidth);
                    const isSelected = selectedOption === option;
                    doc.setFillColor(isSelected ? '#4f46e5' : '#FFFFFF').setDrawColor('#d1d5db');
                    doc.roundedRect(x, y, optionWidth - 2, 8, 2, 2, 'FD');
                    doc.setTextColor(isSelected ? '#FFFFFF' : '#4b5563').setFontSize(8).setFont('helvetica', isSelected ? 'bold' : 'normal');
                    doc.text(option, x + optionWidth / 2, y + 5, { align: 'center' });
                });
                y += 12;
            });
        }
        
        // --- Final Grades Summary ---
        y = _checkPageBreak(doc, y, 80);
        if (y < 150) { doc.addPage(); y = 20; }
        drawSectionHeader("Récapitulatif des Notes");
        const finalGrade = (internship.tutorEvaluation?.globalGrade ?? 0) + (internship.visitReportGrade ?? 0) + (internship.portfolioGrade ?? 0);
        
        const drawGradeRow = (label: string, grade: number | undefined, max: number, sublabel?: string) => {
            doc.setFillColor(249, 250, 251).setDrawColor(229, 231, 235).rect(margin, y, contentWidth, 12, 'FD');
            doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(75, 85, 99);
            const labelY = sublabel ? y + 5 : y + 8;
            doc.text(label, margin + 5, labelY);
            if (sublabel) {
                doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(156, 163, 175);
                doc.text(sublabel, margin + 5, y + 10);
            }
            doc.setFontSize(14).setFont('helvetica', 'bold').setTextColor(21, 128, 61); // green-700
            doc.text(`${(grade ?? 0).toFixed(2)} / ${max}`, margin + contentWidth - 5, y + 9, {align: 'right'});
            y += 14;
        };

        drawGradeRow("Note Compétences", internship.tutorEvaluation?.globalGrade, 10, "(Hors NE)");
        drawGradeRow("Note Observations Tuteur", internship.visitReportGrade, 5);
        drawGradeRow("Note Portfolio & Soutenance", internship.portfolioGrade, 5);

        y += 2;
        doc.setFillColor(224, 231, 255).setDrawColor(199, 210, 254).rect(margin, y, contentWidth, 18, 'FD');
        doc.setFontSize(14).setFont('helvetica', 'bold').setTextColor(67, 56, 202); // indigo-800
        doc.text("Note Finale de Stage", margin + 5, y + 12);
        doc.setFontSize(20).text(`${finalGrade.toFixed(2)} / 20`, margin + contentWidth - 5, y + 13, { align: 'right' });

        doc.save(`Bilan_Stage_${student.lastName}_${student.firstName}.pdf`);

    } catch (error) {
        console.error("Failed to generate Internship Report PDF:", error);
        alert("Une erreur est survenue lors de la génération du PDF.");
    }
};

export const generateSimpleSessionPdf = (session: TpSession, establishmentLogo?: string) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);
        let y = 20;

        if (establishmentLogo) {
            try {
                const logoSize = 20;
                let format = establishmentLogo.includes('image/png') ? 'PNG' : 'JPEG';
                doc.addImage(establishmentLogo, format, margin, y, logoSize, logoSize, undefined, 'FAST');
                y += logoSize + 5;
            } catch (e) { console.error("Error adding logo to PDF", e); }
        }

        doc.setFont("helvetica", "bold").setFontSize(18);
        const titleLines = doc.splitTextToSize(session.title.toUpperCase(), contentWidth);
        doc.text(titleLines, margin, y);
        y += (titleLines.length * 8) + 5;

        doc.setFont("helvetica", "normal").setFontSize(10);
        const details = [
            `Type: ${session.sequenceType}`,
            `Durée: ${session.duration}`,
            `Public: ${session.targetAudience}`,
            `Date: ${new Date(session.date).toLocaleDateString()}`
        ].join(' | ');
        doc.text(details, margin, y);
        y += 10;
        doc.setDrawColor("#C8C8C8").line(margin, y, pageWidth - margin, y);
        y += 15;

        const lines = (session.content || '').split('\n');
        lines.forEach(line => {
            const trimmedLine = line.trim();
            y = _checkPageBreak(doc, y, 6);

            if (trimmedLine.startsWith('## ')) {
                doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(30, 41, 59);
                doc.text(trimmedLine.substring(3), margin, y);
                y += 8;
            } else if (trimmedLine.startsWith('### ')) {
                doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(51, 65, 85);
                doc.text(trimmedLine.substring(4), margin, y);
                y += 7;
            } else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
                doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(0, 0, 0);
                doc.text(`• ${trimmedLine.substring(2)}`, margin + 5, y, { maxWidth: contentWidth - 5 });
                const textLines = doc.splitTextToSize(`• ${trimmedLine.substring(2)}`, contentWidth - 5);
                y += textLines.length * 5;
            } else {
                 doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(0, 0, 0);
                 const textLines = doc.splitTextToSize(trimmedLine, contentWidth);
                 doc.text(textLines, margin, y);
                 y += textLines.length * 5;
            }
        });
        
        doc.save(`Sequence_${session.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (error) {
        console.error("Failed to generate simple session PDF:", error);
        alert("Une erreur est survenue lors de la génération du PDF.");
    }
};

export const generateTpPdf = (session: TpSession, type: 'student' | 'teacher', establishmentLogo?: string, competencies?: CompetencyDef[], activities?: ActivityDefWithTasks[]) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    const fullContentWidth = pageWidth - (margin * 2);
    let y = 20;

    // --- HEADER ---
    const initialY = y;
    let headerTextWidth = fullContentWidth;
    let headerTextX = margin;

    if (establishmentLogo) {
        const logoSize = 20;
        try {
            let format = establishmentLogo.includes('image/png') ? 'PNG' : 'JPEG';
            doc.addImage(establishmentLogo, format, margin, y, logoSize, logoSize, undefined, 'FAST');
            headerTextX = margin + logoSize + 5;
            headerTextWidth -= (logoSize + 5);
        } catch (e) { console.error("Error adding logo to PDF", e); }
    }

    if (session.supportImage) {
        const imgWidth = 50;
        const imgHeight = 50;
        const imgX = pageWidth - margin - imgWidth;
        try {
            let format = session.supportImage.includes('image/png') ? 'PNG' : 'JPEG';
            doc.addImage(session.supportImage, format, imgX, y, imgWidth, imgHeight, undefined, 'FAST');
            headerTextWidth -= (imgWidth + 10);
        } catch (e) { console.error("Error adding image to PDF", e); }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const titleLines = doc.splitTextToSize(session.title.toUpperCase(), headerTextWidth);
    doc.text(titleLines, headerTextX, y + 5);
    let textY = y + 8 + (titleLines.length * 7);

    // --- METADATA BADGES (GABARIT STYLE) ---
    const badgesToRender = [
        { label: 'Public', value: session.targetAudience || 'Niveau Bac Pro' },
        { label: 'Durée', value: session.duration || 'N/C' },
        { label: 'Date', value: new Date(session.date).toLocaleDateString('fr-FR') },
        { label: 'Auteur', value: session.studentName || 'Enseignant' }
    ];

    if (session.activities && session.activities.length > 0) {
        badgesToRender.push({ label: 'Activités', value: session.activities.join(', ') });
    }

    const uniqueCompetencies = Array.from(new Set(session.evaluations.map(e => e.competencyCode))).sort((a, b) => {
        const numA = parseInt((a as string).replace(/\D/g, '')) || 0;
        const numB = parseInt((b as string).replace(/\D/g, '')) || 0;
        return numA - numB;
    });

    if (uniqueCompetencies.length > 0) {
        badgesToRender.push({ label: 'Compétences', value: uniqueCompetencies.join(', ') });
    }

    let currentX = headerTextX;
    doc.setFontSize(9);
    
    badgesToRender.forEach(badge => {
        const badgeText = `${badge.label}: ${badge.value}`;
        doc.setFont("helvetica", "normal");
        const textWidth = doc.getTextWidth(badgeText);
        const badgeWidth = textWidth + 6;
        
        if (currentX + badgeWidth > headerTextX + headerTextWidth) {
            textY += 10;
            currentX = headerTextX;
        }

        doc.setFillColor(243, 244, 246); // gray-100
        doc.setTextColor(100, 116, 139); // slate-500
        doc.roundedRect(currentX, textY, badgeWidth, 7, 3, 3, 'F');
        doc.text(badgeText, currentX + 3, textY + 5);
        
        currentX += badgeWidth + 4;
    });
    
    textY += 15;

    const roleTitle = type === 'teacher' ? "VERSION PROFESSEUR" : "VERSION ÉLÈVE";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    if (type === 'teacher') doc.setTextColor(220, 38, 38); 
    else doc.setTextColor(0, 0, 0);
    doc.text(roleTitle, headerTextX, textY);
    doc.setTextColor(0, 0, 0);
    
    y = Math.max(textY + 5, initialY + 50 + 10);
    doc.setDrawColor("#C8C8C8");
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    if (session.objectives && session.objectives.length > 0) {
        y = _checkPageBreak(doc, y, 30);
        doc.setFont("helvetica", "bold").setFontSize(10).text("OBJECTIFS PÉDAGOGIQUES", margin, y);
        y += 6;
        doc.setFont("helvetica", "normal").setFontSize(9);
        session.objectives.forEach(obj => {
            const lines = doc.splitTextToSize(`• ${obj}`, fullContentWidth);
            y = _checkPageBreak(doc, y, lines.length * 5);
            doc.text(lines, margin, y);
            y += lines.length * 5;
        });
        y += 8;
    }

    doc.setFont("helvetica", "bold").setFontSize(11).text("DÉROULEMENT DES ACTIVITÉS", margin, y);
    y += 10;

    if (session.sessionActivities) {
        session.sessionActivities.forEach((act, index) => {
            
            const headerHeight = 12;

            y = _checkPageBreak(doc, y, 40);
            doc.setFillColor("#F5F7FA").rect(margin, y - 5, fullContentWidth, headerHeight, 'F');
            
            const cleanTitle = act.title.replace(/^(Activité|Activity)\s*\d+\s*[:\-]?\s*/i, '').trim();
            
            doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0,0,0).text(`Activité ${index + 1}: ${cleanTitle}`, margin + 2, y + 3);
            doc.setFont("helvetica", "normal").text(String(act.duration), pageWidth - margin - doc.getTextWidth(String(act.duration)) - 2, y + 3);
            
            y += headerHeight;
            
            // START: New competency criteria display for PDF
            const activityCodeMatchPdf = act.title.match(/\b(A[1-5])\b/i);
            let relevantCompetenciesPdf: CompetencyDef[] = [];
            if (activityCodeMatchPdf && competencies) {
                const code = activityCodeMatchPdf[1].toUpperCase();
                const sessionCompCodes = new Set(session.evaluations.map(e => e.competencyCode));
                // FIX: Corrected sort callback to compare b.code instead of b object.
                relevantCompetenciesPdf = competencies
                    .filter(c => c.activities && c.activities.includes(code as any) && sessionCompCodes.has(c.code))
                    .sort((a, b) => a.code.localeCompare(b.code, undefined, {numeric: true}));
            }

            if (relevantCompetenciesPdf.length > 0) {
                y += 4;
                doc.setFillColor(239, 246, 255).rect(margin, y, fullContentWidth, 1, 'F'); // Blue-50 separator
                y += 3;
                relevantCompetenciesPdf.forEach(comp => {
                    const specificEvals = session.evaluations.filter(e => e.competencyCode === comp.code);
                    if (specificEvals.length === 0) return;

                    y = _checkPageBreak(doc, y, 15);
                    doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(30, 64, 175); // blue-800
                    doc.text(`${comp.code}: `, margin + 5, y);
                    const compLabelLines = doc.setFont("helvetica", "bold").splitTextToSize(comp.label, fullContentWidth - 25);
                    doc.text(compLabelLines, margin + 5 + doc.getTextWidth(`${comp.code}: `), y);
                    y += compLabelLines.length * 4 + 2;
                    
                    specificEvals.forEach(ev => {
                        const criterionText = ev.comment;
                        const criterionLines = doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(71, 85, 105).splitTextToSize(criterionText, fullContentWidth - 20);
                        const boxHeight = criterionLines.length * 4 + 6;
                        y = _checkPageBreak(doc, y, boxHeight + 2);
                        
                        doc.setFillColor(255, 255, 255).setDrawColor(229, 231, 235).rect(margin + 10, y, fullContentWidth - 15, boxHeight, 'FD');
                        doc.text(criterionLines, margin + 12, y + 4.5);
                        y += boxHeight + 2;
                    });
                });
                 y += 6;
            }
             // END: New competency criteria display for PDF

            if (act.description) {
                doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(60, 60, 60);
                const descLines = doc.splitTextToSize(act.description, fullContentWidth);
                y = _checkPageBreak(doc, y, descLines.length * 5);
                doc.text(descLines, margin, y);
                y += (descLines.length * 5) + 6;
            }

            if (act.diagramImage) {
                y = _checkPageBreak(doc, y, 65);
                try {
                    let format = act.diagramImage.includes('image/png') ? 'PNG' : 'JPEG';
                    const imgWidth = 80;
                    const imgHeight = 60;
                    const imgX = margin + (fullContentWidth - imgWidth) / 2;
                    doc.addImage(act.diagramImage, format, imgX, y, imgWidth, imgHeight, undefined, 'FAST');
                    y += imgHeight + 8;
                } catch(e) {
                    console.error("Error adding diagramImage to PDF", e);
                }
            }

            if (act.studentConsignes) {
                y = _checkPageBreak(doc, y, 20);
                doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(0,0,0).text("CONSIGNES :", margin, y);
                y += 5;
                doc.setFont("helvetica", "normal");
                const lines = doc.splitTextToSize(act.studentConsignes, fullContentWidth);
                y = _checkPageBreak(doc, y, lines.length * 5);
                doc.text(lines.join("\n"), margin, y);
                y += (lines.length * 5) + 6;
            }

            if (type === 'teacher' && act.teacherCorrection) {
                y = _checkPageBreak(doc, y, 20);
                doc.setFont("helvetica", "bold").setFontSize(9).setTextColor("#008000").text("GUIDE / CORRECTION :", margin, y);
                y += 5;
                doc.setFont("helvetica", "normal").setTextColor("#1E641E");
                const lines = doc.splitTextToSize(act.teacherCorrection, fullContentWidth);
                y = _checkPageBreak(doc, y, lines.length * 5);
                doc.text(lines.join("\n"), margin, y);
                y += (lines.length * 5) + 8;
                doc.setTextColor("#000000");
            }
            y += 5;
        });
    }

    doc.addPage();
    _drawEvaluationGrid(doc, 20, session, competencies, type);

    doc.save(`Sequence-${type}-${session.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  } catch (error) {
      console.error("Failed to generate TP PDF:", error);
      alert("Une erreur est survenue lors de la génération du PDF de la séquence.");
  }
};

export const generateStudentResponsePdf = (
    session: TpSession,
    aiContent: string,
    establishmentLogo?: string,
    competencies?: CompetencyDef[]
) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;
        const contentWidth = pageWidth - margin * 2;
        let y = 20;

        const initialY = y;
        let headerTextX = margin;
        let headerTextWidth = contentWidth;
        let imageEndY = initialY;

        if (establishmentLogo) {
            const logoSize = 20;
            try {
                let format = establishmentLogo.includes('image/png') ? 'PNG' : 'JPEG';
                doc.addImage(establishmentLogo, format, margin, y, logoSize, logoSize, undefined, 'FAST');
                headerTextX += logoSize + 5;
                headerTextWidth -= (logoSize + 5);
            } catch (e) { console.error("Error adding logo to PDF", e); }
        }

        if (session.supportImage) {
            const imgWidth = 40;
            const imgHeight = 30;
            const imgX = pageWidth - margin - imgWidth;
            try {
                let format = session.supportImage.includes('image/png') ? 'PNG' : 'JPEG';
                doc.addImage(session.supportImage, format, imgX, y, imgWidth, imgHeight, undefined, 'FAST');
                imageEndY = y + imgHeight;
            } catch (e) { console.error("Error adding support image to PDF", e); }
            headerTextWidth -= (imgWidth + 5);
        }

        doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(30, 41, 59);
        const titleLines = doc.splitTextToSize(session.title, headerTextWidth);
        doc.text(titleLines, headerTextX, y + 7);
        y += (titleLines.length * 8) + 5;
        
        let currentX = headerTextX;
        ['Public', 'Durée', 'Date'].forEach(label => {
            const value = label === 'Public' ? session.targetAudience : label === 'Durée' ? session.duration : new Date(session.date).toLocaleDateString('fr-FR');
            const badgeText = `${label}: ${value}`;
            const textWidth = doc.setFont("helvetica", "normal").setFontSize(9).getTextWidth(badgeText);
            const badgeWidth = textWidth + 6;
            if (currentX + badgeWidth > headerTextX + headerTextWidth) { y += 10; currentX = headerTextX; }
            doc.setFillColor(243, 244, 246).setTextColor(100, 116, 139).roundedRect(currentX, y, badgeWidth, 7, 3, 3, 'F');
            doc.text(badgeText, currentX + 3, y + 5);
            currentX += badgeWidth + 4;
        });

        y = Math.max(y + 7, initialY + (establishmentLogo ? 20 : 0), imageEndY) + 10;
        doc.setDrawColor("#4B5563").setLineWidth(0.5).line(margin, y, pageWidth - margin, y);
        y += 10;
        
        doc.setFontSize(10).setTextColor(0,0,0).setDrawColor("#B0B0B0").setLineWidth(0.2);
        const halfWidth = contentWidth / 2 - 5;
        doc.text("NOM Prénom :", margin, y + 5).line(margin + 28, y + 5.5, margin + halfWidth, y + 5.5);
        doc.text("Classe :", margin + halfWidth + 10, y + 5).line(margin + halfWidth + 22, y + 5.5, pageWidth - margin, y + 5.5);
        y += 10;
        doc.text("Date :", margin, y + 5).line(margin + 12, y + 5.5, margin + halfWidth, y + 5.5);
        y += 12;

        const lines = aiContent.split('\n');
        const answerLineHeight = 8;
        let inTable = false;

        lines.forEach(line => {
            y = _checkPageBreak(doc, y, 20);
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('|')) {
                if (!inTable) { inTable = true; doc.setFont("courier", "normal").setFontSize(9); y += 2; }
                y = _drawMarkedupText(doc, trimmedLine, margin, y, contentWidth);
            } else {
                if (inTable) { inTable = false; doc.setFont("helvetica", "normal"); y += 5; }
                
                if (line.startsWith('## ')) {
                    y += 5;
                    doc.setFillColor("#F5F7FA").rect(margin, y - 4, contentWidth, 10, 'F');
                    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(30, 41, 59);
                    y = _drawMarkedupText(doc, line.substring(3), margin + 3, y + 3, contentWidth - 6);
                    y += 7;
                } else if (line.startsWith('### ')) {
                    y += 4;
                    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(51, 65, 85);
                    y = _drawMarkedupText(doc, line.substring(4), margin, y, contentWidth);
                    y += 2;
                } else if (line.includes('[LIGNE]')) {
                    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(0,0,0);
                    const text = line.replace('[LIGNE]', '').trim();
                    doc.text(text, margin, y);
                    const lineStartX = margin + doc.getTextWidth(text) + 2;
                    doc.setDrawColor("#B0B0B0").setLineWidth(0.2);
                    if (lineStartX < pageWidth - margin - 20) {
                        doc.line(lineStartX, y + 0.5, pageWidth - margin, y + 0.5); y += answerLineHeight;
                    } else { y += 6; doc.line(margin, y, pageWidth - margin, y); y += 4; }
                } else if (line.includes('[LIGNES:')) {
                    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(0,0,0);
                    const match = line.match(/\[LIGNES:(\d+)]/);
                    const numLines = match ? parseInt(match[1], 10) : 1;
                    doc.text(line.replace(/\[LIGNES:\d+]/, '').trim(), margin, y);
                    y += 6;
                    doc.setDrawColor("#B0B0B0").setLineWidth(0.2);
                    for (let i = 0; i < numLines; i++) { y = _checkPageBreak(doc, y, answerLineHeight); doc.line(margin, y, pageWidth - margin, y); y += answerLineHeight; }
                    y += 2;
                } else if (trimmedLine) {
                    y = _drawMarkedupText(doc, trimmedLine, margin, y, contentWidth);
                } else { 
                    y += 2.5; 
                }
            }
        });

        doc.addPage();
        _drawEvaluationGrid(doc, 20, session, competencies, 'student-response');

        doc.save(`DocReponse_${session.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch(error) {
        console.error("Failed to generate Student Response PDF:", error);
        alert("Une erreur est survenue lors de la génération du document réponse.");
    }
};

export const generateCorrectedResponsePdf = (
    session: TpSession,
    aiContent: string,
    establishmentLogo?: string,
    competencies?: CompetencyDef[]
) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;
        const contentWidth = pageWidth - margin * 2;
        let y = 20;

        const initialY = y;
        let headerTextX = margin;
        let headerTextWidth = contentWidth;
        let imageEndY = initialY;

        if (establishmentLogo) {
            const logoSize = 20;
            try {
                let format = establishmentLogo.includes('image/png') ? 'PNG' : 'JPEG';
                doc.addImage(establishmentLogo, format, margin, y, logoSize, logoSize, undefined, 'FAST');
                headerTextX += logoSize + 5;
                headerTextWidth -= (logoSize + 5);
            } catch (e) { console.error("Error adding logo to PDF", e); }
        }

        if (session.supportImage) {
            const imgWidth = 40;
            const imgHeight = 30;
            const imgX = pageWidth - margin - imgWidth;
            try {
                let format = session.supportImage.includes('image/png') ? 'PNG' : 'JPEG';
                doc.addImage(session.supportImage, format, imgX, y, imgWidth, imgHeight, undefined, 'FAST');
                imageEndY = y + imgHeight;
            } catch (e) { console.error("Error adding support image to PDF", e); }
            headerTextWidth -= (imgWidth + 5);
        }

        doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(30, 41, 59);
        const titleLines = doc.splitTextToSize(session.title, headerTextWidth);
        doc.text(titleLines, headerTextX, y + 7);
        y += (titleLines.length * 8) + 5;
        
        let currentX = headerTextX;
        ['Public', 'Durée', 'Date'].forEach(label => {
            const value = label === 'Public' ? session.targetAudience : label === 'Durée' ? session.duration : new Date(session.date).toLocaleDateString('fr-FR');
            const badgeText = `${label}: ${value}`;
            const textWidth = doc.setFont("helvetica", "normal").setFontSize(9).getTextWidth(badgeText);
            const badgeWidth = textWidth + 6;
            if (currentX + badgeWidth > headerTextX + headerTextWidth) { y += 10; currentX = headerTextX; }
            doc.setFillColor(243, 244, 246).setTextColor(100, 116, 139).roundedRect(currentX, y, badgeWidth, 7, 3, 3, 'F');
            doc.text(badgeText, currentX + 3, y + 5);
            currentX += badgeWidth + 4;
        });

        y = Math.max(y + 7, initialY + (establishmentLogo ? 20 : 0), imageEndY) + 10;
        doc.setDrawColor("#4B5563").setLineWidth(0.5).line(margin, y, pageWidth - margin, y);
        y += 10;
        
        doc.setFontSize(10).setTextColor(0,0,0).setDrawColor("#B0B0B0").setLineWidth(0.2);
        const halfWidth = contentWidth / 2 - 5;
        doc.text("NOM Prénom :", margin, y + 5).line(margin + 28, y + 5.5, margin + halfWidth, y + 5.5);
        doc.text("Classe :", margin + halfWidth + 10, y + 5).line(margin + halfWidth + 22, y + 5.5, pageWidth - margin, y + 5.5);
        y += 10;
        doc.text("Date :", margin, y + 5).line(margin + 12, y + 5.5, margin + halfWidth, y + 5.5);
        y += 12;

        const lines = aiContent.split('\n');
        let inTable = false;

        lines.forEach(line => {
            y = _checkPageBreak(doc, y, 20);
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('|')) {
                if (!inTable) { inTable = true; doc.setFont("courier", "normal").setFontSize(9); y += 2; }
                y = _drawMarkedupText(doc, trimmedLine, margin, y, contentWidth);
            } else {
                if (inTable) { inTable = false; doc.setFont("helvetica", "normal"); y += 5; }
                
                if (line.startsWith('## ')) {
                    y += 5;
                    doc.setFillColor("#F5F7FA").rect(margin, y - 4, contentWidth, 10, 'F');
                    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(30, 41, 59);
                    y = _drawMarkedupText(doc, line.substring(3), margin + 3, y + 3, contentWidth - 6);
                    y += 7;
                } else if (line.startsWith('### ')) {
                    y += 4;
                    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(51, 65, 85);
                    y = _drawMarkedupText(doc, line.substring(4), margin, y, contentWidth);
                    y += 2;
                } else if (trimmedLine) {
                    y = _drawMarkedupText(doc, trimmedLine, margin, y, contentWidth);
                } else { 
                    y += 2.5; 
                }
            }
        });

        doc.addPage();
        _drawEvaluationGrid(doc, 20, session, competencies, 'student-response');

        doc.save(`DocCorrige_${session.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch(error) {
        console.error("Failed to generate Corrected Response PDF:", error);
        alert("Une erreur est survenue lors de la génération du document corrigé.");
    }
};

export const generateExamBilanPdf = (
    title: string,
    scopeInfo: { student: string, class: string, birthDate?: string },
    globalNote: number,
    examResults: {
        note: number;
        def: { code: string; label: string; coef: number };
        details: { code: string; avg: number; count: number }[];
    }[]
  ) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;
        const contentWidth = pageWidth - margin * 2;
        let y = 20;

        doc.setFont("helvetica", "bold").setFontSize(16).text(title.toUpperCase(), margin, y);
        y += 10;
        
        doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(0, 0, 0);
        doc.text(`Classe : ${scopeInfo.class}`, margin, y);
        doc.text(`Nom Prénom : ${scopeInfo.student}`, margin, y + 5);
        if (scopeInfo.birthDate) {
            doc.text(`Date de naissance : ${new Date(scopeInfo.birthDate).toLocaleDateString()}`, margin, y + 10);
            y += 20;
        } else {
            y += 15;
        }

        doc.setFillColor(248, 250, 252).roundedRect(margin, y, contentWidth, 20, 3, 3, 'F');
        doc.setFontSize(10).setTextColor(100, 116, 139).setFont("helvetica", "bold").text("NOTE GLOBALE PRO", margin + 7, y + 8);
        doc.setFontSize(24).setTextColor(30, 41, 59).text(`${globalNote.toFixed(2)}`, margin + 7, y + 17);
        doc.setFontSize(14).setTextColor(148, 163, 184).setFont("helvetica", "normal").text("/ 20", margin + 7 + doc.getTextWidth(globalNote.toFixed(2)) + 2, y + 17);
        y += 30;

        examResults.forEach(res => {
            const boxHeight = 16 + (res.details.length + 1) * 7;
            y = _checkPageBreak(doc, y, boxHeight + 10);

            doc.setDrawColor(226, 232, 240).roundedRect(margin, y, contentWidth, boxHeight, 3, 3, 'S');
            doc.setFillColor(248, 250, 252).rect(margin + 1, y + 1, contentWidth - 2, 14, 'F');
            
            doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(71, 85, 105).text(`${res.def.code} (Coef ${res.def.coef})`, margin + 5, y + 10);
            doc.setFontSize(9).setTextColor(100, 116, 139).setFont("helvetica", "normal").text(res.def.label, margin + 5 + doc.getTextWidth(`${res.def.code} (Coef ${res.def.coef})`) + 5, y + 10);
            doc.setFontSize(16).setFont("helvetica", "bold").setTextColor(res.note >= 10 ? 30 : 220, res.note >= 10 ? 41 : 38, res.note >= 10 ? 59 : 38).text(res.note.toFixed(1), pageWidth - margin - 5, y + 11, { align: "right" });
            y += 16;
            
            const colX = [margin + 5, contentWidth - 30, contentWidth];
            doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(148, 163, 184).text("Compétence", colX[0], y + 5).text("Moyenne", colX[1], y + 5, { align: "right" }).text("Nb.", colX[2], y + 5, { align: "right" });
            y += 7;

            doc.setFont("helvetica", "normal").setFontSize(9);
            res.details.forEach(d => {
                doc.setTextColor(71, 85, 105).text(d.code, colX[0], y + 5);
                const avgText = d.count > 0 ? d.avg.toFixed(1) : '-';
                const avgColor = d.avg >= 15 ? [34,197,94] : d.avg >= 10 ? [249,115,22] : [220,38,38];
                doc.setTextColor(d.count > 0 ? avgColor[0] : 100, d.count > 0 ? avgColor[1] : 116, d.count > 0 ? avgColor[2] : 139).text(avgText, colX[1], y + 5, { align: "right" });
                doc.setTextColor(148, 163, 184).text(String(d.count), colX[2], y + 5, { align: "right" });
                y += 7;
            });
            y += 10;
        });
        
        y = _drawSignatureBlock(doc, margin, contentWidth, y);
      
        doc.save(`Bilan_${scopeInfo.student.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch(error) {
        console.error("Failed to generate Exam Bilan PDF:", error);
        alert("Une erreur est survenue lors de la génération du bilan d'examen.");
    }
};

export const generateCompetencyBilanPdf = (
  title: string,
  scopeInfo: { student: string, class: string, birthDate?: string },
  tableData: any[],
  competencySummaryData: { code: string; label?: string; percentage: string; level: string }[],
  exams: ExamDef[]
) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const margin = 10; // Reduced margin
        const contentWidth = pageWidth - margin * 2;
        let y = 10; // Start higher

        doc.setFont("helvetica", "bold").setFontSize(14).text(title.toUpperCase(), margin, y);
        y += 6;
        doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(0, 0, 0);
        doc.text(`Classe : ${scopeInfo.class}`, margin, y);
        doc.text(`Nom Prénom : ${scopeInfo.student}`, margin, y + 4);
        if (scopeInfo.birthDate) {
            doc.text(`Date de naissance : ${new Date(scopeInfo.birthDate).toLocaleDateString()}`, margin, y + 8);
            y += 14;
        } else {
            y += 10;
        }
        
        tableData.forEach((row) => {
            const bilanText = `Acquis: ${row.status.acquired}, En cours: ${row.status.inProgress}, Non: ${row.status.notAcquired} (${row.evaluatedCount}/${competencySummaryData.length} évaluées)`;
            const studentText = `${row.name} (${row.class})`;
            const moyenne = row.globalAvg !== null ? row.globalAvg.toFixed(2) : '-';
            
            // Student Header
            doc.setFillColor(240, 240, 240).rect(margin, y, contentWidth, 8, 'F');
            doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(0, 0, 0);
            doc.text(studentText, margin + 2, y + 5.5);
            doc.setFont("helvetica", "normal").setFontSize(8);
            doc.text(`Moyenne globale : ${moyenne}`, margin + contentWidth - 2, y + 5.5, { align: 'right' });
            y += 8;
            
            // Bilan text
            doc.setFont("helvetica", "italic").setFontSize(8).setTextColor(80, 80, 80);
            doc.text(`Bilan : ${bilanText}`, margin + 2, y + 5);
            y += 7;
            
            // Exams Table (Vertical)
            if (exams.length > 0) {
                doc.setFillColor(248, 250, 252).rect(margin, y, contentWidth, 6, 'F');
                doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(100, 116, 139);
                doc.text("Épreuve", margin + 2, y + 4.5);
                doc.text("Note", margin + contentWidth - 20, y + 4.5, { align: 'center' });
                y += 6;
                
                doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(0, 0, 0);
                exams.forEach(exam => {
                    const score = row.exams[exam.code] != null ? row.exams[exam.code].toFixed(1) : '-';
                    doc.text(`${exam.code} - ${exam.label}`, margin + 2, y + 4.5);
                    doc.text(score, margin + contentWidth - 20, y + 4.5, { align: 'center' });
                    y += 6;
                    doc.setDrawColor(226, 232, 240).line(margin, y, margin + contentWidth, y);
                });
            }
            y += 6;
        });

        doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0, 0, 0).text("BILAN DÉTAILLÉ PAR COMPÉTENCE", margin, y);
        y += 6;
        
        if (competencySummaryData.length === 0) {
            y = _drawSignatureBlock(doc, margin, contentWidth, y);
            doc.save(`Bilan_Competences_${scopeInfo.class.replace(/ /g, '_')}_${scopeInfo.student.replace(/ /g, '_')}.pdf`);
            return;
        }

        const levelColorsPDF: { [key: string]: [number, number, number] } = {
            TA: [22, 163, 74],    // green-600
            PA: [132, 204, 22],   // lime-500
            IA: [250, 204, 21],   // yellow-400
            NA: [220, 38, 38],    // red-600
        };

        // Table Header for Competencies
        doc.setFillColor(240, 240, 240).rect(margin, y, contentWidth, 8, 'F');
        doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(0, 0, 0);
        doc.text("Compétence", margin + 2, y + 5.5);
        doc.text("Taux de réussite", margin + contentWidth - 40, y + 5.5, { align: 'center' });
        doc.text("Niveau", margin + contentWidth - 15, y + 5.5, { align: 'center' });
        y += 8;

        doc.setFont("helvetica", "normal").setFontSize(8);
        competencySummaryData.forEach((comp) => {
            const compText = `${comp.code} - ${comp.label || ''}`;
            const compLines = doc.splitTextToSize(compText, contentWidth - 60);
            const rowHeight = Math.max(6, compLines.length * 3.5 + 2);
            
            doc.setTextColor(0, 0, 0);
            doc.text(compLines, margin + 2, y + 4);
            
            doc.text(comp.percentage, margin + contentWidth - 40, y + rowHeight / 2 + 1.5, { align: 'center' });
            
            const color = levelColorsPDF[comp.level] || [255, 255, 255];
            doc.setFillColor(color[0], color[1], color[2]).roundedRect(margin + contentWidth - 25, y + rowHeight / 2 - 2.5, 20, 5, 1.5, 1.5, 'F');
            
            const useDarkText = comp.level === 'PA' || comp.level === 'IA';
            doc.setTextColor(useDarkText ? 50 : 255, useDarkText ? 50 : 255, useDarkText ? 50 : 255);
            doc.setFont("helvetica", "bold").setFontSize(7);
            doc.text(comp.level, margin + contentWidth - 15, y + rowHeight / 2 + 1.5, { align: 'center' });
            
            doc.setFont("helvetica", "normal").setFontSize(8);
            y += rowHeight;
            doc.setDrawColor(226, 232, 240).line(margin, y, margin + contentWidth, y);
        });

        y = _drawSignatureBlock(doc, margin, contentWidth, y);

        doc.save(`Bilan_Competences_${scopeInfo.class.replace(/ /g, '_')}_${scopeInfo.student.replace(/ /g, '_')}.pdf`);
    } catch(error) {
        console.error("Failed to generate Competency Bilan PDF:", error);
        alert("Une erreur est survenue lors de la génération du bilan de compétences.");
    }
};

export const generateMassEvaluationPdf = (
    tpTitle: string,
    className: string,
    date: string,
    students: Student[],
    tpCompetencies: CompetencyCode[],
    groupSessions: TpSession[],
    levels: Record<LevelCode, LevelDetails>,
    allCompetencies: CompetencyDef[]
) => {
    try {
        const doc = new jsPDF({ orientation: 'landscape' });
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;
        const contentWidth = pageWidth - margin * 2;
        let y = 15;

        // --- PDF Header ---
        doc.setFontSize(18).setFont('helvetica', 'bold').text(tpTitle, pageWidth / 2, y, { align: 'center' });
        y += 8;
        doc.setFontSize(12).setFont('helvetica', 'normal').text(`${className} - ${new Date(date).toLocaleDateString('fr-FR')}`, pageWidth / 2, y, { align: 'center' });
        y += 15;

        // --- Table Drawing ---
        const studentColWidth = 45;
        const noteColWidth = 25;
        const compColWidth = (contentWidth - studentColWidth - noteColWidth) / tpCompetencies.length;
        const rowHeight = 12; // Increased row height to accommodate competency label
        const headerHeight = 20;

        // Dynamic font size adjustment for large tables
        const headerFontSize = tpCompetencies.length > 8 ? 8 : 10;
        const labelFontSize = tpCompetencies.length > 8 ? 6 : 7;

        const drawHeader = (currentY: number) => {
            doc.setFillColor(37, 53, 71); // Dark blue/gray
            doc.rect(margin, currentY, contentWidth, headerHeight, 'F');
            doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold');
            
            doc.setFontSize(8).text('ÉLÈVE', margin + 3, currentY + headerHeight / 2 + 1);
            
            let x = margin + studentColWidth;
            tpCompetencies.forEach(compCode => {
                const compDef = allCompetencies.find(c => c.code === compCode);
                
                doc.setFontSize(headerFontSize).text(compCode, x + compColWidth / 2, currentY + 7, { align: 'center' });

                if (compDef?.label) {
                    doc.setFontSize(labelFontSize).setFont('helvetica', 'normal');
                    const labelLines = doc.splitTextToSize(compDef.label, compColWidth - 2);
                    doc.text(labelLines, x + compColWidth / 2, currentY + 11, { align: 'center', lineHeightFactor: 1.1 });
                }
                x += compColWidth;
            });
            
            doc.setFontSize(8).setFont('helvetica', 'bold');
            doc.text('NOTE', x + noteColWidth / 2, currentY + headerHeight / 2 + 1, { align: 'center' });
            
            return currentY + headerHeight;
        };

        y = drawHeader(y);

        // Table Body
        doc.setFontSize(9).setFont('helvetica', 'normal');
        students.sort((a,b) => a.lastName.localeCompare(b.lastName)).forEach((student, index) => {
            if (y + rowHeight > pageHeight - margin) {
                doc.addPage();
                y = margin;
                y = drawHeader(y);
            }

            const studentFullName = `${student.lastName} ${student.firstName}`;
            const session = groupSessions.find(s => s.studentName === studentFullName);

            let noteText = '-';
            if (session) {
                const validEvals = session.evaluations.filter(e => 
                    e.level !== LevelCode.NE && tpCompetencies.includes(e.competencyCode)
                );
                if (validEvals.length > 0) {
                    const totalScore = validEvals.reduce((sum, item) => sum + levels[item.level].score, 0);
                    const calculatedNote = totalScore / validEvals.length;
                    noteText = calculatedNote.toFixed(2).replace('.', ',');
                }
            }

            doc.setFillColor(index % 2 === 0 ? 255 : 249, 250, 251);
            doc.rect(margin, y, contentWidth, rowHeight, 'F');
            doc.setDrawColor(226, 232, 240).line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
            
            doc.setTextColor(51, 65, 85);
            doc.text(studentFullName, margin + 3, y + rowHeight / 2 + 2, { maxWidth: studentColWidth - 4 });
            
            let x = margin + studentColWidth;
            
            tpCompetencies.forEach(compCode => {
                const evaluation = session?.evaluations.find(e => e.competencyCode === compCode);
                const level = evaluation?.level || LevelCode.NE;
                
                const color = levelColors[level] || '#FFFFFF';

                if (level !== LevelCode.NE) {
                    doc.setFillColor(color);
                    doc.rect(x + 1, y + 1, compColWidth - 2, rowHeight - 2, 'F');
                    
                    if (level === LevelCode.PA || level === LevelCode.IA) {
                        doc.setTextColor(50, 50, 50);
                    } else {
                        doc.setTextColor(255, 255, 255);
                    }
                }
                
                doc.setFont('helvetica', 'bold').text(level, x + compColWidth / 2, y + rowHeight / 2 + 2.5, { align: 'center' });
                doc.setTextColor(51, 65, 85);
                x += compColWidth;
            });
            
            doc.setFillColor(243, 244, 246);
            doc.rect(x, y, noteColWidth, rowHeight, 'F');
            doc.setTextColor(30, 41, 59).setFont('helvetica', 'bold');
            doc.text(noteText, x + noteColWidth / 2, y + rowHeight / 2 + 2.5, { align: 'center' });

            y += rowHeight;
        });
        
        doc.save(`Grille_${className}_${tpTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

    } catch (error) {
        console.error("Failed to generate Mass Evaluation PDF:", error);
        alert("Une erreur est survenue lors de la génération du PDF.");
    }
};

/**
 * Exports the complete visual Student Dossier as a high-resolution PDF matching the on-screen UI
 */
export const exportStudentDossierPdf = async (
  element: HTMLElement,
  studentName: string,
  className: string
): Promise<void> => {
  try {
    // 1. Temporarily prepare layout for full visual rendering
    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    const originalMinHeight = element.style.minHeight;
    const originalBackground = element.style.backgroundColor;

    // Find and expand all scroll containers so nothing is cropped
    const scrollContainers = element.querySelectorAll<HTMLElement>('.overflow-y-auto, [class*="max-h-"]');
    const originalMaxHeights: string[] = [];
    const originalOverflows: string[] = [];

    scrollContainers.forEach((el, index) => {
      originalMaxHeights[index] = el.style.maxHeight;
      originalOverflows[index] = el.style.overflow;
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
    });

    // Hide interactive elements (like edit/delete buttons)
    const noPrintElements = element.querySelectorAll<HTMLElement>('.no-print, [data-no-print="true"]');
    const originalDisplays: string[] = [];
    noPrintElements.forEach((el, index) => {
      originalDisplays[index] = el.style.display;
      el.style.display = 'none';
    });

    // Lock width to standard desktop layout (1200px) so two columns render side-by-side
    element.style.width = '1200px';
    element.style.maxWidth = '1200px';
    element.style.backgroundColor = '#f8fafc';

    // Wait a moment for layout stabilization & radar SVG rendering
    await new Promise(resolve => setTimeout(resolve, 200));

    // Capture using html2canvas with high DPI
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#f8fafc',
      logging: false,
      windowWidth: 1280
    });

    // Restore original element styles
    element.style.width = originalWidth;
    element.style.maxWidth = originalMaxWidth;
    element.style.minHeight = originalMinHeight;
    element.style.backgroundColor = originalBackground;

    scrollContainers.forEach((el, index) => {
      el.style.maxHeight = originalMaxHeights[index];
      el.style.overflow = originalOverflows[index];
    });

    noPrintElements.forEach((el, index) => {
      el.style.display = originalDisplays[index];
    });

    // 2. Build A4 PDF
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
    const margin = 8; // 8mm margin
    const contentWidth = pageWidth - (margin * 2); // 194mm
    const maxContentHeightPerPage = pageHeight - (margin * 2); // 281mm

    const totalImgHeightMm = (canvas.height * contentWidth) / canvas.width;

    if (totalImgHeightMm <= maxContentHeightPerPage) {
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', margin, margin, contentWidth, totalImgHeightMm, undefined, 'FAST');
    } else {
      // Multi-page slicing for lengthy dossiers
      const pageHeightPx = (canvas.width * maxContentHeightPerPage) / contentWidth;
      let currentYPx = 0;
      let pageIndex = 0;

      while (currentYPx < canvas.height) {
        if (pageIndex > 0) {
          doc.addPage();
        }

        const sliceHeightPx = Math.min(pageHeightPx, canvas.height - currentYPx);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;
        const ctx = sliceCanvas.getContext('2d');

        if (ctx) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(
            canvas,
            0, currentYPx, canvas.width, sliceHeightPx,
            0, 0, sliceCanvas.width, sliceHeightPx
          );

          const sliceImgData = sliceCanvas.toDataURL('image/png');
          const sliceHeightMm = (sliceHeightPx * contentWidth) / canvas.width;
          doc.addImage(sliceImgData, 'PNG', margin, margin, contentWidth, sliceHeightMm, undefined, 'FAST');
        }

        currentYPx += pageHeightPx;
        pageIndex++;
      }
    }

    const cleanStudentName = studentName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanClassName = className.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`Fiche_Dossier_${cleanClassName}_${cleanStudentName}.pdf`);

  } catch (error) {
    console.error("Failed to export Student Dossier to PDF:", error);
    alert("Une erreur est survenue lors de la génération du dossier PDF.");
  }
};