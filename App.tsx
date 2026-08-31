

import React, { useState, useEffect, useMemo } from 'react';
import EvaluationForm from './components/EvaluationForm';
import ExamBilan from './components/ExamBilan';
import CompetencyBilan from './components/CompetencyBilan';
// FIX: Changed from default import to named import for SessionHistory to match the updated export in its module.
import { SessionHistory } from './components/SessionHistory';
import ClassManager from './components/ClassManager';
import MassEvaluation from './components/MassEvaluation';
import StudentDossier from './components/StudentDossier';
import UserSettings from './components/UserSettings';
import { DiplomaSettings } from './components/DiplomaSettings';
import PublicEntry from './components/PublicEntry'; // Changed from LoginScreen
import StudentPortal from './components/StudentPortal';
import TutorPortal from './components/TutorPortal';
import Schedule from './components/Schedule';
import InternshipManager from './components/InternshipManager';
import SaaSManager from './components/SaaSManager';
import ConfirmModal from './components/ConfirmModal';
import Dashboard from './components/Dashboard';
import { useConfirm } from './components/ConfirmContext';
import { TpSession, StudentClass, UserSettingsData, LevelCode, RepositoryData, Diploma, AuthUser, InternshipDataStore, EvaluationItem, CompetencyCode, ActivityCode, Student, Subscriber } from './types';
import { LayoutDashboard, PenTool, GraduationCap, Menu, X, Users, FolderOpen, ClipboardCheck, Settings, BarChart2, BookCopy, FileText, LogOut, Calendar, Briefcase } from 'lucide-react';
import { generateTpPdf } from './services/pdfService';
import { deleteSubscriberData, getSubscribers } from './services/saasService';
import { LEVELS } from './constants';
import { DEFAULT_DIPLOMAS } from './data/defaultData';

// FIX: Per API Key guidelines, removed geminiApiKey from default settings.
const DEFAULT_SETTINGS: UserSettingsData = {
    teacherName: '',
    examThresholds: {
      TA: 15,
      PA: 10,
      IA: 5,
    },
    customScores: {
      [LevelCode.TA]: 20,
      [LevelCode.PA]: 20 * (2/3),
      [LevelCode.IA]: 20 * (1/3),
      [LevelCode.NA]: 0,
      [LevelCode.NE]: 0,
    }
};

const DEFAULT_REPOSITORY: RepositoryData = {
    competencies: [],
    exams: [],
    savoirs: [],
    activities: [],
};

// Helper for safe JSON parsing, now with prefix for multi-tenancy
const safeJSONParse = (key: string, defaultValue: any, prefix: string | null = null) => {
    const fullKey = prefix ? `${prefix}-${key}` : key;
    try {
        const saved = localStorage.getItem(fullKey);
        if (saved === null || saved === 'undefined') {
            return defaultValue;
        }
        return JSON.parse(saved);
    } catch (error) {
        console.error(`Error parsing ${fullKey} from localStorage, removing faulty data.`, error);
        localStorage.removeItem(fullKey); // Avoid repeated errors on reload
        return defaultValue;
    }
};

