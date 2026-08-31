import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AuthUser, InternshipDataStore, StudentClass, Diploma, StudentInternship, LevelDetails, VisitObservation, InternshipVisitReport, Student, InternshipPeriod, LevelCode, InternshipCompetencyEvaluation } from '../types';
import { LogOut, User, Briefcase, ChevronLeft, ChevronRight, Camera, FileText, CheckCircle2, Check, Star, Calendar } from 'lucide-react';

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

const calculateTutorObservationGrade = (observations: VisitObservation): number => {
    let totalPoints = 0;
    const maxPoints = OBSERVATION_CRITERIA.length * 2;
    for (const criterion of OBSERVATION_CRITERIA) {
        const selectedOption = observations[criterion.key];
        if (selectedOption) {
            const optionIndex = criterion.options.indexOf(selectedOption);
            if (optionIndex === 0) totalPoints += 0.5;
            else if (optionIndex === 1) totalPoints += 1;
            else if (optionIndex === 2) totalPoints += 2;
        }
    }
    if (maxPoints === 0) return 0;
    return parseFloat(( (totalPoints / maxPoints) * 5 ).toFixed(2));
};

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


interface StudentDetails {
    student: Student;
    internship: StudentInternship;
    period: InternshipPeriod;
    class: StudentClass;
}

interface Props {
  user: AuthUser;
  onLogout: () => void;
  internshipData: InternshipDataStore;
  classes: StudentClass[];
  diplomas: Diploma[];
  levels: Record<string, LevelDetails>;
  onUpdateData: (data: InternshipDataStore) => void;
}

