
import React from 'react';
import { TpSession } from '../types';
import { FileText, Calendar, User, Trash2, PenTool, GraduationCap, BookOpen } from 'lucide-react';

interface Props {
    sessions: TpSession[];
    onEdit: (s: TpSession) => void;
    onDelete: (s: TpSession) => void;
    onPrintStudent: (s: TpSession) => void;
    onPrintTeacher: (s: TpSession) => void;
}

const SessionHistory: React.FC<Props> = ({ sessions, onEdit, onDelete, onPrintStudent, onPrintTeacher }) => {
    return (
        <div className="space-y-4">
            {sessions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50/50 rounded-lg border border-dashed border-gray-200 text-gray-500">
                    <FileText size={40} className="mx-auto mb-3 opacity-50"/>
                    <p className="font-semibold text-gray-700">Aucun modèle de séquence trouvé pour ce diplôme.</p>
                    <p className="text-sm">Créez une nouvelle séquence pour commencer.</p>
                </div>
            ) : (
                sessions.map(session => (
                    <div 
                        key={session.id} 
                        className="group flex flex-col lg:flex-row lg:items-center justify-between p-5 rounded-lg border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all shadow-sm relative"
                    >
                        {/* Info Section */}
                        <div className="mb-4 lg:mb-0 lg:mr-4 flex-1">
                            <h3 className="font-bold text-lg text-gray-800 group-hover:text-indigo-700">{session.title}</h3>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-1">
                                <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-gray-200">
                                    <User size={12}/> {session.studentName}
                                </span>
                                <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-gray-200">
                                    <Calendar size={12}/> {session.date}
                                </span>
                                <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
                                    {session.sequenceType || 'Travaux pratiques (TP)'}
                                </span>
                            </div>
                        </div>

                        {/* Actions Section */}
                        <div className="flex flex-wrap items-center gap-2 z-10 relative">
                            <button 
                                type="button"
                                onClick={() => onEdit(session)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded hover:bg-blue-700 shadow-sm transition-colors"
                                title="Modifier la Séquence"
                            >
                                <PenTool size={14} /> Modifier
                            </button>

                            <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block"></div>

                            <button 
                                type="button"
                                onClick={() => onPrintStudent(session)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 hover:text-indigo-600 transition-colors"
                                title="Télécharger la version Élève"
                            >
                                <GraduationCap size={14} /> PDF Élève
                            </button>

                            <button 
                                type="button"
                                onClick={() => onPrintTeacher(session)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 hover:text-red-600 transition-colors"
                                title="Télécharger la version Professeur"
                            >
                                <BookOpen size={14} /> PDF Prof
                            </button>

                            <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block"></div>

                            <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDelete(session); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded hover:bg-red-600 hover:text-white transition-colors z-50 cursor-pointer relative"
                                title="Supprimer la Séquence"
                            >
                                <Trash2 size={14} className="pointer-events-none"/>
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export { SessionHistory };
