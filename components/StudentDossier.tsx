import React, { useMemo, useState, useRef } from 'react';
import { TpSession, LevelCode, StudentClass, LevelDetails, Diploma, Student } from '../types';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { ArrowLeft, Download, FileText, Check, X, Calendar, MessageSquare, Tag, Eye, RefreshCw } from 'lucide-react';
import { exportStudentDossierPdf } from '../services/pdfService';

interface Props {
  student: Student;
  studentClass: StudentClass;
  classes: StudentClass[];
  sessions: TpSession[];
  levels: Record<LevelCode, LevelDetails>;
  diplomas: Diploma[];
  onBack: () => void;
  onEditSession?: (session: TpSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  onSelectStudent?: (student: Student, cls: StudentClass) => void;
  examThresholds?: { TA: number; PA: number; IA: number; };
}

interface CompetencyDetail {
    code: string;
    label?: string;
    criteria?: string[];
    percentage: number;
    level: string;
    color: string;
    textColor: string;
    avgScore: number;
    isManual?: boolean;
}

const StudentDossier: React.FC<Props> = ({
  student,
  studentClass,
  classes,
  sessions,
  levels,
  diplomas,
  onBack,
  onEditSession,
  onDeleteSession,
  onSelectStudent,
  examThresholds
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const dossierRef = useRef<HTMLDivElement>(null);

  const thresholds = useMemo(() => ({
    TA: examThresholds?.TA ?? 15,
    PA: examThresholds?.PA ?? 10,
    IA: examThresholds?.IA ?? 5,
  }), [examThresholds]);

  // Determine Diploma
  const diploma = useMemo(() => {
    return diplomas.find(d => d.id === studentClass.diplomaId);
  }, [diplomas, studentClass]);

  const { competencies, exams } = useMemo(() => {
    if (!diploma) return { competencies: [], exams: [] };
    const allCompetencies = diploma.repository.competencies || [];
    const allExams = diploma.repository.exams || [];
    const professionalExams = allExams.filter(exam => exam.isProfessional);
    return {
        competencies: allCompetencies,
        exams: professionalExams
    };
  }, [diploma]);

  // All students from this class to populate the CONSULT dropdown
  const classStudents = useMemo(() => {
    return [...studentClass.students].sort((a, b) => 
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
    );
  }, [studentClass]);

  const studentFullName = `${student.lastName} ${student.firstName}`;

  // Filter evaluated sessions for this specific student
  const studentSessions = useMemo(() => {
    return sessions.filter(s => 
        s.studentClass === studentClass.name &&
        s.studentName === studentFullName &&
        !s.isTemplate
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, studentClass, studentFullName]);

  // Compute detailed metrics for each competency based on evaluations and manual overrides
  const competencyDetails = useMemo<CompetencyDetail[]>(() => {
    if (competencies.length === 0) return [];
    
    const manualOverrides = student.manualCompetencyOverrides || {};

    return competencies.map(comp => {
        const manualOverride = manualOverrides[comp.code];
        
        // Find all evaluations for this competency
        const compEvals = studentSessions.flatMap(s => 
            s.evaluations.filter(e => e.competencyCode === comp.code && e.level !== LevelCode.NE)
        );

        if (manualOverride || compEvals.length > 0) {
            let avgScore = 0;
            let percentage = 0;
            let level = 'NA';
            
            if (manualOverride) {
                level = manualOverride;
                avgScore = levels[manualOverride].score;
                percentage = Math.round((avgScore / 20) * 100);
            } else {
                const sum = compEvals.reduce((acc, curr) => acc + levels[curr.level].score, 0);
                avgScore = sum / compEvals.length;
                percentage = Math.round((avgScore / 20) * 100);
                
                if (avgScore >= thresholds.TA) level = 'TA';
                else if (avgScore >= thresholds.PA) level = 'PA';
                else if (avgScore >= thresholds.IA) level = 'IA';
            }
            
            let color = 'bg-red-500/10 text-red-700 border-red-200';
            let label = 'NON ACQUIS (NA)';
            if (level === 'TA') {
                color = 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
                label = 'ACQUIS (TA)';
            } else if (level === 'PA') {
                color = 'bg-lime-500/10 text-lime-800 border-lime-200';
                label = 'P. ACQUIS (PA)';
            } else if (level === 'IA') {
                color = 'bg-yellow-400/10 text-yellow-850 border-yellow-200';
                label = 'EN COURS (EA)';
            }

            return { 
                code: comp.code, 
                label: comp.label, 
                criteria: comp.criteria, 
                percentage, 
                level, 
                color, 
                textColor: 'text-gray-800', 
                avgScore, 
                isManual: !!manualOverride 
            };
        }

        return { 
            code: comp.code, 
            label: comp.label, 
            criteria: comp.criteria, 
            percentage: 0, 
            level: 'NE', 
            color: 'bg-gray-50 text-gray-400 border-gray-100', 
            textColor: 'text-gray-400', 
            avgScore: 0, 
            isManual: false 
        };
    });
  }, [competencies, studentSessions, student.manualCompetencyOverrides, levels, thresholds]);

  // Evaluated competencies count
  const evaluatedCount = useMemo(() => {
    return competencyDetails.filter(c => c.level !== 'NE').length;
  }, [competencyDetails]);

  // Exam computation
  const examResults = useMemo(() => {
    return exams.map(exam => {
        if (!exam.competencies || exam.competencies.length === 0) {
            return { exam, note: 0, isValid: false };
        }
        
        let weightedSum = 0;
        let wasAnyCompetencyAssessed = false;

        exam.competencies.forEach(examComp => {
            const compDetail = competencyDetails.find(d => d.code === examComp.code);

            if (compDetail && compDetail.level !== 'NE') {
                wasAnyCompetencyAssessed = true;
                weightedSum += compDetail.avgScore * (examComp.weight / 100);
            }
        });

        return {
            exam,
            note: wasAnyCompetencyAssessed ? weightedSum : 0,
            isValid: wasAnyCompetencyAssessed
        };
    });
  }, [exams, competencyDetails]);

  // Global weighted note calculation
  const globalProNote = useMemo(() => {
    let totalCoef = 0;
    let weightedSumOfGrades = 0;
    let hasAnyValid = false;

    examResults.forEach(res => {
        if (res.isValid) {
            hasAnyValid = true;
            weightedSumOfGrades += res.note * res.exam.coef;
            totalCoef += res.exam.coef;
        }
    });

    return hasAnyValid && totalCoef > 0 ? weightedSumOfGrades / totalCoef : 0;
  }, [examResults]);

  // Radar chart data structuring
  const chartData = useMemo(() => {
     return competencyDetails.map(c => ({
         subject: c.code,
         score: c.level === 'NE' ? 0 : parseFloat(c.avgScore.toFixed(1)),
         fullMark: 20
     }));
  }, [competencyDetails]);

  // Handle PDF Export
  const handleDownloadPdf = async () => {
    if (!dossierRef.current || isExporting) return;
    setIsExporting(true);
    try {
      await exportStudentDossierPdf(
        dossierRef.current,
        studentFullName,
        studentClass.name
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleConsultSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStudent = classStudents.find(s => s.id === e.target.value);
    if (nextStudent && onSelectStudent) {
        onSelectStudent(nextStudent, studentClass);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-7xl mx-auto pb-12">
      {/* Top Banner Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <button 
          onClick={onBack} 
          className="text-slate-500 hover:text-indigo-600 font-bold flex items-center gap-2 transition-colors text-sm"
        >
          <ArrowLeft size={16}/> Retourner au suivi global
        </button>

        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-end">
          <button 
            onClick={handleDownloadPdf} 
            disabled={isExporting}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            {isExporting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Génération du PDF...</span>
              </>
            ) : (
              <>
                <Download size={16}/>
                <span>Télécharger Fiche PDF (Dossier)</span>
              </>
            )}
          </button>
          
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <span>CONSULTER :</span>
            <select
              value={student.id}
              onChange={handleConsultSelect}
              className="p-2 border border-slate-350 bg-white rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              {classStudents.map(s => (
                <option key={s.id} value={s.id}>{s.lastName} {s.firstName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Printable Visual Dossier Container */}
      <div ref={dossierRef} className="space-y-6 bg-slate-50/50 p-2 sm:p-4 rounded-3xl">
        {/* Main Student Header Banner */}
        <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden border border-slate-800">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full border-4 border-slate-700/80 overflow-hidden flex items-center justify-center bg-slate-850 shadow-inner flex-shrink-0">
             {student.photo ? (
                 <img src={student.photo} alt="Profil" className="w-full h-full object-cover" />
             ) : (
                 <div className="text-3xl font-bold text-slate-500">
                     {student.firstName[0]}{student.lastName[0]}
                 </div>
             )}
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold tracking-tight">{studentFullName}</h2>
            <p className="text-slate-400 font-medium text-sm flex items-center gap-2">
              <span className="bg-slate-800 px-2.5 py-1 rounded-full text-xs font-bold text-slate-300">
                {studentClass.name.toUpperCase()}
              </span>
              <span>•</span>
              {diploma?.name.toUpperCase()} • CERTIFICATIONS {exams.map(e => e.code).join(', ')}
            </p>
          </div>
        </div>
        <div className="flex gap-4 self-stretch md:self-auto justify-end">
          <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800/80 w-28 text-center flex flex-col justify-center">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">BAC PRO</div>
            <div className="text-2xl font-black mt-1 text-indigo-400">{globalProNote.toFixed(2)}</div>
          </div>
          <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800/85 w-28 text-center flex flex-col justify-center">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Évaluées</div>
            <div className="text-2xl font-black mt-1 text-emerald-400">{evaluatedCount}/{competencies.length}</div>
          </div>
        </div>
      </div>

      {/* Two Column Section Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column (5-span) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Radar Chart Coverage */}
          <div className="bg-white rounded-[1.75rem] border border-slate-200/80 shadow-md p-6">
            <h3 className="font-extrabold text-slate-800 text-lg mb-4 text-center">
               Couverture des {competencies.length} Compétences
            </h3>
            <div className="h-72 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#475569' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 20]} stroke="#cbd5e1" tick={{ fontSize: 9 }} />
                      <Radar name="Aquis" dataKey="score" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.45} />
                      <Tooltip />
                  </RadarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend as shown in Image 1 */}
            <div className="flex justify-center gap-6 text-xs font-semibold text-slate-500 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                <span>Acquis (≥75%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
                <span>Non évalué (0% ou NE)</span>
              </div>
            </div>
          </div>

          {/* Calculs de Certification Card */}
          <div className="bg-white rounded-[1.75rem] border border-slate-200/80 shadow-md p-6">
            <h3 className="font-extrabold text-[#475569] text-xs uppercase tracking-wider mb-4">
              Calculs de certification
            </h3>
            <div className="space-y-4">
              {examResults.map(res => (
                <div key={res.exam.code} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center transition-all hover:bg-slate-100/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">Note {res.exam.code}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">({res.exam.label.split(' ')[0]})</span>
                    </div>
                    <p className="text-xs text-slate-400 font-semibold">Coef {res.exam.coef} • Compétences rattachées</p>
                  </div>
                  <div className={`text-xl font-bold tracking-tight py-1 px-3.5 rounded-lg ${
                    res.isValid 
                      ? res.note >= thresholds.PA ? 'text-emerald-600 bg-emerald-50' : 'text-amber-500 bg-amber-50'
                      : 'text-slate-400 bg-slate-100'
                  }`}>
                    {res.isValid ? `${res.note.toFixed(2)}/20` : '0/20'}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column (7-span) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Bilan des Compétences list */}
          <div className="bg-white rounded-[1.75rem] border border-slate-200/80 shadow-md p-6">
            <h3 className="font-extrabold text-slate-800 text-lg mb-4">
              Bilan des {competencies.length} Compétences Officielles
            </h3>
            <div className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto pr-1">
              {competencyDetails.map(comp => (
                <div key={comp.code} className="py-2.5 flex items-start gap-4 hover:bg-slate-50/50 rounded-xl px-2 transition-colors">
                  <span className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-indigo-700 text-sm flex-shrink-0 mt-0.5 shadow-sm">
                    {comp.code}
                  </span>
                  <div className="flex-grow space-y-1">
                    <h4 className="font-extrabold text-slate-800 text-sm leading-tight">{comp.label}</h4>
                    <p className="text-xs text-slate-400 font-semibold">
                      Épreuve rattachée : {exams.find(e => e.competencies.some(ec => ec.code === comp.code))?.code || 'Non rattaché'} • {comp.percentage > 0 ? `${comp.percentage}% ou évalué` : '0 évaluations'}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold border flex-shrink-0 ${comp.color}`}>
                    {comp.level === 'NE' ? 'NON ÉVALUÉ' : comp.level === 'TA' ? 'ACQUIS (TA)' : comp.level === 'PA' ? 'P. ACQUIS (PA)' : comp.level === 'IA' ? 'EN COURS (EA)' : 'NON ACQUIS (NA)'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Evaluations History List */}
          <div className="bg-white rounded-[1.75rem] border border-slate-200/80 shadow-md p-6">
            <h3 className="font-extrabold text-slate-800 text-lg mb-4">
              Historique des Évaluations
            </h3>
            <div className="space-y-4 max-h-[29rem] overflow-y-auto pr-1">
              {studentSessions.length === 0 ? (
                <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <FileText className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-sm">Aucune évaluation enregistrée</p>
                  <p className="text-xs">Les évaluations de TP ou d'épreuves s'afficheront ici.</p>
                </div>
              ) : (
                studentSessions.map(session => (
                  <div key={session.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col space-y-4 relative overflow-hidden group hover:border-indigo-200 hover:shadow-md transition-all">
                    
                    {/* Title and grade */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-slate-800 text-sm leading-snug">
                          {session.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                          <Calendar size={12}/>
                          <span>Évalué le : {new Date(session.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className="text-lg font-extrabold px-3 py-1 bg-yellow-400/90 text-slate-900 rounded-xl shadow-inner">
                        {session.globalNote.toFixed(1)}/20
                      </span>
                    </div>

                    {/* Feedback/Observation comment */}
                    {session.evaluations.some(e => e.comment) && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-500 italic font-medium leading-relaxed flex items-start gap-2">
                        <MessageSquare size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                        <span>
                          "{session.evaluations.find(e => e.comment)?.comment}"
                        </span>
                      </div>
                    )}

                    {/* Competency bubbles */}
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                      {session.evaluations.map(evalu => {
                        const levelColor = evalu.level === 'TA' ? 'bg-green-500 text-white' : evalu.level === 'PA' ? 'bg-lime-500 text-slate-900' : evalu.level === 'IA' ? 'bg-yellow-400 text-slate-900' : 'bg-red-500 text-white';
                        return (
                          <span key={evalu.competencyCode} className={`px-2 py-0.5 rounded text-[10px] font-bold ${levelColor}`}>
                            {evalu.competencyCode}: {evalu.level}
                          </span>
                        );
                      })}
                      
                      {/* Action buttons on far right hover only, but styled very neatly in line */}
                      <div className="ml-auto flex items-center gap-2 no-print">
                        {onEditSession && (
                          <button
                            onClick={() => onEditSession(session)}
                            className="px-3 py-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1 transition-colors"
                          >
                            Modifier
                          </button>
                        )}
                        {onDeleteSession && (
                          <button
                            onClick={() => onDeleteSession(session.id)}
                            className="p-1 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-lg transition-colors border border-transparent"
                            title="Supprimer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      </div>

    </div>
  );
};

export default StudentDossier;
