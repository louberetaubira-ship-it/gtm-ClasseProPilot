import React, { useState, useEffect } from 'react';
import { Save, User, Settings, Star, AlertTriangle, Image as ImageIcon, Upload, X, KeyRound } from 'lucide-react';
import { UserSettingsData, LevelCode } from '../types';
import { LEVELS } from '../constants';
import { compressImage } from '../services/imageService';

interface Props {
  currentSettings: UserSettingsData;
  onSave: (settings: UserSettingsData) => void;
  onFactoryReset: () => void;
}

const levelTextColors: Record<LevelCode, string> = {
    [LevelCode.TA]: 'text-emerald-700',
    [LevelCode.PA]: 'text-yellow-800',
    [LevelCode.IA]: 'text-orange-800',
    [LevelCode.NA]: 'text-red-700',
    [LevelCode.NE]: 'text-gray-500',
};

const UserSettings: React.FC<Props> = ({ currentSettings, onSave, onFactoryReset }) => {
  const [teacherName, setTeacherName] = useState(currentSettings.teacherName);
  const [logo, setLogo] = useState<string | null>(null);
  const [examThresholds, setExamThresholds] = useState<{TA: number, PA: number, IA: number}>({ TA: 15, PA: 10, IA: 5 });
  const [customScores, setCustomScores] = useState<{[key in LevelCode]?: number}>({});
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
      setTeacherName(currentSettings.teacherName);
      setLogo(currentSettings.establishmentLogo || null);
      
      setExamThresholds({
        TA: currentSettings.examThresholds?.TA ?? 15,
        PA: currentSettings.examThresholds?.PA ?? 10,
        IA: currentSettings.examThresholds?.IA ?? 5,
      });

      setCustomScores(currentSettings.customScores || {
        [LevelCode.TA]: 20,
        [LevelCode.PA]: 20 * (2/3),
        [LevelCode.IA]: 20 * (1/3),
        [LevelCode.NA]: 0,
        [LevelCode.NE]: 0,
      });
  }, [currentSettings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      compressImage(file, { maxSize: 300, quality: 0.9 }).then(compressedDataUrl => {
        setLogo(compressedDataUrl);
      }).catch(err => {
        console.error("Logo compression failed", err);
        alert("Erreur lors du traitement du logo.");
      });
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
  };

  const handleScoreChange = (levelCode: LevelCode, value: string) => {
    if (value === '') {
        const newScores = { ...customScores };
        delete newScores[levelCode];
        setCustomScores(newScores);
        return;
    }
    const score = parseFloat(value.replace(',', '.'));
    if (!isNaN(score)) {
      setCustomScores(prev => ({ ...prev, [levelCode]: score }));
    }
  };
  
  const handleResetScores = () => {
      setCustomScores({
        [LevelCode.TA]: 20,
        [LevelCode.PA]: 20 * (2/3),
        [LevelCode.IA]: 20 * (1/3),
        [LevelCode.NA]: 0,
        [LevelCode.NE]: 0,
      });
  };

  const handleThresholdChange = (level: 'TA' | 'PA' | 'IA', value: string) => {
      const numVal = parseFloat(value);
      if (!isNaN(numVal)) {
          setExamThresholds(prev => ({ ...prev, [level]: numVal }));
      }
  };

  const handleResetThresholds = () => {
      setExamThresholds({ TA: 15, PA: 10, IA: 5 });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
        teacherName,
        establishmentLogo: logo || undefined,
        customScores: customScores as {[key in LevelCode]: number},
        examThresholds,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-8">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Settings className="text-indigo-600" />
            Paramètres Admin
        </h2>

        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200">
            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Teacher Name Section */}
                <div className="border-b border-gray-100 pb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <User size={16} />
                        Nom de l'enseignant / Créateur (par défaut)
                    </label>
                    <input 
                        type="text" 
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Ex: Loubère TAUBIRA"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Ce nom apparaîtra comme auteur/élève pour les TPs créés en tant que modèles (Masters).
                    </p>
                </div>

                {/* Establishment Logo Section */}
                <div className="border-b border-gray-100 pb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <ImageIcon size={16} />
                        Logo de l'établissement (optionnel)
                    </label>
                    
                    {logo ? (
                        <div className="relative w-48 h-24 bg-gray-100 rounded-md border border-gray-200 p-2 group">
                            <img src={logo} alt="Logo de l'établissement" className="h-full w-full object-contain" />
                            <button 
                                type="button" 
                                onClick={handleRemoveLogo} 
                                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 transition-transform hover:scale-110"
                                title="Supprimer le logo"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="relative w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 hover:bg-gray-100 hover:border-indigo-400 transition-colors group">
                            <input 
                                type="file" 
                                accept="image/png, image/jpeg, image/svg+xml"
                                onChange={handleLogoUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="text-center text-gray-500 pointer-events-none group-hover:text-indigo-600">
                                <Upload size={24} className="mx-auto mb-1" />
                                <span className="text-sm font-medium">Cliquez pour uploader un logo</span>
                            </div>
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                        Ce logo pourra apparaître sur les documents exportés (PDFs).
                    </p>
                </div>

                {/* FIX: Per API Key guidelines, removed the Gemini API key input section. */}

                {/* Custom Scores Section */}
                 <div className="border-b border-gray-100 pb-6">
                    <div className="flex justify-between items-end mb-4">
                        <label className="block text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Star size={16} />
                            Configuration des Barèmes (Notes /20)
                        </label>
                        <button 
                            type="button" 
                            onClick={handleResetScores}
                            className="text-xs text-indigo-600 hover:underline"
                        >
                            Rétablir les défauts
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                       {(Object.keys(LEVELS) as LevelCode[]).map(levelCode => (
                           <div key={levelCode} className="bg-gray-50 p-3 rounded border border-gray-200">
                               <div className="flex items-center gap-2">
                                   <span className={`font-bold text-sm ${levelTextColors[levelCode]}`}>{levelCode}</span>
                                   <span className="text-xs text-gray-500 truncate" title={LEVELS[levelCode].label}>{LEVELS[levelCode].label}</span>
                               </div>
                               <input 
                                   type="number" 
                                   step="any"
                                   value={customScores[levelCode] ?? ''}
                                   onChange={(e) => handleScoreChange(levelCode, e.target.value)}
                                   className="w-full p-2 mt-2 text-sm border border-gray-300 rounded focus:border-indigo-500 outline-none text-center font-mono"
                               />
                           </div>
                       ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                        Modifiez les valeurs numériques associées à chaque niveau. Ces valeurs seront utilisées pour tous les calculs de moyenne.
                    </p>
                </div>
                
                {/* Exam Thresholds Section */}
                 <div className="border-b border-gray-100 pb-6">
                    <div className="flex justify-between items-end mb-4">
                        <label className="block text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Star size={16} />
                            Configuration des Seuils de Bilan (Notes /20)
                        </label>
                        <button 
                            type="button" 
                            onClick={handleResetThresholds}
                            className="text-xs text-indigo-600 hover:underline"
                        >
                            Rétablir les défauts
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-3 rounded border border-gray-200">
                            <span className="font-bold text-sm text-emerald-600">TA (Totalement Acquis)</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-medium text-gray-500">Score ≥</span>
                                <input 
                                    type="number" 
                                    step="0.5"
                                    value={examThresholds.TA}
                                    onChange={(e) => handleThresholdChange('TA', e.target.value)}
                                    className="w-full p-2 text-sm border border-gray-300 rounded focus:border-indigo-500 outline-none text-center font-mono"
                                />
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded border border-gray-200">
                            <span className="font-bold text-sm text-yellow-600">PA (Parfaitement Acquis)</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-medium text-gray-500">Score ≥</span>
                                <input 
                                    type="number" 
                                    step="0.5"
                                    value={examThresholds.PA}
                                    onChange={(e) => handleThresholdChange('PA', e.target.value)}
                                    className="w-full p-2 text-sm border border-gray-300 rounded focus:border-indigo-500 outline-none text-center font-mono"
                                />
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded border border-gray-200">
                            <span className="font-bold text-sm text-orange-600">IA (Insuffisamment Acquis)</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-medium text-gray-500">Score ≥</span>
                                <input 
                                    type="number" 
                                    step="0.5"
                                    value={examThresholds.IA}
                                    onChange={(e) => handleThresholdChange('IA', e.target.value)}
                                    className="w-full p-2 text-sm border border-gray-300 rounded focus:border-indigo-500 outline-none text-center font-mono"
                                />
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded border border-gray-200 flex flex-col justify-center">
                            <span className="font-bold text-sm text-red-600">NA (Non Acquis)</span>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-sm font-medium text-gray-500">Score &lt; {examThresholds.IA}</span>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                        Définissez les scores minimums pour chaque niveau de maîtrise dans les bilans de compétences et d'examens.
                    </p>
                </div>


                <div className="flex items-center justify-end gap-4">
                    {isSaved && <span className="text-emerald-600 text-sm font-bold animate-pulse">Paramètres enregistrés !</span>}
                    <button 
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded shadow-md flex items-center gap-2 transition-transform hover:scale-105"
                    >
                        <Save size={18} /> Enregistrer les Paramètres
                    </button>
                </div>
            </form>
            
            {/* Danger Zone */}
            <div className="mt-8 pt-6 border-t border-gray-100">
                <h3 className="text-red-600 font-bold flex items-center gap-2 mb-4">
                    <AlertTriangle size={20} />
                    Zone de Danger
                </h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <p className="font-bold text-red-800 text-sm">Réinitialisation Complète</p>
                        <p className="text-red-600 text-xs mt-1">Supprime définitivement toutes les classes, les élèves, l'historique des TP, les notes et le référentiel.</p>
                    </div>
                    <button 
                        type="button"
                        onClick={onFactoryReset}
                        className="bg-white border border-red-300 text-red-600 hover:bg-red-600 hover:text-white font-bold py-2 px-4 rounded shadow-sm transition-colors text-sm whitespace-nowrap"
                    >
                        Tout Effacer
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default UserSettings;