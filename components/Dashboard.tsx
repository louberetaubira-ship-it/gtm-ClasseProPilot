import React from 'react';
import { StudentClass, TpSession } from '../types';
import Schedule from './Schedule';
import { PenTool, ClipboardCheck, Users, GraduationCap } from 'lucide-react';

interface Props {
  classes: StudentClass[];
  sessions: TpSession[];
  onNavigate: (view: 'new-tp' | 'mass-eval' | 'classes' | 'bilan') => void;
}

const Dashboard: React.FC<Props> = ({ classes, sessions, onNavigate }) => {
  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-indigo-600 text-white rounded-xl shadow-lg p-6 flex flex-col justify-between hover:shadow-indigo-300 transition-shadow">
                <div>
                    <h3 className="font-bold text-xl">Nouvelle Séquence</h3>
                    <p className="text-sm opacity-80 mt-1 mb-4">Créer une séquence pédagogique</p>
                </div>
                <button onClick={() => onNavigate('new-tp')} className="bg-white text-indigo-600 font-bold text-sm py-2 px-4 rounded-lg self-start hover:bg-indigo-100 transition-colors">
                    Action
                </button>
            </div>
            <div className="bg-emerald-600 text-white rounded-xl shadow-lg p-6 flex flex-col justify-between hover:shadow-emerald-300 transition-shadow">
                 <div>
                    <h3 className="font-bold text-xl">Notes & Évaluations</h3>
                    <p className="text-sm opacity-80 mt-1 mb-4">Noter un groupe rapidement</p>
                </div>
                <button onClick={() => onNavigate('mass-eval')} className="bg-white text-emerald-600 font-bold text-sm py-2 px-4 rounded-lg self-start hover:bg-emerald-100 transition-colors">
                    Classe
                </button>
            </div>
             <button onClick={() => onNavigate('classes')} className="text-left bg-white rounded-xl shadow-md border border-gray-200 p-6 flex flex-col justify-start hover:shadow-lg hover:border-indigo-300 transition-all">
                <div className="flex items-center gap-3 mb-2">
                    <Users size={20} className="text-gray-500" />
                    <h3 className="font-bold text-xl text-gray-800">Mes Classes</h3>
                </div>
                <p className="text-sm text-gray-500">{classes.length} Classe(s)</p>
            </button>
            <button onClick={() => onNavigate('bilan')} className="text-left bg-white rounded-xl shadow-md border border-gray-200 p-6 flex flex-col justify-start hover:shadow-lg hover:border-indigo-300 transition-all">
                <div className="flex items-center gap-3 mb-2">
                    <GraduationCap size={20} className="text-gray-500" />
                    <h3 className="font-bold text-xl text-gray-800">Bilans Examens</h3>
                </div>
                <p className="text-sm text-gray-500">Suivi des compétences</p>
            </button>
        </div>
        
        <div className="h-[calc(100vh-22rem)] min-h-[500px] bg-white rounded-xl shadow-md border border-gray-200">
            <Schedule hideControls={true} />
        </div>
    </div>
  );
};

export default Dashboard;
