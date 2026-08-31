import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Diploma, CompetencyCode, EvaluationItem, LevelCode, TpSession, SessionActivityDetail, LevelDetails, TechnicalDoc, CompetencyDef, ActivityCode, SequenceType } from '../types';
import { Save, Wand2, Loader2, ChevronRight, ChevronLeft, CheckCircle2, Printer, Download, Plus, Trash2, FileDown, ArrowLeft, Image as ImageIcon, X, FileSignature, FileStack, Paperclip, BookCopy, PenTool, Home, ListChecks, RotateCcw, ClipboardCheck, FileText, FileCheck2, ArrowRight, Eye, Pencil, Lightbulb, CheckSquare, Target, ChevronDown } from 'lucide-react';
import { generateFullSessionDesign, generateSupportImage, generateStudentResponseSheet, generateCorrectedResponseSheet, generateSimpleSessionContent } from '../services/geminiService';
import { generateTpPdf, generateStudentResponsePdf, generateCorrectedResponsePdf, generateSimpleSessionPdf } from '../services/pdfService';
import { compressImage } from '../services/imageService';
import MarkdownLatexRenderer from './MarkdownLatexRenderer';


interface Props {
  onSave: (session: TpSession) => void;
  initialSession?: TpSession | null;
  onCancel?: () => void;
  teacherName: string;
  levels: Record<LevelCode, LevelDetails>;
  establishmentLogo?: string;
  diplomas: Diploma[];
  activeDiplomaId: string | null;
  onDiplomaChange: (id: string) => void;
  // FIX: Per API Key guidelines, removed geminiApiKey prop.
}

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const SEQUENCE_TYPES: { type: SequenceType; icon: React.ReactNode }[] = [
  { type: 'Cours magistral', icon: <BookCopy size={16} /> },
  { type: 'Travaux pratiques (TP)', icon: <PenTool size={16} /> },
  { type: 'Travaux dirigés (TD)', icon: <FileSignature size={16} /> },
  { type: 'Devoir maison (DM)', icon: <Home size={16} /> },
  { type: 'QCM', icon: <ListChecks size={16} /> },
  { type: 'Synthèses', icon: <FileText size={16} /> },
  { type: 'Remédiation', icon: <RotateCcw size={16} /> },
  { type: 'Devoir sur table (DST)', icon: <ClipboardCheck size={16} /> },
];


