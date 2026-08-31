import React, { useState, useMemo, useRef } from 'react';
import { TpSession, LevelCode, StudentClass, LevelDetails, Diploma } from '../types';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { FileText, Filter, ArrowRight, GraduationCap, Printer, Download } from 'lucide-react';
import { generateExamBilanPdf } from '../services/pdfService';

interface Props {
  sessions: TpSession[];
  classes: StudentClass[];
  levels: Record<LevelCode, LevelDetails>;
  diplomas: Diploma[];
  examThresholds?: { TA: number; PA: number; IA: number; };
}

const ExamBilan: React.FC<Props> = ({ sessions, classes, levels, diplomas, examThresholds }) => {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentName, setSelectedStudentName] = useState<string>('all');
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const thresholds = useMemo(() => ({
    TA: examThresholds?.TA ?? 15,
    PA: examThresholds?.PA ?? 10,
    IA: examThresholds?.IA ?? 5,
  }), [examThresholds]);

  const selectedDiploma = useMemo(() => {
    if (!selectedClassId) return null;
    const cls = classes.find(c => c.id === selectedClassId);
    if (!cls) return null;
    return diplomas.find(d => d.id === cls.diplomaId);
  }, [selectedClassId, classes, diplomas]);

  // Get repository (exams, competencies) from the selected class's diploma
  const { exams, competencies } = useMemo(() => {
    if (!selectedDiploma) return { exams: [], competencies: [] };
    
    const allCompetencies = selectedDiploma.repository.competencies || [];
    const allExams = selectedDiploma.repository.exams || [];

    const professionalExams = allExams.filter(exam => exam.isProfessional);

    return {
        exams: professionalExams,
        competencies: allCompetencies
    };
  }, [selectedDiploma]);

  // Get available students based on selected class
  const availableStudents = useMemo(() => {
      if (!selectedClassId) return [];
      const cls = classes.find(c => c.id === selectedClassId);
      return cls ? cls.students.map(s => `${s.lastName} ${s.firstName}`).sort() : [];
  }, [selectedClassId, classes]);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedClassId(e.target.value);
      setSelectedStudentName('all');
  };

  const isAllStudents = selectedStudentName === 'all';
  const currentClassName = classes.find(c => c.id === selectedClassId)?.name || "";

  // Filter sessions
  const studentSessions = useMemo(() => {
      if (!selectedClassId) return [];
      const cls = classes.find(c => c.id === selectedClassId);
      if (!cls) return [];

      let filtered = sessions.filter(s => 
          s.diplomaId === cls.diplomaId &&
          s.studentClass === cls.name
      );

      // Filter by specific student
      if (!isAllStudents) {
          filtered = filtered.filter(s => s.studentName === selectedStudentName);
      }

      return filtered;
  }, [sessions, selectedClassId, selectedStudentName, isAllStudents, classes]);

  const hasData = useMemo(() => {
      if (studentSessions.length > 0) return true;
      
      if (!selectedClassId) return false;
      const cls = classes.find(c => c.id === selectedClassId);
      if (!cls) return false;

      let targetStudents = cls.students;
      if (!isAllStudents) {
          targetStudents = targetStudents.filter(s => `${s.lastName} ${s.firstName}` === selectedStudentName);
      }

      return targetStudents.some(student => 
          student.manualCompetencyOverrides && Object.keys(student.manualCompetencyOverrides).length > 0
      );
  }, [studentSessions, selectedClassId, classes, isAllStudents, selectedStudentName]);

  const computeExamStats = (examCode: string) => {
    const examDef = exams.find(e => e.code === examCode);

    if (!examDef || examDef.competencies.length === 0) {
        return {
            note: 0,
            details: [],
            def: examDef || { code: examCode, label: `Épreuve ${examCode} (non définie)`, coef: 0, competencies: [] }
        };
    }
    
    let weightedSum = 0;
    
    const cls = classes.find(c => c.id === selectedClassId);
    let targetStudents = cls ? cls.students : [];
    if (!isAllStudents) {
        targetStudents = targetStudents.filter(s => `${s.lastName} ${s.firstName}` === selectedStudentName);
    }

    const competencyStats = examDef.competencies.map(examComp => {
        const compCode = examComp.code;
        const weight = examComp.weight;

        let totalScore = 0;
        let evaluatedStudentsCount = 0;
        let totalEvaluationsCount = 0;

        targetStudents.forEach(student => {
            const studentFullName = `${student.lastName} ${student.firstName}`;
            const userSessions = studentSessions.filter(s => s.studentName === studentFullName);
            const manualOverride = student.manualCompetencyOverrides?.[compCode];
            
            const compEvals = userSessions.flatMap(s => 
                s.evaluations.filter(ev => ev.competencyCode === compCode)
            );
            
            totalEvaluationsCount += compEvals.length;

            if (manualOverride) {
                totalScore += levels[manualOverride].score;
                evaluatedStudentsCount++;
            } else {
                const validEvals = compEvals.filter(ev => ev.level !== LevelCode.NE);
                if (validEvals.length > 0) {
                    const sum = validEvals.reduce((acc, curr) => acc + levels[curr.level].score, 0);
                    totalScore += sum / validEvals.length;
                    evaluatedStudentsCount++;
                }
            }
        });

        let avgCompScore = 0;
        if (evaluatedStudentsCount > 0) {
            avgCompScore = totalScore / evaluatedStudentsCount;
        } else {
            if (totalEvaluationsCount > 0) {
                avgCompScore = 0;
            } else {
                return null;
            }
        }
        
        weightedSum += avgCompScore * (weight / 100);
        
        return {
            code: compCode,
            avg: avgCompScore,
            count: totalEvaluationsCount, // Total evaluations including NE
            weight: weight,
        };
    }).filter(Boolean); // Filtre les compétences non évaluées

    const examNote = weightedSum;

    return {
        note: examNote,
        details: competencyStats,
        def: examDef
    };
  };

  // Only compute if sessions and exams for that diploma exist
  const examResults = hasData && exams.length > 0 ? exams.map(exam => computeExamStats(exam.code)) : [];

  const totalCoef = examResults.reduce((sum, r) => sum + r.def.coef, 0);
  const weightedSum = examResults.reduce((sum, r) => sum + (r.note * r.def.coef), 0);
  const globalProNote = totalCoef > 0 ? weightedSum / totalCoef : 0;

  const chartData = competencies.map(comp => {
      const cls = classes.find(c => c.id === selectedClassId);
      let targetStudents = cls ? cls.students : [];
      if (!isAllStudents) {
          targetStudents = targetStudents.filter(s => `${s.lastName} ${s.firstName}` === selectedStudentName);
      }

      let totalScore = 0;
      let evaluatedStudentsCount = 0;

      targetStudents.forEach(student => {
          const studentFullName = `${student.lastName} ${student.firstName}`;
          const userSessions = studentSessions.filter(s => s.studentName === studentFullName);
          const manualOverride = student.manualCompetencyOverrides?.[comp.code];
          
          if (manualOverride) {
              totalScore += levels[manualOverride].score;
              evaluatedStudentsCount++;
          } else {
              const compEvals = userSessions.flatMap(s => 
                  s.evaluations.filter(ev => ev.competencyCode === comp.code && ev.level !== LevelCode.NE)
              );
              if (compEvals.length > 0) {
                  const sum = compEvals.reduce((acc, curr) => acc + levels[curr.level].score, 0);
                  totalScore += sum / compEvals.length;
                  evaluatedStudentsCount++;
              }
          }
      });

      const avg = evaluatedStudentsCount > 0 ? totalScore / evaluatedStudentsCount : 0;
      
      return {
          subject: comp.code,
          score: avg,
          fullMark: 20
      };
  });

  const handleDownloadPdf = () => {
    if (!hasData) return;

    const selectedStudent = !isAllStudents ? classes.find(c => c.id === selectedClassId)?.students.find(s => `${s.lastName} ${s.firstName}` === selectedStudentName) : null;
    const birthDate = selectedStudent?.birthDate;

    generateExamBilanPdf(
        isAllStudents ? "Bilan de Classe" : "Bilan Périodique",
        { student: isAllStudents ? "Tous les élèves" : selectedStudentName, class: currentClassName, birthDate },
        globalProNote,
        examResults
    );
  };


  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
        <h2 className="text-2xl font-bold text-gray-800">
            Bilan Examens {selectedDiploma ? `(${selectedDiploma.name})` : ''}
        </h2>
        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between no-print">
             <div className="flex items-center gap-4 w-full md:w-auto flex-1">
                 <div className="flex items-center gap-2 text-gray-700 font-bold whitespace-nowrap">
                     <Filter size={20} className="text-indigo-600"/>
                     Sélection :
                 </div>
                 
                 <select 
                    value={selectedClassId}
                    onChange={handleClassChange}
                    className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm w-full md:w-48 font-medium text-gray-700"
                 >
                     <option value="">-- Choisir une classe --</option>
                     {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>

                 <div className="flex items-center gap-2 w-full md:w-auto">
                     <ArrowRight size={16} className="text-gray-400 hidden md:block"/>
                     <select 
                        value={selectedStudentName}
                        onChange={(e) => setSelectedStudentName(e.target.value)}
                        disabled={!selectedClassId}
                        className={`p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm w-full md:w-64 ${!selectedClassId ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'font-medium text-gray-700'}`}
                     >
                         <option value="all">Tous les élèves</option>
                         {availableStudents.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                 </div>
             </div>

             {/* Action Buttons */}
             {selectedClassId && hasData && (
                <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-4 mt-2 md:mt-0 w-full md:w-auto justify-end">
                    <button 
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-md font-bold shadow-sm transition-transform hover:scale-105"
                    >
                        <Printer size={18} /> Imprimer
                    </button>
                    <button 
                        onClick={handleDownloadPdf}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-bold shadow-sm transition-transform hover:scale-105"
                    >
                        <Download size={18} /> PDF
                    </button>
                </div>
             )}
        </div>

        {/* Content */}
        {!selectedClassId ? (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500 shadow-sm">
                <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <GraduationCap size={32} className="text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-700 mb-1">Aucune classe sélectionnée</h3>
                <p>Veuillez choisir une classe pour afficher les bilans d'examens.</p>
            </div>
        ) : !hasData ? (
             <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
                  <FileText size={48} className="mb-4 opacity-50"/>
                  <p className="text-lg">
                      {isAllStudents 
                        ? `Aucune donnée disponible pour la classe ${currentClassName}.` 
                        : `Aucune donnée trouvée pour l'élève "${selectedStudentName}"`
                      }
                  </p>
              </div>
        ) : (
            // Render Dashboard
            <div className="space-y-8">
                 {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold mb-2">{isAllStudents ? "Bilan de Classe" : "Bilan Périodique"}</h2>
                        <p className="text-slate-300">
                            Nom Prénom : <span className="font-semibold text-white">{isAllStudents ? "Tous les élèves" : selectedStudentName}</span>
                            {isAllStudents && <span className="ml-2 text-xs opacity-75">({currentClassName})</span>}
                        </p>
                        {!isAllStudents && (() => {
                            const s = classes.find(c => c.id === selectedClassId)?.students.find(s => `${s.lastName} ${s.firstName}` === selectedStudentName);
                            if (s?.birthDate) {
                                return (
                                    <p className="text-slate-300 text-sm mt-1">
                                        Date de naissance : <span className="font-semibold text-white">{new Date(s.birthDate).toLocaleDateString()}</span>
                                    </p>
                                );
                            }
                            return null;
                        })()}
                        <p className="text-slate-300 text-sm mt-1">
                            {studentSessions.length > 0 
                                ? `${studentSessions.length} TP(s) évalué(s)` 
                                : "Évaluations manuelles uniquement"}
                        </p>
                    </div>
                    <div className="mt-4 md:mt-0 text-right">
                        <div className="text-sm text-slate-400 uppercase tracking-wider font-semibold">
                            {isAllStudents ? "Moyenne Classe" : "Note Globale \"Pro\""}
                        </div>
                        <div className="text-5xl font-bold">{globalProNote.toFixed(2)}<span className="text-2xl text-slate-500">/20</span></div>
                    </div>
                </div>

                {/* Charts & Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Chart */}
                    <div ref={chartContainerRef} className="lg:col-span-1 bg-white p-4 rounded-xl shadow-md border border-gray-200 h-96 break-inside-avoid">
                        <h3 className="font-bold text-gray-700 mb-4 text-center">{isAllStudents ? "Radar Moyen (Classe)" : "Radar des Compétences"}</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 20]} />
                                <Radar name="Moyenne" dataKey="score" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.4} />
                                <Legend />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Exam Cards */}
                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {examResults.map((res) => (
                            <div key={res.def.code} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col break-inside-avoid">
                                <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                                     <div>
                                         <div className="flex items-center gap-2">
                                             <span className="font-bold text-indigo-700">{res.def.code}</span>
                                             <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Coef {res.def.coef}</span>
                                         </div>
                                         <p className="text-xs text-gray-500 mt-1">{res.def.label}</p>
                                     </div>
                                     <div className={`text-2xl font-bold ${res.note >= thresholds.PA ? 'text-gray-800' : 'text-red-500'}`}>
                                         {res.note.toFixed(1)}
                                     </div>
                                </div>
                                <div className="p-4 flex-1 overflow-y-auto max-h-60">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-gray-400 border-b border-gray-100">
                                                <th className="pb-2 font-medium">Comp.</th>
                                                <th className="pb-2 font-medium text-right">Poids</th>
                                                <th className="pb-2 font-medium text-center">Niv.</th>
                                                <th className="pb-2 font-medium text-right">Moy.</th>
                                                <th className="pb-2 font-medium text-right">Nb.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {res.details.map(d => {
                                                if (!d) return null;
                                                const getLevel = () => {
                                                    if (d.count === 0) return { code: '-', color: 'text-gray-400' };
                                                    if (d.avg >= thresholds.TA) return { code: 'TA', color: 'bg-green-100 text-green-800' };
                                                    if (d.avg >= thresholds.PA) return { code: 'PA', color: 'bg-lime-100 text-lime-900' };
                                                    if (d.avg >= thresholds.IA) return { code: 'IA', color: 'bg-yellow-100 text-yellow-900' };
                                                    return { code: 'NA', color: 'bg-red-100 text-red-800' };
                                                };
                                                const levelInfo = getLevel();

                                                return (
                                                <tr key={d.code} className="border-b border-gray-50 last:border-0">
                                                    <td className="py-2 font-medium text-gray-700" title={competencies.find(c => c.code === d.code)?.label}>
                                                        {d.code}
                                                    </td>
                                                    <td className="py-2 text-right text-gray-400 text-xs">{d.weight.toFixed(0)}%</td>
                                                    <td className="py-2 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${levelInfo.color}`}>
                                                            {levelInfo.code}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 text-right font-mono">
                                                        <span className={`px-2 py-0.5 rounded ${
                                                            d.avg >= thresholds.TA ? 'bg-green-50 text-green-800' : // TA
                                                            d.avg >= thresholds.PA ? 'bg-lime-50 text-lime-900' : // PA
                                                            d.avg >= thresholds.IA ? 'bg-yellow-50 text-yellow-900' : // IA
                                                            d.count > 0 ? 'bg-red-50 text-red-800' : 'text-gray-400' // NA ou NE
                                                        }`}>
                                                            {d.count > 0 ? d.avg.toFixed(1) : '-'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 text-right text-gray-400 text-xs">{d.count}</td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ExamBilan;