const TutorPortal: React.FC<Props> = ({ user, onLogout, internshipData, classes, diplomas, levels, onUpdateData }) => {
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    const myStudents = useMemo(() => {
        const tutorEmail = user.id;
        if (!tutorEmail) return [];

        return internshipData.internships
            .filter(i => i.tutorEmail === tutorEmail)
            .map(internship => {
                let student: Student | undefined;
                let studentClass: StudentClass | undefined;
                for (const cls of classes) {
                    const found = cls.students.find(s => s.id === internship.studentId);
                    if (found) {
                        student = found;
                        studentClass = cls;
                        break;
                    }
                }
                const period = internshipData.periods.find(p => p.id === internship.periodId);
                if (student && studentClass && period) {
                    return { student, internship, period, class: studentClass };
                }
                return null;
            })
            .filter((item): item is StudentDetails => item !== null);
    }, [user, internshipData, classes]);

    const handleUpdateInternship = (updatedInternship: StudentInternship) => {
        const newInternships = internshipData.internships.map(i => 
            i.id === updatedInternship.id ? updatedInternship : i
        );
        onUpdateData({ ...internshipData, internships: newInternships });
    };

    const selectedStudentDetails = useMemo(() => {
        if (!selectedStudentId) return null;
        return myStudents.find(s => s.student.id === selectedStudentId);
    }, [selectedStudentId, myStudents]);

    const cycleGrade = (current: LevelCode): LevelCode => {
      const order = [LevelCode.NE, LevelCode.NA, LevelCode.IA, LevelCode.PA, LevelCode.TA];
      const idx = order.indexOf(current);
      return order[(idx + 1) % order.length];
    };

    const calculateInternshipGrade = (evals: InternshipCompetencyEvaluation[]) => {
      const valid = evals.filter(e => e.level !== LevelCode.NE);
      if (valid.length === 0) return 0;
      const total = valid.reduce((sum, e) => sum + levels[e.level].score, 0);
      // Note /20 -> Note /10
      return parseFloat(((total / valid.length) / 2).toFixed(2));
    };

    // --- RENDER ---
    
    if (selectedStudentDetails) {
        const { student, internship, period, class: studentClass } = selectedStudentDetails;
        const diploma = diplomas.find(d => d.id === studentClass.diplomaId);
        const competencies = diploma?.repository.competencies || [];

        const handleObservationChange = (key: string, value: string) => {
            const currentObservations = internship.visitReport?.tutorObservations || {};
            const newObservations = {
                ...currentObservations,
                [key]: currentObservations[key] === value ? undefined : value
            };
            const newGrade = calculateTutorObservationGrade(newObservations);
            const newReport: InternshipVisitReport = {
                studentActivities: internship.visitReport?.studentActivities || '',
                generalAppreciation: internship.visitReport?.generalAppreciation || '',
                eventualAbsences: internship.visitReport?.eventualAbsences || '',
                tutorObservations: newObservations
            };
            handleUpdateInternship({ ...internship, visitReport: newReport, visitReportGrade: newGrade });
        };

        const handleTutorEvalLevelChange = (compCode: string) => {
            const currentEval = internship.tutorEvaluation?.competencies.find(c => c.competencyCode === compCode);
            const currentLevel = currentEval?.level || LevelCode.NE;
            const newLevel = cycleGrade(currentLevel);
            
            const baseEval = internship.tutorEvaluation || { competencies: [], globalGrade: 0, tutorComment: '', tutorSignature: '' };
            
            let newComps = [...baseEval.competencies];
            const index = newComps.findIndex(c => c.competencyCode === compCode);
            
            if (index > -1) {
                newComps[index] = { ...newComps[index], level: newLevel };
            } else {
                newComps.push({ competencyCode: compCode, level: newLevel });
            }
    
            const newGrade = calculateInternshipGrade(newComps);
            handleUpdateInternship({
                ...internship,
                tutorEvaluation: { ...baseEval, competencies: newComps, globalGrade: newGrade }
            });
        };

        const handleAbsenceToggle = (date: Date) => {
            const dateString = date.toISOString().split('T')[0]; // 'YYYY-MM-DD'
            const currentAbsences = internship.absentDays || [];
            const isAbsent = currentAbsences.includes(dateString);
        
            const newAbsences = isAbsent
                ? currentAbsences.filter(d => d !== dateString)
                : [...currentAbsences, dateString];
            
            handleUpdateInternship({ ...internship, absentDays: newAbsences });
        };
        
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

        const days = getDaysInPeriod(period.startDate, period.endDate);
        const months = days.reduce((acc, day) => {
            const monthYear = day.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            if (!acc[monthYear]) {
                acc[monthYear] = [];
            }
            acc[monthYear].push(day);
            return acc;
        }, {} as Record<string, Date[]>);
        
        return (
            <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <button onClick={() => setSelectedStudentId(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-bold mb-4">
                        <ChevronLeft size={18} /> Retour à la liste
                    </button>
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                             <h2 className="text-2xl font-bold text-gray-800">{student.lastName} {student.firstName}</h2>
                             <p className="text-gray-500">{period.title}</p>
                        </div>
                        <div className="p-6 space-y-8">
                            
                            {/* Competency Evaluation */}
                            <section>
                                <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><Star size={20} className="text-yellow-500"/> Évaluation des Compétences</h3>
                                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                                  {competencies.map(compDef => {
                                      const preEvalItem = internship.preEvaluation?.competencies.find(c => c.competencyCode === compDef.code) || { level: LevelCode.NE };
                                      const tutorEvalItem = internship.tutorEvaluation?.competencies.find(c => c.competencyCode === compDef.code) || { level: LevelCode.NE };
                                      return (
                                          <div key={compDef.code} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                                              <div>
                                                  <p className="font-bold text-sky-800">{compDef.code}</p>
                                                  <p className="text-xs text-gray-500">{compDef.label}</p>
                                              </div>
                                              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                                                  <div>
                                                      <p className="font-bold text-gray-500 mb-1">Pos. Prof</p>
                                                      <span className={`inline-block w-20 py-1 rounded font-bold border-2 ${levels[preEvalItem.level].color} border-transparent`}>{preEvalItem.level}</span>
                                                  </div>
                                                  <div>
                                                      <p className="font-bold text-gray-500 mb-1">Éval. Tuteur</p>
                                                      <button 
                                                        onClick={() => handleTutorEvalLevelChange(compDef.code)}
                                                        className={`w-20 py-1 rounded font-bold border-2 transition-all ${tutorEvalItem.level === LevelCode.NE ? 'bg-white border-gray-300' : `${levels[tutorEvalItem.level].color} border-transparent`}`}>
                                                          {tutorEvalItem.level}
                                                      </button>
                                                  </div>
                                              </div>
                                          </div>
                                      )
                                  })}
                                </div>
                            </section>

                            <section>
                                <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                                    <Calendar size={20} className="text-red-500"/> Suivi des Absences
                                </h3>
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-sm text-gray-600">Cliquez sur un jour pour marquer une absence.</p>
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
                                                            <button 
                                                                key={dateString}
                                                                onClick={() => !isWeekend && handleAbsenceToggle(day)}
                                                                disabled={isWeekend}
                                                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors
                                                                    ${isAbsent ? 'bg-red-500 text-white ring-2 ring-red-200' : ''}
                                                                    ${isWeekend ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-sky-100 border border-gray-200'}
                                                                `}
                                                            >
                                                                {day.getDate()}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                            
                             {/* Observations */}
                            <section>
                                <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><CheckCircle2 size={20} className="text-green-500"/> Observations du Tuteur</h3>
                                <div className="space-y-4 text-sm">
                                    {OBSERVATION_CRITERIA.map(criterion => (
                                        <div key={criterion.key}>
                                            <label className="font-bold text-gray-500 uppercase">{criterion.label}</label>
                                            <div className="grid grid-cols-3 gap-2 mt-1">
                                                {criterion.options.map(option => {
                                                    const isSelected = internship.visitReport?.tutorObservations?.[criterion.key] === option;
                                                    return (
                                                        <button
                                                            key={option}
                                                            type="button"
                                                            onClick={() => handleObservationChange(criterion.key, option)}
                                                            className={`p-2 rounded border text-center transition-colors ${
                                                                isSelected
                                                                    ? 'bg-sky-600 text-white border-sky-700 font-bold'
                                                                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
                                                            }`}
                                                        >
                                                            {option}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                             {/* Tutor Comment & Signature */}
                            <section>
                                <h3 className="font-bold text-lg text-gray-800 mb-4">Appréciation & Signature</h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="font-bold text-sm text-gray-600 block mb-2">Commentaire du Tuteur</label>
                                        <textarea
                                            value={internship.tutorEvaluation?.tutorComment || ''}
                                            onChange={e => {
                                                const baseEval = internship.tutorEvaluation || { competencies: [], globalGrade: 0, tutorComment: '', tutorSignature: '' };
                                                handleUpdateInternship({
                                                    ...internship,
                                                    tutorEvaluation: { ...baseEval, tutorComment: e.target.value }
                                                });
                                            }}
                                            className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                                            rows={4}
                                            placeholder="Indiquez ici votre appréciation générale sur le stagiaire..."
                                        />
                                    </div>
                                    <div>
                                         <label className="font-bold text-sm text-gray-600 block mb-2">Signature du Tuteur</label>
                                         <SignaturePad
                                            signature={internship.tutorEvaluation?.tutorSignature}
                                            onSave={signatureDataUrl => {
                                                const baseEval = internship.tutorEvaluation || { competencies: [], globalGrade: 0, tutorComment: '', tutorSignature: '' };
                                                handleUpdateInternship({
                                                    ...internship,
                                                    tutorEvaluation: { ...baseEval, tutorSignature: signatureDataUrl }
                                                });
                                            }}
                                         />
                                    </div>
                                </div>
                            </section>

                            {/* Portfolio view */}
                            <div className="border-t border-gray-200 pt-8">
                                <h3 className="font-bold text-lg text-gray-800 mb-4">Portfolio de l'élève</h3>
                                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                                     {internship.portfolio.length === 0 ? (
                                        <div className="text-center text-gray-400 py-10">
                                            Aucune entrée dans le portfolio.
                                        </div>
                                    ) : (
                                        internship.portfolio.map(item => (
                                            <div key={item.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-bold text-gray-500">{new Date(item.date).toLocaleDateString()}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.type === 'photo' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {item.type === 'photo' ? 'Photo' : 'Journal'}
                                                    </span>
                                                </div>
                                                {item.type === 'photo' && item.content.startsWith('data:image') ? (
                                                    <img src={item.content} alt="Portfolio" className="w-full h-40 object-cover rounded mb-2 border"/>
                                                ) : (
                                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>
                                                )}
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
    }
    
    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-sky-700 text-white p-6 shadow-md">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3"><Briefcase /> Espace Tuteur</h1>
                        <p className="opacity-80">{user.name}</p>
                    </div>
                    <button onClick={onLogout} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            <main className="p-4 sm:p-6 md:p-8">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Mes Stagiaires</h2>
                    
                    {myStudents.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-lg border border-dashed">
                             <p className="text-gray-500">Aucun stagiaire ne vous est actuellement assigné.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myStudents.map(({ student, internship, period }) => (
                                <button 
                                    key={student.id}
                                    onClick={() => setSelectedStudentId(student.id)}
                                    className="w-full flex items-center justify-between text-left p-5 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-sky-400 hover:shadow-md transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-xl">
                                            {student.lastName.charAt(0)}{student.firstName.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900 group-hover:text-sky-700">{student.lastName} {student.firstName}</h3>
                                            <p className="text-sm text-gray-500">{period.title} - {internship.companyName}</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={24} className="text-gray-300 group-hover:text-sky-600 transition-transform group-hover:translate-x-1"/>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default TutorPortal;