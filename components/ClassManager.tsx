
import React, { useState, useRef, useMemo } from 'react';
import { StudentClass, Student, TpSession, Diploma } from '../types';
import { Users, Upload, Plus, Trash2, UserPlus, Pencil, Check, X, AlertCircle, KeyRound, Copy, RefreshCw, User as UserIcon, Calendar, Mail, Home, Phone, Filter, Camera, ArrowRight } from 'lucide-react';
import { compressImage } from '../services/imageService';
import { useConfirm } from './ConfirmContext';

interface Props {
  classes: StudentClass[];
  onUpdateClasses: (classes: StudentClass[]) => void;
  sessions: TpSession[];
  onUpdateSessions: (sessions: TpSession[]) => void;
  diplomas: Diploma[];
  onDeleteClass: (classId: string) => void;
  onDeleteStudent: (classId: string, studentId: string) => void;
  onOpenStudentDossier?: (student: Student, studentClass: StudentClass) => void;
}

const ClassManager: React.FC<Props> = ({ classes, onUpdateClasses, sessions, onUpdateSessions, diplomas, onDeleteClass, onDeleteStudent, onOpenStudentDossier }) => {
  // State for new class creation
  const [newClassName, setNewClassName] = useState('');
  const [newClassDiplomaId, setNewClassDiplomaId] = useState<string>(diplomas.length > 0 ? diplomas[0].id : '');
  const [csvContent, setCsvContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDiplomaFilter, setSelectedDiplomaFilter] = useState<string>('all');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingClassName, setEditingClassName] = useState<string>('');

  // State for student profile modal
  const [modalState, setModalState] = useState<{ isOpen: boolean; student: Partial<Student> | null; classId: string | null }>({ isOpen: false, student: null, classId: null });

  // --- Password Generation ---
  const generatePassword = () => Math.floor(1000 + Math.random() * 9000).toString();

  // --- Filtering ---
  const filteredClasses = useMemo(() => {
      if (selectedDiplomaFilter === 'all') return classes;
      return classes.filter(c => c.diplomaId === selectedDiplomaFilter);
  }, [classes, selectedDiplomaFilter]);

  // --- Class Management ---

  const handleSaveClassName = (classId: string) => {
    if (editingClassName.trim()) {
      onUpdateClasses(classes.map(c => c.id === classId ? { ...c, name: editingClassName.trim() } : c));
    }
    setEditingClassId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      if (lines.length === 0) return;

      const firstLine = lines[0];
      const separator = firstLine.includes(';') ? ';' : ',';
      const headers = firstLine.split(separator).map(h => h.trim().toLowerCase());
      
      const lastNameIdx = headers.findIndex(h => h.includes('nom'));
      const firstNameIdx = headers.findIndex(h => h.includes('prénom') || h.includes('prenom'));
      const emailIdx = headers.findIndex(h => h.includes('mail') || h.includes('e-mail') || h.includes('email'));

      let startIdx = 1;
      let lIdx = lastNameIdx;
      let fIdx = firstNameIdx;
      let eIdx = emailIdx;

      if (lIdx === -1) {
        // Fallback: assume no header, col 0 = Nom, col 1 = Prénom
        lIdx = 0;
        fIdx = 1;
        startIdx = 0;
      }

      const extractedStudents: string[] = [];

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(separator);
        const lastName = parts[lIdx]?.replace(/^"|"$/g, '').trim() || '';
        const firstName = fIdx !== -1 ? parts[fIdx]?.replace(/^"|"$/g, '').trim() || '' : '';
        const email = eIdx !== -1 ? parts[eIdx]?.replace(/^"|"$/g, '').trim() || '' : '';

        if (lastName) {
            let studentLine = `${lastName}, ${firstName}`;
            if (email) {
                studentLine += `, ${email}`;
            }
            extractedStudents.push(studentLine);
        }
      }

      setCsvContent(prev => {
          const newContent = extractedStudents.join('\n');
          return prev ? prev + '\n' + newContent : newContent;
      });
      
      e.target.value = '';
    };
    reader.readAsText(file, 'windows-1252');
  };

  const handleCreateClass = () => {
    if (!newClassName.trim() || !newClassDiplomaId) {
        alert("Le nom de la classe et le diplôme sont obligatoires.");
        return;
    }

    let students: Student[] = [];
    if (csvContent) {
      const lines = csvContent.split('\n');
      lines.forEach(line => {
        if (!line.trim()) return;
        const parts = line.split(/[,;]/); 
        if (parts.length >= 1) {
          const lastName = parts[0].trim();
          const firstName = parts[1]?.trim() || '';
          const email = parts[2]?.trim() || '';
          if (lastName) {
            students.push({
              id: crypto.randomUUID(),
              lastName,
              firstName,
              email: email || undefined,
              studentPassword: generatePassword(),
              parentPassword: generatePassword()
            });
          }
        }
      });
    }

    const newClass: StudentClass = {
      id: crypto.randomUUID(),
      name: newClassName,
      students: students,
      diplomaId: newClassDiplomaId,
    };

    onUpdateClasses([...classes, newClass]);
    setNewClassName('');
    setCsvContent('');
    setNewClassDiplomaId(diplomas.length > 0 ? diplomas[0].id : '');
    setIsCreating(false);
    // Optionally reset filter to show the new class's diploma or 'all'
    setSelectedDiplomaFilter('all'); 
  };

  const updateClassList = (updatedClass: StudentClass) => {
    const newClasses = classes.map(c => c.id === updatedClass.id ? updatedClass : c);
    onUpdateClasses(newClasses);
  };

  // --- Student Management ---

  const handleOpenProfileModal = (student: Student | null, classId: string) => {
      setModalState({ isOpen: true, student, classId });
  };

  const handleCloseProfileModal = () => {
      setModalState({ isOpen: false, student: null, classId: null });
  };

  const handleSaveStudent = (studentToSave: Student, classId: string) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    let updatedStudents;
    if (studentToSave.id && cls.students.some(s => s.id === studentToSave.id)) { // Existing student
        updatedStudents = cls.students.map(s => s.id === studentToSave.id ? studentToSave : s);
    } else { // New student
        const newStudent = {
            ...studentToSave,
            id: crypto.randomUUID(),
            studentPassword: studentToSave.studentPassword || generatePassword(),
            parentPassword: studentToSave.parentPassword || generatePassword()
        };
        updatedStudents = [...cls.students, newStudent];
    }

    const updatedClass = { ...cls, students: updatedStudents.sort((a,b) => a.lastName.localeCompare(b.lastName)) };
    updateClassList(updatedClass);
    handleCloseProfileModal();
  };

  const StudentProfileModal = ({ student, classId, onSave, onClose }: { student: Partial<Student> | null, classId: string, onSave: (student: Student, classId: string) => void, onClose: () => void }) => {
    const [formData, setFormData] = useState<Partial<Student>>(student || {});
    const photoInputRef = useRef<HTMLInputElement>(null);
    const { confirm } = useConfirm();

    // Webcam states
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

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
                setFormData(prev => ({ ...prev, photo: dataUrl }));
            }
        }
        stopCamera();
    };

    React.useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            compressImage(file, { maxSize: 400, quality: 0.85 }).then(compressedDataUrl => {
                setFormData({ ...formData, photo: compressedDataUrl });
            }).catch(err => {
                console.error("Student photo compression failed", err);
                alert("Erreur lors du traitement de la photo.");
            });
        }
    };
    
    const handleRegeneratePassword = (type: 'student' | 'parent') => {
        confirm({
            title: "Nouveau mot de passe",
            message: `Voulez-vous vraiment générer un nouveau mot de passe ${type === 'student' ? 'élève' : 'parent'} ? L'ancien sera perdu.`,
            onConfirm: () => {
                setFormData({
                    ...formData,
                    [type === 'student' ? 'studentPassword' : 'parentPassword']: generatePassword()
                });
            }
        });
    };

    const handleSave = () => {
        if (!formData.lastName || !formData.firstName) {
            alert("Le nom et le prénom sont obligatoires.");
            return;
        }
        onSave(formData as Student, classId);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
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

            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <UserIcon className="text-indigo-600"/>
                        {student?.id ? "Modifier le profil de l'élève" : "Ajouter un nouvel élève"}
                    </h3>
                </div>
                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                            <input type="file" accept="image/*" ref={photoInputRef} onChange={handlePhotoUpload} className="hidden" />
                            <div 
                                className="w-24 h-24 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden group relative shadow-inner"
                                onClick={() => photoInputRef.current?.click()}
                                title="Cliquer pour importer une photo"
                            >
                                {formData.photo ? (
                                    <img src={formData.photo} alt="Avatar" className="w-full h-full object-cover"/>
                                ) : (
                                    <UserIcon size={32} className="text-gray-400"/>
                                )}
                                <div className="absolute w-24 h-24 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Pencil size={16}/>
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => photoInputRef.current?.click()}
                                    className="p-1 px-2 border border-gray-300 rounded text-xs flex items-center gap-1 hover:bg-gray-100 text-gray-700 font-semibold shadow-sm"
                                >
                                    <Upload size={11}/> Importer
                                </button>
                                <button
                                    type="button"
                                    onClick={startCamera}
                                    className="p-1 px-2 border border-gray-300 rounded text-xs flex items-center gap-1 hover:bg-gray-100 text-gray-700 font-semibold shadow-sm"
                                >
                                    <Camera size={11}/> Photo
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 w-full grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Nom</label>
                                <input name="lastName" value={formData.lastName || ''} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded text-sm" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Prénom</label>
                                <input name="firstName" value={formData.firstName || ''} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded text-sm" required />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Calendar size={12}/> Date de naissance</label>
                            <input type="date" name="birthDate" value={formData.birthDate || ''} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded text-sm" />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Phone size={12}/> N° Mobile</label>
                            <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Mail size={12}/> Adresse E-mail</label>
                        <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Home size={12}/> Adresse</label>
                        <textarea name="address" value={formData.address || ''} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded text-sm h-16 resize-none" />
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <KeyRound size={16} /> Mots de passe
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Élève</label>
                                <div className="flex items-center gap-2">
                                    <input value={formData.studentPassword || 'N/A'} readOnly className="flex-1 p-2 bg-white border border-gray-300 rounded text-sm font-mono" />
                                    <button onClick={() => handleRegeneratePassword('student')} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded" title="Régénérer"><RefreshCw size={16}/></button>
                                </div>
                            </div>
                             <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Parent</label>
                                <div className="flex items-center gap-2">
                                    <input value={formData.parentPassword || 'N/A'} readOnly className="flex-1 p-2 bg-white border border-gray-300 rounded text-sm font-mono" />
                                    <button onClick={() => handleRegeneratePassword('parent')} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded" title="Régénérer"><RefreshCw size={16}/></button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end items-center gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-md text-sm font-bold">Annuler</button>
                    <button onClick={handleSave} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 text-sm">
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-8">
      {modalState.isOpen && <StudentProfileModal student={modalState.student} classId={modalState.classId!} onSave={handleSaveStudent} onClose={handleCloseProfileModal} />}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Users className="text-indigo-600" />
          Gestion des Classes
        </h2>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-md px-2 py-1.5">
                <Filter size={16} className="text-gray-500"/>
                <select 
                    value={selectedDiplomaFilter} 
                    onChange={(e) => setSelectedDiplomaFilter(e.target.value)}
                    className="text-sm bg-transparent outline-none text-gray-700 font-medium"
                >
                    <option value="all">Tous les diplômes</option>
                    {diplomas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
            </div>
            <button 
              type="button"
              onClick={() => setIsCreating(!isCreating)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-indigo-700 shadow-sm transition-colors text-sm font-bold"
            >
              {isCreating ? <X size={18}/> : <Plus size={18} />}
              {isCreating ? 'Annuler' : 'Nouvelle Classe'}
            </button>
        </div>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-indigo-100 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-semibold text-lg mb-4 text-indigo-900">Création d'une classe</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la classe</label>
              <input 
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="ex: Tle MELEC A"
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diplôme de référence</label>
              <select
                  value={newClassDiplomaId}
                  onChange={(e) => setNewClassDiplomaId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md bg-white"
                  required
              >
                  {diplomas.length === 0 ? (
                      <option disabled>Veuillez d'abord créer un diplôme</option>
                  ) : (
                      diplomas.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                      ))
                  )}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-end mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Importer Élèves (CSV / Copier-Coller)
                  </label>
                  <label className="cursor-pointer bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-indigo-100 flex items-center gap-2 transition-colors">
                      <Upload size={14} />
                      Importer CSV Pronote
                      <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                  </label>
              </div>
              <p className="text-xs text-gray-500 mb-2">Format attendu par ligne : <span className="font-mono">Nom, Prénom, Email</span></p>
              <textarea 
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`Dupont, Jean, jean.dupont@email.com\nMartin, Sophie\n...`}
                className="w-full p-2 border border-gray-300 rounded-md h-32 font-mono text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button 
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Annuler
              </button>
              <button 
                type="button"
                onClick={handleCreateClass}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
              >
                Créer la classe
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredClasses.length === 0 && !isCreating ? (
          <div className="col-span-2 text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500">
            <Users size={48} className="mx-auto mb-2 opacity-50" />
            <p>Aucune classe trouvée pour ce filtre. Créez une classe pour commencer.</p>
          </div>
        ) : (
          filteredClasses.map(cls => {
            const diploma = diplomas.find(d => d.id === cls.diplomaId);
            return (
            <div key={cls.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              {/* Class Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center relative">
                <div>
                  {editingClassId === cls.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingClassName}
                        onChange={(e) => setEditingClassName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveClassName(cls.id);
                          if (e.key === 'Escape') setEditingClassId(null);
                        }}
                        autoFocus
                        className="font-bold text-gray-800 border border-indigo-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button onClick={() => handleSaveClassName(cls.id)} className="text-green-600 hover:text-green-700">
                        <Check size={18} />
                      </button>
                      <button onClick={() => setEditingClassId(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-800">{cls.name}</h3>
                      <button 
                        onClick={() => {
                          setEditingClassId(cls.id);
                          setEditingClassName(cls.name);
                        }}
                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                        title="Modifier le nom de la classe"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {diploma && <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">{diploma.name}</span>}
                    <span className="text-xs text-gray-500">{cls.students.length} élèves</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDeleteClass(cls.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all p-2 rounded group relative z-50 cursor-pointer"
                  title="Supprimer la classe et ses élèves"
                >
                  <Trash2 size={18} className="group-hover:scale-110 transition-transform pointer-events-none" />
                </button>
              </div>

              {/* Student List */}
              <div className="flex-1 max-h-[32rem] overflow-y-auto p-4 bg-slate-50/20">
                {cls.students.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-6">Aucun élève.</p>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {cls.students.map(student => (
                      <div 
                        key={student.id} 
                        className="bg-white rounded-[1.25rem] border border-indigo-50 shadow-sm p-4 flex items-center justify-between hover:shadow-md hover:border-indigo-100 transition-all duration-200"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                          <div className="flex-shrink-0 w-12 h-12 rounded-full border-2 border-indigo-150 overflow-hidden flex items-center justify-center bg-gray-50 text-indigo-400 shadow-sm">
                            {student.photo ? (
                              <img src={student.photo} alt="Profil" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-[12px] font-black text-slate-400 uppercase">
                                {student.lastName[0] || ''}{student.firstName[0] || ''}
                              </div>
                            )}
                          </div>
                          <div className="flex-grow space-y-0.5 select-text min-w-0">
                            <h4 className="font-extrabold text-[#1e293b] text-xs leading-normal">
                              {student.lastName} <br /> {student.firstName}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-bold tracking-wider uppercase truncate">
                              {cls.name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button 
                            type="button"
                            onClick={() => onOpenStudentDossier?.(student, cls)}
                            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 font-bold rounded-full text-[11px] flex items-center gap-1 transition-colors border border-indigo-100/40 mr-1 cursor-pointer"
                          >
                            Fiche <ArrowRight size={11}/>
                          </button>
                          
                          <button 
                            type="button"
                            onClick={() => handleOpenProfileModal(student, cls.id)} 
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={13}/>
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDeleteStudent(cls.id, student.id); }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Student Footer */}
              <div className="border-t border-gray-100 p-2 bg-gray-50">
                  <button 
                    type="button"
                    onClick={() => handleOpenProfileModal(null, cls.id)}
                    className="w-full flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-indigo-600 hover:bg-white py-2 rounded border border-transparent hover:border-gray-200 transition-all"
                  >
                    <UserPlus size={14} />
                    Ajouter un élève
                  </button>
              </div>
            </div>
          )})
        )}
      </div>
    </div>
  );
};

export default ClassManager;
