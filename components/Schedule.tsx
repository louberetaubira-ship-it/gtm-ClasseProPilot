import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Plus, Edit2, Trash2, Upload, Save, X, Loader2, RotateCcw, Settings, Eye, Clock, Sparkles, AlertTriangle, GitCommitHorizontal, Plane, FileText } from 'lucide-react';
import { ScheduleEvent, Holiday } from '../types';
import { analyzeScheduleDocument, analyzeHolidayDocument } from '../services/geminiService';
import { useConfirm } from './ConfirmContext';

const DEFAULT_EVENTS: ScheduleEvent[] = [
    { 
        id: '1', dayIndex: 0, 
        startTime: '07h30', endTime: '11h30', 
        title: 'AL. UN PROJET', subtitle: 'CLEANTE J. TBPMELEC1', details: 'AT207, AT208',
        color: 'bg-[#98b888] border-[#86a378] text-[#1a3b1a]' 
    },
    { 
        id: '2', dayIndex: 0, 
        startTime: '13h30', endTime: '17h30', 
        title: 'TEC.PROFESSION.', subtitle: 'CLEANTE J. TBPMELEC1', details: 'AT207, AT208',
        color: 'bg-[#98b888] border-[#86a378] text-[#1a3b1a]'
    },
    { 
        id: '3', dayIndex: 1, 
        startTime: '07h30', endTime: '10h30', 
        title: 'TECHNO.DE SPE.', subtitle: 'TBPMELEC1', details: 'AT213',
        color: 'bg-[#98b888] border-[#86a378] text-[#1a3b1a]'
    },
    { 
        id: '4', dayIndex: 3, 
        startTime: '07h30', endTime: '11h30', 
        title: 'TEC.PROFESSION.', subtitle: 'BAC PRO MELEC', details: 'AT203 MELEC',
        color: 'bg-[#bd9ba6] border-[#a88a94] text-[#3e2731]'
    },
    { 
        id: '5', dayIndex: 3, 
        startTime: '13h30', endTime: '17h30', 
        title: 'TEC.PROFESSION.', subtitle: 'BAC PRO MELEC', details: 'AT203 MELEC',
        color: 'bg-[#bd9ba6] border-[#a88a94] text-[#3e2731]'
    },
];

const DEFAULT_TIME_SLOTS = [
    '07h30', '08h30', '09h20', '10h30', '11h30', 
    '12h30', '13h30', '14h30', '15h20', '16h30', '17h30'
];

const COLORS = [
    { label: 'Vert Olive', value: 'bg-[#98b888] border-[#86a378] text-[#1a3b1a]' },
    { label: 'Rose Pale', value: 'bg-[#bd9ba6] border-[#a88a94] text-[#3e2731]' },
    { label: 'Jaune/Rouge', value: 'bg-[#fff9c4] border-[#fff176] text-[#b71c1c]' },
    { label: 'Bleu Indigo', value: 'bg-indigo-100 border-indigo-200 text-indigo-800' },
    { label: 'Gris Neutre', value: 'bg-gray-100 border-gray-200 text-gray-800' },
];

const getISOWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
    return new Date(date.setDate(diff));
};

const getSchoolYearStart = (date: Date) => {
    const year = date.getMonth() < 8 ? date.getFullYear() - 1 : date.getFullYear();
    return new Date(year, 8, 1); 
};

interface SchoolWeek {
    weekNumber: number;
    startDate: Date;
    monthName: string;
    year: number;
}

interface Props {
    hideControls?: boolean;
}

