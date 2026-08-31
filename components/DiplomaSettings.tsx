import React, { useState, useMemo } from 'react';
import { Loader2, BookCopy, FileUp, X, ChevronDown, ChevronRight, FileText, Activity, Book, Award, Plus, Check, Pencil, Trash2, Star, Save, RefreshCw, Upload } from 'lucide-react';
import { RepositoryData, TechnicalDoc, Diploma, ExamDef, ExamCompetency, SavoirDef, ActivityDefWithTasks, CompetencyDef, TacheDef, CompetencyCode, ActivityCode } from '../types';
import { analyzeRepositoryDocument } from '../services/geminiService';
import { useConfirm } from './ConfirmContext';

interface Props {
  diplomas: Diploma[];
  activeDiplomaId: string | null;
  onAddDiploma: (diploma: Diploma) => void;
  onUpdateDiploma: (diploma: Diploma) => void;
  onDeleteDiploma: (diplomaId: string) => void;
  onSetActiveDiploma: (diplomaId: string) => void;
}

interface AccordionSectionProps {
    title: string;
    icon: React.ReactNode;
    count: number;
    children: React.ReactNode;
    initiallyOpen?: boolean;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({ title, icon, count, children, initiallyOpen = false }) => {
    const [isOpen, setIsOpen] = useState(initiallyOpen);
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-5 text-left bg-white hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                        {icon}
                    </div>
                    <span className="font-bold text-gray-800 text-lg">{title}</span>
                    <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{count}</span>
                </div>
                {isOpen ? <ChevronDown size={20} className="text-gray-400"/> : <ChevronRight size={20} className="text-gray-400"/>}
            </button>
            {isOpen && (
                <div className="p-5 border-t border-gray-100 bg-white animate-in fade-in duration-300">
                    {children}
                </div>
            )}
        </div>
    );
};

