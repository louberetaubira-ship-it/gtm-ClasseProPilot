import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StudentClass, InternshipDataStore, InternshipPeriod, StudentInternship, PortfolioItem, Diploma, LevelCode, InternshipCompetencyEvaluation, LevelDetails, InternshipVisitReport, VisitObservation, Student } from '../types';
import { Briefcase, Calendar, Plus, User, MapPin, Phone, Mail, FileText, Camera, Check, X, Trash2, ExternalLink, ChevronDown, ChevronRight, Save, Star, Download, KeyRound, RefreshCw, CheckCircle2 } from 'lucide-react';
import { generateInternshipReportPdf } from '../services/pdfService';
import { useConfirm } from './ConfirmContext';

interface Props {
  classes: StudentClass[];
  internshipData: InternshipDataStore;
  onUpdateData: (data: InternshipDataStore) => void;
  diplomas: Diploma[];
  levels: Record<LevelCode, LevelDetails>;
}

const OBSERVATION_CRITERIA = [
  { key: 'comportement', label: 'COMPORTEMENT', options: ['peu acceptable', 'posé', 'très sérieux(se)'] },
  { key: 'ponctualite', label: 'PONCTUALITE', options: ['souvent en retard', 'quelques retards', 'à l\'heure'] },
  { key: 'espritEquipe', label: 'ESPRIT D\'EQUIPE', options: ['réservé face au groupe', 'intégration facile', 'stimule le groupe'] },
  { key: 'autonomie', label: 'AUTONOMIE', options: ['sans autonomie', 'peu autonome', 'autonome'] },
  { key: 'organisation', label: 'ORGANISATION', options: ['désordonné(e)', 'sait s\'organiser avec aide', 'sait s\'organiser seul(e)'] },
  { key: 'methode', label: 'METHODE', options: ['sans méthode', 'essaie de trouver une méthode', 'méthodique et logique'] },
  { key: 'expression', label: 'EXPRESSION', options: ['confuse', 's\'efforce de se faire comprendre', 's\'exprime clairement'] },
  { key: 'aptitudeApprentissage', label: 'APTITUDE A L\'APPRENTISSAGE', options: ['réfractaire', 'fait des efforts', 'très réceptif (ive)'] },
  { key: 'comprehension', label: 'COMPREHENSION', options: ['difficile', 'saisit assez vite', 'rapide et bonne'] },
  { key: 'motivation', label: 'MOTIVATION', options: ['aucune', 's\'intéresse', 'passionné(e)'] },
];

const SignaturePad = ({ signature, onSave }: { signature?: string, onSave: (dataUrl: string) => void }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
        }

        if (signature) {
            if (ctx) {
                const img = new Image();
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                };
                img.src = signature;
            }
        } else if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, [signature]);

    const getCoords = (e: MouseEvent | TouchEvent): { x: number, y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const coords = getCoords(e.nativeEvent);
        if (!coords) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        setIsDrawing(true);
        setHasDrawn(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        e.preventDefault();
        const coords = getCoords(e.nativeEvent);
        if (!coords) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.closePath();
        setIsDrawing(false);
    };
    
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
        onSave(""); // Pass empty string to clear
    };

    const saveSignature = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            if (hasDrawn) {
                onSave(canvas.toDataURL('image/jpeg', 0.8));
                alert("Signature enregistrée !");
            } else {
                 onSave(""); // Clear if empty
                 alert("Signature effacée !");
            }
        }
    };

    return (
        <div>
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                width="400"
                height="150"
                className="bg-white border border-gray-300 rounded-lg cursor-crosshair w-full"
            />
            <div className="flex gap-2 mt-2">
                <button onClick={clearCanvas} className="text-sm text-gray-600 hover:underline">Effacer</button>
                <button onClick={saveSignature} className="text-sm text-sky-600 font-bold hover:underline ml-auto">Enregistrer la signature</button>
            </div>
        </div>
    );
};