const EvaluationForm: React.FC<Props> = ({ onSave, initialSession, onCancel, teacherName, levels, establishmentLogo, diplomas, activeDiplomaId, onDiplomaChange }) => {
  const [step, setStep] = useState<Step>(1);
  const [selectedDiplomaId, setSelectedDiplomaId] = useState<string | null>(initialSession?.diplomaId || activeDiplomaId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [isGeneratingResponseDoc, setIsGeneratingResponseDoc] = useState(false);
  const [isGeneratingCorrectedDoc, setIsGeneratingCorrectedDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inspirationInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [simpleContentView, setSimpleContentView] = useState<'edit' | 'preview'>('edit');
  
  const [tpData, setTpData] = useState<Partial<TpSession>>({
    title: '',
    sequenceType: 'Travaux pratiques (TP)',
    description: '',
    targetAudience: 'Niveau Bac Pro',
    duration: '4 heures',
    supportImage: undefined,
    technicalDocs: [],
    pedagogicalInspiration: [],
    date: new Date().toISOString().split('T')[0],
    objectives: [],
    materials: [],
    sessionActivities: [],
    evaluations: [],
    content: '',
    activities: [], // Initialize activities
  });
  
  const [suggestedCompetencies, setSuggestedCompetencies] = useState<CompetencyCode[]>([]);
  const [newObjective, setNewObjective] = useState('');
  const [newMaterial, setNewMaterial] = useState('');

  useEffect(() => {
    if (!initialSession && diplomas.length > 1) {
      setStep(0);
    } else if (!initialSession && diplomas.length === 1) {
      setSelectedDiplomaId(diplomas[0].id);
      setStep(1);
    } else if (initialSession) {
      setSelectedDiplomaId(initialSession.diplomaId);
      setTpData({ 
          ...initialSession,
          title: initialSession.title || '',
          sequenceType: initialSession.sequenceType || 'Travaux pratiques (TP)',
          description: initialSession.description || '',
          targetAudience: initialSession.targetAudience || 'Niveau Bac Pro',
          duration: initialSession.duration || '4 heures',
          supportImage: initialSession.supportImage || undefined,
          technicalDocs: initialSession.technicalDocs || [],
          pedagogicalInspiration: initialSession.pedagogicalInspiration || [],
          date: initialSession.date || new Date().toISOString().split('T')[0],
          objectives: initialSession.objectives || [],
          materials: initialSession.materials || [],
          sessionActivities: initialSession.sessionActivities || [],
          evaluations: initialSession.evaluations || [],
          content: initialSession.content || '',
          activities: initialSession.activities || [],
      });
      const comps = Array.from(new Set(initialSession.evaluations.map(e => e.competencyCode)));
      setSuggestedCompetencies(comps);
      setStep(5);
    }
  }, [initialSession, diplomas]);

  const selectedDiploma = useMemo(() => diplomas.find(d => d.id === selectedDiplomaId), [diplomas, selectedDiplomaId]);
  const diplomaCompetencies = useMemo(() => selectedDiploma?.repository.competencies || [], [selectedDiploma]);
  const diplomaActivities = useMemo(() => selectedDiploma?.repository.activities || [], [selectedDiploma]);
  const diplomaExams = useMemo(() => selectedDiploma?.repository.exams || [], [selectedDiploma]);
  const isTpMode = tpData.sequenceType === 'Travaux pratiques (TP)';
  
  useEffect(() => {
    if (!initialSession && selectedDiploma) {
        setTpData(prev => ({...prev, targetAudience: selectedDiploma.name}));
    }
  }, [initialSession, selectedDiploma]);

  
  const MAX_FILE_SIZE_MB = 10;
  const MAX_TOTAL_SIZE_MB = 15;

  const handleFiles = (files: FileList | null, target: 'technicalDocs' | 'pedagogicalInspiration') => {
    if (!files) return;
    const fileArray = Array.from(files);
    
    const currentList = tpData[target] || [];
    const currentTotalSize = currentList.reduce((sum, doc) => {
        return sum + (doc.data.length * 3 / 4);
    }, 0);
    
    let newFilesSize = 0;
    const validFiles: File[] = [];

    for (const file of fileArray) {
        if (currentList.some(doc => doc.name === file.name)) continue;

        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            alert(`Le fichier "${file.name}" est trop volumineux (${(file.size / 1024 / 1024).toFixed(1)}Mo). La taille maximale par fichier est de ${MAX_FILE_SIZE_MB}Mo.`);
            continue;
        }
        newFilesSize += file.size;
        validFiles.push(file);
    }

    if (currentTotalSize + newFilesSize > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
        alert(`L'ajout de ces fichiers dépasserait la limite totale de ${MAX_TOTAL_SIZE_MB}Mo. Veuillez retirer des documents ou en sélectionner de plus petits.`);
        return;
    }

    validFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        compressImage(file).then(compressedDataUrl => {
          setTpData(prev => ({ ...prev, [target]: [...(prev[target] || []), {
            name: file.name,
            type: 'image/jpeg', 
            data: compressedDataUrl,
          }]}));
        }).catch(err => {
          console.error("Doc image compression failed", err);
          alert(`Erreur lors du traitement de l'image ${file.name}.`);
        });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (typeof e.target?.result === 'string') {
            setTpData(prev => ({ ...prev, [target]: [...(prev[target] || []), {
              name: file.name,
              type: file.type, // This should ideally be 'application/pdf' for inspiration, but we keep it generic
              data: e.target.result as string,
            }]}));
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };
  
  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files, 'technicalDocs');
  };

  const handleInspirationUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files, 'pedagogicalInspiration');
  };
  
  const removeTechnicalDoc = (index: number) => {
    setTpData(prev => ({ ...prev, technicalDocs: (prev.technicalDocs || []).filter((_, i) => i !== index) }));
  };

  const removeInspirationDoc = (index: number) => {
    setTpData(prev => ({ ...prev, pedagogicalInspiration: (prev.pedagogicalInspiration || []).filter((_, i) => i !== index) }));
  };
  
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files, 'technicalDocs'); // Drag & drop currently only for Technical Docs
  };

  const handleActivityChange = (index: number, field: keyof SessionActivityDetail, value: string) => {
    const updatedActivities = (tpData.sessionActivities || []).map((activity, i) => 
        i === index ? { ...activity, [field]: value } : activity
    );
    setTpData(prev => ({...prev, sessionActivities: updatedActivities}));
  };

  const handleEvaluationChange = (index: number, field: keyof EvaluationItem, value: CompetencyCode | LevelCode | string) => {
      const updatedEvaluations = (tpData.evaluations || []).map((evaluation, i) => 
          i === index ? { ...evaluation, [field]: value } : evaluation
      );
      setTpData(prev => ({...prev, evaluations: updatedEvaluations}));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    let imagePastedToSupport = false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
            compressImage(blob as File).then(compressedDataUrl => {
              if (typeof compressedDataUrl === 'string') {
                if (!tpData.supportImage && !imagePastedToSupport) {
                    setTpData(prev => ({...prev, supportImage: compressedDataUrl}));
                    imagePastedToSupport = true;
                } else {
                    setTpData(prev => ({...prev, technicalDocs: [...(prev.technicalDocs || []), {
                        name: `Image collée ${new Date().toLocaleTimeString()}`,
                        type: 'image/jpeg', 
                        data: compressedDataUrl,
                    }]}));
                }
              }
            }).catch(err => {
              console.error("Pasted image compression failed", err);
              alert("Erreur lors du traitement de l'image collée.");
            });
            e.preventDefault();
        }
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      compressImage(file).then(compressedDataUrl => {
        setTpData(prev => ({...prev, supportImage: compressedDataUrl}));
      }).catch(err => {
        console.error("Image compression failed", err);
        alert("Erreur lors du traitement de l'image.");
      });
    }
  };

  const handleRepoActivityToggle = (actCode: string) => {
      setTpData(prev => {
          const currentActs = prev.activities || [];
          if (currentActs.includes(actCode as ActivityCode)) {
              return { ...prev, activities: currentActs.filter(c => c !== actCode) };
          } else {
              return { ...prev, activities: [...currentActs, actCode as ActivityCode] };
          }
      });
  };

  const handleGenerateDesign = async () => {
    if (!tpData.title) return alert("Veuillez saisir un thème.");
    if (!selectedDiploma) return alert("Aucun diplôme sélectionné.");

    setIsGenerating(true);
    let finalSupportImage = tpData.supportImage;

    try {
      if (!tpData.supportImage) {
        setGenerationStatus("Génération de l'image de support...");
        try {
          const generatedImage = await generateSupportImage(tpData.title);
          if (generatedImage) {
            finalSupportImage = generatedImage;
            setTpData(prev => ({...prev, supportImage: generatedImage}));
          }
        } catch (imageErr) {
          console.warn("Échec de la génération de l'image de support (clé gratuite ou restrictions) - Poursuite de la conception sans image.", imageErr);
        }
      }
      
      setGenerationStatus("Conception de la séance...");
      
      // Prepare selected activities labels for context
      const selectedActivitiesWithLabels = tpData.activities?.map(code => {
          const act = diplomaActivities.find(a => a.code === code);
          return act ? `${act.code}: ${act.label}` : code;
      }) || [];

      const design = await generateFullSessionDesign(
          tpData.title, 
          tpData.targetAudience || '', 
          tpData.duration || '', 
          tpData.description || '', 
          tpData.sequenceType || 'Travaux pratiques (TP)', 
          finalSupportImage || undefined, 
          tpData.technicalDocs, 
          tpData.pedagogicalInspiration, 
          selectedDiploma.repository, 
          selectedActivitiesWithLabels // Pass selected activities context
      );
      
      if (design) {
        const validCompetencyCodes = new Set(diplomaCompetencies.map(c => c.code));

        const suggestedCompsFromAI: CompetencyCode[] = [];
        if (design.competencies && Array.isArray(design.competencies)) {
            design.competencies.forEach((c: string) => {
                const cleanedCode = c.trim() as CompetencyCode;
                if (validCompetencyCodes.has(cleanedCode)) {
                    suggestedCompsFromAI.push(cleanedCode);
                }
            });
        }
        
        const evalsFromAI: EvaluationItem[] = [];
        const compsFromCriteria = new Set<CompetencyCode>();
        if (design.evaluationCriteria && Array.isArray(design.evaluationCriteria)) {
             design.evaluationCriteria.forEach((item: any) => {
                 const code = item.competencyCode as CompetencyCode;
                 if (validCompetencyCodes.has(code)) {
                     compsFromCriteria.add(code);
                     // Create a separate evaluation item for each criterion
                     evalsFromAI.push({
                         competencyCode: code,
                         level: LevelCode.NE,
                         comment: item.criterion || ''
                     });
                 }
             });
        }
        
        const allRelevantComps = Array.from(new Set([...suggestedCompsFromAI, ...Array.from(compsFromCriteria)]));
        setSuggestedCompetencies(allRelevantComps);

        // Sort the generated evaluations to match the competency order
        evalsFromAI.sort((a, b) => {
            const numA = parseInt(a.competencyCode.replace('C', ''));
            const numB = parseInt(b.competencyCode.replace('C', ''));
            if (numA !== numB) {
                return numA - numB;
            }
            return a.comment.localeCompare(b.comment);
        });

        setTpData(prev => ({
            ...prev,
            objectives: design.objectives || [],
            materials: design.materials || [],
            sessionActivities: design.activitiesBreakdown || [],
            evaluations: evalsFromAI,
        }));
        setStep(3);
      }
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "Erreur de génération IA. Veuillez vérifier votre connexion ou réessayer.";
      alert(errorMessage);
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  const handleGenerateSimpleContent = async () => {
      if (!tpData.title) return alert("Veuillez saisir un thème.");
      if (!selectedDiploma) return alert("Aucun diplôme sélectionné.");

      setIsGenerating(true);
      setGenerationStatus(`Rédaction de la séance (${tpData.sequenceType})...`);

      try {
          const content = await generateSimpleSessionContent(
              tpData.title,
              tpData.description || '',
              tpData.sequenceType || 'Cours magistral',
              tpData.targetAudience || '',
              tpData.duration || '',
              selectedDiploma.repository
          );

          if (content) {
              setTpData(prev => ({ ...prev, content }));
              setSimpleContentView('preview');
          }
      } catch (e) {
          console.error("Error generating simple content:", e);
          const errorMessage = e instanceof Error ? e.message : "Erreur de génération IA. Veuillez vérifier votre connexion ou réessayer.";
          alert(errorMessage);
      } finally {
          setIsGenerating(false);
          setGenerationStatus('');
      }
  };

  const handleGoToStep4 = () => {
      // Rebuild the evaluations list based on selected competencies, keeping existing criteria
      const finalEvals: EvaluationItem[] = [];
      const addedCriteria = new Set<string>();

      suggestedCompetencies.forEach(code => {
          const existingEvalsForComp = (tpData.evaluations || []).filter(ev => ev.competencyCode === code);
          if (existingEvalsForComp.length > 0) {
              existingEvalsForComp.forEach(ev => {
                  if (!addedCriteria.has(ev.comment)) {
                    finalEvals.push(ev);
                    addedCriteria.add(ev.comment);
                  }
              });
          } else {
              // If no criteria exist for a selected competency, add a default one
              const compDef = diplomaCompetencies.find(def => def.code === code);
              const defaultCriterion = compDef?.criteria?.[0] || `Évaluation de la compétence ${code}`;
               if (!addedCriteria.has(defaultCriterion)) {
                  finalEvals.push({ competencyCode: code, level: LevelCode.NE, comment: defaultCriterion });
                  addedCriteria.add(defaultCriterion);
               }
          }
      });

      finalEvals.sort((a, b) => parseInt(a.competencyCode.replace('C', '')) - parseInt(b.competencyCode.replace('C', '')));
      
      setTpData(prev => ({...prev, evaluations: finalEvals}));
      setStep(4);
  };

  const calculateNote = (evals: EvaluationItem[] = []) => {
    const validEvals = evals.filter(c => c.level !== LevelCode.NE);
    if (validEvals.length === 0) return 0;
    const total = validEvals.reduce((sum, item) => sum + levels[item.level].score, 0);
    return parseFloat((total / validEvals.length).toFixed(2));
  };

  const constructSessionObject = (): TpSession => {
    const finalEvaluations = tpData.evaluations || [];
    
    // Respect user selected activities, or fallback to inferred ones if empty
    let finalActivities = tpData.activities || [];
    if (finalActivities.length === 0) {
        finalActivities = Array.from(new Set(
            finalEvaluations.flatMap(sc => {
              const def = diplomaCompetencies.find(c => c.code === sc.competencyCode);
              return def ? def.activities : [];
            })
        )) as ActivityCode[];
    }

    const note = calculateNote(finalEvaluations);
    const id = initialSession ? initialSession.id : crypto.randomUUID();
    const diplomaId = selectedDiplomaId || (diplomas.length > 0 ? diplomas[0].id : 'unknown');
    const studentName = (initialSession && !initialSession.isTemplate) ? initialSession.studentName : (teacherName || "Modèle");

    return {
        id,
        diplomaId,
        title: tpData.title || '',
        sequenceType: tpData.sequenceType || 'Travaux pratiques (TP)',
        description: tpData.description || '',
        date: tpData.date || new Date().toISOString().split('T')[0],
        studentName,
        studentClass: initialSession ? initialSession.studentClass : "",
        activities: finalActivities,
        evaluations: finalEvaluations,
        globalNote: note,
        aiSummary: "",
        targetAudience: tpData.targetAudience || '',
        duration: tpData.duration || '',
        objectives: tpData.objectives || [],
        materials: tpData.materials || [],
        sessionActivities: tpData.sessionActivities || [],
        supportImage: tpData.supportImage,
        technicalDocs: [], 
        pedagogicalInspiration: [], 
        content: tpData.content,
        isTemplate: initialSession?.isTemplate ?? true
    };
  };

  const handleSave = () => {
    const newSession = constructSessionObject();
    onSave(newSession);
  };

  const handleExportPDF = (type: 'student' | 'teacher') => {
    const session = constructSessionObject();
    if (isTpMode) {
        generateTpPdf(session, type, establishmentLogo, diplomaCompetencies, diplomaActivities);
    } else {
        generateSimpleSessionPdf(session, establishmentLogo);
    }
  };

  const handleGenerateStudentResponseDoc = async () => {
    const session = constructSessionObject();
    if (!session.sessionActivities.some(a => a.studentConsignes.trim())) {
        alert("Il n'y a pas de consignes élève pour générer un document réponse.");
        return;
    }

    setIsGeneratingResponseDoc(true);
    try {
        const allConsignes = session.sessionActivities
            .map((act, index) => `Activité ${index + 1}: ${act.title}\n${act.studentConsignes}`)
            .join('\n\n---\n\n');

        const aiResponseContent = await generateStudentResponseSheet(session.title, allConsignes);

        if (aiResponseContent) {
            generateStudentResponsePdf(session, aiResponseContent, establishmentLogo, diplomaCompetencies);
        } else {
            alert("La génération du document réponse par l'IA a échoué.");
        }
    } catch (error) {
        console.error("Error generating student response document:", error);
        const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue lors de la génération du document.";
        alert(errorMessage);
    } finally {
        setIsGeneratingResponseDoc(false);
    }
  };

  const handleGenerateCorrectedResponseDoc = async () => {
    const session = constructSessionObject();
    if (!session.sessionActivities.some(a => a.studentConsignes.trim() && a.teacherCorrection.trim())) {
        alert("Il n'y a pas de consignes et de corrections pour générer un document corrigé.");
        return;
    }

    setIsGeneratingCorrectedDoc(true);
    try {
        const allConsignes = session.sessionActivities
            .map((act, index) => `Activité ${index + 1}: ${act.title}\n${act.studentConsignes}`)
            .join('\n\n---\n\n');

        const allCorrections = session.sessionActivities
            .map((act, index) => `Activité ${index + 1}: ${act.title}\n${act.teacherCorrection}`)
            .join('\n\n---\n\n');

        const aiResponseContent = await generateCorrectedResponseSheet(session.title, allConsignes, allCorrections);

        if (aiResponseContent) {
            generateCorrectedResponsePdf(session, aiResponseContent, establishmentLogo, diplomaCompetencies);
        } else {
            alert("La génération du document corrigé par l'IA a échoué.");
        }
    } catch (error) {
        console.error("Error generating corrected response document:", error);
        const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue lors de la génération du document corrigé.";
        alert(errorMessage);
    } finally {
        setIsGeneratingCorrectedDoc(false);
    }
  };

  const AutoResizeTextarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [props.value]);

    return (
        <textarea
            ref={textareaRef}
            {...props}
            onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
                if (props.onInput) props.onInput(e);
            }}
        />
    );
  };
  
  const renderStep0 = () => (
    <div className="space-y-8 animate-in fade-in">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
                 <h2 className="text-xl font-bold text-gray-800">Étape 0: Choix du Diplôme</h2>
                 {onCancel && (
                     <button onClick={onCancel} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                         <ArrowLeft size={16}/> Retour
                     </button>
                 )}
            </div>
            <p className="mb-4 text-gray-600">Pour quel référentiel souhaitez-vous créer cette séquence ?</p>
            <div className="space-y-3">
                {diplomas.map(diploma => (
                    <button 
                        key={diploma.id}
                        onClick={() => {
                            setSelectedDiplomaId(diploma.id);
                            onDiplomaChange(diploma.id);
                            setStep(1);
                        }}
                        className="w-full text-left p-4 border rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center gap-3"
                    >
                        <BookCopy className="text-indigo-500"/>
                        <span className="font-semibold text-gray-800">{diploma.name}</span>
                    </button>
                ))}
            </div>
        </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-8 animate-in fade-in">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Étape 1: Choix du Type de Séance</h2>
                {onCancel && (
                    <button onClick={() => {
                        if (!initialSession && diplomas.length > 1) setStep(0);
                        else onCancel();
                    }} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                        <ArrowLeft size={16}/> Retour
                    </button>
                )}
            </div>
            
            <div className="max-w-3xl mx-auto">
                <label className="block text-center text-xs font-bold text-gray-500 uppercase mb-4">Quel type de séance souhaitez-vous créer ?</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {SEQUENCE_TYPES.map(({ type, icon }) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => {
                                setTpData(prev => ({ 
                                    ...prev, 
                                    sequenceType: type
                                }));
                                setStep(2);
                            }}
                            className="flex flex-col items-center justify-center text-center gap-2 p-4 h-28 text-sm font-semibold rounded-lg border-2 transition-all duration-200 bg-white hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm"
                        >
                            {React.cloneElement(icon as React.ReactElement<any>, { size: 24, className: "mb-1" })}
                            <span>{type}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500" onPaste={handlePaste}>
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
                 <h2 className="text-xl font-bold text-gray-800">Étape 2: Thème de la Séance</h2>
                 <button onClick={() => setStep(1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                     <ArrowLeft size={16}/> Retour
                 </button>
            </div>
            
            <div className="mb-6 bg-indigo-50 p-3 rounded-lg border border-indigo-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-indigo-800">Type de séance :</span>
                    <span className="font-semibold text-indigo-700">{tpData.sequenceType}</span>
                </div>
                <button onClick={() => setStep(1)} className="text-xs text-indigo-600 font-bold hover:underline">Changer</button>
            </div>

            <div className="space-y-6 max-w-3xl">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Thème de la Séance (obligatoire)</label>
                    <input 
                        value={tpData.title}
                        onChange={e => setTpData(prev => ({...prev, title: e.target.value}))}
                        placeholder="ex: Mise en service d'un variateur de vitesse"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                {/* ACTIVITY SELECTION */}
                {diplomaActivities.length > 0 && (
                    <div className="border border-indigo-100 rounded-lg p-4 bg-indigo-50/30">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                            <CheckSquare size={14} className="text-indigo-600"/>
                            Activités du Référentiel concernées (Optionnel)
                        </label>
                        <p className="text-xs text-gray-500 mb-3">Sélectionnez les activités principales que l'élève réalisera. Ces activités apparaîtront sur le document final et guideront l'IA.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2">
                            {diplomaActivities.map(act => {
                                const isSelected = (tpData.activities || []).includes(act.code as ActivityCode);
                                return (
                                    <div 
                                        key={act.code}
                                        onClick={() => handleRepoActivityToggle(act.code)}
                                        className={`cursor-pointer flex items-start gap-2 p-2 rounded-md text-sm border transition-colors ${isSelected ? 'bg-indigo-100 border-indigo-300 text-indigo-900' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center bg-white ${isSelected ? 'border-indigo-500' : 'border-gray-400'}`}>
                                            {isSelected && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-sm"></div>}
                                        </div>
                                        <div className="flex-1">
                                            <span className="font-bold">{act.code} : </span>
                                            <span className="opacity-90">{act.label}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description de la Séance (Optionnel)</label>
                    <textarea
                        value={tpData.description}
                        onChange={e => setTpData(prev => ({...prev, description: e.target.value}))}
                        placeholder="Donnez plus de contexte à l'IA pour une génération plus précise (ex: type de matériel, panne à simuler, objectifs...)"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-y"
                    />
                    <p className="text-xs text-gray-400 mt-1 italic">Une bonne description aide l'IA à créer une séance plus pertinente.</p>
                </div>

                {/* Support Image */}
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center justify-between">
                      <span>Support Didactique Principal (Optionnel)</span>
                      <span className="text-[10px] normal-case font-normal text-gray-400">Image ou Capture d'écran (Ctrl+V)</span>
                   </label>
                   
                   {!tpData.supportImage ? (
                     <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 text-center transition-colors hover:bg-gray-100 hover:border-blue-400 group relative h-48 flex flex-col justify-center">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center text-gray-500 pointer-events-none">
                           <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                              <ImageIcon size={32} className="text-blue-500" />
                           </div>
                           <span className="text-lg font-medium">Uploader une image</span>
                           <span className="text-sm mt-1">ou collez (Ctrl+V) une capture directement</span>
                        </div>
                     </div>
                   ) : (
                     <div className="relative bg-gray-50 rounded-lg border border-gray-200 p-2 inline-block">
                        <img src={tpData.supportImage} alt="Support Didactique" className="max-h-48 w-auto object-contain rounded shadow-sm" />
                        <button 
                          onClick={() => setTpData(prev => ({...prev, supportImage: undefined}))}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 transition-transform hover:scale-110"
                          title="Supprimer l'image"
                        >
                          <X size={14} />
                        </button>
                     </div>
                   )}
                </div>

                {isTpMode && (
                    <>
                        {/* INSPIRATION PÉDAGOGIQUE - NEW FIELD */}
                        <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-2">
                              <Lightbulb size={16} className="text-amber-500"/>
                              Inspiration Pédagogique (Optionnel)
                           </label>
                           <div className="border-2 border-dashed border-amber-200 rounded-lg p-6 bg-amber-50 text-center transition-colors hover:bg-amber-100 hover:border-amber-400 group relative">
                               <input 
                                  type="file"
                                  multiple
                                  ref={inspirationInputRef}
                                  onChange={handleInspirationUpload}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  accept=".pdf" // Restricting to PDF for now as Gemini prefers it for inlineData docs
                               />
                               <div className="flex flex-col items-center justify-center text-gray-500 pointer-events-none">
                                   <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                       <FileText size={32} className="text-amber-500"/>
                                   </div>
                                   <span className="font-medium text-amber-900">Uploader un document d'inspiration (PDF)</span>
                                   <span className="text-sm mt-1 text-amber-800">qui servira de base pour reproduire la structure et les activités "en mieux".</span>
                               </div>
                           </div>
                           {(tpData.pedagogicalInspiration || []).length > 0 && (
                               <div className="mt-4 space-y-2">
                                   {tpData.pedagogicalInspiration?.map((doc, index) => (
                                       <div key={index} className="flex items-center justify-between bg-white p-2 border border-amber-200 rounded-md shadow-sm">
                                           <div className="flex items-center gap-2 overflow-hidden">
                                               <FileText size={16} className="text-amber-500 flex-shrink-0" />
                                               <span className="text-sm text-gray-700 truncate" title={doc.name}>{doc.name}</span>
                                           </div>
                                           <button onClick={() => removeInspirationDoc(index)} className="text-red-500 hover:bg-red-100 p-1 rounded-full">
                                               <X size={14} />
                                           </button>
                                       </div>
                                   ))}
                               </div>
                           )}
                        </div>

                        {/* DOCUMENTS TECHNIQUES */}
                        <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                              Documents Techniques (Optionnel)
                           </label>
                           <div 
                             onDragOver={handleDragOver}
                             onDragLeave={handleDragLeave}
                             onDrop={handleDrop}
                             className={`border-2 border-dashed rounded-lg p-6 bg-gray-50 text-center transition-colors group relative ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-100'}`}
                           >
                               <input 
                                  type="file"
                                  multiple
                                  ref={fileInputRef}
                                  onChange={handleDocUpload}
                                  className="hidden"
                                  accept=".pdf,.png,.jpg,.jpeg,.svg"
                               />
                               <div className="flex flex-col items-center justify-center text-gray-500 pointer-events-none">
                                   <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                       <FileStack size={32} className="text-blue-500"/>
                                   </div>
                                   <span className="font-medium">Glissez-déposez des documents ici</span>
                                   <span className="text-sm mt-1">ou <button type="button" onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:underline font-semibold pointer-events-auto">parcourez vos fichiers</button></span>
                                   <span className="text-xs mt-2 text-gray-400">(PDF, PNG, JPG, etc.)</span>
                               </div>
                           </div>
                           {(tpData.technicalDocs || []).length > 0 && (
                               <div className="mt-4 space-y-2">
                                   {tpData.technicalDocs?.map((doc, index) => (
                                       <div key={index} className="flex items-center justify-between bg-white p-2 border border-gray-200 rounded-md shadow-sm">
                                           <div className="flex items-center gap-2 overflow-hidden">
                                               <Paperclip size={16} className="text-gray-400 flex-shrink-0" />
                                               <span className="text-sm text-gray-700 truncate" title={doc.name}>{doc.name}</span>
                                           </div>
                                           <button onClick={() => removeTechnicalDoc(index)} className="text-red-500 hover:bg-red-100 p-1 rounded-full">
                                               <X size={14} />
                                           </button>
                                       </div>
                                   ))}
                               </div>
                           )}
                           <p className="text-xs text-gray-400 mt-1 italic">
                               Ces documents seront analysés par l'IA pour contextualiser la génération.
                               <br/>
                               <strong className="text-orange-600">Limite: 15Mo total. Les documents ne sont pas sauvegardés avec la séance pour éviter de saturer le stockage.</strong>
                           </p>
                        </div>
                    </>
                )}


                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Public Cible</label>
                      <input 
                          value={tpData.targetAudience}
                          readOnly
                          className="w-full p-3 bg-gray-100 border border-gray-200 rounded-md outline-none cursor-not-allowed text-gray-500"
                      />
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Durée Estimée</label>
                      <select 
                          value={tpData.duration}
                          onChange={e => setTpData(prev => ({...prev, duration: e.target.value}))}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:ring-blue-500 outline-none appearance-none"
                      >
                          <option>1 heure</option>
                          <option>2 heures</option>
                          <option>3 heures</option>
                          <option>4 heures</option>
                          <option>5 heures</option>
                          <option>6 heures</option>
                          <option>7 heures</option>
                          <option>8 heures</option>
                      </select>
                  </div>
                </div>
                
                <div className="bg-indigo-50 p-3 rounded-md border border-indigo-100 text-sm text-indigo-700">
                    <p>Auteur de la fiche : <strong>{teacherName || "Modèle"}</strong></p>
                </div>

                <div className="flex justify-end pt-4 gap-4">
                    {isTpMode ? (
                        <>
                            {(initialSession || (tpData.title && (tpData.sessionActivities || []).length > 0)) && (
                               <button 
                                  onClick={() => setStep(3)}
                                  className="px-6 py-3 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-md font-bold shadow-sm transition-colors mr-auto md:mr-0"
                               >
                                   Suivant (Sans IA)
                               </button>
                            )}

                            <button 
                                onClick={handleGenerateDesign}
                                disabled={isGenerating || !tpData.title}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 className="animate-spin"/> : <Wand2 size={18}/>}
                                {isGenerating ? (generationStatus || "Analyse & Génération...") : (initialSession ? "Régénérer avec IA" : "Générer & Continuer")}
                            </button>
                        </>
                    ) : (
                        // NON-TP MODE SHORTCUT
                        <button 
                            onClick={() => setStep(3)}
                            disabled={!tpData.title}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            Suivant <ArrowRight size={18}/>
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
  );

  // TP Mode Step 3
  const renderStep3 = () => {
      if (!isTpMode) {
          // --- NON-TP MODE (Simple Content Editor) ---
          return (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                  <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-gray-800">Étape 3: Contenu de la Séance ({tpData.sequenceType})</h2>
                      {isGenerating && <span className="text-indigo-600 font-bold animate-pulse flex items-center gap-2"><Loader2 className="animate-spin"/> {generationStatus}</span>}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                      <div className="p-4 border-b border-gray-200">
                          <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                                    <button onClick={() => setSimpleContentView('edit')} className={`px-3 py-1.5 text-sm font-bold flex items-center gap-2 rounded-md transition-colors ${simpleContentView === 'edit' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}>
                                        <Pencil size={16}/> Éditeur
                                    </button>
                                    <button onClick={() => setSimpleContentView('preview')} className={`px-3 py-1.5 text-sm font-bold flex items-center gap-2 rounded-md transition-colors ${simpleContentView === 'preview' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}>
                                        <Eye size={16}/> Aperçu
                                    </button>
                                </div>
                                <button 
                                    onClick={handleGenerateSimpleContent}
                                    disabled={isGenerating}
                                    className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    <Wand2 size={16}/> Générer avec SéanceGPT
                                </button>
                          </div>
                          <p className="text-xs text-gray-500">
                              Le contenu est au format Markdown. Utilisez la syntaxe LaTeX pour les formules (ex: `$E=mc^2$` ou `$$...$$`).
                          </p>
                      </div>

                      <div className="p-4 min-h-[500px]">
                          {simpleContentView === 'edit' ? (
                            <textarea 
                                value={tpData.content}
                                onChange={e => setTpData(prev => ({...prev, content: e.target.value}))}
                                className="w-full h-full min-h-[500px] p-2 border-0 rounded-lg font-mono text-sm focus:ring-0 outline-none resize-none"
                                placeholder="# Titre de la séance..."
                            />
                          ) : (
                            <div className="prose prose-indigo max-w-none p-2">
                                <MarkdownLatexRenderer content={tpData.content || 'Aucun contenu à prévisualiser.'} />
                            </div>
                          )}
                      </div>
                  </div>

                  <div className="flex justify-between pt-4">
                     <button 
                        onClick={() => setStep(2)}
                        className="px-6 py-2 bg-gray-500 text-white rounded-md font-bold hover:bg-gray-600"
                     >
                         Précédent
                     </button>
                     <button 
                        onClick={() => setStep(5)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700"
                     >
                         Validation & Export
                     </button>
                  </div>
              </div>
          );
      }

      return (
      <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
          <h2 className="text-xl font-bold text-gray-800">Étape 3: Contenu de la Séance {isGenerating ? "(Génération...)" : ""}</h2>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 text-lg">Objectifs de la Séance</h3>
              <ul className="divide-y divide-gray-100 mb-4">
                  {(tpData.objectives || []).map((obj, i) => (
                      <li key={i} className="py-2 flex items-center gap-2">
                          <input 
                            value={obj}
                            onChange={(e) => {
                                const newObjs = [...(tpData.objectives || [])];
                                newObjs[i] = e.target.value;
                                setTpData(prev => ({...prev, objectives: newObjs}));
                            }}
                            className="w-full p-1 border-transparent hover:border-gray-200 rounded text-sm focus:border-blue-500 outline-none bg-transparent"
                          />
                          <button onClick={() => setTpData(prev => ({...prev, objectives: (prev.objectives || []).filter((_, idx) => idx !== i)}))} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                      </li>
                  ))}
                  <li className="py-2 flex items-center gap-2">
                        <input 
                            value={newObjective}
                            onChange={(e) => setNewObjective(e.target.value)}
                            onKeyDown={(e) => {
                                if(e.key === 'Enter' && newObjective.trim()) {
                                    setTpData(prev => ({...prev, objectives: [...(prev.objectives || []), newObjective]}));
                                    setNewObjective('');
                                }
                            }}
                            placeholder="Ajouter un objectif..."
                            className="w-full p-1 border border-gray-200 rounded text-sm outline-none focus:border-blue-500"
                        />
                        <button 
                            onClick={() => {
                                if(newObjective.trim()) {
                                    setTpData(prev => ({...prev, objectives: [...(prev.objectives || []), newObjective]}));
                                    setNewObjective('');
                                }
                            }}
                            className="text-blue-500"
                        >
                            <Plus size={16}/>
                        </button>
                  </li>
              </ul>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 text-lg">Compétences Développées</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  {diplomaCompetencies.map(c => {
                      const isSelected = suggestedCompetencies.includes(c.code);
                      return (
                          <label key={c.code} className="flex items-start gap-3 cursor-pointer group">
                              <div className="pt-0.5">
                                <input 
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                        if (isSelected) setSuggestedCompetencies(prev => prev.filter(code => code !== c.code));
                                        else setSuggestedCompetencies(prev => [...prev, c.code]);
                                    }}
                                    className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                              </div>
                              <span className="text-sm text-gray-600 group-hover:text-gray-900">
                                <strong className="text-blue-700 font-bold mr-1">{c.code}:</strong> {c.label}
                              </span>
                          </label>
                      );
                  })}
              </div>
          </div>

          <div className="space-y-6">
              <h3 className="font-bold text-gray-800 text-lg">Déroulement de la Séance</h3>
              {(tpData.sessionActivities || []).map((act, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="grid grid-cols-4 gap-4 mb-4">
                          <div className="col-span-3">
                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-wider flex justify-between items-center">
                                  <span>TITRE DE L'ACTIVITÉ</span>
                              </label>
                              <input 
                                value={act.title} 
                                onChange={e => handleActivityChange(idx, 'title', e.target.value)}
                                className="w-full font-bold text-lg text-gray-900 p-2 border border-gray-200 rounded outline-none focus:border-blue-500"
                              />
                          </div>
                          <div className="col-span-1">
                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-wider">DURÉE</label>
                              <input 
                                value={act.duration} 
                                onChange={e => handleActivityChange(idx, 'duration', e.target.value)}
                                className="w-full text-gray-600 p-2 border border-gray-200 rounded outline-none focus:border-blue-500"
                              />
                          </div>
                      </div>

                      {(() => {
                        const suggestedCompCodes = new Set(suggestedCompetencies);
                        
                        const linkedCompetencies = diplomaCompetencies.filter(c => {
                            const hasLinkToActivity = c.activities.some(activityCode => {
                                const activityDef = diplomaActivities.find(a => a.code === activityCode);
                                return activityDef && act.title.toLowerCase().includes(activityDef.label.toLowerCase());
                            });
                            return hasLinkToActivity && suggestedCompCodes.has(c.code);
                        });

                        if (linkedCompetencies.length === 0) return null;

                        return (
                            <div className="my-4 space-y-3 bg-blue-50/50 p-4 rounded-lg border border-blue-200">
                                {linkedCompetencies.map(comp => {
                                    const specificEvals = (tpData.evaluations || []).filter(e => e.competencyCode === comp.code);
                                    if (specificEvals.length === 0) return null;

                                    return (
                                        <div key={comp.code} className="flex gap-3">
                                            <span className="font-bold text-blue-800 bg-white px-2 py-1 rounded border border-blue-200 shadow-sm self-start mt-1 text-sm">
                                                {comp.code}
                                            </span>
                                            <div className="flex-1">
                                                <p className="font-semibold text-blue-900 text-sm">{comp.label}</p>
                                                <div className="mt-2 space-y-2">
                                                    {specificEvals.map((evaluation, evalIdx) => (
                                                        <div key={evalIdx} className="bg-white p-2 rounded border border-gray-200 text-sm text-slate-700 italic shadow-sm">
                                                            {evaluation.comment}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                      })()}

                      <div className="mb-4">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-wider">MISE EN SITUATION / CONTEXTE</label>
                          <textarea 
                            value={act.description}
                            onChange={e => handleActivityChange(idx, 'description', e.target.value)}
                            className="w-full text-sm text-gray-700 p-3 border border-gray-200 rounded h-24 resize-none focus:border-blue-500 outline-none"
                          />
                      </div>

                      {act.diagramImage && (
                          <div className="mb-4">
                              <label className="block text-[10px] font-bold text-indigo-600 uppercase mb-1 tracking-wider">MÉDIA GÉNÉRÉ (NANO BANANA)</label>
                              <div className="bg-indigo-50 border border-indigo-100 p-2 rounded inline-block">
                                  <img src={act.diagramImage} alt="Schéma électrique" className="max-h-48 contain rounded" />
                              </div>
                          </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1 tracking-wider">DOCUMENT ÉLÈVE (CONSIGNES)</label>
                              <textarea 
                                value={act.studentConsignes}
                                onChange={e => handleActivityChange(idx, 'studentConsignes', e.target.value)}
                                className="w-full text-sm text-gray-700 p-3 border-l-4 border-blue-200 bg-white rounded h-40 resize-none focus:border-blue-500 outline-none shadow-sm"
                              />
                          </div>
                          <div>
                              <label className="block text-[10px] font-bold text-green-600 uppercase mb-1 tracking-wider">DOCUMENT PROFESSEUR (CORRECTION)</label>
                              <textarea 
                                value={act.teacherCorrection}
                                onChange={e => handleActivityChange(idx, 'teacherCorrection', e.target.value)}
                                className="w-full text-sm text-gray-700 p-3 border-l-4 border-green-200 bg-white rounded h-40 resize-none focus:border-green-500 outline-none shadow-sm"
                              />
                          </div>
                      </div>
                      
                       <div className="flex justify-end mt-2">
                           <button onClick={() => setTpData(prev => ({...prev, sessionActivities: (prev.sessionActivities || []).filter((_, i) => i !== idx)}))} className="text-xs text-red-400 hover:text-red-600 hover:underline">
                               Retirer l'activité
                           </button>
                       </div>
                  </div>
              ))}
               <div className="flex justify-center">
                  <button 
                    onClick={() => setTpData(prev => ({...prev, sessionActivities: [...(prev.sessionActivities || []), {title: 'Nouvelle activité', duration: '30 min', description: '', studentConsignes: '', teacherCorrection: ''}]}))}
                    className="flex items-center gap-2 text-blue-600 font-bold bg-blue-50 px-4 py-2 rounded hover:bg-blue-100"
                  >
                      <Plus size={16}/> Ajouter une activité manuellement
                  </button>
              </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <h3 className="font-bold text-gray-800 mb-4 text-lg">Matériel Pédagogique Général</h3>
               <div className="flex flex-wrap gap-2">
                  {(tpData.materials || []).map((mat, i) => (
                      <span key={i} className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm border border-gray-200 flex items-center gap-2">
                          {mat}
                          <button onClick={() => setTpData(prev => ({...prev, materials: (prev.materials || []).filter((_, idx) => idx !== i)}))} className="hover:text-red-600"><Trash2 size={12}/></button>
                      </span>
                  ))}
                  <div className="flex items-center gap-2">
                      <input 
                         value={newMaterial}
                         onChange={e => setNewMaterial(e.target.value)}
                         placeholder="Ajouter matériel..."
                         className="text-sm border border-gray-300 rounded px-2 py-1 w-40 outline-none focus:border-blue-500"
                         onKeyDown={e => { if(e.key === 'Enter' && newMaterial) { setTpData(prev => ({...prev, materials: [...(prev.materials || []), newMaterial]})); setNewMaterial(''); }}}
                      />
                      <button onClick={() => { if(newMaterial) { setTpData(prev => ({...prev, materials: [...(prev.materials || []), newMaterial]})); setNewMaterial(''); }}}><Plus size={16} className="text-blue-600"/></button>
                   </div>
               </div>
          </div>

          <div className="flex justify-between pt-4">
             <button 
                onClick={() => setStep(2)}
                className="px-6 py-2 bg-gray-500 text-white rounded-md font-bold hover:bg-gray-600"
             >
                 Précédent
             </button>
             <button 
                onClick={handleGoToStep4}
                className="px-6 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700"
             >
                 Générer Fiche d'Évaluation
             </button>
          </div>
      </div>
  )};

  const renderStep4 = () => (
      <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
          <h2 className="text-2xl font-bold text-gray-800">Grille d'Évaluation</h2>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center p-4 border-b border-gray-200 bg-gray-50/70 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <div style={{ flex: '1 1 0%' }}>Critères d'évaluation</div>
                  <div style={{ width: '8rem' }} className="text-center">Comp.</div>
                  <div style={{ width: '14rem' }} className="flex justify-around items-center">
                      {[LevelCode.NA, LevelCode.IA, LevelCode.PA, LevelCode.TA, LevelCode.NE].map(lvl => (
                          <div key={lvl} className="flex flex-col items-center gap-1 w-8">
                              <span>{lvl}</span>
                              <div className={`h-1 w-full rounded-full ${lvl !== LevelCode.NE ? levels[lvl].bgColor.replace('bg-', 'bg-') : 'bg-gray-300'}`}></div>
                          </div>
                      ))}
                  </div>
              </div>
              
              <div className="divide-y divide-gray-100">
                {(tpData.evaluations || []).map((item, index) => (
                    <div key={index} className="flex items-center p-3 hover:bg-gray-50/50 transition-colors">
                        <div style={{ flex: '1 1 0%' }} className="pr-4 py-1">
                            <AutoResizeTextarea
                                value={item.comment}
                                onChange={(e) => handleEvaluationChange(index, 'comment', e.target.value)}
                                className="w-full text-sm text-gray-800 bg-transparent border-0 rounded-md focus:ring-1 focus:bg-white focus:ring-indigo-300 outline-none resize-none p-2"
                                placeholder="Saisir un critère d'évaluation..."
                            />
                        </div>
                        <div style={{ width: '8rem' }} className="flex justify-center">
                            <div className="relative">
                                <select
                                    value={item.competencyCode}
                                    onChange={e => handleEvaluationChange(index, 'competencyCode', e.target.value as CompetencyCode)}
                                    className="font-bold text-sm text-gray-700 bg-transparent border-gray-300 focus:ring-indigo-300 outline-none p-1 rounded-md appearance-none text-center pr-6 cursor-pointer"
                                >
                                    {diplomaCompetencies.map(c => (
                                        <option key={c.code} value={c.code}>{c.code}</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500"/>
                            </div>
                        </div>
                        <div style={{ width: '14rem' }} className="flex justify-around">
                            {[LevelCode.NA, LevelCode.IA, LevelCode.PA, LevelCode.TA, LevelCode.NE].map((lvl) => {
                                const isActive = item.level === lvl;
                                return (
                                    <button
                                        key={lvl}
                                        onClick={() => handleEvaluationChange(index, 'level', lvl)}
                                        className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                                            isActive ? 'border-slate-700 border-2' : 'border-gray-300 hover:border-slate-500'
                                        }`}
                                        title={`${lvl}: ${levels[lvl].label}`}
                                    >
                                        {isActive && <div className="w-2.5 h-2.5 bg-slate-700 rounded-full"></div>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
              </div>
              
              <div className="p-4 bg-gray-50 flex justify-center border-t border-gray-100">
                 <button 
                    onClick={() => {
                        const firstCompetency = diplomaCompetencies.length > 0 ? diplomaCompetencies[0].code : CompetencyCode.C1;
                        setTpData(prev => ({...prev, evaluations: [...(prev.evaluations || []), { competencyCode: firstCompetency, level: LevelCode.NE, comment: '' }]}))
                    }}
                    className="text-blue-600 text-sm font-bold flex items-center gap-2 hover:underline"
                 >
                    <Plus size={16}/> Ajouter un critère
                 </button>
              </div>
          </div>

          <div className="flex justify-between pt-4">
             <button 
                onClick={() => setStep(3)}
                className="px-6 py-3 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-md font-bold shadow-sm transition-colors flex items-center gap-2"
             >
                 <ArrowLeft size={16}/>
                 Retour
             </button>
             <button 
                onClick={() => setStep(5)}
                className="px-6 py-3 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
             >
                 Révision & Export <ArrowRight size={16}/>
             </button>
          </div>
      </div>
  );

  const renderStep5 = () => {
      const renderLevels = [LevelCode.NA, LevelCode.IA, LevelCode.PA, LevelCode.TA, LevelCode.NE];
      
      return (
      <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500 pb-32">
           
           <div id="printable-content" className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 print-container">
                <div className="border-b-2 border-gray-800 pb-6 mb-6">
                    <div className="flex justify-between items-start gap-6">
                        <div className="flex items-start gap-6 flex-1">
                            {establishmentLogo && (
                                <img src={establishmentLogo} alt="Logo de l'établissement" className="h-20 w-auto object-contain" />
                            )}
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={tpData.title}
                                    onChange={(e) => setTpData(prev => ({...prev, title: e.target.value}))}
                                    className="text-3xl font-bold text-gray-900 mb-2 w-full border-b-2 border-transparent focus:border-indigo-500 hover:border-gray-200 outline-none bg-transparent transition-colors p-1"
                                    placeholder="Titre du TP"
                                />
                                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                    <div className="bg-gray-100 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                                      <span>Public:</span>
                                      <input type="text" value={tpData.targetAudience} onChange={e => setTpData(prev => ({...prev, targetAudience: e.target.value}))} className="bg-transparent outline-none w-24 p-0" />
                                    </div>
                                    <div className="bg-gray-100 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                                      <span>Durée:</span>
                                      <select value={tpData.duration} onChange={e => setTpData(prev => ({...prev, duration: e.target.value}))} className="bg-transparent outline-none appearance-none p-0">
                                          <option>1 heure</option><option>2 heures</option><option>3 heures</option><option>4 heures</option>
                                      </select>
                                    </div>
                                    <div className="bg-gray-100 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                                      <span>Date:</span>
                                      <input type="date" value={tpData.date} onChange={e => setTpData(prev => ({...prev, date: e.target.value}))} className="bg-transparent outline-none p-0" />
                                    </div>
                                    <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-medium">Auteur: {initialSession?.studentName || teacherName || "Modèle"}</span>
                                </div>
                            </div>
                        </div>
                       {tpData.supportImage && (
                         <img src={tpData.supportImage} alt="Support Didactique" className="h-40 w-auto object-contain rounded border border-gray-200 hidden print:block md:block" />
                       )}
                    </div>
                </div>

                {/* --- CONTENT SECTION --- */}
                {isTpMode ? (
                    // TP MODE: Standard complex breakdown
                    <div className="space-y-8">
                        {(tpData.sessionActivities || []).map((act, idx) => (
                            <div key={idx} className="break-inside-avoid">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2 flex-1">
                                       <span className="text-xl font-bold text-gray-800">Activité {idx + 1}:</span>
                                       <input value={act.title} onChange={e => handleActivityChange(idx, 'title', e.target.value)} className="text-xl font-bold text-gray-800 w-full bg-transparent border-b-2 border-transparent focus:border-gray-300 outline-none p-1" />
                                    </div>
                                    <input value={act.duration} onChange={e => handleActivityChange(idx, 'duration', e.target.value)} className="text-sm font-normal bg-gray-100 px-2 py-1 rounded w-24 text-center border border-transparent focus:border-gray-300 outline-none" />
                                </div>
                                <AutoResizeTextarea
                                  value={act.description}
                                  onChange={e => handleActivityChange(idx, 'description', e.target.value)}
                                  className="w-full text-gray-600 italic mb-4 bg-gray-50 p-3 rounded border-l-4 border-gray-300 outline-none resize-none overflow-hidden focus:bg-white focus:border-indigo-400"
                                  placeholder="Description / Mise en situation..."
                                />

                                {act.diagramImage && (
                                    <div className="mb-4 flex justify-center break-inside-avoid print:my-4">
                                        <div className="border hover:border-indigo-300 transition-colors p-1 rounded-lg">
                                            <img src={act.diagramImage} alt="Schéma de l'activité" className="max-h-64 object-contain rounded" />
                                        </div>
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:block">
                                    <div className="mb-4 print:mb-4">
                                        <h4 className="font-bold text-blue-600 text-sm uppercase mb-1">Consignes Élève</h4>
                                        <AutoResizeTextarea 
                                          value={act.studentConsignes} 
                                          onChange={e => handleActivityChange(idx, 'studentConsignes', e.target.value)} 
                                          className="w-full text-sm text-gray-800 whitespace-pre-wrap bg-blue-50 p-3 rounded border-blue-100 outline-none resize-none overflow-hidden focus:bg-white focus:border-blue-400"
                                          placeholder="Consignes pour l'élève..."
                                        />
                                    </div>
                                    <div className="mb-4 print:mb-4">
                                        <h4 className="font-bold text-green-600 text-sm uppercase mb-1">Correction Professeur</h4>
                                        <AutoResizeTextarea
                                           value={act.teacherCorrection}
                                           onChange={e => handleActivityChange(idx, 'teacherCorrection', e.target.value)} 
                                           className="w-full text-sm text-gray-800 whitespace-pre-wrap bg-green-50 p-3 rounded border-green-100 outline-none resize-none overflow-hidden focus:bg-white focus:border-green-400"
                                           placeholder="Correction pour le professeur..."
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    // SIMPLE MODE: Markdown Content
                    <div className="space-y-6">
                        <div className="prose prose-indigo max-w-none">
                            <MarkdownLatexRenderer content={tpData.content || ''} />
                        </div>
                    </div>
                )}

                {/* Evaluation Grid (Optional for non-TP but good to have) */}
                {tpData.evaluations && tpData.evaluations.length > 0 && (
                    <div className="mt-10 page-break">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-2">Grille d'Évaluation</h2>
                        
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-300 text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="pb-2 pl-2 w-3/5 align-bottom">Critères d'évaluation</th>
                                    <th className="pb-2 text-center w-24 align-bottom">Comp.</th>
                                    {renderLevels.map(l => (
                                        <th key={l} className="pb-2 text-center w-12 font-semibold">
                                           <div className="flex flex-col items-center gap-1">
                                               <span>{l}</span>
                                               <div className={`h-1 w-full rounded-full ${levels[l].bgColor}`}></div>
                                           </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {(tpData.evaluations || []).map((ev, i) => (
                                    <tr key={i} className="group hover:bg-gray-50">
                                        <td className="py-2 pl-2 pr-4 align-middle">
                                            <AutoResizeTextarea 
                                               value={ev.comment}
                                               onChange={e => handleEvaluationChange(i, 'comment', e.target.value)}
                                               className="w-full text-gray-800 text-sm border border-transparent rounded bg-transparent p-2 resize-none overflow-hidden focus:bg-white focus:border-gray-200 outline-none"
                                               placeholder="Nouveau critère..."
                                            />
                                        </td>
                                        <td className="py-4 align-middle text-center border-r border-l border-gray-100 bg-gray-50/50">
                                            {/* FIX: c.code is a string property, not a function. Changed value from c.code() to c.code inside the select options. */}
                                            <select
                                                value={ev.competencyCode}
                                                onChange={e => handleEvaluationChange(i, 'competencyCode', e.target.value as CompetencyCode)}
                                                className="font-bold text-gray-600 bg-transparent border-0 focus:ring-0 outline-none p-1 rounded hover:bg-white"
                                            >
                                                {diplomaCompetencies.map(c => (
                                                    <option key={c.code} value={c.code}>{c.code}</option>
                                                ))}
                                            </select>
                                        </td>
                                        {renderLevels.map(lvl => {
                                             const isActive = ev.level === lvl;
                                             const colorClass = isActive 
                                                ? levels[lvl].color 
                                                : 'bg-white border-gray-200 hover:border-gray-300';
                                             const dotClass = isActive ? 'bg-white' : '';

                                             return (
                                                <td key={lvl} className="py-4 text-center align-middle border-r border-gray-50 last:border-0">
                                                     <button 
                                                        onClick={() => handleEvaluationChange(i, 'level', lvl)}
                                                        className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition-all hover:scale-110 ${colorClass}`}
                                                        title={`${lvl}: ${levels[lvl].label}`}
                                                    >
                                                        {isActive && <div className={`w-2 h-2 rounded-full shadow-sm ${dotClass}`} />}
                                                    </button>
                                                </td>
                                             );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
           </div>
           
           <div className="fixed-bottom-bar fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-50 flex flex-col xl:flex-row justify-between items-center gap-4 no-print px-4 md:px-8">
                
                <div className="flex items-center gap-4 w-full xl:w-auto justify-between xl:justify-start">
                    {onCancel && (
                         <button onClick={onCancel} className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-900 font-bold text-sm rounded hover:bg-gray-100 transition-colors">
                             <ArrowLeft size={18} /> <span className="hidden md:inline">Retour</span>
                         </button>
                    )}
                    
                    <div className="flex bg-gray-100 rounded-lg p-1">
                         <button onClick={() => setStep(2)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-md transition-all" title="Modifier le thème et infos">
                            Infos
                         </button>
                         <button onClick={() => setStep(3)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-md transition-all" title="Modifier le contenu et activités">
                            Contenu
                         </button>
                         {/* Only show Grid step button if useful or exists */}
                         {(isTpMode || (tpData.evaluations && tpData.evaluations.length > 0)) && (
                             <button onClick={() => setStep(4)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-md transition-all" title="Modifier la grille d'évaluation">
                                Grille
                             </button>
                         )}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center w-full xl:w-auto">
                    <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded shadow-md flex items-center gap-2 transition-transform hover:scale-105 text-sm">
                        <Save size={18} /> {initialSession ? 'Mettre à jour' : 'Sauvegarder'}
                    </button>
                    
                    <button onClick={() => window.print()} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded shadow-md flex items-center gap-2 transition-transform hover:scale-105 text-sm hidden md:flex">
                        <Printer size={18} /> Imprimer
                    </button>

                    <div className="h-8 w-px bg-gray-300 mx-2 hidden md:block"></div>
                    
                    <button onClick={() => handleExportPDF('teacher')} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow-md flex items-center gap-2 transition-transform hover:scale-105 text-sm">
                        <FileDown size={18} /> <span className="hidden md:inline">Prof</span>
                    </button>

                    {isTpMode && (
                        <>
                            <button onClick={() => handleExportPDF('student')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-md flex items-center gap-2 transition-transform hover:scale-105 text-sm">
                                <FileDown size={18} /> <span className="hidden md:inline">Élève</span>
                            </button>
                            
                            <button 
                                onClick={handleGenerateStudentResponseDoc}
                                disabled={isGeneratingResponseDoc}
                                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded shadow-md flex items-center gap-2 transition-transform hover:scale-105 text-sm disabled:opacity-50"
                            >
                                {isGeneratingResponseDoc ? <Loader2 className="animate-spin" size={18} /> : <FileSignature size={18} />}
                                <span className="hidden md:inline">{isGeneratingResponseDoc ? 'Génération...' : 'Doc Réponse'}</span>
                            </button>

                             <button 
                                onClick={handleGenerateCorrectedResponseDoc}
                                disabled={isGeneratingCorrectedDoc}
                                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded shadow-md flex items-center gap-2 transition-transform hover:scale-105 text-sm disabled:opacity-50"
                            >
                                {isGeneratingCorrectedDoc ? <Loader2 className="animate-spin" size={18} /> : <FileCheck2 size={18} />}
                                <span className="hidden md:inline">{isGeneratingCorrectedDoc ? 'Génération...' : 'Doc Corrigé'}</span>
                            </button>
                        </>
                    )}
                </div>
           </div>
      </div>
  )};

  return (
    <div className="max-w-5xl mx-auto pb-12">
        <div className="min-h-[400px]">
            {step === 0 && renderStep0()}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
        </div>
    </div>
  );
};

export default EvaluationForm;