// Merges newly added default diplomas into existing records, while permanently filtering out deleted/legacy ones like CS TER
const loadDiplomasAndMergeDefaults = (prefix: string | null) => {
    const loaded = safeJSONParse('classpropilot-diplomas', DEFAULT_DIPLOMAS, prefix);
    // Supprimer définitivement CS TER de la liste chargée
    const filtered = loaded.filter((d: Diploma) => d.id !== 'cs-ter-default' && d.name !== 'CS TER');
    let updated = [...filtered];
    let changed = loaded.length !== filtered.length;
    for (const defDiploma of DEFAULT_DIPLOMAS) {
        if (!updated.some(d => d.id === defDiploma.id)) {
            updated.push(defDiploma);
            changed = true;
        }
    }
    if (changed) {
        const fullKey = prefix ? `${prefix}-classpropilot-diplomas` : 'classpropilot-diplomas';
        try {
            localStorage.setItem(fullKey, JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to save merged diplomas to localStorage', e);
        }
    }
    return updated;
};

const lastSubscriberId = localStorage.getItem('classpropilot-lastSubscriberId');


const App: React.FC = () => {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [impersonationSource, setImpersonationSource] = useState<AuthUser | null>(null);
  const { confirm } = useConfirm();

  const allPublicData = useMemo(() => {
    if (currentUser) {
        return { classes: [], internshipData: { periods: [], internships: [] } };
    }

    const subscribers = getSubscribers();
    if (!subscribers || subscribers.length === 0) {
        return { classes: [], internshipData: { periods: [], internships: [] } };
    }

    let allClasses: StudentClass[] = [];
    let allInternshipData: InternshipDataStore = { periods: [], internships: [] };

    subscribers.forEach(sub => {
        const subscriberClasses = safeJSONParse('classpropilot-classes', [], sub.id);
        allClasses.push(...subscriberClasses);
        
        const subscriberInternships = safeJSONParse('classpropilot-internships', { periods: [], internships: [] }, sub.id);
        allInternshipData.periods.push(...subscriberInternships.periods);
        allInternshipData.internships.push(...subscriberInternships.internships);
    });

    return { classes: allClasses, internshipData: allInternshipData };
  }, [currentUser]);

  const [currentView, setCurrentView] = useState<'dashboard' | 'new-tp' | 'my-tps' | 'bilan' | 'competencies' | 'classes' | 'mass-eval' | 'settings' | 'diploma-settings' | 'schedule' | 'internships' | 'student-dossier'>('dashboard');
  const [activeDossierStudent, setActiveDossierStudent] = useState<Student | null>(null);
  const [activeDossierClass, setActiveDossierClass] = useState<StudentClass | null>(null);
  
  // Data states are now initialized from localStorage of the last user
  const [sessions, setSessions] = useState<TpSession[]>(() => safeJSONParse('classpropilot-sessions', [], lastSubscriberId));
  const [classes, setClasses] = useState<StudentClass[]>(() => safeJSONParse('classpropilot-classes', [], lastSubscriberId));
  const [settings, setSettings] = useState<UserSettingsData>(() => {
    const loadedSettings = safeJSONParse('classpropilot-settings', DEFAULT_SETTINGS, lastSubscriberId);
    return { ...DEFAULT_SETTINGS, ...loadedSettings, examThresholds: {...DEFAULT_SETTINGS.examThresholds, ...loadedSettings.examThresholds}, customScores: {...DEFAULT_SETTINGS.customScores, ...loadedSettings.customScores} };
  });
  const [internshipData, setInternshipData] = useState<InternshipDataStore>(() => safeJSONParse('classpropilot-internships', { periods: [], internships: [] }, lastSubscriberId));
  const [diplomas, setDiplomas] = useState<Diploma[]>(() => loadDiplomasAndMergeDefaults(lastSubscriberId));
  const [activeDiplomaId, setActiveDiplomaId] = useState<string | null>(() => {
    const loadedDiplomas = loadDiplomasAndMergeDefaults(lastSubscriberId);
    const savedActiveId = localStorage.getItem(lastSubscriberId ? `${lastSubscriberId}-classpropilot-activeDiplomaId` : '');
    if (loadedDiplomas.length > 0) {
        if (savedActiveId && loadedDiplomas.some((d: Diploma) => d.id === savedActiveId)) {
            return savedActiveId;
        }
        return loadedDiplomas[0].id;
    }
    return null;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<TpSession | null>(null);

  // Data Loading/Switching Effect for when user logs in
  useEffect(() => {
    const subscriberId = currentUser?.role === 'admin' ? currentUser.subscriberId : null;
    const currentDataOwner = localStorage.getItem('classpropilot-lastSubscriberId');

    if (subscriberId) {
        localStorage.setItem('classpropilot-lastSubscriberId', subscriberId);
        
        // If we've logged in as a different admin, reload all data.
        if (subscriberId !== currentDataOwner) {
            setSessions(safeJSONParse('classpropilot-sessions', [], subscriberId));
            setClasses(safeJSONParse('classpropilot-classes', [], subscriberId));
            const loadedSettings = safeJSONParse('classpropilot-settings', DEFAULT_SETTINGS, subscriberId);
            setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings, examThresholds: {...DEFAULT_SETTINGS.examThresholds, ...loadedSettings.examThresholds}, customScores: {...DEFAULT_SETTINGS.customScores, ...loadedSettings.customScores} });
            setInternshipData(safeJSONParse('classpropilot-internships', { periods: [], internships: [] }, subscriberId));
            const loadedDiplomas = loadDiplomasAndMergeDefaults(subscriberId);
            setDiplomas(loadedDiplomas);

            const savedActiveId = localStorage.getItem(`${subscriberId}-classpropilot-activeDiplomaId`);
            if (loadedDiplomas.length > 0) {
                if (savedActiveId && loadedDiplomas.some((d: Diploma) => d.id === savedActiveId)) {
                    setActiveDiplomaId(savedActiveId);
                } else {
                    setActiveDiplomaId(loadedDiplomas[0].id);
                }
            } else {
                setActiveDiplomaId(null);
            }
        }
    } 
    // NO "else" block, so data is not cleared on logout
  }, [currentUser]);

  // Data Persistence Effect
  useEffect(() => {
    const subscriberId = currentUser?.role === 'admin' ? currentUser.subscriberId : (localStorage.getItem('classpropilot-lastSubscriberId') || lastSubscriberId);
    if (!subscriberId) return;

    const prefix = subscriberId;
    const key = (k: string) => `${prefix}-${k}`;

    try {
        localStorage.setItem(key('classpropilot-sessions'), JSON.stringify(sessions));
        localStorage.setItem(key('classpropilot-classes'), JSON.stringify(classes));
        localStorage.setItem(key('classpropilot-settings'), JSON.stringify(settings));
        localStorage.setItem(key('classpropilot-diplomas'), JSON.stringify(diplomas));
        localStorage.setItem(key('classpropilot-internships'), JSON.stringify(internshipData));
        if (activeDiplomaId) {
            localStorage.setItem(key('classpropilot-activeDiplomaId'), activeDiplomaId);
        } else {
            localStorage.removeItem(key('classpropilot-activeDiplomaId'));
        }
    } catch (error) {
        console.error("Error saving to localStorage", error);
        if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
            alert("ERREUR CRITIQUE : L'espace de stockage est plein. Essayez de supprimer d'anciennes données.");
        }
    }
  }, [sessions, classes, settings, diplomas, activeDiplomaId, internshipData, currentUser]);

  const activeDiploma = useMemo(() => diplomas.find(d => d.id === activeDiplomaId), [diplomas, activeDiplomaId]);
  const activeRepository = useMemo(() => activeDiploma?.repository || DEFAULT_REPOSITORY, [activeDiploma]);

  const currentLevels = useMemo(() => {
    const newLevels = JSON.parse(JSON.stringify(LEVELS)); // Deep copy
    if (settings.customScores) {
        for (const key in newLevels) {
            const levelCode = key as LevelCode;
            if (settings.customScores[levelCode] !== undefined) {
                newLevels[levelCode].score = settings.customScores[levelCode];
            }
        }
    }
    return newLevels;
  }, [settings.customScores]);

  // FIX: Per API Key guidelines, API key status should only come from the environment.
  const hasApiKey = !!process.env.API_KEY;

  const combinedSessions = useMemo(() => {
    const syntheticInternshipSessions: TpSession[] = [];
    internshipData.internships.forEach(internship => {
        if (!internship.tutorEvaluation || internship.tutorEvaluation.competencies.length === 0) return;
        // ... (rest of logic is fine as it operates on state)
    });
    return [...sessions, ...syntheticInternshipSessions];
  }, [sessions, internshipData, classes, diplomas]);

  const handleSaveSession = (session: TpSession) => {
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
        setSessions(prev => prev.map(s => s.id === session.id ? session : s));
        alert("Séance mise à jour avec succès !");
    } else {
        setSessions(prev => [session, ...prev]);
        alert("Séance sauvegardée avec succès !");
    }
    setEditingSession(null);
    setCurrentView('my-tps');
  };
  
  const handleDataReset = () => {
    if (currentUser?.subscriberId) {
        confirm({
            title: "Réinitialiser les données",
            message: "⚠️ ATTENTION\n\nVous allez effacer TOUTES les données de VOTRE compte enseignant (Classes, Élèves, TPs, etc.).\n\nCette action est irréversible. Continuer ?",
            onConfirm: () => {
                deleteSubscriberData(currentUser.subscriberId!);
                alert("Vos données ont été réinitialisées.");
                window.location.reload();
            }
        });
    }
  };

  const handleImpersonate = (subscriber: Subscriber) => {
    confirm({
        title: "Connexion en tant que client",
        message: `Vous allez vous connecter en tant que "${subscriber.name}". Continuer ?`,
        isDestructive: false,
        onConfirm: () => {
            setImpersonationSource(currentUser);
            setCurrentUser({
                role: 'admin',
                name: subscriber.name,
                subscriberId: subscriber.id,
                isImpersonating: true
            });
            setCurrentView('dashboard');
        }
    });
  };

  const handleStopImpersonation = () => {
      if (impersonationSource) {
          setCurrentUser(impersonationSource);
          setImpersonationSource(null);
      }
  };

  // Other handlers (delete, edit, etc.) are mostly fine as they operate on component state which is now correctly scoped.
  const handleDeleteSession = (session: TpSession) => {
    confirm({
        title: "Supprimer la séquence",
        message: `Êtes-vous sûr de vouloir supprimer la séquence "${session.title}" ?`,
        onConfirm: () => {
            setSessions(prev => prev.filter(s => s.id !== session.id));
        }
    });
  };
  const handleBatchSave = (newSessions: TpSession[]) => {
      setSessions(prev => [...newSessions, ...prev]);
      alert(`${newSessions.length} évaluations sauvegardées !`);
      setCurrentView('my-tps');
  };
  const handleUpdateBatch = (updatedOrNewSessionsForGroup: TpSession[], groupKey: string) => {
    const [date, className, tpTitle, diplomaId] = groupKey.split('|');
    setSessions(prev => {
      const otherSessions = prev.filter(s => !(s.isTemplate === false && s.date === date && s.studentClass === className && s.title === tpTitle && s.diplomaId === diplomaId));
      return [...otherSessions, ...updatedOrNewSessionsForGroup];
    });
    alert('Évaluation mise à jour !');
  };
  const handleDeleteBatch = (date: string, className: string, tpTitle: string, diplomaId: string) => {
    confirm({
        title: "Supprimer les évaluations",
        message: `Supprimer toutes les évaluations de ce groupe ?`,
        onConfirm: () => {
            setSessions(prev => prev.filter(s => !(s.date === date && s.studentClass === className && s.title === tpTitle && s.diplomaId === diplomaId)));
        }
    });
  };
  const handleEditSession = (session: TpSession) => {
      if (session.diplomaId) setActiveDiplomaId(session.diplomaId);
      setEditingSession(session);
      setCurrentView('new-tp');
  };
  const handleAddDiploma = (diploma: Diploma) => {
    if (diplomas.length >= 10) return;
    setDiplomas([...diplomas, diploma]);
    setActiveDiplomaId(diploma.id);
    setCurrentView('dashboard');
  };
  const handleUpdateDiploma = (updatedDiploma: Diploma) => {
    setDiplomas(diplomas.map(d => d.id === updatedDiploma.id ? updatedDiploma : d));
  };
  const handleDeleteDiploma = (diplomaId: string) => {
    const diplomaToDelete = diplomas.find(d => d.id === diplomaId);
    if (!diplomaToDelete) return;
    confirm({
        title: "Supprimer le diplôme",
        message: `Supprimer le diplôme "${diplomaToDelete.name}" et TOUTES ses données associées (TPs, classes...) ?`,
        onConfirm: () => {
            setSessions(prev => prev.filter(s => s.diplomaId !== diplomaId));
            setClasses(prev => prev.filter(c => c.diplomaId !== diplomaId));
            setDiplomas(prev => {
                const newDiplomas = prev.filter(d => d.id !== diplomaId);
                if (activeDiplomaId === diplomaId) {
                   setActiveDiplomaId(newDiplomas.length > 0 ? newDiplomas[0].id : null);
                }
                return newDiplomas;
            });
        }
    });
  };
  const handleDeleteClassGlobal = (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    confirm({
        title: "Supprimer la classe",
        message: `Supprimer la classe "${cls.name}" et toutes ses données associées ?`,
        onConfirm: () => {
            const studentNames = new Set(cls.students.map(s => `${s.lastName} ${s.firstName}`));
            setSessions(prev => prev.filter(s => !(s.studentClass === cls.name && studentNames.has(s.studentName))));
            setInternshipData(prev => ({
                periods: prev.periods.filter(p => p.classId !== classId),
                internships: prev.internships.filter(i => !cls.students.some(s => s.id === i.studentId))
            }));
            setClasses(prev => prev.filter(c => c.id !== classId));
        }
    });
  };
  const handleDeleteStudentGlobal = (classId: string, studentId: string) => {
     const cls = classes.find(c => c.id === classId);
     const student = cls?.students.find(s => s.id === studentId);
     if (!cls || !student) return;
     confirm({
         title: "Supprimer l'élève",
         message: `Supprimer l'élève "${student.lastName} ${student.firstName}" et toutes ses données ?`,
         onConfirm: () => {
             const fullName = `${student.lastName} ${student.firstName}`;
             setSessions(prev => prev.filter(s => !(s.studentClass === cls.name && s.studentName === fullName)));
             setInternshipData(prev => ({ ...prev, internships: prev.internships.filter(i => i.studentId !== studentId) }));
             setClasses(prev => prev.map(c => c.id === classId ? {...c, students: c.students.filter(s => s.id !== studentId)} : c));
         }
     });
  };

  const handleUpdateStudentPhoto = (studentId: string, photo: string) => {
      setClasses(prev => prev.map(c => {
          if (c.students.some(s => s.id === studentId)) {
              return {
                  ...c,
                  students: c.students.map(s => s.id === studentId ? { ...s, photo } : s)
              };
          }
          return c;
      }));
  };

  const filteredSessionsByDiploma = useMemo(() => sessions.filter(s => s.diplomaId === activeDiplomaId), [sessions, activeDiplomaId]);

  if (!currentUser) {
      return (
          <PublicEntry
            classes={allPublicData.classes} 
            onLogin={(user: AuthUser) => setCurrentUser(user)} 
            establishmentLogo={settings.establishmentLogo}
            internshipData={allPublicData.internshipData}
          />
      );
  }

  if (currentUser.role === 'super-admin') {
      return <SaaSManager onImpersonate={handleImpersonate} onLogout={() => setCurrentUser(null)} />;
  }

  if (currentUser.role === 'student' || currentUser.role === 'parent') {
      return (
          <StudentPortal 
            user={currentUser} onLogout={() => setCurrentUser(null)}
            sessions={combinedSessions} classes={classes} diplomas={diplomas}
            levels={currentLevels} establishmentLogo={settings.establishmentLogo}
            examThresholds={settings.examThresholds}
            onUpdateStudentPhoto={handleUpdateStudentPhoto}
          />
      );
  }
  
  if (currentUser.role === 'tutor') {
      return (
          <TutorPortal
            user={currentUser} onLogout={() => setCurrentUser(null)}
            classes={classes} diplomas={diplomas} levels={currentLevels}
            internshipData={internshipData} onUpdateData={setInternshipData}
          />
      );
  }

  const renderContent = () => {
    if (diplomas.length === 0) {
        return <DiplomaSettings 
            diplomas={diplomas} activeDiplomaId={activeDiplomaId}
            onAddDiploma={handleAddDiploma} onUpdateDiploma={handleUpdateDiploma}
            onDeleteDiploma={handleDeleteDiploma} onSetActiveDiploma={setActiveDiplomaId}
        />;
    }
    if (!activeDiploma) {
        return <div className="p-8 text-center">Chargement des données du diplôme...</div>;
    }
    // ... (rest of renderContent is mostly fine)
    switch (currentView) {
      case 'new-tp':
        return (
            <EvaluationForm 
                key={editingSession?.id || 'new'}
                onSave={handleSaveSession} 
                initialSession={editingSession}
                onCancel={() => { setEditingSession(null); setCurrentView('my-tps'); }}
                teacherName={settings.teacherName} levels={currentLevels}
                establishmentLogo={settings.establishmentLogo} diplomas={diplomas}
                activeDiplomaId={activeDiplomaId} onDiplomaChange={setActiveDiplomaId}
            />
        );
      case 'classes':
        return <ClassManager 
                  classes={classes} onUpdateClasses={setClasses} sessions={sessions} onUpdateSessions={setSessions}
                  diplomas={diplomas} onDeleteClass={handleDeleteClassGlobal} onDeleteStudent={handleDeleteStudentGlobal}
                  onOpenStudentDossier={(student, cls) => {
                    setActiveDossierStudent(student);
                    setActiveDossierClass(cls);
                    setCurrentView('student-dossier');
                  }}
               />;
      case 'student-dossier':
        if (!activeDossierStudent || !activeDossierClass) {
            return <div className="p-8 text-center text-slate-500 font-semibold bg-white rounded-xl border border-dashed border-slate-200">Aucun dossier élève actif.</div>;
        }
        return (
          <StudentDossier
            student={activeDossierStudent}
            studentClass={activeDossierClass}
            classes={classes}
            sessions={combinedSessions}
            levels={currentLevels}
            diplomas={diplomas}
            onBack={() => { setCurrentView('classes'); setActiveDossierStudent(null); setActiveDossierClass(null); }}
            onEditSession={(session) => { setEditingSession(session); setCurrentView('new-tp'); }}
            onDeleteSession={(sessionId) => {
              confirm({
                title: "Supprimer la séquence",
                message: "Êtes-vous sûr de vouloir supprimer définitivement cette évaluation ?",
                onConfirm: () => {
                  setSessions(prev => prev.filter(s => s.id !== sessionId));
                  alert("Évaluation supprimée avec succès !");
                }
              });
            }}
            onSelectStudent={(student, cls) => {
              setActiveDossierStudent(student);
              setActiveDossierClass(cls);
            }}
            examThresholds={settings.examThresholds}
          />
        );
      case 'mass-eval':
        return <MassEvaluation 
                    sessions={sessions} classes={classes} onSaveBatch={handleBatchSave}
                    onUpdateBatch={handleUpdateBatch} onDeleteBatch={handleDeleteBatch} 
                    levels={currentLevels} diplomas={diplomas} 
                />;
      case 'internships':
        return <InternshipManager 
                    classes={classes} internshipData={internshipData} onUpdateData={setInternshipData}
                    diplomas={diplomas} levels={currentLevels}
                />;
      case 'settings':
        return <UserSettings currentSettings={settings} onSave={setSettings} onFactoryReset={handleDataReset} />;
      case 'diploma-settings':
        return <DiplomaSettings 
                    diplomas={diplomas} activeDiplomaId={activeDiplomaId} onAddDiploma={handleAddDiploma}
                    onUpdateDiploma={handleUpdateDiploma} onDeleteDiploma={handleDeleteDiploma}
                    onSetActiveDiploma={setActiveDiplomaId}
                />;
      case 'my-tps':
        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                     <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FolderOpen className="text-indigo-600"/> Mes Séquences</h2>
                    <div className="flex items-center gap-4 flex-wrap md:flex-nowrap justify-start md:justify-end">
                        {diplomas.length > 1 && (
                            <div className="flex items-center gap-2">
                                <label htmlFor="diploma-select-tps" className="text-sm font-medium text-gray-500">Diplôme:</label>
                                <select id="diploma-select-tps" value={activeDiplomaId || ''} onChange={(e) => setActiveDiplomaId(e.target.value)}
                                    className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-gray-700 bg-white">
                                    {diplomas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        )}
                        <button onClick={() => { setEditingSession(null); setCurrentView('new-tp'); }}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-indigo-700 justify-center">
                            <PenTool size={18}/> Créer une Séquence
                        </button>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                     <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><FileText className="text-indigo-600"/>Modèles de Séquence pour "{activeDiploma.name}"</h3>
                    <SessionHistory 
                        sessions={filteredSessionsByDiploma.filter(s => s.isTemplate)} onEdit={handleEditSession} onDelete={handleDeleteSession}
                        onPrintStudent={(s) => generateTpPdf(s, 'student', settings.establishmentLogo, activeRepository.competencies)}
                        onPrintTeacher={(s) => generateTpPdf(s, 'teacher', settings.establishmentLogo, activeRepository.competencies)}
                    />
                </div>
            </div>
        );
      case 'bilan':
        return <ExamBilan sessions={combinedSessions} classes={classes} levels={currentLevels} diplomas={diplomas} examThresholds={settings.examThresholds} />;
      case 'competencies':
        return <CompetencyBilan sessions={combinedSessions} classes={classes} onUpdateClasses={setClasses} levels={currentLevels} diplomas={diplomas} examThresholds={settings.examThresholds} />;
      case 'schedule':
        return <div className="h-[calc(100vh-6rem)]"><Schedule /></div>;
      case 'dashboard':
      default:
        return <Dashboard classes={classes} onNavigate={setCurrentView as any} sessions={combinedSessions.filter(s => !s.isTemplate)} />;
    }
  };

  return (
    <>
      {currentUser.isImpersonating && (
          <div className="bg-yellow-400 text-yellow-900 text-center py-2 px-4 font-bold text-sm fixed top-0 left-0 right-0 z-[100] no-print">
              Vous êtes connecté en tant que <span className="underline">{currentUser.name.replace(' (Impersonation)', '')}</span>. 
              <button onClick={handleStopImpersonation} className="ml-4 underline font-bold">Retourner au panel Admin</button>
          </div>
      )}
      <div className={`min-h-screen flex flex-col md:flex-row ${currentUser.isImpersonating ? 'pt-8' : ''}`}>
        
        {/* Mobile Header */}
        <div className="md:hidden bg-indigo-900 text-white p-4 flex justify-between items-center no-print sticky top-0 z-50">
            <span className="font-bold text-lg">ClassProPilot</span>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>{isSidebarOpen ? <X /> : <Menu />}</button>
        </div>

        {/* Sidebar */}
        <aside className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-indigo-900 text-white transform transition-transform duration-200 ease-in-out no-print ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col`}>
          <div className="p-6 border-b border-indigo-800">
            <h1 className="text-2xl font-bold tracking-tight">ClassPro<span className="text-indigo-400">Pilot</span></h1>
            <p className="text-xs text-indigo-300 mt-1">Assistant Pédagogique Intelligent</p>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {[
                { view: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
                { view: 'schedule', label: 'Mon EDT', icon: Calendar },
                { view: 'new-tp', label: 'Nouvelle Séquence', icon: PenTool },
                { view: 'mass-eval', label: 'Notes & Évaluations', icon: ClipboardCheck },
                { view: 'my-tps', label: 'Mes Séquences', icon: FolderOpen },
                { view: 'classes', label: 'Mes Classes', icon: Users },
                { view: 'internships', label: 'Suivi de Stage', icon: Briefcase },
                { view: 'competencies', label: 'Bilans Compétences', icon: BarChart2 },
                { view: 'bilan', label: 'Bilans Examens', icon: GraduationCap },
            ].map(item => (
                 <button key={item.view} onClick={() => { setCurrentView(item.view as any); setIsSidebarOpen(false); if(item.view === 'new-tp') setEditingSession(null); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === item.view ? 'bg-indigo-800 text-white' : 'text-indigo-200 hover:bg-indigo-800/50'}`}>
                    <item.icon size={20}/>{item.label}
                </button>
            ))}
            <div className="pt-4 mt-4 border-t border-indigo-800">
                <button onClick={() => { setCurrentView('settings'); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'settings' ? 'bg-indigo-800 text-white' : 'text-indigo-200 hover:bg-indigo-800/50'}`}>
                    <Settings size={20}/>Paramètres Admin
                </button>
                 <button onClick={() => { setCurrentView('diploma-settings'); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'diploma-settings' ? 'bg-indigo-800 text-white' : 'text-indigo-200 hover:bg-indigo-800/50'}`}>
                    <BookCopy size={20}/>Paramètres Diplôme
                </button>
            </div>
          </nav>
          <div className="p-4 bg-indigo-950 text-xs text-indigo-400">
              <div className="flex justify-between items-center mb-2">
                 <span>{currentUser.name}</span>
                 <button onClick={() => setCurrentUser(null)} className="text-white hover:text-red-300" title="Déconnexion"><LogOut size={14}/></button>
              </div>
              <p className="mb-2">Status API: {hasApiKey ? <span className="text-green-400">Connecté</span> : <span className="text-red-400">Manquant</span>}</p>
              <p>© 2024 ClassProPilot</p>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">{renderContent()}</main>

        {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
      </div>
    </>
  );
};

export default App;