const InternshipManager: React.FC<Props> = ({ classes, internshipData, onUpdateData, diplomas, levels }) => {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'tracking' | 'periods'>('tracking');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const { confirm } = useConfirm();
  
  // Period Form State
  const [isAddingPeriod, setIsAddingPeriod] = useState(false);
  const [newPeriod, setNewPeriod] = useState<Partial<InternshipPeriod>>({});

  // Detail Modal State
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const selectedClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);

  const classPeriods = useMemo(() => {
    if (!selectedClassId) return [];
    return internshipData.periods
        .filter(p => p.classId === selectedClassId)
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [internshipData.periods, selectedClassId]);

  // Default selection of latest period
  useEffect(() => {
      if (classPeriods.length > 0 && !selectedPeriodId) {
          setSelectedPeriodId(classPeriods[0].id);
      }
  }, [classPeriods, selectedPeriodId]);

  const studentsWithInternship = useMemo(() => {
    if (!selectedClass || !selectedPeriodId) return [];
    
    return selectedClass.students.map(student => {
        const internship = internshipData.internships.find(i => i.studentId === student.id && i.periodId === selectedPeriodId);
        return {
            student,
            internship: internship || {
                id: crypto.randomUUID(),
                studentId: student.id,
                periodId: selectedPeriodId,
                companyName: '', companyAddress: '', tutorName: '', tutorEmail: '', tutorPhone: '', 
                referentTeacherGen: '', referentTeacherPro: '',
                portfolio: []
            } as StudentInternship
        };
    });
  }, [selectedClass, selectedPeriodId, internshipData.internships]);


  // --- HANDLERS ---
  const generatePassword = () => Math.floor(1000 + Math.random() * 9000).toString();

  const handleAddPeriod = () => {
    if (!selectedClassId || !newPeriod.title || !newPeriod.startDate || !newPeriod.endDate) {
        alert("Veuillez remplir tous les champs de la période.");
        return;
    }
    const period: InternshipPeriod = {
        id: crypto.randomUUID(),
        classId: selectedClassId,
        title: newPeriod.title,
        startDate: newPeriod.startDate,
        endDate: newPeriod.endDate
    };
    onUpdateData({
        ...internshipData,
        periods: [...internshipData.periods, period]
    });
    setNewPeriod({});
    setIsAddingPeriod(false);
  };

  const handleDeletePeriod = (periodId: string) => {
      confirm({
          title: "Supprimer la période",
          message: "Supprimer cette période et toutes les données associées ?",
          isDestructive: true,
          onConfirm: () => {
              onUpdateData({
                  periods: internshipData.periods.filter(p => p.id !== periodId),
                  internships: internshipData.internships.filter(i => i.periodId !== periodId)
              });
              if (selectedPeriodId === periodId) setSelectedPeriodId('');
          }
      });
  };

  const handleUpdateInternship = (updatedInternship: StudentInternship) => {
      const existingIndex = internshipData.internships.findIndex(i => i.id === updatedInternship.id);
      let newInternships = [...internshipData.internships];
      
      if (existingIndex >= 0) {
          newInternships[existingIndex] = updatedInternship;
      } else {
          newInternships.push(updatedInternship);
      }
      
      onUpdateData({
          ...internshipData,
          internships: newInternships
      });
  };

  const handleInlineUpdate = (studentId: string, field: keyof StudentInternship, value: string) => {
      const currentWrapper = studentsWithInternship.find(s => s.student.id === studentId);
      if (currentWrapper) {
          const updatedInternship = { ...currentWrapper.internship, [field]: value };
          // Auto-generate password when tutor info is first added
          if (['tutorName', 'tutorEmail'].includes(field as string) && value.trim() && !updatedInternship.tutorPassword) {
              updatedInternship.tutorPassword = generatePassword();
          }
          handleUpdateInternship(updatedInternship);
      }
  };
  
  const handleGenerateInternshipReportPdf = (studentWrapper: { student: Student; internship: StudentInternship; }) => {
    if (!studentWrapper || !selectedClass) return;
    const { student, internship } = studentWrapper;
    const period = classPeriods.find(p => p.id === selectedPeriodId);
    if (!period) return;
    
    const diploma = diplomas.find(d => d.id === selectedClass.diplomaId);
    const competencies = diploma?.repository.competencies || [];

    generateInternshipReportPdf(student, internship, period, competencies, levels, OBSERVATION_CRITERIA);
  };


  // --- EVALUATION LOGIC ---

  const getDiplomaCompetencies = () => {
      if (!selectedClass) return [];
      const diploma = diplomas.find(d => d.id === selectedClass.diplomaId);
      return diploma?.repository.competencies || [];
  };

  const cycleGrade = (current: LevelCode): LevelCode => {
    const order = [LevelCode.NE, LevelCode.NA, LevelCode.IA, LevelCode.PA, LevelCode.TA];
    const idx = order.indexOf(current);
    return order[(idx + 1) % order.length];
  };

  const calculateTutorObservationGrade = (observations: VisitObservation): number => {
    let totalPoints = 0;
    const maxPoints = OBSERVATION_CRITERIA.length * 2; // Max is 2 points per criterion

    for (const criterion of OBSERVATION_CRITERIA) {
        const selectedOption = observations[criterion.key];
        if (selectedOption) {
            const optionIndex = criterion.options.indexOf(selectedOption);
            if (optionIndex === 0) {
                totalPoints += 0.5;
            } else if (optionIndex === 1) {
                totalPoints += 1;
            } else if (optionIndex === 2) {
                totalPoints += 2;
            }
        }
    }
    
    if (maxPoints === 0) return 0;
    // Scale from /maxPoints to /5
    const totalOn20 = (totalPoints / maxPoints) * 20;
    return parseFloat(((totalOn20 / 20) * 5).toFixed(2));
  };

  // --- RENDERERS ---

  const renderStudentDetailModal = () => {
      if (!selectedStudentId) return null;
      const wrapper = studentsWithInternship.find(s => s.student.id === selectedStudentId);
      if (!wrapper) return null;
      const { student, internship } = wrapper;
      const competencies = getDiplomaCompetencies();
      
      const skillsGrade = internship.tutorEvaluation?.globalGrade ?? 0;
      const tutorGrade = internship.visitReportGrade ?? 0;
      const portfolioGrade = internship.portfolioGrade ?? 0;
      const finalGrade = skillsGrade + tutorGrade + portfolioGrade;

      const handlePreEvalLevelChange = (compCode: string) => {
        const currentLevel = internship.preEvaluation?.competencies.find(c => c.competencyCode === compCode)?.level || LevelCode.NE;
        const newLevel = cycleGrade(currentLevel);
        
        const currentComps = internship.preEvaluation?.competencies || competencies.map(c => ({ competencyCode: c.code, level: LevelCode.NE }));
        
        let newComps = [...currentComps];
        const index = newComps.findIndex(c => c.competencyCode === compCode);

        if (index > -1) {
            newComps[index] = { ...newComps[index], level: newLevel };
        } else {
            newComps.push({ competencyCode: compCode, level: newLevel });
        }

        handleUpdateInternship({
            ...internship,
            preEvaluation: {
                competencies: newComps,
            }
        });
      };
      
      const handleVisitReportChange = (field: keyof Omit<InternshipVisitReport, 'tutorObservations'>, value: string) => {
        const newReport: InternshipVisitReport = {
            studentActivities: '',
            generalAppreciation: '',
            eventualAbsences: '',
            tutorObservations: {},
            ...internship.visitReport,
            [field]: value
        };
        handleUpdateInternship({ ...internship, visitReport: newReport });
      };

      const handleModalInternshipUpdate = (field: keyof StudentInternship, value: string) => {
        const updatedInternship = { ...internship, [field]: value };
        // Auto-generate password when tutor info is first added in the modal
        if (['tutorName', 'tutorEmail'].includes(field as string) && value.trim() && !internship.tutorPassword) {
            updatedInternship.tutorPassword = generatePassword();
        }
        handleUpdateInternship(updatedInternship);
      };
      
      const currentPeriod = classPeriods.find(p => p.id === selectedPeriodId);

      const getDaysInPeriod = (startDateStr: string, endDateStr: string): Date[] => {
        const days: Date[] = [];
        let currentDate = new Date(startDateStr);
        currentDate.setUTCHours(0,0,0,0);
        const endDate = new Date(endDateStr);
        endDate.setUTCHours(0,0,0,0);
    
        while (currentDate <= endDate) {
            days.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return days;
    };

    const days = currentPeriod ? getDaysInPeriod(currentPeriod.startDate, currentPeriod.endDate) : [];
    const months = days.reduce((acc, day) => {
        const monthYear = day.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        if (!acc[monthYear]) {
            acc[monthYear] = [];
        }
        acc[monthYear].push(day);
        return acc;
    }, {} as Record<string, Date[]>);


      return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-4xl h-[95vh] flex flex-col overflow-hidden">
                  {/* Header */}
                  <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white">
                      <div>
                          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                              <User className="text-indigo-600"/> {student.lastName} {student.firstName}
                          </h3>
                          <p className="text-sm text-gray-500">
                             Classe: {selectedClass?.name} | Période: {currentPeriod?.title}
                          </p>
                           <p className="text-xs text-gray-400 mt-1">
                                {internship.companyName ? internship.companyName : "Aucune entreprise"} 
                                {internship.tutorName ? ` - Tuteur: ${internship.tutorName}` : ""}
                           </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                            onClick={() => handleGenerateInternshipReportPdf(wrapper)}
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                            title="Télécharger le bilan de stage en PDF"
                        >
                            <Download size={24}/>
                        </button>
                        <button onClick={() => setSelectedStudentId(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                            <X size={24}/>
                        </button>
                      </div>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      
                      {/* Informations Stage */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                              <Briefcase size={18} className="text-blue-500"/> Informations Stage
                          </h4>
                          <div className="space-y-3">
                              <div>
                                  <label className="text-xs font-bold text-gray-500">Entreprise</label>
                                  <input 
                                    value={internship.companyName}
                                    onChange={e => handleModalInternshipUpdate('companyName', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                    placeholder="Nom de l'entreprise"
                                  />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500">Adresse</label>
                                  <input 
                                    value={internship.companyAddress}
                                    onChange={e => handleModalInternshipUpdate('companyAddress', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                    placeholder="Adresse complète"
                                  />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                  <div>
                                      <label className="text-xs font-bold text-gray-500">Tuteur</label>
                                      <input 
                                        value={internship.tutorName}
                                        onChange={e => handleModalInternshipUpdate('tutorName', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        placeholder="Nom du tuteur"
                                      />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-gray-500">Téléphone</label>
                                      <input 
                                        value={internship.tutorPhone}
                                        onChange={e => handleModalInternshipUpdate('tutorPhone', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        placeholder="06..."
                                      />
                                  </div>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500">Email Tuteur</label>
                                  <input 
                                    value={internship.tutorEmail}
                                    onChange={e => handleModalInternshipUpdate('tutorEmail', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                    placeholder="email@entreprise.com"
                                  />
                              </div>
                          </div>
                      </div>
                      
                      {/* Tutor Access Card */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                              <KeyRound size={18} className="text-yellow-500"/> Accès Tuteur
                          </h4>
                          <div className="space-y-3">
                              <div>
                                  <label className="text-xs font-bold text-gray-500">Mot de passe</label>
                                  <div className="flex items-center gap-2 mt-1">
                                      <input 
                                          readOnly
                                          value={internship.tutorPassword || 'N/A'}
                                          className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50 font-mono"
                                      />
                                      <button 
                                          onClick={() => {
                                              confirm({
                                                  title: "Nouveau mot de passe",
                                                  message: "Générer un nouveau mot de passe ? L'ancien sera perdu.",
                                                  onConfirm: () => {
                                                      handleUpdateInternship({...internship, tutorPassword: generatePassword()});
                                                  }
                                              });
                                          }}
                                          className="p-2 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                                          title="Régénérer le mot de passe"
                                      >
                                          <RefreshCw size={16} />
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>

                       {/* Suivi des Absences */}
                       <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                           <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                               <Calendar size={18} className="text-red-500"/> Suivi des Absences (par le tuteur)
                           </h4>
                           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <div className="flex justify-between items-center mb-3">
                                    <p className="text-sm text-gray-600">Calendrier des absences déclarées.</p>
                                    <p className="text-sm font-bold text-red-600 bg-red-100 px-3 py-1 rounded-full">Total: {internship.absentDays?.length || 0} jours</p>
                                </div>
                                <div className="flex overflow-x-auto space-x-6 pb-2">
                                    {Object.entries(months).map(([monthYear, monthDays]) => (
                                        <div key={monthYear} className="flex-shrink-0">
                                            <h5 className="font-bold text-sm text-center mb-2 text-gray-700">{monthYear}</h5>
                                            <div className="grid grid-cols-7 gap-1 text-xs">
                                                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => <div key={d} className="text-center font-bold text-gray-400 w-8 h-8 flex items-center justify-center">{d}</div>)}
                                                {Array.from({ length: (new Date(monthDays[0]).getUTCDay() + 6) % 7 }).map((_, i) => <div key={`empty-${i}`}></div>)}
                                                {monthDays.map(day => {
                                                    const dayOfWeek = day.getUTCDay();
                                                    const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
                                                    const dateString = day.toISOString().split('T')[0];
                                                    const isAbsent = internship.absentDays?.includes(dateString);

                                                    return (
                                                        <div 
                                                            key={dateString}
                                                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold
                                                                ${isAbsent ? 'bg-red-500 text-white ring-2 ring-red-200' : ''}
                                                                ${isWeekend ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 border border-gray-200'}
                                                            `}
                                                        >
                                                            {day.getDate()}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                       </div>
                      
                      {/* Observations du Tuteur */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                              <CheckCircle2 size={18} className="text-green-500"/> Observations du Tuteur
                          </h4>
                          <div className="space-y-3 text-xs max-h-96 overflow-y-auto">
                              {OBSERVATION_CRITERIA.map(criterion => {
                                  const selectedOption = internship.visitReport?.tutorObservations?.[criterion.key];
                                  return (
                                  <div key={criterion.key} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                                      <label className="font-bold text-gray-500 uppercase">{criterion.label}</label>
                                      <span className="font-semibold text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full text-center min-w-[100px]">
                                          {selectedOption || 'N/A'}
                                      </span>
                                  </div>
                              )})}
                          </div>
                      </div>

                      {/* Appréciation & Signature du Tuteur */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                              <Star size={18} className="text-yellow-500"/> Appréciation & Signature du Tuteur
                          </h4>
                          {internship.tutorEvaluation?.tutorComment ? (
                              <div>
                                  <label className="text-xs font-bold text-gray-500">Commentaire</label>
                                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md mt-1 border">{internship.tutorEvaluation.tutorComment}</p>
                              </div>
                          ) : <p className="text-sm text-gray-400 italic">Aucun commentaire du tuteur.</p>}

                          {internship.tutorEvaluation?.tutorSignature ? (
                              <div className="mt-4">
                                  <label className="text-xs font-bold text-gray-500">Signature</label>
                                  <div className="mt-1 bg-gray-50 p-2 rounded-md border inline-block">
                                      <img src={internship.tutorEvaluation.tutorSignature} alt="Signature Tuteur" className="h-20 w-auto"/>
                                  </div>
                              </div>
                          ) : <p className="text-sm text-gray-400 italic mt-4">Aucune signature.</p>}
                      </div>

                      {/* Evaluation Grid Card */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                              <Check size={18} className="text-emerald-500"/> Évaluation par Compétences
                          </h4>
                          
                          {competencies.length === 0 ? (
                              <div className="text-red-500 text-sm p-4 bg-red-50 rounded">
                                  Aucun référentiel trouvé pour cette classe. Veuillez associer un diplôme.
                              </div>
                          ) : (
                              <div className="space-y-4">
                                  <div className="max-h-80 overflow-y-auto border border-gray-100 rounded-lg">
                                      <table className="w-full text-sm text-left">
                                          <thead className="bg-gray-50 text-gray-600 text-xs sticky top-0 z-10">
                                              <tr>
                                                  <th className="px-3 py-2">Compétence</th>
                                                  <th className="px-3 py-2 text-center w-24">Pos. Prof</th>
                                                  <th className="px-3 py-2 text-center w-24">Éval. Tuteur</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100">
                                              {competencies.map(compDef => {
                                                  const preEvalItem = internship.preEvaluation?.competencies.find(c => c.competencyCode === compDef.code) || { competencyCode: compDef.code, level: LevelCode.NE };
                                                  const tutorEvalItem = internship.tutorEvaluation?.competencies.find(c => c.competencyCode === compDef.code) || { competencyCode: compDef.code, level: LevelCode.NE };
                                                  return (
                                                      <tr key={compDef.code}>
                                                          <td className="px-3 py-2">
                                                              <span className="font-bold text-indigo-700 mr-1">{compDef.code}</span>
                                                              <span className="text-xs text-gray-500 line-clamp-1">{compDef.label}</span>
                                                          </td>
                                                          <td className="px-3 py-2 text-center">
                                                              <button
                                                                type="button"
                                                                onClick={() => handlePreEvalLevelChange(compDef.code)}
                                                                className={`w-20 py-1 rounded font-bold text-xs transition-all border-2 select-none ${
                                                                    preEvalItem.level === LevelCode.NE 
                                                                        ? 'bg-white border-gray-200 text-gray-400 hover:border-gray-400' 
                                                                        : `${levels[preEvalItem.level].color} border-transparent shadow-sm`
                                                                }`}
                                                              >
                                                                {preEvalItem.level}
                                                              </button>
                                                          </td>
                                                          <td className="px-3 py-2 text-center">
                                                              <span
                                                                  className={`inline-block w-20 py-1 rounded font-bold text-xs border-2 ${
                                                                      tutorEvalItem.level === LevelCode.NE 
                                                                          ? 'bg-gray-100 border-gray-200 text-gray-400' 
                                                                          : `${levels[tutorEvalItem.level].color} border-transparent`
                                                                  }`}
                                                              >
                                                                  {tutorEvalItem.level}
                                                              </span>
                                                          </td>
                                                      </tr>
                                                  );
                                              })}
                                          </tbody>
                                      </table>
                                  </div>
                              </div>
                          )}
                      </div>

                      {/* Compte Rendu de Visite */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                                <FileText size={18} className="text-orange-500"/> Compte Rendu de Visite du Professeur
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Activités de l'élève</label>
                                    <textarea
                                        value={internship.visitReport?.studentActivities || ''}
                                        onChange={e => handleVisitReportChange('studentActivities', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded text-sm mt-1"
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Appréciation générale</label>
                                    <textarea
                                        value={internship.visitReport?.generalAppreciation || ''}
                                        onChange={e => handleVisitReportChange('generalAppreciation', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded text-sm mt-1"
                                        rows={3}
                                    />
                                </div>
                                
                                <div className="pt-4 mt-4 border-t border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 block mb-2">Signature du Professeur</label>
                                    <SignaturePad
                                        signature={internship.visitReport?.teacherSignature}
                                        onSave={signatureDataUrl => {
                                            const newReport: InternshipVisitReport = {
                                                studentActivities: internship.visitReport?.studentActivities || '',
                                                generalAppreciation: internship.visitReport?.generalAppreciation || '',
                                                eventualAbsences: internship.visitReport?.eventualAbsences || '',
                                                tutorObservations: internship.visitReport?.tutorObservations || {},
                                                teacherSignature: signatureDataUrl,
                                            };
                                            handleUpdateInternship({ ...internship, visitReport: newReport });
                                        }}
                                    />
                                </div>
                            </div>
                      </div>

                      {/* Portfolio Élève */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col">
                          <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                              <Camera size={18} className="text-purple-500"/> Portfolio Élève (Lecture seule)
                          </h4>
                          <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[500px]">
                              {internship.portfolio.length === 0 ? (
                                  <div className="text-center text-gray-400 py-10">
                                      Aucune entrée dans le portfolio.
                                  </div>
                              ) : (
                                  internship.portfolio.map(item => (
                                      <div key={item.id} className="bg-gray-50 p-3 rounded shadow-sm border border-gray-200">
                                          <div className="flex justify-between items-start mb-2">
                                              <span className="text-xs font-bold text-gray-500">{new Date(item.date).toLocaleDateString()}</span>
                                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.type === 'photo' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                  {item.type === 'photo' ? 'Photo' : 'Journal'}
                                              </span>
                                          </div>
                                          {item.type === 'photo' && item.content.startsWith('data:image') ? (
                                              <img src={item.content} alt="Portfolio" className="w-full h-40 object-cover rounded mb-2 border border-gray-100"/>
                                          ) : (
                                              <p className="text-sm text-gray-700 mb-2">{item.content}</p>
                                          )}
                                          
                                          <div className="mt-2 pt-2 border-t border-gray-100">
                                              <input 
                                                  placeholder="Ajouter un commentaire..."
                                                  className="w-full text-xs p-1 border border-gray-200 rounded"
                                                  onKeyDown={(e) => {
                                                      if(e.key === 'Enter') {
                                                          const newItem = { ...item, comment: e.currentTarget.value };
                                                          const newPortfolio = internship.portfolio.map(p => p.id === item.id ? newItem : p);
                                                          handleUpdateInternship({ ...internship, portfolio: newPortfolio });
                                                          e.currentTarget.blur();
                                                      }
                                                  }}
                                                  defaultValue={item.comment}
                                              />
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                          <div className="mt-4 pt-4 border-t border-gray-200">
                                <label className="text-xs font-bold text-gray-500 block mb-1">Note Portfolio & Soutenance (/5)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="5"
                                    value={internship.portfolioGrade ?? ''}
                                    onChange={e => {
                                        const value = e.target.value;
                                        if (value === '') {
                                            handleUpdateInternship({ ...internship, portfolioGrade: undefined });
                                        } else {
                                            const numValue = parseFloat(value);
                                            if (!isNaN(numValue) && numValue >= 0 && numValue <= 5) {
                                                handleUpdateInternship({ ...internship, portfolioGrade: numValue });
                                            }
                                        }
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                />
                            </div>
                      </div>

                      {/* Final Grades Summary */}
                       <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-2">
                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
                                <div>
                                    <span className="text-sm font-bold text-gray-600 block">Note Compétences</span>
                                    <span className="text-xs text-gray-400">(Hors NE)</span>
                                </div>
                                <div className="text-xl font-bold text-emerald-700">
                                    {skillsGrade.toFixed(2)} / 10
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
                                <span className="text-sm font-bold text-gray-600 block">Note Observations Tuteur</span>
                                <div className="text-xl font-bold text-emerald-700">
                                    {tutorGrade.toFixed(2)} / 5
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
                                <span className="text-sm font-bold text-gray-600 block">Note Portfolio & Soutenance</span>
                                <div className="text-xl font-bold text-emerald-700">
                                    {portfolioGrade.toFixed(2)} / 5
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-indigo-100 p-4 rounded border border-indigo-200">
                                <span className="text-lg font-bold text-indigo-800 block">Note Finale de Stage</span>
                                <div className="text-3xl font-bold text-indigo-800">
                                    {finalGrade.toFixed(2)} / 20
                                </div>
                            </div>
                        </div>

                  </div>
              </div>
          </div>
      );
  };


  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="flex justify-between items-center">
             <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Briefcase className="text-indigo-600"/> 
                Suivi des Stages (PFMP)
            </h2>
        </div>

        {/* 1. Class Selection */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <label className="block text-sm font-bold text-gray-700 mb-2">Choisir une Classe</label>
             <select 
                value={selectedClassId}
                onChange={(e) => { setSelectedClassId(e.target.value); setSelectedPeriodId(''); }}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
             >
                 <option value="">-- Sélectionner --</option>
                 {classes.map(cls => (
                     <option key={cls.id} value={cls.id}>{cls.name} ({cls.students.length} élèves)</option>
                 ))}
             </select>
        </div>

        {selectedClass && (
            <div className="space-y-6">
                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button 
                        onClick={() => setActiveTab('tracking')}
                        className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tracking' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <MapPin size={16}/> Suivi & Affectations
                    </button>
                    <button 
                        onClick={() => setActiveTab('periods')}
                        className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'periods' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Calendar size={16}/> Gestion des Périodes
                    </button>
                </div>

                {/* --- TAB: PERIODS --- */}
                {activeTab === 'periods' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-in fade-in">
                         <div className="flex justify-between items-center mb-6">
                             <h3 className="font-bold text-gray-700">Périodes définies pour {selectedClass.name}</h3>
                             <button 
                                onClick={() => setIsAddingPeriod(!isAddingPeriod)}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-md font-bold text-sm hover:bg-indigo-700"
                             >
                                 {isAddingPeriod ? <X size={16}/> : <Plus size={16}/>}
                                 {isAddingPeriod ? 'Annuler' : 'Ajouter Période'}
                             </button>
                         </div>

                         {isAddingPeriod && (
                             <div className="bg-indigo-50 p-4 rounded-lg mb-6 border border-indigo-100 flex flex-wrap gap-4 items-end">
                                 <div>
                                     <label className="block text-xs font-bold text-gray-600 mb-1">Intitulé</label>
                                     <input 
                                        value={newPeriod.title || ''} onChange={e => setNewPeriod({...newPeriod, title: e.target.value})}
                                        className="p-2 border border-indigo-200 rounded text-sm w-64" placeholder="ex: PFMP 1"
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-bold text-gray-600 mb-1">Début</label>
                                     <input 
                                        type="date"
                                        value={newPeriod.startDate || ''} onChange={e => setNewPeriod({...newPeriod, startDate: e.target.value})}
                                        className="p-2 border border-indigo-200 rounded text-sm"
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-bold text-gray-600 mb-1">Fin</label>
                                     <input 
                                        type="date"
                                        value={newPeriod.endDate || ''} onChange={e => setNewPeriod({...newPeriod, endDate: e.target.value})}
                                        className="p-2 border border-indigo-200 rounded text-sm"
                                     />
                                 </div>
                                 <button onClick={handleAddPeriod} className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-emerald-700">
                                     Enregistrer
                                 </button>
                             </div>
                         )}

                         <div className="space-y-3">
                             {classPeriods.length === 0 ? <p className="text-gray-400 italic">Aucune période définie.</p> : classPeriods.map(p => (
                                 <div key={p.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors">
                                     <div>
                                         <span className="font-bold text-gray-800">{p.title}</span>
                                         <span className="text-sm text-gray-500 ml-3">
                                             Du {new Date(p.startDate).toLocaleDateString()} au {new Date(p.endDate).toLocaleDateString()}
                                         </span>
                                     </div>
                                     <button onClick={() => handleDeletePeriod(p.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16}/></button>
                                 </div>
                             ))}
                         </div>
                    </div>
                )}

                {/* --- TAB: TRACKING --- */}
                {activeTab === 'tracking' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in">
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
                             <label className="text-sm font-bold text-gray-600">Période :</label>
                             <select 
                                value={selectedPeriodId}
                                onChange={e => setSelectedPeriodId(e.target.value)}
                                className="p-2 border border-gray-300 rounded text-sm bg-white"
                             >
                                 {classPeriods.length === 0 && <option value="">Aucune période</option>}
                                 {classPeriods.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                             </select>
                        </div>

                        {selectedPeriodId ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-4 font-bold">Élève</th>
                                            <th className="px-6 py-4 font-bold">Entreprise</th>
                                            <th className="px-6 py-4 font-bold">Tuteur</th>
                                            <th className="px-6 py-4 font-bold">Prof. Réf. Gén.</th>
                                            <th className="px-6 py-4 font-bold">Prof. Réf. Pro.</th>
                                            <th className="px-6 py-4 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {studentsWithInternship.map(({ student, internship }) => (
                                            <tr key={student.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    {student.lastName} {student.firstName}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <input 
                                                            placeholder="Nom entreprise..."
                                                            value={internship.companyName}
                                                            onChange={e => handleInlineUpdate(student.id, 'companyName', e.target.value)}
                                                            className="p-1 border border-gray-200 rounded text-sm w-full focus:border-indigo-400 outline-none"
                                                        />
                                                        <input 
                                                            placeholder="Ville / Adresse..."
                                                            value={internship.companyAddress}
                                                            onChange={e => handleInlineUpdate(student.id, 'companyAddress', e.target.value)}
                                                            className="p-1 border-b border-transparent text-xs text-gray-500 focus:border-gray-300 outline-none bg-transparent"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <input 
                                                            placeholder="Nom tuteur..."
                                                            value={internship.tutorName}
                                                            onChange={e => handleInlineUpdate(student.id, 'tutorName', e.target.value)}
                                                            className="p-1 border border-gray-200 rounded text-sm w-full focus:border-indigo-400 outline-none"
                                                        />
                                                        <input 
                                                            placeholder="Email tuteur..."
                                                            value={internship.tutorEmail}
                                                            onChange={e => handleInlineUpdate(student.id, 'tutorEmail', e.target.value)}
                                                            className="p-1 border-b border-transparent text-xs text-gray-500 focus:border-gray-300 outline-none bg-transparent"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                     <input 
                                                            placeholder="Initiales ou Nom..."
                                                            value={internship.referentTeacherGen}
                                                            onChange={e => handleInlineUpdate(student.id, 'referentTeacherGen', e.target.value)}
                                                            className="p-1 border border-gray-200 rounded text-sm w-full focus:border-indigo-400 outline-none"
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                     <input 
                                                            placeholder="Initiales ou Nom..."
                                                            value={internship.referentTeacherPro}
                                                            onChange={e => handleInlineUpdate(student.id, 'referentTeacherPro', e.target.value)}
                                                            className="p-1 border border-gray-200 rounded text-sm w-full focus:border-indigo-400 outline-none"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button 
                                                        onClick={() => setSelectedStudentId(student.id)}
                                                        className="text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors text-xs flex items-center justify-center gap-1 mx-auto"
                                                    >
                                                        <FileText size={14}/> Détails / Noter
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-12 text-center text-gray-500 italic">
                                Veuillez sélectionner ou créer une période de stage.
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}

        {/* Modal */}
        {renderStudentDetailModal()}

    </div>
  );
};

export default InternshipManager;