export const DiplomaSettings: React.FC<Props> = ({ diplomas, activeDiplomaId, onAddDiploma, onUpdateDiploma, onDeleteDiploma, onSetActiveDiploma }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [repoFile, setRepoFile] = useState<TechnicalDoc | null>(null);
  const [newDiplomaName, setNewDiplomaName] = useState('');
  
  const [showUpdateZone, setShowUpdateZone] = useState(false);
  const [updateRepoFile, setUpdateRepoFile] = useState<TechnicalDoc | null>(null);
  const [isUpdatingRepo, setIsUpdatingRepo] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');

  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [currentExamWeights, setCurrentExamWeights] = useState<ExamCompetency[]>([]);

  // CRUD States
  const [newSavoir, setNewSavoir] = useState({ code: '', label: '' });
  const [editingSavoirCode, setEditingSavoirCode] = useState<string | null>(null);
  const [editSavoirData, setEditSavoirData] = useState({ code: '', label: '' });

  const [newActivity, setNewActivity] = useState({ code: '', label: '' });
  const [editingActivityCode, setEditingActivityCode] = useState<string | null>(null);
  const [editActivityData, setEditActivityData] = useState({ code: '', label: '' });

  const [newTask, setNewTask] = useState({ activityCode: '', code: '', label: '' });
  const [editingTaskCode, setEditingTaskCode] = useState<{activityCode: string, taskCode: string} | null>(null);
  const [editTaskData, setEditTaskData] = useState({ code: '', label: '' });

  const [newComp, setNewComp] = useState({ code: '', label: '', activities: '' });
  const [editingCompCode, setEditingCompCode] = useState<string | null>(null);
  const [editCompData, setEditCompData] = useState({ code: '', label: '', activities: '' });

  const [newExam, setNewExam] = useState({ code: '', label: '', coef: 1 });
  const [editingExamDetailsCode, setEditingExamDetailsCode] = useState<string | null>(null);
  const [editExamData, setEditExamData] = useState({ code: '', label: '', coef: 1 });

  const activeDiploma = diplomas.find(d => d.id === activeDiplomaId);

  const professionalExams = useMemo(() => {
    if (!activeDiploma?.repository?.exams) {
        return [];
    }
    return activeDiploma.repository.exams.filter(exam => exam.isProfessional);
  }, [activeDiploma]);

  const updateRepository = (newRepoData: Partial<RepositoryData>) => {
      if (!activeDiploma) return;
      onUpdateDiploma({
          ...activeDiploma,
          repository: {
              ...activeDiploma.repository,
              ...newRepoData
          }
      });
  };

  // --- Savoirs CRUD ---
  const handleAddSavoir = () => {
      if (!newSavoir.code || !newSavoir.label) return;
      const savoirs = [...(activeDiploma?.repository?.savoirs || []), newSavoir];
      updateRepository({ savoirs });
      setNewSavoir({ code: '', label: '' });
  };
  const handleSaveSavoir = () => {
      const savoirs = activeDiploma?.repository?.savoirs?.map(s => s.code === editingSavoirCode ? editSavoirData : s) || [];
      updateRepository({ savoirs });
      setEditingSavoirCode(null);
  };
  const handleDeleteSavoir = (code: string) => {
      confirm({
          title: "Supprimer le savoir",
          message: "Supprimer ce savoir ?",
          isDestructive: true,
          onConfirm: () => {
              const savoirs = activeDiploma?.repository?.savoirs?.filter(s => s.code !== code) || [];
              updateRepository({ savoirs });
          }
      });
  };

  // --- Activities CRUD ---
  const handleAddActivity = () => {
      if (!newActivity.code || !newActivity.label) return;
      const activities = [...(activeDiploma?.repository?.activities || []), { ...newActivity, tasks: [] } as unknown as ActivityDefWithTasks];
      updateRepository({ activities });
      setNewActivity({ code: '', label: '' });
  };
  const handleSaveActivity = () => {
      const activities = activeDiploma?.repository?.activities?.map(a => a.code === editingActivityCode ? { ...a, code: editActivityData.code as ActivityCode, label: editActivityData.label } : a) || [];
      updateRepository({ activities });
      setEditingActivityCode(null);
  };
  const handleDeleteActivity = (code: string) => {
      confirm({
          title: "Supprimer l'activité",
          message: "Supprimer cette activité et toutes ses tâches ?",
          isDestructive: true,
          onConfirm: () => {
              const activities = activeDiploma?.repository?.activities?.filter(a => a.code !== code) || [];
              updateRepository({ activities });
          }
      });
  };

  // --- Tasks CRUD ---
  const handleAddTask = (activityCode: string) => {
      if (!newTask.code || !newTask.label || newTask.activityCode !== activityCode) return;
      const activities = activeDiploma?.repository?.activities?.map(a => {
          if (a.code === activityCode) {
              return { ...a, tasks: [...a.tasks, { code: newTask.code, label: newTask.label }] };
          }
          return a;
      }) || [];
      updateRepository({ activities });
      setNewTask({ activityCode: '', code: '', label: '' });
  };
  const handleSaveTask = () => {
      if (!editingTaskCode) return;
      const activities = activeDiploma?.repository?.activities?.map(a => {
          if (a.code === editingTaskCode.activityCode) {
              return { ...a, tasks: a.tasks.map(t => t.code === editingTaskCode.taskCode ? editTaskData : t) };
          }
          return a;
      }) || [];
      updateRepository({ activities });
      setEditingTaskCode(null);
  };
  const handleDeleteTask = (activityCode: string, taskCode: string) => {
      confirm({
          title: "Supprimer la tâche",
          message: "Supprimer cette tâche ?",
          isDestructive: true,
          onConfirm: () => {
              const activities = activeDiploma?.repository?.activities?.map(a => {
                  if (a.code === activityCode) {
                      return { ...a, tasks: a.tasks.filter(t => t.code !== taskCode) };
                  }
                  return a;
              }) || [];
              updateRepository({ activities });
          }
      });
  };

  // --- Competencies CRUD ---
  const handleAddComp = () => {
      if (!newComp.code || !newComp.label) return;
      const activities = newComp.activities.split(',').map(s => s.trim() as ActivityCode).filter(Boolean);
      const competencies = [...(activeDiploma?.repository?.competencies || []), { code: newComp.code as CompetencyCode, label: newComp.label, activities, criteria: [] }];
      updateRepository({ competencies });
      setNewComp({ code: '', label: '', activities: '' });
  };
  const handleSaveComp = () => {
      const activities = editCompData.activities.split(',').map(s => s.trim() as ActivityCode).filter(Boolean);
      const competencies = activeDiploma?.repository?.competencies?.map(c => c.code === editingCompCode ? { ...c, code: editCompData.code as CompetencyCode, label: editCompData.label, activities } : c) || [];
      updateRepository({ competencies });
      setEditingCompCode(null);
  };
  const handleDeleteComp = (code: string) => {
      confirm({
          title: "Supprimer la compétence",
          message: "Supprimer cette compétence ?",
          isDestructive: true,
          onConfirm: () => {
              const competencies = activeDiploma?.repository?.competencies?.filter(c => c.code !== code) || [];
              updateRepository({ competencies });
          }
      });
  };

  // --- Exams CRUD ---
  const handleAddExam = () => {
      if (!newExam.code || !newExam.label) return;
      const exams = [...(activeDiploma?.repository?.exams || []), { ...newExam, competencies: [], isProfessional: true }];
      updateRepository({ exams });
      setNewExam({ code: '', label: '', coef: 1 });
  };
  const handleSaveExamDetails = () => {
      const exams = activeDiploma?.repository?.exams?.map(e => e.code === editingExamDetailsCode ? { ...e, code: editExamData.code, label: editExamData.label, coef: editExamData.coef } : e) || [];
      updateRepository({ exams });
      setEditingExamDetailsCode(null);
  };

  // --- Existing File Handlers ---
  const handleFileChange = (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      setAnalysisStatus('');
      
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          setRepoFile({ name: file.name, type: file.type, data: e.target.result });
        }
      };
      reader.readAsDataURL(file);
  };
  
  const handleAnalyzeAndAdd = async () => {
      if (!repoFile) return alert("Veuillez sélectionner un fichier.");
      if (!newDiplomaName.trim()) return alert("Veuillez donner un nom au diplôme.");
      
      setIsAnalyzing(true);
      setAnalysisStatus("Analyse IA en cours...");
      try {
          const result = await analyzeRepositoryDocument(repoFile);
          if (result && result.competencies.length > 0) {
              const newDiploma: Diploma = {
                  id: crypto.randomUUID(),
                  name: newDiplomaName.trim(),
                  repository: result,
              };
              onAddDiploma(newDiploma);
              setNewDiplomaName('');
              setRepoFile(null);
              setAnalysisStatus("Ajouté avec succès !");
          } else {
              throw new Error("L'analyse n'a retourné aucune donnée valide. Vérifiez que le document est un référentiel officiel et lisible.");
          }
      } catch (error) {
          console.error(error);
          const errorMessage = error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
          setAnalysisStatus("Erreur d'analyse.");
          alert(errorMessage);
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleUpdateFileChange = (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      setUpdateStatus('');
      
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          setUpdateRepoFile({ name: file.name, type: file.type, data: e.target.result });
        }
      };
      reader.readAsDataURL(file);
  };

  const handleUpdateRepository = async () => {
    if (!updateRepoFile || !activeDiploma) return;

    setIsUpdatingRepo(true);
    setUpdateStatus("Analyse IA en cours...");

    try {
        const analysisResult = await analyzeRepositoryDocument(updateRepoFile);

        if (analysisResult && analysisResult.competencies.length > 0) {
            const updatedDiploma: Diploma = {
                ...activeDiploma,
                repository: analysisResult
            };
            
            onUpdateDiploma(updatedDiploma);

            setUpdateRepoFile(null);
            setShowUpdateZone(false);
            setUpdateStatus("");
            alert("Référentiel mis à jour avec succès ! L'ancien référentiel a été entièrement remplacé.");
        } else {
            throw new Error("L'analyse n'a retourné aucune donnée valide. L'ancien référentiel est conservé. Vérifiez que le document est un référentiel officiel et lisible.");
        }
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue lors de la mise à jour.";
        setUpdateStatus("Erreur d'analyse.");
        alert(errorMessage);
    } finally {
        setIsUpdatingRepo(false);
    }
  };


  const startEditingName = (diploma: Diploma) => {
    setEditingNameId(diploma.id);
    setEditingName(diploma.name);
  };

  const cancelEditingName = () => {
    setEditingNameId(null);
    setEditingName('');
  };

  const saveEditingName = () => {
    if (!editingNameId || !editingName.trim()) return;
    const diplomaToUpdate = diplomas.find(d => d.id === editingNameId);
    if (diplomaToUpdate) {
        onUpdateDiploma({ ...diplomaToUpdate, name: editingName.trim() });
    }
    cancelEditingName();
  };
  
  const startEditExam = (exam: ExamDef) => {
      setEditingExamId(exam.code);
      setCurrentExamWeights(JSON.parse(JSON.stringify(exam.competencies)));
  };

  const cancelEditExam = () => {
      setEditingExamId(null);
      setCurrentExamWeights([]);
  };

  const handleWeightChange = (compCode: string, newWeightStr: string) => {
      const newWeight = parseFloat(newWeightStr);
      if (!isNaN(newWeight) && newWeight >= 0 && newWeight <= 100) {
          setCurrentExamWeights(prev => prev.map(c => 
              c.code === compCode ? { ...c, weight: newWeight } : c
          ));
      } else if (newWeightStr === '') {
           setCurrentExamWeights(prev => prev.map(c => 
              c.code === compCode ? { ...c, weight: 0 } : c
          ));
      }
  };

  const saveExamWeights = () => {
      if (!activeDiploma || !editingExamId) return;

      const totalWeight = currentExamWeights.reduce((sum, c) => sum + (c.weight || 0), 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
          alert(`La somme des pourcentages doit être égale à 100%. Actuellement : ${totalWeight.toFixed(2)}%`);
          return;
      }
      
      const updatedRepo = {
          ...activeDiploma.repository,
          exams: activeDiploma.repository?.exams.map(exam => 
              exam.code === editingExamId ? { ...exam, competencies: currentExamWeights } : exam
          )
      };
      
      onUpdateDiploma({ ...activeDiploma, repository: updatedRepo });
      cancelEditExam();
  };
  
    const handleDeleteExam = (examCode: string) => {
        if (!activeDiploma) return;

        confirm({
            title: "Supprimer l'épreuve",
            message: `Êtes-vous sûr de vouloir supprimer l'épreuve "${examCode}" ? Cette action est irréversible.`,
            isDestructive: true,
            onConfirm: () => {
                const updatedRepo = {
                    ...activeDiploma.repository,
                    exams: activeDiploma.repository?.exams.filter(exam => exam.code !== examCode)
                };
                
                onUpdateDiploma({ ...activeDiploma, repository: updatedRepo });
            }
        });
    };

  const totalWeight = useMemo(() => {
      return currentExamWeights.reduce((sum, c) => sum + (c.weight || 0), 0);
  }, [currentExamWeights]);


  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-8 pb-20">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BookCopy className="text-indigo-600" />
            Paramètres du Diplôme
        </h2>

        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="font-bold text-lg mb-4">Mes Diplômes</h3>
            <div className="space-y-3">
                {diplomas.map(diploma => (
                    <div key={diploma.id} className={`flex items-center p-3 rounded-lg border transition-all ${activeDiplomaId === diploma.id ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'bg-gray-50 border-gray-200'}`}>
                        {editingNameId === diploma.id ? (
                            <div className="flex-1 flex items-center gap-2">
                                <input 
                                    value={editingName} 
                                    onChange={e => setEditingName(e.target.value)}
                                    className="p-1 border border-indigo-300 rounded-md w-full"
                                    autoFocus
                                />
                                <button type="button" onClick={saveEditingName} className="p-1.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"><Check size={16}/></button>
                                <button type="button" onClick={cancelEditingName} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200"><X size={16}/></button>
                            </div>
                        ) : (
                            <>
                                <button type="button" onClick={() => onSetActiveDiploma(diploma.id)} className="flex items-center gap-3 flex-1 text-left">
                                    <BookCopy className={`${activeDiplomaId === diploma.id ? 'text-indigo-600' : 'text-gray-500'}`}/>
                                    <span className={`font-semibold ${activeDiplomaId === diploma.id ? 'text-indigo-800' : 'text-gray-800'}`}>{diploma.name}</span>
                                </button>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => startEditingName(diploma)} className="text-gray-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-100"><Pencil size={14}/></button>
                                    <button 
                                        type="button" 
                                        onClick={(e) => { e.stopPropagation(); onDeleteDiploma(diploma.id); }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-100 z-50 cursor-pointer relative"
                                    >
                                        <Trash2 size={14} className="pointer-events-none"/>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="font-bold text-lg mb-4 text-indigo-800">Ajouter un nouveau Diplôme</h3>
            <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">1. Nom du diplôme</label>
                  <input 
                    value={newDiplomaName}
                    onChange={e => setNewDiplomaName(e.target.value)}
                    placeholder="Ex: Bac Pro MELEC"
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">2. Fichier du référentiel (PDF)</label>
                    
                    {repoFile ? (
                        <div className="flex items-center justify-between bg-indigo-50 p-2 border border-indigo-200 rounded-md">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <FileText size={16} className="text-indigo-600 flex-shrink-0" />
                                <span className="text-sm text-indigo-800 truncate" title={repoFile.name}>{repoFile.name}</span>
                            </div>
                            <button type="button" onClick={() => setRepoFile(null)} className="text-red-500 hover:bg-red-100 p-1 rounded-full"><X size={14} /></button>
                        </div>
                    ) : (
                        <div className="relative w-full h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 hover:bg-gray-100 hover:border-indigo-400 transition-colors group">
                            <input 
                                type="file" 
                                accept=".pdf"
                                onChange={(e) => handleFileChange(e.target.files)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="text-center text-gray-500 pointer-events-none group-hover:text-indigo-600">
                                <FileUp size={24} className="mx-auto mb-1" />
                                <span className="text-sm font-medium">Sélectionner un fichier PDF</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end items-center gap-4">
                    {analysisStatus && <span className="text-sm font-semibold text-indigo-700">{analysisStatus}</span>}
                    <button 
                        type="button"
                        onClick={handleAnalyzeAndAdd}
                        disabled={isAnalyzing || !repoFile || !newDiplomaName}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
                    >
                        {isAnalyzing ? <Loader2 className="animate-spin" /> : <Plus />}
                        {isAnalyzing ? "Analyse..." : "Ajouter le diplôme"}
                    </button>
                </div>
            </div>
        </div>
        
        {activeDiploma && (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t border-gray-200 gap-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        Détails du référentiel : <span className="text-indigo-600">{activeDiploma.name}</span>
                    </h2>
                    <button 
                        onClick={() => setShowUpdateZone(!showUpdateZone)}
                        className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                        <RefreshCw size={16}/>
                        Mettre à jour le référentiel
                    </button>
                </div>
                
                {showUpdateZone && (
                     <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 animate-in fade-in slide-in-from-top-2">
                         <div className="flex justify-between items-start mb-4">
                             <div>
                                 <h4 className="font-bold text-orange-800 flex items-center gap-2">
                                     <Upload size={20}/> Mise à jour du fichier source
                                 </h4>
                                 <p className="text-sm text-orange-700 mt-1">
                                     Utilisez cette option si l'extraction précédente a échoué ou si vous avez une version plus récente du référentiel.
                                     <br/><strong>Attention :</strong> Cela écrasera la structure actuelle du diplôme (Compétences, Activités, Savoirs).
                                 </p>
                             </div>
                             <button onClick={() => setShowUpdateZone(false)} className="text-orange-400 hover:text-orange-600"><X size={20}/></button>
                         </div>

                         <div className="space-y-4">
                             {updateRepoFile ? (
                                <div className="flex items-center justify-between bg-white p-3 border border-orange-200 rounded-md">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <FileText size={16} className="text-orange-600 flex-shrink-0" />
                                        <span className="text-sm text-gray-700 truncate" title={updateRepoFile.name}>{updateRepoFile.name}</span>
                                    </div>
                                    <button type="button" onClick={() => setUpdateRepoFile(null)} className="text-red-500 hover:bg-red-50 p-1 rounded-full"><X size={16} /></button>
                                </div>
                            ) : (
                                <div className="relative w-full h-24 border-2 border-dashed border-orange-300 rounded-lg flex items-center justify-center bg-white hover:border-orange-500 transition-colors group cursor-pointer">
                                    <input 
                                        type="file" 
                                        accept=".pdf"
                                        onChange={(e) => handleUpdateFileChange(e.target.files)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="text-center text-gray-500 pointer-events-none group-hover:text-orange-600">
                                        <FileUp size={24} className="mx-auto mb-1" />
                                        <span className="text-sm font-medium">Glisser ou cliquer pour remplacer le PDF</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-4 items-center">
                                {updateStatus && <span className="text-sm font-bold text-orange-700">{updateStatus}</span>}
                                <button 
                                    onClick={handleUpdateRepository}
                                    disabled={!updateRepoFile || isUpdatingRepo}
                                    className="bg-orange-600 text-white px-4 py-2 rounded-md font-bold text-sm hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isUpdatingRepo && <Loader2 className="animate-spin" size={16}/>}
                                    Lancer l'analyse et mettre à jour
                                </button>
                            </div>
                         </div>
                     </div>
                )}

                <AccordionSection title="Savoirs" icon={<Book className="text-emerald-600"/>} count={activeDiploma.repository?.savoirs?.length || 0}>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                        {activeDiploma.repository?.savoirs?.map(s => (
                            <div key={s.code} className="flex items-center justify-between p-2 bg-gray-50 rounded border hover:bg-gray-100 transition-colors group">
                                {editingSavoirCode === s.code ? (
                                    <div className="flex gap-2 w-full">
                                        <input value={editSavoirData.code} onChange={e => setEditSavoirData({...editSavoirData, code: e.target.value})} className="border p-1 w-20 rounded text-sm" placeholder="Code" />
                                        <input value={editSavoirData.label} onChange={e => setEditSavoirData({...editSavoirData, label: e.target.value})} className="border p-1 flex-1 rounded text-sm" placeholder="Libellé" />
                                        <button onClick={handleSaveSavoir} className="text-emerald-600 hover:bg-emerald-100 p-1 rounded"><Check size={16}/></button>
                                        <button onClick={() => setEditingSavoirCode(null)} className="text-red-600 hover:bg-red-100 p-1 rounded"><X size={16}/></button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-sm text-gray-700"><strong className="font-semibold text-emerald-800">{s.code}:</strong> {s.label}</div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingSavoirCode(s.code); setEditSavoirData(s); }} className="text-gray-500 hover:text-indigo-600"><Pencil size={14}/></button>
                                            <button onClick={() => handleDeleteSavoir(s.code)} className="text-gray-500 hover:text-red-600"><Trash2 size={14}/></button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        <div className="flex gap-2 p-2 border-t mt-2">
                            <input placeholder="Code (ex: S08)" value={newSavoir.code} onChange={e => setNewSavoir({...newSavoir, code: e.target.value})} className="border p-1 w-24 rounded text-sm" />
                            <input placeholder="Libellé du savoir" value={newSavoir.label} onChange={e => setNewSavoir({...newSavoir, label: e.target.value})} className="border p-1 flex-1 rounded text-sm" />
                            <button onClick={handleAddSavoir} className="bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700"><Plus size={16}/></button>
                        </div>
                    </div>
                </AccordionSection>

                <AccordionSection title="Activités & Tâches" icon={<Activity className="text-blue-600"/>} count={activeDiploma.repository?.activities?.length || 0}>
                    <div className="space-y-6">
                        {activeDiploma.repository?.activities?.map(a => (
                            <div key={a.code} className="border-l-4 border-blue-200 pl-4 bg-gray-50 p-3 rounded-r-lg">
                                {editingActivityCode === a.code ? (
                                    <div className="flex gap-2 w-full mb-2">
                                        <input value={editActivityData.code} onChange={e => setEditActivityData({...editActivityData, code: e.target.value})} className="border p-1 w-20 rounded text-sm font-bold" placeholder="Code" />
                                        <input value={editActivityData.label} onChange={e => setEditActivityData({...editActivityData, label: e.target.value})} className="border p-1 flex-1 rounded text-sm font-bold" placeholder="Libellé de l'activité" />
                                        <button onClick={handleSaveActivity} className="text-emerald-600 hover:bg-emerald-100 p-1 rounded"><Check size={16}/></button>
                                        <button onClick={() => setEditingActivityCode(null)} className="text-red-600 hover:bg-red-100 p-1 rounded"><X size={16}/></button>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center mb-2 group">
                                        <h4 className="font-bold text-blue-900 text-base">{a.code}: {a.label}</h4>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingActivityCode(a.code); setEditActivityData(a); }} className="text-gray-500 hover:text-indigo-600"><Pencil size={14}/></button>
                                            <button onClick={() => handleDeleteActivity(a.code)} className="text-gray-500 hover:text-red-600"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                )}
                                
                                <ul className="list-decimal list-inside mt-2 text-sm text-gray-600 space-y-1">
                                    {a.tasks.map(t => (
                                        <li key={t.code} className="group flex justify-between items-center py-1 hover:bg-gray-100 px-2 rounded -ml-2">
                                            {editingTaskCode?.taskCode === t.code && editingTaskCode?.activityCode === a.code ? (
                                                <div className="flex gap-2 w-full ml-4">
                                                    <input value={editTaskData.code} onChange={e => setEditTaskData({...editTaskData, code: e.target.value})} className="border p-1 w-20 rounded text-xs" placeholder="Code" />
                                                    <input value={editTaskData.label} onChange={e => setEditTaskData({...editTaskData, label: e.target.value})} className="border p-1 flex-1 rounded text-xs" placeholder="Libellé de la tâche" />
                                                    <button onClick={handleSaveTask} className="text-emerald-600 hover:bg-emerald-100 p-1 rounded"><Check size={14}/></button>
                                                    <button onClick={() => setEditingTaskCode(null)} className="text-red-600 hover:bg-red-100 p-1 rounded"><X size={14}/></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span title={t.code} className="flex-1">{t.label} <span className="text-xs text-gray-400 ml-1">({t.code})</span></span>
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setEditingTaskCode({activityCode: a.code, taskCode: t.code}); setEditTaskData(t); }} className="text-gray-500 hover:text-indigo-600"><Pencil size={12}/></button>
                                                        <button onClick={() => handleDeleteTask(a.code, t.code)} className="text-gray-500 hover:text-red-600"><Trash2 size={12}/></button>
                                                    </div>
                                                </>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                <div className="flex gap-2 mt-3 ml-4">
                                    <input placeholder="Code (ex: T1.1)" value={newTask.activityCode === a.code ? newTask.code : ''} onChange={e => setNewTask({activityCode: a.code, code: e.target.value, label: newTask.label})} className="border p-1 w-24 rounded text-xs" />
                                    <input placeholder="Nouvelle tâche" value={newTask.activityCode === a.code ? newTask.label : ''} onChange={e => setNewTask({activityCode: a.code, code: newTask.code, label: e.target.value})} className="border p-1 flex-1 rounded text-xs" />
                                    <button onClick={() => handleAddTask(a.code)} className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-xs"><Plus size={14}/></button>
                                </div>
                            </div>
                        ))}
                        <div className="flex gap-2 p-3 border border-dashed border-blue-300 rounded-lg bg-blue-50">
                            <input placeholder="Code (ex: A6)" value={newActivity.code} onChange={e => setNewActivity({...newActivity, code: e.target.value})} className="border p-1 w-24 rounded text-sm" />
                            <input placeholder="Nouvelle activité" value={newActivity.label} onChange={e => setNewActivity({...newActivity, label: e.target.value})} className="border p-1 flex-1 rounded text-sm" />
                            <button onClick={handleAddActivity} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm font-bold flex items-center gap-1"><Plus size={16}/> Activité</button>
                        </div>
                    </div>
                </AccordionSection>
                
                <AccordionSection title="Compétences" icon={<Star className="text-yellow-500"/>} count={activeDiploma.repository?.competencies?.length || 0} initiallyOpen>
                     <div className="space-y-4">
                        {activeDiploma.repository?.competencies?.map(c => (
                            <div key={c.code} className="bg-gray-50 p-4 rounded-lg border border-gray-200 group relative">
                                {editingCompCode === c.code ? (
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input value={editCompData.code} onChange={e => setEditCompData({...editCompData, code: e.target.value})} className="border p-1 w-20 rounded text-sm font-bold" placeholder="Code" />
                                            <input value={editCompData.label} onChange={e => setEditCompData({...editCompData, label: e.target.value})} className="border p-1 flex-1 rounded text-sm font-bold" placeholder="Libellé de la compétence" />
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <span className="text-xs text-gray-500">Activités liées (séparées par des virgules) :</span>
                                            <input value={editCompData.activities} onChange={e => setEditCompData({...editCompData, activities: e.target.value})} className="border p-1 flex-1 rounded text-xs" placeholder="ex: A1, A2" />
                                        </div>
                                        <div className="flex justify-end gap-2 mt-2">
                                            <button onClick={() => setEditingCompCode(null)} className="text-gray-600 hover:bg-gray-200 px-2 py-1 rounded text-xs font-bold">Annuler</button>
                                            <button onClick={handleSaveComp} className="bg-emerald-600 text-white hover:bg-emerald-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Check size={14}/> Enregistrer</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingCompCode(c.code); setEditCompData({code: c.code, label: c.label, activities: c.activities.join(', ')}); }} className="p-1.5 bg-white border border-gray-200 rounded text-gray-500 hover:text-indigo-600 shadow-sm"><Pencil size={14}/></button>
                                            <button onClick={() => handleDeleteComp(c.code)} className="p-1.5 bg-white border border-gray-200 rounded text-gray-500 hover:text-red-600 shadow-sm"><Trash2 size={14}/></button>
                                        </div>
                                        <h4 className="font-bold text-yellow-900 text-sm md:text-base mb-1 pr-16">{c.code}: {c.label}</h4>
                                        <div className="text-xs text-gray-500 mb-2">
                                            <strong className="mr-1">Activités liées :</strong> 
                                            {c.activities.length > 0 ? c.activities.map(a => <span key={a} className="bg-white border border-gray-200 px-1.5 rounded mr-1">{a}</span>) : 'Aucune'}
                                        </div>
                                        {c.criteria && c.criteria.length > 0 && (
                                            <details className="mt-2 text-xs group/details">
                                                <summary className="cursor-pointer font-bold text-gray-600 hover:text-black flex items-center gap-1 select-none">
                                                    <ChevronRight size={12} className="group-open/details:rotate-90 transition-transform"/>
                                                    Critères d'évaluation ({c.criteria.length})
                                                </summary>
                                                <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-gray-600 pl-2 border-l border-gray-300">
                                                    {c.criteria.map((crit, i) => <li key={i}>{crit}</li>)}
                                                </ul>
                                            </details>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                        <div className="bg-yellow-50 p-4 rounded-lg border border-dashed border-yellow-300 space-y-2">
                            <h5 className="text-sm font-bold text-yellow-800 mb-2">Ajouter une compétence</h5>
                            <div className="flex gap-2">
                                <input placeholder="Code (ex: C14)" value={newComp.code} onChange={e => setNewComp({...newComp, code: e.target.value})} className="border p-1 w-24 rounded text-sm" />
                                <input placeholder="Libellé de la compétence" value={newComp.label} onChange={e => setNewComp({...newComp, label: e.target.value})} className="border p-1 flex-1 rounded text-sm" />
                            </div>
                            <div className="flex gap-2 items-center">
                                <span className="text-xs text-gray-600">Activités liées :</span>
                                <input placeholder="ex: A1, A3" value={newComp.activities} onChange={e => setNewComp({...newComp, activities: e.target.value})} className="border p-1 flex-1 rounded text-xs" />
                                <button onClick={handleAddComp} className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-sm font-bold flex items-center gap-1"><Plus size={16}/> Ajouter</button>
                            </div>
                        </div>
                    </div>
                </AccordionSection>
                
                <AccordionSection title="Épreuves Professionnelles" icon={<Award className="text-red-500"/>} count={professionalExams.length || 0}>
                     <div className="space-y-4">
                        {professionalExams.map(exam => (
                             <div key={exam.code} className="p-4 bg-white rounded-lg border border-red-100 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-red-400"></div>
                                
                                {editingExamDetailsCode === exam.code ? (
                                    <div className="mb-4 space-y-2 pl-2">
                                        <div className="flex gap-2">
                                            <input value={editExamData.code} onChange={e => setEditExamData({...editExamData, code: e.target.value})} className="border p-1 w-20 rounded text-sm font-bold" placeholder="Code" />
                                            <input value={editExamData.label} onChange={e => setEditExamData({...editExamData, label: e.target.value})} className="border p-1 flex-1 rounded text-sm font-bold" placeholder="Nom de l'épreuve" />
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <span className="text-xs text-gray-600 font-bold">Coefficient :</span>
                                            <input type="number" value={editExamData.coef} onChange={e => setEditExamData({...editExamData, coef: parseFloat(e.target.value) || 1})} className="border p-1 w-20 rounded text-sm text-center" />
                                            <div className="flex-1 flex justify-end gap-2">
                                                <button onClick={() => setEditingExamDetailsCode(null)} className="text-gray-600 hover:bg-gray-200 px-2 py-1 rounded text-xs font-bold">Annuler</button>
                                                <button onClick={handleSaveExamDetails} className="bg-emerald-600 text-white hover:bg-emerald-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Check size={14}/> Enregistrer</button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-start mb-2 pl-2">
                                        <div>
                                            <h4 className="font-bold text-red-900">{exam.code}: {exam.label}</h4>
                                            <span className="text-xs font-bold bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100 mt-1 inline-block">Coef {exam.coef}</span>
                                        </div>
                                        {editingExamId !== exam.code && (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => { setEditingExamDetailsCode(exam.code); setEditExamData({code: exam.code, label: exam.label, coef: exam.coef}); }} className="p-1.5 bg-white border border-gray-200 rounded text-gray-500 hover:text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><Pencil size={14}/></button>
                                                <button type="button" onClick={() => startEditExam(exam)} className="text-xs flex items-center gap-1 text-indigo-600 font-bold hover:underline bg-indigo-50 px-2 py-1 rounded">
                                                    <Pencil size={12}/> Pondérer
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteExam(exam.code); }} 
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onTouchStart={(e) => e.stopPropagation()}
                                                    className="text-xs flex items-center gap-1 text-red-600 font-bold hover:underline bg-red-50 px-2 py-1 rounded z-50 cursor-pointer relative"
                                                >
                                                    <Trash2 size={12} className="pointer-events-none"/> Supprimer
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                 {editingExamId === exam.code ? (
                                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-indigo-200">
                                        <h5 className="text-sm font-bold mb-3 text-indigo-900">Pondération des compétences</h5>
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {currentExamWeights.map(comp => {
                                                 const compDef = activeDiploma?.repository?.competencies?.find(c => c.code === comp.code);
                                                 return (
                                                    <div key={comp.code} className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-gray-200">
                                                        <label htmlFor={`weight-${comp.code}`} className="flex-1 truncate font-medium text-gray-700" title={compDef?.label}>
                                                            <span className="font-bold text-indigo-700 mr-2">{comp.code}</span>
                                                            {compDef?.label}
                                                        </label>
                                                        <div className="flex items-center gap-1">
                                                            <input 
                                                                id={`weight-${comp.code}`}
                                                                type="number"
                                                                value={comp.weight}
                                                                onChange={e => handleWeightChange(comp.code, e.target.value)}
                                                                className="w-16 p-1 border border-gray-300 rounded text-center font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            />
                                                            <span className="text-gray-500">%</span>
                                                        </div>
                                                    </div>
                                                 );
                                            })}
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                                            <span className={`font-bold text-sm ${Math.abs(totalWeight - 100) > 0.1 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                Total: {totalWeight.toFixed(2)}%
                                            </span>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={cancelEditExam} className="text-xs text-gray-600 px-3 py-1.5 rounded hover:bg-gray-200 font-bold">Annuler</button>
                                                <button type="button" onClick={saveExamWeights} className="text-xs text-white bg-indigo-600 px-3 py-1.5 rounded hover:bg-indigo-700 flex items-center gap-1 font-bold"><Save size={12}/> Enregistrer</button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2 pl-2">
                                        <p className="text-xs font-bold text-gray-500 mb-1">Compétences évaluées :</p>
                                        <div className="flex flex-wrap gap-2">
                                           {exam.competencies.map(c => (
                                               <div key={c.code} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded text-gray-700" title={activeDiploma?.repository?.competencies?.find(def => def.code === c.code)?.label}>
                                                   <span className="font-bold">{c.code}</span> <span className="text-gray-400">|</span> {c.weight.toFixed(0)}%
                                               </div>
                                           ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        
                        <div className="bg-red-50 p-4 rounded-lg border border-dashed border-red-300 space-y-2">
                            <h5 className="text-sm font-bold text-red-800 mb-2">Ajouter une épreuve</h5>
                            <div className="flex gap-2">
                                <input placeholder="Code (ex: E33)" value={newExam.code} onChange={e => setNewExam({...newExam, code: e.target.value})} className="border p-1 w-24 rounded text-sm" />
                                <input placeholder="Nom de l'épreuve" value={newExam.label} onChange={e => setNewExam({...newExam, label: e.target.value})} className="border p-1 flex-1 rounded text-sm" />
                            </div>
                            <div className="flex gap-2 items-center">
                                <span className="text-xs text-gray-600 font-bold">Coefficient :</span>
                                <input type="number" value={newExam.coef} onChange={e => setNewExam({...newExam, coef: parseFloat(e.target.value) || 1})} className="border p-1 w-20 rounded text-sm text-center" />
                                <div className="flex-1 flex justify-end">
                                    <button onClick={handleAddExam} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm font-bold flex items-center gap-1"><Plus size={16}/> Ajouter</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </AccordionSection>
            </div>
        )}
    </div>
  );
};
