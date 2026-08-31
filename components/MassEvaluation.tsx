
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TpSession, StudentClass, EvaluationItem, LevelCode, CompetencyCode, LevelDetails, Diploma, Student, CompetencyDef } from '../types';
import { Save, Users, ArrowRight, AlertCircle, History, Eye, Trash2, Printer, Download, FileDown } from 'lucide-react';
import { generateMassEvaluationPdf } from '../services/pdfService';

interface Props {
  sessions: TpSession[];
  classes: StudentClass[];
  onSaveBatch: (newSessions: TpSession[]) => void;
  onUpdateBatch: (updatedSessions: TpSession[], originalGroupKey: string) => void;
  onDeleteBatch: (date: string, className: string, tpTitle: string, diplomaId: string) => void;
  levels: Record<LevelCode, LevelDetails>;
  diplomas: Diploma[];
}

const MassEvaluation: React.FC<Props> = ({ sessions, classes, onSaveBatch, onUpdateBatch, onDeleteBatch, levels, diplomas }) => {
  const [selectedTpId, setSelectedTpId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  
  // Map of studentId -> EvaluationItem[]
  const [grades, setGrades] = useState<Record<string, EvaluationItem[]>>({});

  const isEditing = !!editingGroupKey;
  const componentRef = useRef<HTMLDivElement>(null);

  // Derive selected class, its diploma, and its competencies
  const selectedClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);
  
  const selectedDiploma = useMemo(() => {
    if (!selectedClass) return null;
    return diplomas.find(d => d.id === selectedClass.diplomaId);
  }, [diplomas, selectedClass]);

  const competencies = useMemo(() => selectedDiploma?.repository.competencies || [], [selectedDiploma]);
  
  // Get the template session details from the full sessions list
  const templateTp = useMemo(() => sessions.find(s => s.id === selectedTpId), [sessions, selectedTpId]);

  // Helper to get sorted competencies from a TP
  const getTpCompetencies = (tp: TpSession | undefined) => {
      if (!tp) return [];
      return Array.from(new Set(tp.evaluations.map(e => e.competencyCode)))
        .sort((a, b) => {
            const numA = parseInt((a as string).replace('C', ''));
            const numB = parseInt((b as string).replace('C', ''));
            return numA - numB;
        }) as CompetencyCode[];
  };

  const tpCompetencies = useMemo(() => getTpCompetencies(templateTp), [templateTp]);

  const studentsToDisplay = useMemo(() => {
    if (!selectedClass) return [];

    // Règle 3: When editing a historical batch, show all students from the class
    if (isEditing) {
        return selectedClass.students;
    }

    if (!templateTp) {
        return []; // Don't show any students until a TP is selected
    }

    // Règle 2: For new evaluations, filter out already evaluated students
    const evaluatedStudentNames = new Set(
        sessions
            .filter(s => 
                !s.isTemplate &&
                s.title === templateTp.title &&
                s.studentClass === selectedClass.name &&
                s.diplomaId === selectedClass.diplomaId
            )
            .map(s => s.studentName)
    );

    return selectedClass.students.filter(student => {
        const fullName = `${student.lastName} ${student.firstName}`;
        return !evaluatedStudentNames.has(fullName);
    });
  }, [selectedClass, templateTp, sessions, isEditing, classes]); // Added classes to dependency array

  useEffect(() => {
      if (!isEditing && templateTp && studentsToDisplay) {
          const newGrades: Record<string, EvaluationItem[]> = {};
          studentsToDisplay.forEach(s => {
              newGrades[s.id] = tpCompetencies.map(c => ({ competencyCode: c, level: LevelCode.NE, comment: '' }));
          });
          setGrades(newGrades);
      }
      if (!templateTp) {
          setGrades({});
      }
  }, [studentsToDisplay, tpCompetencies, templateTp, isEditing]);


  // --- Handlers ---

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newClassId = e.target.value;
      setSelectedClassId(newClassId);
      setSelectedTpId('');
      setGrades({});
      setEditingGroupKey(null);
  };

  const handleTpChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newTpId = e.target.value;
      setSelectedTpId(newTpId);
      setEditingGroupKey(null);
  };

  const handleLoadHistory = (group: any) => {
      const cls = classes.find(c => c.name === group.className && c.diplomaId === group.diplomaId);
      const tp = sessions.find(s => s.title === group.tpTitle && s.diplomaId === group.diplomaId && s.isTemplate);
      
      if (!cls || !tp) {
          alert("Impossible de charger : La classe ou la Séquence d'origine semble introuvable.");
          return;
      }

      setEditingGroupKey(group.key);

      const relevantSessions = sessions.filter(s => 
          s.date === group.date && 
          s.studentClass === group.className && 
          s.title === group.tpTitle &&
          s.diplomaId === group.diplomaId
      );

      const compCodes = getTpCompetencies(tp);
      const historyGrades: Record<string, EvaluationItem[]> = {};

      cls.students.forEach(student => {
          const studentSession = relevantSessions.find(s => s.studentName === `${student.lastName} ${student.firstName}`);
          
          if (studentSession) {
              historyGrades[student.id] = compCodes.map(c => {
                  const existingEval = studentSession.evaluations.find(e => e.competencyCode === c);
                  return existingEval 
                      ? { ...existingEval }
                      : { competencyCode: c, level: LevelCode.NE, comment: '' };
              });
          } else {
              historyGrades[student.id] = compCodes.map(c => ({ competencyCode: c, level: LevelCode.NE, comment: '' }));
          }
      });

      setSelectedClassId(cls.id);
      setSelectedTpId(tp.id);
      setGrades(historyGrades);
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGradeChange = (studentId: string, compCode: CompetencyCode, newLevel: LevelCode) => {
    setGrades(prev => {
      const studentGrades = [...(prev[studentId] || [])];
      const index = studentGrades.findIndex(g => g.competencyCode === compCode);
      
      if (index >= 0) {
        studentGrades[index] = { ...studentGrades[index], level: newLevel };
      }
      
      return { ...prev, [studentId]: studentGrades };
    });
  };

  const cycleGrade = (current: LevelCode): LevelCode => {
      const order = [LevelCode.NE, LevelCode.NA, LevelCode.IA, LevelCode.PA, LevelCode.TA];
      const idx = order.indexOf(current);
      return order[(idx + 1) % order.length];
  };

  const calculateStudentNote = (studentEvals: EvaluationItem[]) => {
      const validEvals = studentEvals.filter(e => e.level !== LevelCode.NE);
      if (validEvals.length === 0) return 0;
      const total = validEvals.reduce((sum, item) => sum + levels[item.level].score, 0);
      return parseFloat((total / validEvals.length).toFixed(2));
  };

  const handleSave = () => {
    if (!templateTp || !selectedClass) return;

    if (editingGroupKey) {
      // --- UPDATE LOGIC ---
      const [date, className, , diplomaId] = editingGroupKey.split('|');
      const sessionsForBatch: TpSession[] = [];
      
      selectedClass.students.forEach(student => {
        const studentEvals = grades[student.id];
        const studentFullName = `${student.lastName} ${student.firstName}`;
        const originalSession = sessions.find(s => 
          s.date === date && 
          s.studentClass === className && 
          s.title === templateTp.title &&
          s.studentName === studentFullName &&
          s.diplomaId === diplomaId
        );

        if (!studentEvals && !originalSession) return;
        if (!studentEvals) return; 

        const note = calculateStudentNote(studentEvals);
        
        if (originalSession) {
          sessionsForBatch.push({ ...originalSession, evaluations: studentEvals, globalNote: note });
        } else if (studentEvals && !studentEvals.every(e => e.level === LevelCode.NE)) {
          // This logic adds a new student to an existing batch
          sessionsForBatch.push({
            id: crypto.randomUUID(),
            templateId: templateTp.id,
            isTemplate: false,
            diplomaId: selectedClass.diplomaId,
            title: templateTp.title,
            activities: templateTp.activities,
            date: date,
            studentName: studentFullName,
            studentClass: className,
            evaluations: studentEvals,
            globalNote: note,
          });
        }
      });

      const finalSessionsToUpdate = sessionsForBatch.filter(s => s.evaluations.some(e => e.level !== LevelCode.NE));

      onUpdateBatch(finalSessionsToUpdate, editingGroupKey);
      setEditingGroupKey(null);
      setSelectedClassId('');
      setSelectedTpId('');
      setGrades({});

    } else {
      // --- CREATE LOGIC ---
      const newSessions: TpSession[] = [];
      const today = new Date().toISOString().split('T')[0];

      studentsToDisplay.forEach(student => {
          const studentEvals = grades[student.id];
          if (!studentEvals || studentEvals.every(e => e.level === LevelCode.NE)) return;
          
          const note = calculateStudentNote(studentEvals);

          const newSession: TpSession = {
              id: crypto.randomUUID(),
              templateId: templateTp.id,
              isTemplate: false,
              diplomaId: selectedClass.diplomaId,
              title: templateTp.title,
              activities: templateTp.activities,
              date: today,
              studentName: `${student.lastName} ${student.firstName}`,
              studentClass: selectedClass.name,
              evaluations: studentEvals,
              globalNote: note,
          };
          newSessions.push(newSession);
      });

      if (newSessions.length === 0) {
          alert("Aucune note saisie. Veuillez évaluer au moins un élève.");
          return;
      }
      onSaveBatch(newSessions);
      setSelectedTpId('');
      setGrades({});
    }
  };

  const handlePrintActiveGrid = () => {
      window.print();
  };

  const handleGenerateActivePdf = () => {
    if (!selectedClass || !templateTp) return;

    // Construct mock sessions for PDF generation based on current active UI state
    const mockSessions = studentsToDisplay.map(student => {
         const studentEvals = grades[student.id] || [];
         const note = calculateStudentNote(studentEvals);
         return {
             id: student.id, // temporary id
             templateId: templateTp.id,
             isTemplate: false,
             diplomaId: selectedClass.diplomaId,
             title: templateTp.title,
             activities: [],
             date: new Date().toISOString(),
             studentName: `${student.lastName} ${student.firstName}`,
             studentClass: selectedClass.name,
             evaluations: studentEvals,
             globalNote: note
         } as TpSession;
    });

    generateMassEvaluationPdf(
        templateTp.title,
        selectedClass.name,
        isEditing && editingGroupKey ? editingGroupKey.split('|')[0] : new Date().toISOString(),
        studentsToDisplay,
        tpCompetencies,
        mockSessions,
        levels,
        competencies
    );
  };

  const handleHistoryPdf = (group: any) => {
    const cls = classes.find(c => c.name === group.className && c.diplomaId === group.diplomaId);
    const tp = sessions.find(s => s.title === group.tpTitle && s.diplomaId === group.diplomaId && s.isTemplate);
    if (!cls || !tp) return;

    const groupSessions = sessions.filter(s => 
        s.date === group.date && s.studentClass === group.className && s.title === group.tpTitle && s.diplomaId === group.diplomaId
    );
    
    generateMassEvaluationPdf(
        tp.title,
        cls.name,
        group.date,
        cls.students,
        getTpCompetencies(tp),
        groupSessions,
        levels,
        competencies
    );
  };


  const uniqueTpOptions = useMemo(() => {
    if (!selectedClass) return [];
    return sessions.filter(s => s.isTemplate && s.diplomaId === selectedClass.diplomaId);
  }, [sessions, selectedClass]);

  const groupedHistory = useMemo(() => {
      const groups: Record<string, {
          key: string; date: string; className: string; tpTitle: string;
          count: number; sumNotes: number; diplomaId: string; totalStudents: number;
      }> = {};

      sessions.forEach(s => {
          if (!s.studentClass || s.isTemplate || !s.diplomaId) return;
          const key = `${s.date}|${s.studentClass}|${s.title}|${s.diplomaId}`;
          if (!groups[key]) {
              const cls = classes.find(c => c.name === s.studentClass && c.diplomaId === s.diplomaId);
              groups[key] = {
                  key, date: s.date, className: s.studentClass, tpTitle: s.title,
                  count: 0, sumNotes: 0, diplomaId: s.diplomaId,
                  totalStudents: cls ? cls.students.length : 0,
              };
          }
          groups[key].count++;
          groups[key].sumNotes += s.globalNote;
      });

      return Object.values(groups)
          .map(g => ({ ...g, average: (g.count > 0 ? (g.sumNotes / g.count).toFixed(2) : '0.00') }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, classes]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 pb-12">

      <div className="flex items-center justify-between no-print">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Users className="text-indigo-600"/> 
              Notes & Évaluations
          </h2>
          {selectedClass && templateTp && studentsToDisplay.length > 0 && (
             <button 
                type="button"
                onClick={handleSave}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded shadow-md flex items-center gap-2"
            >
                <Save size={18} /> {isEditing ? 'Mettre à jour' : 'Enregistrer les évaluations'}
            </button>
          )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
         <div>
             <label className="block text-sm font-bold text-gray-700 mb-2">1. Choisir la Classe</label>
             <select 
                value={selectedClassId}
                onChange={handleClassChange}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
             >
                 <option value="">-- Sélectionner une Classe --</option>
                 {classes.map(cls => (
                     <option key={cls.id} value={cls.id}>{cls.name} ({cls.students.length} élèves)</option>
                 ))}
             </select>
         </div>

         <div className={!selectedClassId ? "opacity-50 pointer-events-none" : ""}>
             <label className="block text-sm font-bold text-gray-700 mb-2">2. Choisir la Séquence à évaluer</label>
             <select 
                value={selectedTpId}
                onChange={handleTpChange}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
             >
                 <option value="">-- Sélectionner une Séquence Modèle --</option>
                 {uniqueTpOptions.map(tp => (
                     <option key={tp.id} value={tp.id}>{tp.title}</option>
                 ))}
             </select>
             {templateTp && (
                 <div className="mt-2 text-xs text-gray-500 flex gap-2 flex-wrap">
                     {tpCompetencies.map(c => (
                         <span key={c} className="bg-gray-100 px-2 py-1 rounded border border-gray-200">{c}</span>
                     ))}
                 </div>
             )}
         </div>
      </div>

      {selectedClass && templateTp && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden print-container">
              
              {/* Action Bar for Grid */}
              <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center no-print">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                      <AlertCircle size={16} className="text-indigo-600"/>
                      <span>Cliquez sur les cases pour changer la note : NE → NA → IA → PA → TA</span>
                  </div>
                  <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={handlePrintActiveGrid}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                      >
                          <Printer size={16}/> Imprimer
                      </button>
                      <button 
                        type="button"
                        onClick={handleGenerateActivePdf}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
                      >
                          <FileDown size={16}/> PDF
                      </button>
                  </div>
              </div>

              {/* Title for Print */}
              <div className="hidden print:block p-6 text-center">
                  <h1 className="text-2xl font-bold text-black">{templateTp.title}</h1>
                  <p className="text-lg text-gray-600">{selectedClass.name} - {new Date().toLocaleDateString()}</p>
              </div>

              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-indigo-900 text-white uppercase text-xs print:bg-white print:text-black print:border-b-2 print:border-black">
                          <tr>
                              <th className="px-6 py-4 font-bold sticky left-0 bg-indigo-900 z-10 min-w-[200px] print:bg-white print:static">Élève</th>
                              {tpCompetencies.map(comp => (
                                  <th key={comp} className="px-4 py-4 text-center min-w-[100px]" title={competencies.find(c => c.code === comp)?.label}>
                                      <div className="flex flex-col gap-1">
                                          <span className="text-lg">{comp}</span>
                                          <span className="text-[9px] opacity-70 font-normal normal-case truncate max-w-[120px] print:hidden">
                                              {competencies.find(c => c.code === comp)?.label}
                                          </span>
                                      </div>
                                  </th>
                              ))}
                              <th className="px-4 py-4 text-center w-24 bg-indigo-950 print:bg-gray-100">Note</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 print:divide-gray-300">
                          {studentsToDisplay.map((student, idx) => {
                              const studentEvals = grades[student.id] || [];
                              const currentNote = calculateStudentNote(studentEvals);
                              
                              return (
                                  <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-white'}>
                                      <td className="px-6 py-4 font-bold text-gray-800 sticky left-0 bg-inherit border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none print:border-r">
                                          {student.lastName} {student.firstName}
                                      </td>
                                      {tpCompetencies.map(comp => {
                                          const evalItem = studentEvals.find(e => e.competencyCode === comp);
                                          const level = evalItem?.level || LevelCode.NE;
                                          const style = levels[level];
                                          
                                          return (
                                              <td key={comp} className="px-2 py-3 text-center print:p-1">
                                                  <button
                                                      type="button"
                                                      onClick={() => handleGradeChange(student.id, comp, cycleGrade(level))}
                                                      className={`w-full py-2 rounded-md font-bold text-xs transition-all border-2 select-none print:border-1 print:text-black ${
                                                          level === LevelCode.NE 
                                                            ? 'bg-white border-gray-200 text-gray-300 hover:border-gray-400 print:border-gray-300' 
                                                            : `${style.color.replace('text-', 'text-').replace('bg-', 'bg-')} border-transparent shadow-sm print:shadow-none`
                                                      }`}
                                                  >
                                                      {level}
                                                  </button>
                                              </td>
                                          );
                                      })}
                                      <td className="px-4 py-4 text-center font-mono font-bold text-gray-900 bg-gray-100 border-l border-gray-200 print:bg-white print:border-l">
                                          {currentNote > 0 ? currentNote.toLocaleString('fr-FR') : '-'}
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
      
      {selectedClass && templateTp && studentsToDisplay.length === 0 && !isEditing && (
        <div className="text-center py-10 bg-yellow-50 rounded-xl border border-dashed border-yellow-300 text-yellow-800 no-print">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-80" />
          <p className="font-bold">Tous les élèves de cette classe ont déjà été évalués pour cette séquence.</p>
          <p className="text-sm mt-1">Pour modifier ou compléter une évaluation, utilisez le bouton "Voir / Modifier" dans l'historique ci-dessous.</p>
        </div>
      )}
      
      {(!selectedClassId || !templateTp) && !isEditing && (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500 no-print">
              <ArrowRight size={48} className="mx-auto mb-4 opacity-20" />
              <p>{!selectedClassId ? "Veuillez sélectionner une classe pour commencer." : "Veuillez sélectionner une Séquence à évaluer."}</p>
          </div>
      )}

      <div className="mt-12 pt-8 border-t border-gray-200 no-print">
           <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
               <History size={24} className="text-indigo-600" />
               Historique des évaluations enregistrées
           </h3>
           
           {groupedHistory.length > 0 ? (
               <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                   <table className="w-full text-sm text-left">
                       <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
                           <tr>
                               <th className="px-6 py-4 font-semibold">Date</th>
                               <th className="px-6 py-4 font-semibold">Classe</th>
                               <th className="px-6 py-4 font-semibold">Séquence Évaluée</th>
                               <th className="px-6 py-4 text-center font-semibold">Élèves notés</th>
                               <th className="px-6 py-4 text-right font-semibold">Moyenne</th>
                               <th className="px-6 py-4 text-center font-semibold">Action</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                           {groupedHistory.map((group) => (
                               <tr key={group.key} className="hover:bg-indigo-50/30 transition-colors">
                                   <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                                      {new Date(group.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                   </td>
                                   <td className="px-6 py-4 font-bold text-gray-800">{group.className}</td>
                                   <td className="px-6 py-4 text-gray-800 font-medium">{group.tpTitle}</td>
                                   <td className="px-6 py-4 text-center">
                                       <span className={`inline-flex items-center justify-center min-w-[50px] px-2 h-8 rounded-full font-bold text-xs ${group.count === group.totalStudents ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                           {group.count} / {group.totalStudents}
                                       </span>
                                   </td>
                                   <td className="px-6 py-4 text-right font-mono text-base font-bold">
                                       <span className={`px-2 py-1 rounded ${
                                           parseFloat(group.average) >= 12 ? 'text-green-700 bg-green-50' :
                                           parseFloat(group.average) >= 10 ? 'text-yellow-700 bg-yellow-50' :
                                           'text-red-700 bg-red-50'
                                       }`}>
                                          {group.average}/20
                                       </span>
                                   </td>
                                   <td className="px-6 py-4 text-center flex items-center justify-center gap-2 flex-wrap">
                                       <button 
                                            type="button"
                                            onClick={() => handleLoadHistory(group)}
                                            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md text-xs font-bold transition-colors"
                                            title="Voir / Modifier la grille"
                                       >
                                           <Eye size={14} /> Voir / Modifier
                                       </button>
                                       <button 
                                            type="button"
                                            onClick={() => handleHistoryPdf(group)}
                                            className="flex items-center gap-1 text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-md text-xs font-bold transition-colors"
                                            title="Générer le PDF de la grille"
                                       >
                                           <Download size={14} />
                                       </button>
                                       <button 
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onDeleteBatch(group.date, group.className, group.tpTitle, group.diplomaId); }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onTouchStart={(e) => e.stopPropagation()}
                                            className="flex items-center gap-1 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md text-xs font-bold transition-colors z-50 cursor-pointer relative"
                                            title="Supprimer ce lot d'évaluations"
                                       >
                                           <Trash2 size={14} className="pointer-events-none"/>
                                       </button>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
           ) : (
               <div className="bg-white p-8 rounded-xl border border-dashed border-gray-200 text-center">
                   <p className="text-gray-400 italic">Aucune évaluation de groupe enregistrée pour le moment.</p>
               </div>
           )}
       </div>
    </div>
  );
};

export default MassEvaluation;
