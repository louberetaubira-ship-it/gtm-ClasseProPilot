
import React, { useState, useRef } from 'react';
import { StudentInternship, InternshipPeriod, PortfolioItem } from '../types';
import { Camera, MapPin, User, Save, Upload, Plus, FileText, CheckCircle2 } from 'lucide-react';
import { compressImage } from '../services/imageService';

interface Props {
    internship: StudentInternship;
    period: InternshipPeriod;
    onUpdate: (internship: StudentInternship) => void;
}

const StudentInternshipView: React.FC<Props> = ({ internship, period, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'info' | 'portfolio'>('info');
    const [newLogText, setNewLogText] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Info Handlers ---
    const handleInfoChange = (field: keyof StudentInternship, value: string) => {
        onUpdate({ ...internship, [field]: value });
    };

    // --- Portfolio Handlers ---
    const handleAddLog = () => {
        if (!newLogText.trim()) return;
        
        const newItem: PortfolioItem = {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            type: 'journal',
            content: newLogText
        };
        
        onUpdate({
            ...internship,
            portfolio: [newItem, ...internship.portfolio]
        });
        setNewLogText('');
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        compressImage(file, { maxSize: 1024, quality: 0.8 }).then(compressedDataUrl => {
            const newItem: PortfolioItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                type: 'photo',
                content: compressedDataUrl,
            };
            onUpdate({
                ...internship,
                portfolio: [newItem, ...internship.portfolio]
            });
        }).catch(err => {
            console.error("Portfolio photo compression failed", err);
            alert("Erreur lors du traitement de la photo.");
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
                <h2 className="text-xl font-bold mb-1">{period.title}</h2>
                <p className="opacity-90 text-sm flex items-center gap-2">
                    <MapPin size={14}/> {internship.companyName || 'Entreprise non renseignée'}
                </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button 
                    onClick={() => setActiveTab('info')}
                    className={`flex-1 py-3 font-bold text-sm text-center border-b-2 transition-colors ${activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
                >
                    Mes Infos
                </button>
                <button 
                    onClick={() => setActiveTab('portfolio')}
                    className={`flex-1 py-3 font-bold text-sm text-center border-b-2 transition-colors ${activeTab === 'portfolio' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
                >
                    Mon Portfolio
                </button>
            </div>

            {/* Content */}
            <div className="p-6">
                {activeTab === 'info' ? (
                    <div className="space-y-6">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                            <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                <MapPin size={18}/> L'Entreprise
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Nom de l'entreprise</label>
                                    <input 
                                        value={internship.companyName}
                                        onChange={e => handleInfoChange('companyName', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        placeholder="Ex: Garage du Centre"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Adresse complète</label>
                                    <input 
                                        value={internship.companyAddress}
                                        onChange={e => handleInfoChange('companyAddress', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        placeholder="Ex: 12 Rue des Lilas, 75000 Paris"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                            <h3 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
                                <User size={18}/> Mon Tuteur
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Nom du tuteur</label>
                                    <input 
                                        value={internship.tutorName}
                                        onChange={e => handleInfoChange('tutorName', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        placeholder="Ex: M. Dupont"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Téléphone</label>
                                        <input 
                                            value={internship.tutorPhone}
                                            onChange={e => handleInfoChange('tutorPhone', e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded text-sm"
                                            placeholder="06..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Email (facultatif)</label>
                                        <input 
                                            value={internship.tutorEmail}
                                            onChange={e => handleInfoChange('tutorEmail', e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded text-sm"
                                            placeholder="email@entreprise.com"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                         <div className="flex justify-end">
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                <CheckCircle2 size={12}/> Sauvegarde automatique
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Add Section */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h3 className="font-bold text-gray-700 mb-3 text-sm">Ajouter une entrée</h3>
                            <textarea 
                                value={newLogText}
                                onChange={e => setNewLogText(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Aujourd'hui, j'ai appris à..."
                                rows={3}
                            />
                            <div className="flex justify-between items-center">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
                                        title="Ajouter une photo"
                                    >
                                        <Camera size={20}/>
                                    </button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={handlePhotoUpload}
                                    />
                                </div>
                                <button 
                                    onClick={handleAddLog}
                                    disabled={!newLogText.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50"
                                >
                                    Publier
                                </button>
                            </div>
                        </div>

                        {/* Feed */}
                        <div className="space-y-4">
                            {internship.portfolio.length === 0 ? (
                                <p className="text-center text-gray-400 py-8 text-sm">Votre portfolio est vide.</p>
                            ) : (
                                internship.portfolio.map(item => (
                                    <div key={item.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 relative">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-gray-400">
                                                {new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' })}
                                            </span>
                                        </div>
                                        
                                        {item.type === 'photo' ? (
                                            <div className="rounded-lg overflow-hidden border border-gray-100">
                                                <img src={item.content} alt="Portfolio" className="w-full h-auto object-cover max-h-64"/>
                                            </div>
                                        ) : (
                                            <p className="text-gray-800 text-sm whitespace-pre-wrap">{item.content}</p>
                                        )}

                                        {item.comment && (
                                            <div className="mt-3 bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-400">
                                                <p className="text-xs font-bold text-yellow-800 mb-1">Commentaire Professeur</p>
                                                <p className="text-xs text-yellow-900">{item.comment}</p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentInternshipView;