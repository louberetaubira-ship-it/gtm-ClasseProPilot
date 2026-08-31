import React, { useMemo, useState, useRef, useEffect } from 'react';
import { AuthUser, TpSession, StudentClass, Diploma, LevelCode, LevelDetails, InternshipDataStore, StudentInternship, InternshipPeriod } from '../types';
import { LogOut, GraduationCap, Calendar, Download, BarChart2, Star, TrendingUp, Briefcase, Camera, Upload, X, User as UserIcon, Pencil } from 'lucide-react';
import { generateTpPdf } from '../services/pdfService';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import StudentInternshipView from './StudentInternshipView';
import { compressImage } from '../services/imageService';

interface Props {
  user: AuthUser;
  onLogout: () => void;
  sessions: TpSession[];
  classes: StudentClass[];
  diplomas: Diploma[];
  levels: Record<LevelCode, LevelDetails>;
  establishmentLogo?: string;
  examThresholds?: { TA: number; PA: number; IA: number; };
  onUpdateStudentPhoto?: (studentId: string, photo: string) => void;
}

interface CompetencyDetail {
    code: string;
    percentage: number;
    level: string;
    color: string;
    textColor: string;
    avgScore: number;
}

const CompetencyMatrix = ({ details }: { details: CompetencyDetail[] }) => {
    if (!details || details.length === 0) return null;
    return (
        <div className="w-full">
            {/* Codes */}
            <div className="flex">
                {details.map(d => (
                    <div key={d.code} className="flex-1 text-center text-xs font-bold text-gray-600 truncate px-1" title={d.code}>{d.code}</div>
                ))}
            </div>
             {/* Average Scores */}
            <div className="flex mt-1">
                {details.map(d => (
                    <div key={d.code} className="flex-1 text-center text-[10px] text-gray-500 font-mono">
                        {d.level === 'NE' ? '-' : d.avgScore.toFixed(1)}
                    </div>
                ))}
            </div>
            {/* Percentages */}
            <div className="flex mt-1">
                {details.map(d => (
                    <div key={d.code} className="flex-1 text-center text-[10px] text-gray-500">
                        {d.level === 'NE' ? '-' : `${d.percentage}%`}
                    </div>
                ))}
            </div>
            {/* Color bars */}
            <div className="flex mt-1 h-5 gap-px">
                {details.map(d => (
                    <div key={d.code} title={`${d.code}: ${d.level} (${d.avgScore.toFixed(1)}/20 - ${d.percentage}%)`} className={`flex-1 flex items-center justify-center rounded-sm text-[10px] ${d.color} ${d.textColor}`}>
                        {d.level !== 'NE' ? d.level : ''}
                    </div>
                ))}
            </div>
        </div>
    );
};


const StudentPortal: React.FC<Props> = ({ user, onLogout, sessions, classes, diplomas, levels, establishmentLogo, examThresholds, onUpdateStudentPhoto }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'internship'>('dashboard');
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // Retrieve Student and Class Info
  const studentInfo = useMemo(() => {
      const cls = classes.find(c => c.id === user.classId);
      const student = cls?.students.find(s => s.id === user.id);
      return { cls, student };
  }, [classes, user]);

  const studentFullName = studentInfo.student ? `${studentInfo.student.lastName} ${studentInfo.student.firstName}` : user.name;
  
  // Filter sessions for this student
  const mySessions = useMemo(() => {
      if (!studentInfo.cls) return [];
      return sessions.filter(s => 
          s.studentClass === studentInfo.cls?.name && 
          s.studentName === studentFullName &&
          !s.isTemplate
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, studentInfo, studentFullName]);

  // Determine Diploma
  const diploma = useMemo(() => {
      if (!studentInfo.cls) return null;
      return diplomas.find(d => d.id === studentInfo.cls?.diplomaId);
  }, [diplomas, studentInfo]);

  // Statistics
  const stats = useMemo(() => {
      if (mySessions.length === 0) return { avg: 0, count: 0, best: 0 };
      const sum = mySessions.reduce((acc, s) => acc + s.globalNote, 0);
      const notes = mySessions.map(s => s.globalNote);
      return {
          avg: sum / mySessions.length,
          count: mySessions.length,
          best: Math.max(...notes)
      };
  }, [mySessions]);

  // Chart Data
  const chartData = useMemo(() => {
      if (!diploma || mySessions.length === 0) return [];
      
      const competencies = diploma.repository.competencies || [];
      return competencies.map(comp => {
          const evals = mySessions.flatMap(s => 
              s.evaluations.filter(e => e.competencyCode === comp.code && e.level !== LevelCode.NE)
          );
          
          let score = 0;
          if (evals.length > 0) {
              const sum = evals.reduce((acc, curr) => acc + levels[curr.level].score, 0);
              score = parseFloat((sum / evals.length).toFixed(2));
          }
          
          return { subject: comp.code, score, fullMark: 20, label: comp.label };
      });
  }, [diploma, mySessions, levels]);

  const bilanData = useMemo(() => {
    if (!diploma || mySessions.length === 0) {
        return null;
    }

    const thresholds = {
        TA: examThresholds?.TA ?? 15,
        PA: examThresholds?.PA ?? 10,
        IA: examThresholds?.IA ?? 5,
    };

    const { competencies, exams: allExams } = diploma.repository;
    const professionalExams = allExams.filter(exam => exam.isProfessional);

    const competencyDetails: CompetencyDetail[] = competencies.map(comp => {
        const compEvals = mySessions.flatMap(s => 
            s.evaluations.filter(e => e.competencyCode === comp.code && e.level !== LevelCode.NE)
        );

        if (compEvals.length > 0) {
            const sum = compEvals.reduce((acc, curr) => acc + levels[curr.level].score, 0);
            const avgScore = sum / compEvals.length;
            const percentage = Math.round((avgScore / 20) * 100);
            
            let level = 'NA', color = 'bg-red-600', textColor = 'text-white font-bold';
            if (avgScore >= thresholds.TA) {
                level = 'TA'; color = 'bg-green-600'; textColor = 'text-white font-bold';
            } else if (avgScore >= thresholds.PA) {
                level = 'PA'; color = 'bg-lime-500'; textColor = 'text-lime-950 font-bold';
            } else if (avgScore >= thresholds.IA) {
                level = 'IA'; color = 'bg-yellow-400'; textColor = 'text-yellow-950 font-bold';
            }
            
            return { code: comp.code, percentage, level, color, textColor, avgScore };
        }

        return { code: comp.code, percentage: 0, level: 'NE', color: 'bg-gray-100 border border-gray-200', textColor: 'text-gray-400', avgScore: 0 };
    });

    const examGrades: Record<string, number> = {};
    professionalExams.forEach(exam => {
        if (!exam.competencies || exam.competencies.length === 0) {
            examGrades[exam.code] = 0;
            return;
        }
        
        let weightedSum = 0;
        exam.competencies.forEach(examComp => {
            const compDetail = competencyDetails.find(cd => cd.code === examComp.code);
            const avgCompScore = compDetail ? compDetail.avgScore : 0;
            weightedSum += avgCompScore * (examComp.weight / 100);
        });
        examGrades[exam.code] = weightedSum;
    });

    let totalCoef = 0;
    let weightedSumOfGrades = 0;
    professionalExams.forEach(exam => {
        const grade = examGrades[exam.code];
        if (grade !== undefined) {
            weightedSumOfGrades += grade * exam.coef;
            totalCoef += exam.coef;
        }
    });
    const globalAvg = totalCoef > 0 ? weightedSumOfGrades / totalCoef : 0;

    return { competencyDetails, examGrades, globalAvg, professionalExams };

  }, [diploma, mySessions, levels, examThresholds]);



  // --- Internship Logic ---
  
  // Load Internship Data from LocalStorage directly here to avoid passing it all the way down from App if not needed globally yet, 
  // OR strictly, we should probably pass it from App. For now, let's load it to allow self-contained logic if App doesn't pass it.
  // Ideally, props should be updated. Let's assume we read from LS for the student view if not passed.
  // Actually, let's update App.tsx to pass it down. But since I can't change App.tsx interface easily without breaking things if I don't update all calls,
  // I will read LS here as a fallback or if possible.
  
  const [internshipData, setInternshipData] = useState<InternshipDataStore>(() => {
      const saved = localStorage.getItem('classpropilot-internships');
      return saved ? JSON.parse(saved) : { periods: [], internships: [] };
  });

  const activePeriod = useMemo(() => {
      if (!studentInfo.cls) return null;
      // Find active period for this class (current date in range, or latest)
      const periods = internshipData.periods.filter(p => p.classId === studentInfo.cls!.id);
      return periods.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
  }, [internshipData.periods, studentInfo.cls]);

  const myInternship = useMemo(() => {
    if (!activePeriod || !user.id) return null;
    return internshipData.internships.find(i => i.studentId === user.id && i.periodId === activePeriod.id) || {
        id: crypto.randomUUID(),
        studentId: user.id,
        periodId: activePeriod.id,
        companyName: '', companyAddress: '', tutorName: '', tutorEmail: '', tutorPhone: '', 
        referentTeacherGen: '', referentTeacherPro: '',
        portfolio: []
    } as StudentInternship;
  }, [activePeriod, user.id, internshipData.internships]);

  const handleUpdateInternship = (updated: StudentInternship) => {
      const existingIndex = internshipData.internships.findIndex(i => i.id === updated.id);
      const newInternships = [...internshipData.internships];
      if (existingIndex >= 0) newInternships[existingIndex] = updated;
      else newInternships.push(updated);
      
      const newData = { ...internshipData, internships: newInternships };
      setInternshipData(newData);
      localStorage.setItem('classpropilot-internships', JSON.stringify(newData));
  };

  const StudentPhotoEditModal = () => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 400, height: 400 }
            });
            setStream(mediaStream);
            setIsCameraOpen(true);
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            }, 100);
        } catch (err) {
            console.error("Camera access failed", err);
            alert("Impossible d'accéder à la caméra. Veuillez vérifier les permissions dans votre navigateur.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsCameraOpen(false);
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth || 400;
            canvas.height = videoRef.current.videoHeight || 400;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                if (onUpdateStudentPhoto && user.id) {
                    onUpdateStudentPhoto(user.id, dataUrl);
                }
            }
        }
        stopCamera();
        setIsPhotoModalOpen(false);
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            compressImage(file, { maxSize: 400, quality: 0.85 }).then(compressedDataUrl => {
                if (onUpdateStudentPhoto && user.id) {
                    onUpdateStudentPhoto(user.id, compressedDataUrl);
                }
                setIsPhotoModalOpen(false);
            }).catch(err => {
                console.error("photo compression failed", err);
                alert("Erreur lors du traitement de la photo.");
            });
        }
    };

    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in text-gray-800">
            {isCameraOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex flex-col items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl border border-slate-350 shadow-2xl p-6 max-w-md w-full flex flex-col items-center justify-center space-y-6">
                        <div className="w-52 h-52 rounded-full border-4 border-indigo-600/95 overflow-hidden flex items-center justify-center bg-black shadow-lg relative">
                            <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline autoPlay muted />
                        </div>
                        <div className="flex items-center justify-center gap-3 w-full">
                            <button 
                                type="button" 
                                onClick={capturePhoto} 
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors flex items-center gap-2"
                            >
                                Prendre la photo
                            </button>
                            <button 
                                type="button" 
                                onClick={stopCamera} 
                                className="px-6 py-2.5 bg-slate-200 hover:bg-slate-350 text-slate-700 text-sm font-bold rounded-xl transition-colors"
                            >
                                Désactiver caméra
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Camera className="text-emerald-600" size={18}/>
                        Photo de profil
                    </h3>
                    <button type="button" onClick={() => setIsPhotoModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
                </div>
                <div className="p-6 flex flex-col items-center gap-6">
                    <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-emerald-300 flex items-center justify-center overflow-hidden relative shadow-inner">
                        {studentInfo.student?.photo ? (
                            <img src={studentInfo.student.photo} alt="Avatar" className="w-full h-full object-cover"/>
                        ) : (
                            <UserIcon size={38} className="text-gray-400"/>
                        )}
                    </div>
                    
                    <p className="text-center text-xs text-gray-500 px-4">
                        Ajoutez ou prenez une photo de vous pour personnaliser votre profil dans ClassProPilot.
                    </p>

                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" />

                    <div className="flex gap-3 w-full">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-gray-200"
                        >
                            <Upload size={14}/> Importer
                        </button>
                        <button
                            type="button"
                            onClick={startCamera}
                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md"
                        >
                            <Camera size={14}/> Photo
                        </button>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button type="button" onClick={() => setIsPhotoModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 text-xs font-bold">Fermer</button>
                </div>
            </div>
        </div>
    );
  };


  return (
    <div className="min-h-screen bg-gray-50 pb-20">
        {/* Mobile App Header */}
        <header className={`${user.role === 'parent' ? 'bg-orange-600' : 'bg-emerald-600'} text-white p-6 pb-6 rounded-b-[2.5rem] shadow-lg`}>
            <div className="flex justify-between items-start mb-6">
                 <div className="flex items-center gap-3">
                     <button 
                         type="button"
                         onClick={() => { if (user.role === 'student') setIsPhotoModalOpen(true); }}
                         className={`relative group w-11 h-11 rounded-full flex items-center justify-center overflow-hidden border border-white/30 shadow-inner ${user.role === 'student' ? 'cursor-pointer hover:border-white transition-all bg-white/10' : 'bg-white/20'}`}
                         title={user.role === 'student' ? "Modifier ma photo" : undefined}
                     >
                         {studentInfo.student?.photo ? (
                             <img src={studentInfo.student.photo} alt="Profil" className="w-full h-full object-cover" />
                         ) : (
                             <div className="p-2 rounded-full w-full h-full flex items-center justify-center">
                                 {user.role === 'parent' ? <Star className="text-white" /> : <GraduationCap className="text-white" />}
                             </div>
                         )}
                         {user.role === 'student' && (
                             <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Camera size={14} className="text-white" />
                             </div>
                         )}
                     </button>
                     <div>
                         <h1 className="font-bold text-lg leading-tight">{user.role === 'parent' ? 'Espace Parent' : 'Espace Élève'}</h1>
                         <p className="text-white/80 text-sm">{studentFullName}</p>
                     </div>
                 </div>
                 <button onClick={onLogout} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                     <LogOut size={20} />
                 </button>
            </div>
            
            {/* Main Stats Cards */}
            <div className="grid grid-cols-3 gap-4 text-center mb-6">
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-md">
                    <div className="text-2xl font-bold">{stats.avg.toFixed(2)}</div>
                    <div className="text-[10px] uppercase tracking-wider opacity-80">Moyenne</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-md">
                    <div className="text-2xl font-bold">{stats.count}</div>
                    <div className="text-[10px] uppercase tracking-wider opacity-80">TPs Notés</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-md">
                    <div className="text-2xl font-bold">{stats.best.toFixed(0)}</div>
                    <div className="text-[10px] uppercase tracking-wider opacity-80">Meilleure</div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex justify-center gap-4 bg-white/10 p-1 rounded-xl backdrop-blur-md inline-flex mx-auto w-full">
                <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white text-emerald-600 shadow-sm' : 'text-white/70 hover:bg-white/10'}`}
                >
                    Tableau de Bord
                </button>
                <button 
                    onClick={() => setActiveTab('internship')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'internship' ? 'bg-white text-emerald-600 shadow-sm' : 'text-white/70 hover:bg-white/10'}`}
                >
                    Mon Stage
                </button>
            </div>
        </header>

        <main className="px-4 mt-6 space-y-6">
            
            {activeTab === 'dashboard' ? (
                <>
                    {/* Bilan des Compétences */}
                    {bilanData && (
                        <div className="bg-white p-4 rounded-2xl shadow-md">
                            <div className="flex">
                                <div className="flex-1 text-xs font-bold text-gray-500 uppercase self-end pb-1">
                                    Bilan des Compétences
                                </div>
                                {bilanData.professionalExams.map(exam => (
                                    <div key={exam.code} className="w-14 text-center text-xs font-bold text-gray-500 uppercase">{exam.code}</div>
                                ))}
                                <div className="w-20 text-center text-xs font-bold text-gray-500 uppercase">Moy. Pro</div>
                            </div>
                            <div className="mt-2 flex items-center">
                                <div className="flex-1">
                                    <CompetencyMatrix details={bilanData.competencyDetails} />
                                </div>
                                {bilanData.professionalExams.map(exam => (
                                    <div key={exam.code} className="w-14 text-center font-bold text-lg text-gray-800">
                                        {bilanData.examGrades[exam.code] !== undefined ? bilanData.examGrades[exam.code].toFixed(1) : '-'}
                                    </div>
                                ))}
                                <div className="w-20 text-center">
                                    <span className="p-2 rounded-lg font-bold text-lg bg-orange-100 text-orange-700">
                                        {bilanData.globalAvg.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Competency Chart */}
                    {chartData.length > 0 && (
                        <div className="bg-white p-4 rounded-2xl shadow-md">
                            <div className="flex items-center gap-2 mb-2 text-gray-700 font-bold text-sm uppercase">
                                <BarChart2 size={16} className="text-indigo-500" />
                                Radar des Compétences
                            </div>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                                        <PolarGrid stroke="#e5e7eb" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6b7280' }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 20]} tick={false} axisLine={false} />
                                        <Radar name="Score" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                                        <Tooltip />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Recent Sessions List */}
                    <div>
                        <h3 className="text-gray-800 font-bold text-lg mb-3 flex items-center gap-2 px-2">
                            <TrendingUp size={20} className="text-indigo-500" />
                            Derniers TPs
                        </h3>
                        
                        <div className="space-y-3">
                            {mySessions.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                                    Aucune évaluation disponible.
                                </div>
                            ) : (
                                mySessions.map(session => (
                                    <div key={session.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                                        <div className="flex-1">
                                            <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{session.title}</h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                <Calendar size={12} />
                                                {new Date(session.date).toLocaleDateString()}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            <div className={`px-3 py-1 rounded-lg font-bold text-sm ${
                                                session.globalNote >= 15 ? 'bg-green-100 text-green-800' :
                                                session.globalNote >= 10 ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                                {session.globalNote.toFixed(1)}
                                            </div>
                                            <button 
                                                onClick={() => generateTpPdf(session, 'student', establishmentLogo, diploma?.repository.competencies)}
                                                className="p-2 bg-gray-50 text-gray-600 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                            >
                                                <Download size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            ) : (
                /* INTERNSHIP TAB */
                <div>
                     {activePeriod && myInternship ? (
                         <StudentInternshipView 
                            internship={myInternship} 
                            period={activePeriod} 
                            onUpdate={handleUpdateInternship} 
                         />
                     ) : (
                         <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
                             <Briefcase size={40} className="mx-auto text-gray-300 mb-4"/>
                             <p className="text-gray-500 font-medium">Aucune période de stage active.</p>
                             <p className="text-xs text-gray-400 mt-1">Votre enseignant doit d'abord créer une période.</p>
                         </div>
                     )}
                </div>
            )}
        </main>
        
        {establishmentLogo && (
            <div className="fixed bottom-4 left-0 right-0 flex justify-center opacity-50 pointer-events-none">
                 <img src={establishmentLogo} alt="Logo" className="h-8 grayscale" />
            </div>
        )}

        {isPhotoModalOpen && <StudentPhotoEditModal />}
    </div>
  );
};

export default StudentPortal;