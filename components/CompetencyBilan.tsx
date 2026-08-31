import React, { useState, useMemo } from 'react';
import { TpSession, LevelCode, StudentClass, LevelDetails, CompetencyDef, ExamDef, Diploma } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Table, BarChart3, Users, Filter, ArrowRight, Printer, Download } from 'lucide-react';
import { generateCompetencyBilanPdf } from '../services/pdfService';

interface Props {
  sessions: TpSession[];
  classes: StudentClass[];
  onUpdateClasses?: (classes: StudentClass[] | ((prev: StudentClass[]) => StudentClass[])) => void;
  levels: Record<LevelCode, LevelDetails>;
  diplomas: Diploma[];
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

const CompetencyMatrix = ({ details, onOverride, onMouseEnter, onMouseLeave }: { details: CompetencyDetail[], onOverride?: (compCode: string, level: LevelCode | null) => void, onMouseEnter?: (e: React.MouseEvent, d: CompetencyDetail) => void, onMouseLeave?: () => void }) => {
    if (!details || details.length === 0) return null;
    return (
        <div className="w-full min-w-[350px]">
            {/* Codes */}
            <div className="flex">
                {details.map(d => (
                    <div 
                        key={d.code} 
                        className="flex-1 text-center text-xs font-bold text-gray-600 truncate px-1 cursor-help hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        onMouseEnter={(e) => onMouseEnter && onMouseEnter(e, d)}
                        onMouseLeave={() => onMouseLeave && onMouseLeave()}
                    >
                        {d.code}
                        {d.isManual && <span className="text-[8px] text-indigo-500 ml-0.5" title="Modifié manuellement">*</span>}
                    </div>
                ))}
            </div>
             {/* Average Scores */}
            <div className="flex mt-1">
                {details.map(d => (
                    <div key={d.code} className="flex-1 text-center text-[10px] text-gray-500 font-mono">
                        {d.level === 'NE' ? '-' : (d.isManual ? '-' : d.avgScore.toFixed(1))}
                    </div>
                ))}
            </div>
            {/* Percentages */}
            <div className="flex mt-1">
                {details.map(d => (
                    <div key={d.code} className="flex-1 text-center text-[10px] text-gray-500">
                        {d.level === 'NE' ? '-' : (d.isManual ? '-' : `${d.percentage}%`)}
                    </div>
                ))}
            </div>
            {/* Color bars / Selects */}
            <div className="flex mt-1 h-6 gap-px">
                {details.map(d => (
                    <div key={d.code} title={`${d.code}: ${d.level} ${!d.isManual && d.level !== 'NE' ? `(${d.avgScore.toFixed(1)}/20 - ${d.percentage}%)` : ''}`} className={`flex-1 relative rounded-sm ${d.color} ${d.textColor}`}>
                        {onOverride ? (
                            <select
                                value={d.isManual ? d.level : 'auto'}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'auto') {
                                        onOverride(d.code, null);
                                    } else {
                                        onOverride(d.code, val as LevelCode);
                                    }
                                }}
                                className={`w-full h-full appearance-none bg-transparent text-center text-[10px] font-bold cursor-pointer outline-none ${d.textColor}`}
                                style={{ textAlignLast: 'center' }}
                            >
                                <option value="auto" className="text-gray-800 bg-white">Auto ({d.level !== 'NE' ? d.level : '-'})</option>
                                <option value={LevelCode.TA} className="text-white bg-green-600">TA</option>
                                <option value={LevelCode.PA} className="text-lime-950 bg-lime-500">PA</option>
                                <option value={LevelCode.IA} className="text-yellow-950 bg-yellow-400">IA</option>
                                <option value={LevelCode.NA} className="text-white bg-red-600">NA</option>
                            </select>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold">
                                {d.level !== 'NE' ? d.level : ''}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};


const CompetencyBilan: React.FC<Props> = ({ sessions, classes, onUpdateClasses, levels, diplomas, examThresholds }) => {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentName, setSelectedStudentName] = useState<string>('all');
  const [tooltipData, setTooltipData] = useState<{ code: string, label: string, criteria?: string[], x: number, y: number } | null>(null);

  const thresholds = useMemo(() => ({
    TA: examThresholds?.TA ?? 15,
    PA: examThresholds?.PA ?? 10,
    IA: examThresholds?.IA ?? 5,
  }), [examThresholds]);

  // --- Derive diploma, competencies, exams from selection ---
  const selectedDiploma = useMemo(() => {
    if (!selectedClassId) return null;
    const cls = classes.find(c => c.id === selectedClassId);
    if (!cls) return null;
    return diplomas.find(d => d.id === cls.diplomaId);
  }, [selectedClassId, classes, diplomas]);

  const { competencies, exams } = useMemo(() => {
    if (!selectedDiploma) return { competencies: [], exams: [] };
    
    const allCompetencies = selectedDiploma.repository.competencies || [];
    const allExams = selectedDiploma.repository.exams || [];

    const professionalExams = allExams.filter(exam => exam.isProfessional);

    return {
        competencies: allCompetencies,
        exams: professionalExams
    };
  }, [selectedDiploma]);
  
  // --- Filtering Logic ---
  
  // Get available students based on selected class
  const availableStudents = useMemo(() => {
      if (!selectedClassId) return [];
      
      const cls = classes.find(c => c.id === selectedClassId);
      if (cls) {
          return cls.students.map(s => `${s.lastName} ${s.firstName}`).sort();
      }
      return [];
  }, [selectedClassId, classes]);

  // Handle Class Change
  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedClassId(e.target.value);
      setSelectedStudentName('all'); // Reset student selection
  };

  const handleMouseEnter = (e: React.MouseEvent, d: CompetencyDetail) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltipData({
          code: d.code,
          label: d.label || '',
          criteria: d.criteria,
          x: rect.left + rect.width / 2,
          y: rect.top
      });
  };

  const handleMouseLeave = () => {
      setTooltipData(null);
  };

  // --- Data Preparation ---

  const isAllStudents = selectedStudentName === 'all';
  const currentClassName = classes.find(c => c.id === selectedClassId)?.name || "";
  
  const filteredSessions = useMemo(() => {
    if (!selectedClassId) return [];
    const cls = classes.find(c => c.id === selectedClassId);
    if (!cls) return [];
    
    return sessions.filter(s => 
        s.diplomaId === cls.diplomaId &&
        s.studentClass === cls.name
    );
  }, [sessions, selectedClassId, classes]);

  // Data for Table View (Student List with Grades)
  const tableData = useMemo(() => {
    if (!selectedClassId || competencies.length === 0) return [];

    const studentMap = new Map<string, { id: string, name: string, class: string, birthDate?: string, overrides: Record<string, LevelCode> }>();
    
    const cls = classes.find(c => c.id === selectedClassId);
    if (cls) {
        cls.students.forEach(s => {
             const fullName = `${s.lastName} ${s.firstName}`;
             studentMap.set(fullName, { id: s.id, name: fullName, class: cls.name, birthDate: s.birthDate, overrides: s.manualCompetencyOverrides || {} });
        });
    }

    // Filter by specific student if selected
    let students = Array.from(studentMap.values());
    if (!isAllStudents) {
        students = students.filter(s => s.name === selectedStudentName);
    }
    
    // Calculate stats per student
    return students.map(student => {
        const userSessions = filteredSessions.filter(s => s.studentName === student.name);
         
         // 1. Coverage & Status Breakdown for PDF
         let acquiredCount = 0, inProgressCount = 0, notAcquiredCount = 0, evaluatedCount = 0;
         
         const competencyDetails = competencies.map(comp => {
            const manualOverride = student.overrides[comp.code];
            
            const compEvals = userSessions.flatMap(s => 
                s.evaluations.filter(e => e.competencyCode === comp.code && e.level !== LevelCode.NE)
            );

            if (manualOverride || compEvals.length > 0) {
                evaluatedCount++;
                
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
                
                let color = 'bg-red-600', textColor = 'text-white font-bold';
                if (level === 'TA') {
                    color = 'bg-green-600'; textColor = 'text-white font-bold';
                } else if (level === 'PA') {
                    color = 'bg-lime-500'; textColor = 'text-lime-950 font-bold';
                } else if (level === 'IA') {
                    color = 'bg-yellow-400'; textColor = 'text-yellow-950 font-bold';
                }

                // For PDF stats
                if (level === 'TA') acquiredCount++;
                else if (level === 'PA') inProgressCount++;
                else notAcquiredCount++;

                return { code: comp.code, label: comp.label, criteria: comp.criteria, percentage, level, color, textColor, avgScore, isManual: !!manualOverride };
            }

            return { code: comp.code, label: comp.label, criteria: comp.criteria, percentage: 0, level: 'NE', color: 'bg-gray-100 border border-gray-200', textColor: 'text-gray-400', avgScore: 0, isManual: false };
         });


         // 2. Exam Grades Calculation
        const examGrades: Record<string, number | null> = {};
        const hasAnyEvaluatedSessions = evaluatedCount > 0;

        if (hasAnyEvaluatedSessions) {
            exams.forEach(exam => {
                if (!exam.competencies || exam.competencies.length === 0) {
                    examGrades[exam.code] = 0;
                    return;
                }
                
                let weightedSum = 0;
                let wasAnyCompetencyAssessed = false;

                exam.competencies.forEach(examComp => {
                    const compCode = examComp.code;
                    const weight = examComp.weight;

                    const compDetail = competencyDetails.find(d => d.code === compCode);

                    if (compDetail && compDetail.level !== 'NE') {
                        wasAnyCompetencyAssessed = true;
                        weightedSum += compDetail.avgScore * (weight / 100);
                    }
                });
                
                examGrades[exam.code] = wasAnyCompetencyAssessed ? weightedSum : null;
            });
        } else {
            exams.forEach(exam => {
                examGrades[exam.code] = null;
            });
        }


         // 3. Global Weighted Average
         let totalCoef = 0;
         let weightedSumOfGrades = 0;

         if (hasAnyEvaluatedSessions) {
            exams.forEach(exam => {
                const grade = examGrades[exam.code];
                if (grade !== null) {
                    weightedSumOfGrades += grade * exam.coef;
                    totalCoef += exam.coef;
                }
            });
         }

         const globalAvg = hasAnyEvaluatedSessions && totalCoef > 0 ? weightedSumOfGrades / totalCoef : null;

         return {
             ...student,
             evaluatedCount,
             competencyDetails,
             status: { acquired: acquiredCount, inProgress: inProgressCount, notAcquired: notAcquiredCount },
             exams: examGrades,
             globalAvg
         };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredSessions, classes, selectedClassId, selectedStudentName, isAllStudents, levels, competencies, exams, thresholds]);

  // Data for Chart View (Aggregated or Single Student)
  const chartData = useMemo(() => {
      if (!selectedClassId || competencies.length === 0 || tableData.length === 0) return [];

      return competencies.map(comp => {
          let sum = 0;
          let count = 0;
          
          tableData.forEach(student => {
              const compDetail = student.competencyDetails.find(d => d.code === comp.code);
              if (compDetail && compDetail.level !== 'NE') {
                  sum += compDetail.avgScore;
                  count++;
              }
          });
          
          return {
              name: comp.code,
              label: comp.label,
              score: count > 0 ? parseFloat((sum / count).toFixed(2)) : 0,
              count: count,
              activities: comp.activities
          };
      });
  }, [selectedClassId, competencies, tableData]);

  // Data for the detailed competency summary table in the PDF
  const competencySummaryData = useMemo(() => {
    return chartData.map(comp => {
        let level = 'NA';
        if (comp.score >= thresholds.TA) level = 'TA';
        else if (comp.score >= thresholds.PA) level = 'PA';
        else if (comp.score >= thresholds.IA) level = 'IA';

        return {
            code: comp.name,
            label: comp.label,
            percentage: `${Math.round((comp.score / 20) * 100)}%`,
            level
        };
    });
  }, [chartData, thresholds]);


  const handleDownloadPdf = () => {
    if (tableData.length === 0) return;

    const selectedStudent = !isAllStudents ? tableData.find(s => s.name === selectedStudentName) : null;
    const birthDate = selectedStudent?.birthDate;

    generateCompetencyBilanPdf(
        "Bilan Détaillé des Compétences",
        { student: isAllStudents ? "Tous les élèves" : selectedStudentName, class: currentClassName, birthDate },
        tableData,
        competencySummaryData,
        exams
    );
  };


  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-md shadow-lg border border-gray-200">
          <p className="font-bold text-gray-800">{label}: {data.label}</p>
          <p className="text-indigo-600 font-semibold">Note moyenne: {data.score}</p>
          <p className="text-xs text-gray-500">{data.count} évaluation(s)</p>
          <p className="text-xs text-gray-500 mt-1">Activités: {data.activities.join(', ')}</p>
        </div>
      );
    }
    return null;
  };
  
  const handleOverride = (studentId: string, compCode: string, level: LevelCode | null) => {
    if (!onUpdateClasses) return;
    
    onUpdateClasses(prevClasses => {
        return prevClasses.map(cls => {
            if (cls.id !== selectedClassId) return cls;
            
            return {
                ...cls,
                students: cls.students.map(student => {
                    if (student.id !== studentId) return student;
                    
                    const newOverrides = { ...(student.manualCompetencyOverrides || {}) };
                    if (level === null) {
                        delete newOverrides[compCode];
                    } else {
                        newOverrides[compCode] = level;
                    }
                    
                    return {
                        ...student,
                        manualCompetencyOverrides: newOverrides
                    };
                })
            };
        });
    });
  };

  const renderContent = () => {
    if (!selectedClassId) {
      return (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
             <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Users size={32} className="text-indigo-400" />
             </div>
             <h3 className="text-lg font-bold text-gray-700 mb-1">Aucune classe sélectionnée</h3>
             <p>Veuillez choisir une classe pour afficher le bilan des compétences.</p>
         </div>
      );
    }

    if (viewMode === 'chart') {
      return (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 h-[500px]">
           <h3 className="font-bold text-gray-700 mb-4 text-center">
             {isAllStudents ? `Moyenne de la classe (${currentClassName})` : `Bilan de ${selectedStudentName}`}
           </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 20]} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="score">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={
                    entry.score >= thresholds.TA ? '#16a34a' :
                    entry.score >= thresholds.PA ? '#84cc16' :
                    entry.score >= thresholds.IA ? '#facc15' :
                    entry.score > 0 ? '#dc2626' :
                    '#9ca3af'
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-3 font-semibold sticky left-0 bg-gray-50 z-10">Élève</th>
              <th className="px-4 py-3 font-semibold">Bilan des Compétences</th>
              {exams.map(exam => (
                <th key={exam.code} className="px-6 py-3 font-semibold text-center">{exam.code}</th>
              ))}
              <th className="px-6 py-3 font-semibold text-center">Moy. Pro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tableData.map(row => (
              <tr key={row.name}>
                <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-800 sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r border-gray-200">{row.name}</td>
                <td className="px-4 py-2">
                   <CompetencyMatrix 
                       details={row.competencyDetails} 
                       onOverride={(compCode, level) => handleOverride(row.id, compCode, level)} 
                       onMouseEnter={handleMouseEnter}
                       onMouseLeave={handleMouseLeave}
                   />
                </td>
                {exams.map(exam => (
                    <td key={exam.code} className="px-6 py-4 whitespace-nowrap text-center font-mono">
                        {row.exams[exam.code] != null ? row.exams[exam.code].toFixed(1) : '-'}
                    </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-center font-mono font-bold text-lg">
                    {row.globalAvg !== null ? (
                       <span className={`px-2 py-1 rounded ${
                           row.globalAvg >= thresholds.TA ? 'text-green-800 bg-green-50' :
                           row.globalAvg >= thresholds.PA ? 'text-lime-900 bg-lime-50' :
                           row.globalAvg >= thresholds.IA ? 'text-yellow-900 bg-yellow-50' :
                           'text-red-800 bg-red-50'
                       }`}>
                           {row.globalAvg.toFixed(2)}
                       </span>
                    ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
      <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-gray-800">
              Bilan Compétences {selectedDiploma ? `(${selectedDiploma.name})` : ''}
          </h2>
          {!isAllStudents && (() => {
              const s = classes.find(c => c.id === selectedClassId)?.students.find(s => `${s.lastName} ${s.firstName}` === selectedStudentName);
              if (s?.birthDate) {
                  return (
                      <p className="text-gray-500 text-sm">
                          Date de naissance : <span className="font-semibold">{new Date(s.birthDate).toLocaleDateString()}</span>
                      </p>
                  );
              }
              return null;
          })()}
      </div>
      {/* Header & Filters */}
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
          
          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-4 mt-2 md:mt-0 w-full md:w-auto justify-end">
              <div className="flex bg-gray-100 rounded-lg p-1">
                  <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1 transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-white/50'}`}><Table size={14}/> Tableau</button>
                  <button onClick={() => setViewMode('chart')} className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1 transition-all ${viewMode === 'chart' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-white/50'}`}><BarChart3 size={14}/> Graphique</button>
              </div>

              {selectedClassId && (
                <>
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-md font-bold shadow-sm transition-transform hover:scale-105"
                    title="Imprimer"
                  >
                      <Printer size={16} />
                  </button>
                  <button 
                    onClick={handleDownloadPdf}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-bold shadow-sm transition-transform hover:scale-105"
                    title="Télécharger en PDF"
                  >
                      <Download size={16} />
                  </button>
                </>
              )}
          </div>
      </div>
      
      {renderContent()}

      {/* Fixed Tooltip */}
      {tooltipData && (
          <div 
              className="fixed z-[100] w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
              style={{ left: tooltipData.x, top: tooltipData.y - 8 }}
          >
              <div className="font-bold text-indigo-300 mb-1">{tooltipData.code}</div>
              <div className="font-semibold text-sm leading-tight">{tooltipData.label}</div>
              {tooltipData.criteria && tooltipData.criteria.length > 0 && (
                  <ul className="text-gray-300 mt-2 text-[11px] leading-relaxed list-disc pl-3">
                      {tooltipData.criteria.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
              )}
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
          </div>
      )}
    </div>
  );
};

export default CompetencyBilan;