const Schedule: React.FC<Props> = ({ hideControls = false }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { confirm } = useConfirm();
  
  const [showSaturday, setShowSaturday] = useState(() => {
      const saved = localStorage.getItem('classpropilot-show-saturday');
      return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [timeSlots, setTimeSlots] = useState<string[]>(() => {
      const saved = localStorage.getItem('classpropilot-timeslots');
      return saved ? JSON.parse(saved) : DEFAULT_TIME_SLOTS;
  });

  const [events, setEvents] = useState<ScheduleEvent[]>(() => {
      const saved = localStorage.getItem('classpropilot-schedule');
      return saved ? JSON.parse(saved) : DEFAULT_EVENTS;
  });
  
  const [holidays, setHolidays] = useState<Holiday[]>(() => {
      const saved = localStorage.getItem('classpropilot-holidays');
      return saved ? JSON.parse(saved) : [];
  });


  const [q1Inverted, setQ1Inverted] = useState(() => {
      try {
          const saved = localStorage.getItem('classpropilot-q1-logic-v2');
          return saved ? JSON.parse(saved) : false;
      } catch { return false; }
  });

  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<Partial<ScheduleEvent>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      localStorage.setItem('classpropilot-schedule', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
      localStorage.setItem('classpropilot-show-saturday', JSON.stringify(showSaturday));
  }, [showSaturday]);

  useEffect(() => {
      localStorage.setItem('classpropilot-timeslots', JSON.stringify(timeSlots));
  }, [timeSlots]);
  
  useEffect(() => {
      localStorage.setItem('classpropilot-q1-logic-v2', JSON.stringify(q1Inverted));
  }, [q1Inverted]);
  
  useEffect(() => {
      localStorage.setItem('classpropilot-holidays', JSON.stringify(holidays));
  }, [holidays]);

  const startOfWeek = useMemo(() => getMonday(currentDate), [currentDate]);
  const endOfWeek = useMemo(() => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + (showSaturday ? 5 : 4)); 
      return d;
  }, [startOfWeek, showSaturday]);

  const currentWeekNumber = useMemo(() => getISOWeek(startOfWeek), [startOfWeek]);

  const currentQLabel = useMemo(() => {
      const isEven = currentWeekNumber % 2 === 0;
      const isQ1 = isEven ? !q1Inverted : q1Inverted;
      return isQ1 ? 'Q1' : 'Q2';
  }, [currentWeekNumber, q1Inverted]);

  const weekDays = useMemo(() => {
      const days = [];
      const count = showSaturday ? 6 : 5;
      for (let i = 0; i < count; i++) {
          const day = new Date(startOfWeek);
          day.setDate(startOfWeek.getDate() + i);
          days.push(day);
      }
      return days;
  }, [startOfWeek, showSaturday]);

  const schoolWeeks = useMemo(() => {
      const weeks: SchoolWeek[] = [];
      const startYear = getSchoolYearStart(currentDate);
      const iterator = new Date(startYear);
      const firstMonday = getMonday(iterator);
      iterator.setTime(firstMonday.getTime());
      const endOfSchoolYear = new Date(startYear.getFullYear() + 1, 7, 1); 

      while (iterator < endOfSchoolYear) {
          weeks.push({
              weekNumber: getISOWeek(iterator),
              startDate: new Date(iterator),
              monthName: iterator.toLocaleDateString('fr-FR', { month: 'long' }),
              year: iterator.getFullYear()
          });
          iterator.setDate(iterator.getDate() + 7);
      }
      return weeks;
  }, [currentDate]);

  const timelineGroups = useMemo(() => {
      const groups: { month: string; year: number; weeks: SchoolWeek[] }[] = [];
      let currentGroup: { month: string; year: number; weeks: SchoolWeek[] } | null = null;

      schoolWeeks.forEach(week => {
          const thursday = new Date(week.startDate);
          thursday.setDate(thursday.getDate() + 3);
          const monthName = thursday.toLocaleDateString('fr-FR', { month: 'long' });
          const year = thursday.getFullYear();

          if (!currentGroup || currentGroup.month !== monthName) {
              if (currentGroup) groups.push(currentGroup);
              currentGroup = { month: monthName, year, weeks: [] };
          }
          currentGroup.weeks.push(week);
      });
      if (currentGroup) groups.push(currentGroup);
      return groups;
  }, [schoolWeeks]);
  
  const isHoliday = useMemo(() => (date: Date): Holiday | null => {
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0); 
      for (const holiday of holidays) {
          const startDate = new Date(holiday.startDate);
          const endDate = new Date(holiday.endDate);
          startDate.setUTCHours(0, 0, 0, 0); 
          endDate.setUTCHours(23, 59, 59, 999);
          if (checkDate >= startDate && checkDate <= endDate) {
              return holiday;
          }
      }
      return null;
  }, [holidays]);


  useEffect(() => {
    if (timelineRef.current) {
        const activeWeekEl = timelineRef.current.querySelector(`[data-active="true"]`);
        if (activeWeekEl) {
            activeWeekEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
  }, [currentWeekNumber, isSettingsOpen]); 

  const handleWeekClick = (week: SchoolWeek) => setCurrentDate(week.startDate);
  
  const handlePrevWeek = () => {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
  };

  const getRowStart = (time: string) => {
      const idx = timeSlots.indexOf(time);
      return idx !== -1 ? idx + 2 : 2;
  };
  
  const getRowSpan = (start: string, end: string) => {
      let startIdx = timeSlots.indexOf(start);
      let endIdx = timeSlots.indexOf(end);
      if (startIdx === -1) startIdx = 0; 
      if (endIdx === -1) endIdx = startIdx + 1;
      return Math.max(1, endIdx - startIdx);
  };

  const handleEditEvent = (event: ScheduleEvent) => {
      if (hideControls) return; 
      
      const eventDay = new Date(startOfWeek);
      eventDay.setDate(startOfWeek.getDate() + event.dayIndex);
      if (isHoliday(eventDay)) {
        return;
      }
      
      setCurrentEvent(event);
      setIsEditingEvent(true);
  };

  const handleAddEvent = () => {
      setCurrentEvent({
          id: crypto.randomUUID(),
          dayIndex: 0,
          startTime: timeSlots[1] || '08h30',
          endTime: timeSlots[2] || '09h20',
          color: COLORS[4].value
      });
      setIsEditingEvent(true);
  };

  const saveEvent = () => {
      if (!currentEvent.title || !currentEvent.startTime || !currentEvent.endTime) {
          alert("Veuillez remplir au moins le titre et les horaires.");
          return;
      }
      setEvents(prev => {
          const exists = prev.find(e => e.id === currentEvent.id);
          if (exists) {
              return prev.map(e => e.id === currentEvent.id ? { ...e, ...currentEvent } as ScheduleEvent : e);
          }
          return [...prev, currentEvent as ScheduleEvent];
      });
      setIsEditingEvent(false);
  };

  const deleteEvent = () => {
      if (currentEvent.id) {
          confirm({
              title: "Supprimer l'événement",
              message: "Voulez-vous vraiment supprimer cet événement ?",
              isDestructive: true,
              onConfirm: () => {
                  setEvents(prev => prev.filter(e => e.id !== currentEvent.id));
                  setIsEditingEvent(false);
              }
          });
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsAnalyzing(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
          if (typeof event.target?.result === 'string') {
               try {
                   const newEvents = await analyzeScheduleDocument({
                       name: file.name,
                       type: file.type,
                       data: event.target.result
                   });
                   if (newEvents.length > 0) {
                       confirm({
                           title: "Importer l'emploi du temps",
                           message: `L'IA a détecté ${newEvents.length} événements. Voulez-vous remplacer l'emploi du temps actuel ?`,
                           onConfirm: () => {
                               setEvents(newEvents);
                               setIsSettingsOpen(false); 
                           }
                       });
                   } else {
                       alert("Aucun événement détecté.");
                   }
               } catch (error) {
                   console.error(error);
                   const errorMessage = error instanceof Error ? error.message : "Erreur d'analyse.";
                   alert(errorMessage);
               } finally {
                   setIsAnalyzing(false);
               }
          }
      };
      reader.readAsDataURL(file);
  };
  
  const SettingsModal = () => {
      const [localSlots, setLocalSlots] = useState([...timeSlots]);
      const [newSlot, setNewSlot] = useState('');
      const [isAnalyzingHolidays, setIsAnalyzingHolidays] = useState(false);
      const [holidayAnalysisResult, setHolidayAnalysisResult] = useState<string | null>(null);

      const addSlot = () => {
          if (newSlot && !localSlots.includes(newSlot)) {
              const updated = [...localSlots, newSlot].sort();
              setLocalSlots(updated);
              setNewSlot('');
          }
      };

      const removeSlot = (slotToRemove: string) => {
          setLocalSlots(prev => prev.filter(s => s !== slotToRemove));
      };
      
      const saveSlots = () => {
          setTimeSlots(localSlots);
          alert('Horaires mis à jour !');
      };

      const setWeekAsQ1 = () => {
          if (currentQLabel === 'Q2') setQ1Inverted(!q1Inverted);
          else alert("Cette semaine est déjà définie comme Q1.");
      };
      
      const handleHolidayUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzingHolidays(true);
        setHolidayAnalysisResult(null);
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (typeof event.target?.result === 'string') {
                try {
                    const newHolidays = await analyzeHolidayDocument({
                        name: file.name,
                        type: file.type,
                        data: event.target.result
                    });

                    if (newHolidays.length > 0) {
                        const holidaysWithIds = newHolidays.map(h => ({ ...h, id: crypto.randomUUID() }));
                        confirm({
                            title: "Importer le calendrier",
                            message: `L'IA a détecté ${holidaysWithIds.length} périodes de vacances/jours fériés. Voulez-vous remplacer le calendrier actuel ?`,
                            onConfirm: () => {
                               setHolidays(holidaysWithIds);
                               setHolidayAnalysisResult(`Succès: ${holidaysWithIds.length} périodes ajoutées.`);
                            },
                            onCancel: () => {
                               setHolidayAnalysisResult(`Analyse annulée.`);
                            }
                        });
                    } else {
                        setHolidayAnalysisResult("Aucune période de vacances détectée.");
                    }

                } catch (error) {
                    console.error(error);
                    const errorMessage = error instanceof Error ? error.message : "Erreur d'analyse du calendrier.";
                    setHolidayAnalysisResult(`Erreur: ${errorMessage}`);
                } finally {
                    setIsAnalyzingHolidays(false);
                }
            }
        };
        reader.readAsDataURL(file);
      };

      return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="font-bold text-xl text-gray-800 flex items-center gap-3">
                          <Settings className="text-indigo-600"/>
                          Paramètres de l'Emploi du Temps
                      </h3>
                      <button onClick={() => setIsSettingsOpen(false)} className="p-2 rounded-full text-gray-400 hover:bg-gray-100"><X size={20}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-8">
                       <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2"><Plus size={16}/> Gestion des Événements</h4>
                            <button 
                                onClick={() => { setIsSettingsOpen(false); handleAddEvent(); }} 
                                className="text-sm font-semibold bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-100">
                                Ajouter un événement
                            </button>
                        </div>

                      {/* Import Section */}
                      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                          <h4 className="font-bold text-indigo-800 mb-2 flex items-center gap-2"><Upload size={16}/> Import Automatique (via IA)</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <label className="text-sm font-semibold text-gray-700">Importer un emploi du temps</label>
                                  <input type="file" onChange={handleFileUpload} className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200"/>
                                  {isAnalyzing && <span className="text-xs text-indigo-600 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Analyse en cours...</span>}
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-semibold text-gray-700">Importer un calendrier des vacances</label>
                                  <input type="file" onChange={handleHolidayUpload} className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200"/>
                                  {isAnalyzingHolidays && <span className="text-xs text-indigo-600 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Analyse en cours...</span>}
                                  {holidayAnalysisResult && <span className="text-xs text-gray-600">{holidayAnalysisResult}</span>}
                              </div>
                          </div>
                      </div>

                      {/* Time Slots Section */}
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                           <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Clock size={16}/> Gestion des Créneaux Horaires</h4>
                           <div className="flex items-center gap-2 mb-2">
                               <input 
                                   type="text"
                                   value={newSlot}
                                   onChange={e => setNewSlot(e.target.value)}
                                   placeholder="HHhMM (ex: 18h30)"
                                   className="p-2 border border-gray-300 rounded text-sm w-32"
                               />
                               <button onClick={addSlot} className="bg-indigo-100 text-indigo-700 p-2 rounded hover:bg-indigo-200"><Plus size={16}/></button>
                               <button onClick={saveSlots} className="bg-emerald-100 text-emerald-700 p-2 rounded hover:bg-emerald-200 ml-auto"><Save size={16}/></button>
                           </div>
                           <div className="flex flex-wrap gap-2 text-xs">
                               {localSlots.map(slot => (
                                   <div key={slot} className="bg-white border border-gray-300 rounded-full px-2 py-1 flex items-center gap-1">
                                       {slot}
                                       <button onClick={() => removeSlot(slot)} className="text-red-400 hover:text-red-600"><X size={12}/></button>
                                   </div>
                               ))}
                           </div>
                      </div>
                      
                      {/* Other settings */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                               <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><GitCommitHorizontal size={16}/> Alternance Quinzaine</h4>
                               <p className="text-xs text-gray-500 mb-2">Si le "Q" affiché est incorrect pour la semaine en cours, cliquez ici.</p>
                               <button 
                                   onClick={setWeekAsQ1}
                                   className="text-sm font-semibold bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-100"
                                >
                                   Définir cette semaine comme Q1
                                </button>
                           </div>
                           <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Eye size={16}/> Affichage</h4>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={showSaturday}
                                        onChange={e => setShowSaturday(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-gray-700">Afficher le Samedi</span>
                                </label>
                           </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const EventModal = () => (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-bold text-xl text-gray-800">
                      {currentEvent.id && events.find(e => e.id === currentEvent.id) ? 'Modifier' : 'Ajouter'} un événement
                  </h3>
                  <button onClick={() => setIsEditingEvent(false)} className="p-2 rounded-full text-gray-400 hover:bg-gray-100"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div>
                      <label className="text-sm font-bold text-gray-600">Titre</label>
                      <input value={currentEvent.title || ''} onChange={e => setCurrentEvent(p => ({...p, title: e.target.value}))} className="w-full mt-1 p-2 border border-gray-300 rounded"/>
                  </div>
                  <div>
                      <label className="text-sm font-bold text-gray-600">Sous-titre (Prof, Classe...)</label>
                      <input value={currentEvent.subtitle || ''} onChange={e => setCurrentEvent(p => ({...p, subtitle: e.target.value}))} className="w-full mt-1 p-2 border border-gray-300 rounded"/>
                  </div>
                  <div>
                      <label className="text-sm font-bold text-gray-600">Détails (Salle...)</label>
                      <input value={currentEvent.details || ''} onChange={e => setCurrentEvent(p => ({...p, details: e.target.value}))} className="w-full mt-1 p-2 border border-gray-300 rounded"/>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                       <div>
                          <label className="text-sm font-bold text-gray-600">Jour</label>
                          <select value={currentEvent.dayIndex} onChange={e => setCurrentEvent(p => ({...p, dayIndex: parseInt(e.target.value)}))} className="w-full mt-1 p-2 border border-gray-300 rounded bg-white">
                              {weekDays.map((d, i) => <option key={i} value={i}>{d.toLocaleDateString('fr-FR', { weekday: 'long' })}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="text-sm font-bold text-gray-600">Début</label>
                          <select value={currentEvent.startTime} onChange={e => setCurrentEvent(p => ({...p, startTime: e.target.value}))} className="w-full mt-1 p-2 border border-gray-300 rounded bg-white">
                              {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="text-sm font-bold text-gray-600">Fin</label>
                          <select value={currentEvent.endTime} onChange={e => setCurrentEvent(p => ({...p, endTime: e.target.value}))} className="w-full mt-1 p-2 border border-gray-300 rounded bg-white">
                              {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                      </div>
                  </div>
                   <div>
                      <label className="text-sm font-bold text-gray-600">Couleur</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                          {COLORS.map(c => (
                              <button key={c.label} onClick={() => setCurrentEvent(p => ({...p, color: c.value}))} className={`h-8 w-16 rounded border-2 ${c.value} ${currentEvent.color === c.value ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`} title={c.label}></button>
                          ))}
                      </div>
                  </div>
              </div>
               <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                  <button onClick={deleteEvent} className="px-4 py-2 text-red-600 hover:bg-red-100 rounded-md text-sm font-bold flex items-center gap-2">
                      <Trash2 size={16}/> Supprimer
                  </button>
                  <div className="flex items-center gap-2">
                      <button onClick={() => setIsEditingEvent(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-md text-sm font-bold">Annuler</button>
                      <button onClick={saveEvent} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 text-sm">
                          Enregistrer
                      </button>
                  </div>
              </div>
          </div>
      </div>
  );
  
  const mainContent = (
    <div className={`h-full flex flex-col bg-white ${hideControls ? '' : 'rounded-xl overflow-hidden shadow-sm border border-gray-200'}`}>
        {isSettingsOpen && <SettingsModal/>}
        {isEditingEvent && <EventModal/>}
        
        <>
            <div className="bg-green-50/70 border-b border-green-200 p-2 px-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <CalendarIcon className="text-green-700"/>
                    <h2 className="font-bold text-gray-800 text-sm md:text-base">
                        DU {startOfWeek.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} AU {endOfWeek.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        <span className="hidden sm:inline"> - Semaine {currentWeekNumber}</span>
                    </h2>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${currentQLabel === 'Q1' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                        {currentQLabel}
                    </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                    <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 border border-gray-300 rounded-md text-xs sm:text-sm font-semibold hover:bg-gray-100 bg-white shadow-sm">Auj.</button>
                    <div className="flex items-center bg-white rounded-md border border-gray-300 shadow-sm">
                      <button onClick={handlePrevWeek} className="p-2 hover:bg-gray-100 rounded-l-md"><ChevronLeft size={16}/></button>
                      <div className="w-px h-4 bg-gray-300"></div>
                      <button onClick={handleNextWeek} className="p-2 hover:bg-gray-100 rounded-r-md"><ChevronRight size={16}/></button>
                    </div>
                </div>
            </div>

            <div ref={timelineRef} className="bg-slate-50 border-b border-slate-200 overflow-x-auto whitespace-nowrap hidden sm:block">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            {timelineGroups.map(group => (
                                <th key={`${group.month}-${group.year}`} colSpan={group.weeks.length} className="p-1 text-[10px] font-bold uppercase text-slate-500 text-center border-r border-slate-200">
                                    {group.month}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="relative">
                            <td colSpan={schoolWeeks.length} className="p-0 h-full">
                               <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-slate-300 -translate-y-1/2"></div>
                            </td>
                        </tr>
                        <tr>
                            {timelineGroups.flatMap(group => group.weeks).map((week, index) => {
                                const isActive = week.weekNumber === currentWeekNumber;
                                return (
                                    <td key={week.weekNumber} className={`text-center border-r border-slate-200 last:border-0`}>
                                        <button
                                            onClick={() => handleWeekClick(week)}
                                            data-active={isActive}
                                            className={`w-full h-8 flex items-center justify-center transition-colors text-xs font-semibold ${
                                                isActive ? 'bg-teal-500 text-white' : 'text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            {week.weekNumber}
                                        </button>
                                    </td>
                                )
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
        </>
        

        {/* Schedule Grid */}
        <div className="flex-1 overflow-auto">
            <div className="grid gap-px bg-gray-200 print:bg-gray-300 h-full" style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)`, gridTemplateRows: `auto repeat(${timeSlots.length}, 1fr)` }}>
                <div className="sticky top-0 bg-white z-20"></div>
                {weekDays.map((day, i) => {
                    const holiday = isHoliday(day);
                    const isToday = new Date().toDateString() === day.toDateString();
                    return (
                        <div key={i} className={`p-2 text-center sticky top-0 z-10 ${holiday ? 'bg-yellow-100' : 'bg-slate-50'}`}>
                            <div className={`font-bold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                                {day.toLocaleDateString('fr-FR', { weekday: 'short' })}.
                            </div>
                            <div className={`text-2xl font-light ${isToday ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                                {day.getDate()}
                            </div>
                            {holiday && <div className="text-xs text-yellow-700 font-bold mt-1 line-clamp-1" title={holiday.name}><Plane size={12} className="inline-block mr-1"/>{holiday.name}</div>}
                        </div>
                    );
                })}
                
                {timeSlots.map((time, i) => (
                    <React.Fragment key={time}>
                        <div className="text-right text-xs pr-2 pt-1 text-gray-400 bg-white" style={{ gridRow: i + 2 }}>
                            {time.replace('h', ':')}
                        </div>
                        {weekDays.map((day, dayIndex) => (
                             <div key={dayIndex} className="bg-white print:bg-white" style={{ gridColumn: dayIndex + 2, gridRow: i + 2 }}></div>
                        ))}
                    </React.Fragment>
                ))}

                {/* Events */}
                {events.map(event => {
                    if (!showSaturday && event.dayIndex >= 5) return null;
                    const holiday = isHoliday(new Date(startOfWeek.getTime() + event.dayIndex * 86400000));
                    if(holiday) return null;

                    return (
                        <div 
                            key={event.id}
                            onClick={() => handleEditEvent(event)}
                            className={`p-2 rounded-lg border text-xs m-px flex flex-col overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-400 z-10 ${event.color} print:shadow-none print:border-gray-400`}
                            style={{ 
                                gridColumn: event.dayIndex + 2,
                                gridRow: `${getRowStart(event.startTime)} / span ${getRowSpan(event.startTime, event.endTime)}`
                            }}
                        >
                            <p className="font-bold line-clamp-2">{event.title}</p>
                            <p className="opacity-80 line-clamp-1">{event.subtitle}</p>
                            <p className="mt-auto font-semibold opacity-70 flex items-center gap-1">
                                <MapPin size={10}/>
                                {event.details}
                            </p>
                        </div>
                    );
                })}

            </div>
        </div>
    </div>
  );

  return hideControls ? mainContent : (
    <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-2 px-1">
            <div className="text-sm text-gray-500">
                Emploi du temps &gt; <span className="font-semibold text-gray-700">Mon EDT</span>
            </div>
            <button onClick={() => setIsSettingsOpen(true)} className="text-sm font-semibold bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                Affichage
            </button>
        </div>
        {mainContent}
    </div>
  )
};

export default Schedule;