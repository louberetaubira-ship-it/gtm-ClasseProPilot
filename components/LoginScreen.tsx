import React, { useState } from 'react';
import { UserRole, AuthUser, StudentClass, InternshipDataStore } from '../types';
import { getSubscribers } from '../services/saasService';
import { ShieldCheck, GraduationCap, Users, LogIn, Lock, Briefcase, KeyRound, Eye, EyeOff } from 'lucide-react';

interface Props {
  classes: StudentClass[];
  onLogin: (user: AuthUser) => void;
  establishmentLogo?: string;
  internshipData: InternshipDataStore;
  onSwitchToRegister?: () => void;
}

const LoginScreen: React.FC<Props> = ({ classes, onLogin, establishmentLogo, internshipData, onSwitchToRegister }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  
  // Admin State
  const [adminIdentifiant, setAdminIdentifiant] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [showAdminPin, setShowAdminPin] = useState(false);
  
  // Student/Parent State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  // Tutor State
  const [tutorEmail, setTutorEmail] = useState('');
  const [tutorPassword, setTutorPassword] = useState('');
  const [showTutorPassword, setShowTutorPassword] = useState(false);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // Super Admin login
    if (adminIdentifiant.toLowerCase() === 'superadmin' && adminPin === '9999') {
        onLogin({ role: 'super-admin', name: 'Gestionnaire SaaS' });
        return;
    }

    // Regular Admin (Teacher/Subscriber) login
    const subscribers = getSubscribers();
    const subscriber = subscribers.find(s => s.email.toLowerCase() === adminIdentifiant.toLowerCase());

    if (!subscriber) {
        alert("Identifiant incorrect.");
        return;
    }

    if (subscriber.status === 'inactive') {
        alert("Ce compte est inactif. Veuillez contacter le gestionnaire.");
        return;
    }

    if (adminPin === '1234') { // Default PIN for all teachers
        onLogin({ role: 'admin', name: subscriber.name, subscriberId: subscriber.id });
    } else {
        alert("Code PIN incorrect.");
    }
  };


  const handleStudentLogin = (isParent: boolean) => {
    if (!selectedClassId || !selectedStudentId) return;
    
    const cls = classes.find(c => c.id === selectedClassId);
    const student = cls?.students.find(s => s.id === selectedStudentId);
    
    if (cls && student) {
      const requiredPassword = isParent ? student.parentPassword : student.studentPassword;

      // Allow login if no password is set (backward compatibility)
      if (requiredPassword && password !== requiredPassword) {
        alert("Mot de passe incorrect.");
        return;
      }

      onLogin({
        role: isParent ? 'parent' : 'student',
        name: isParent ? `Parent de ${student.firstName}` : `${student.firstName} ${student.lastName}`,
        id: student.id,
        classId: cls.id
      });
    }
  };
  
  const handleTutorLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorEmail.trim() || !tutorPassword.trim()) {
        alert("Veuillez saisir votre e-mail et votre mot de passe.");
        return;
    }

    const foundInternship = internshipData.internships.find(i => 
        i.tutorEmail.toLowerCase() === tutorEmail.toLowerCase()
    );

    if (foundInternship && foundInternship.tutorPassword === tutorPassword) {
        onLogin({
            role: 'tutor',
            name: foundInternship.tutorName || "Tuteur",
            id: foundInternship.tutorEmail,
        });
    } else {
        alert("E-mail ou mot de passe incorrect.");
    }
  };
  
  const resetStudentForm = () => {
    setSelectedClassId('');
    setSelectedStudentId('');
    setPassword('');
    setShowStudentPassword(false);
  };


  const renderRoleSelection = () => (
    <div className="space-y-4 w-full max-w-sm">
        <button 
          onClick={() => setSelectedRole('admin')}
          className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-500 hover:shadow-md transition-all group"
        >
           <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-3 rounded-full text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ShieldCheck size={24} />
              </div>
              <div className="text-left">
                  <h3 className="font-bold text-gray-800">Enseignant (Admin)</h3>
                  <p className="text-xs text-gray-500">Accès complet à la gestion</p>
              </div>
           </div>
        </button>

        <button 
          onClick={() => setSelectedRole('student')}
          className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-emerald-500 hover:shadow-md transition-all group"
        >
           <div className="flex items-center gap-4">
              <div className="bg-emerald-100 p-3 rounded-full text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <GraduationCap size={24} />
              </div>
              <div className="text-left">
                  <h3 className="font-bold text-gray-800">Espace Élève</h3>
                  <p className="text-xs text-gray-500">Consulter mes résultats</p>
              </div>
           </div>
        </button>

        <button 
          onClick={() => setSelectedRole('parent')}
          className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-orange-500 hover:shadow-md transition-all group"
        >
           <div className="flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-full text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <Users size={24} />
              </div>
              <div className="text-left">
                  <h3 className="font-bold text-gray-800">Espace Parents</h3>
                  <p className="text-xs text-gray-500">Suivi de scolarité</p>
              </div>
           </div>
        </button>

        <button 
          onClick={() => setSelectedRole('tutor')}
          className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-sky-500 hover:shadow-md transition-all group"
        >
           <div className="flex items-center gap-4">
              <div className="bg-sky-100 p-3 rounded-full text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                  <Briefcase size={24} />
              </div>
              <div className="text-left">
                  <h3 className="font-bold text-gray-800">Espace Tuteur</h3>
                  <p className="text-xs text-gray-500">Évaluer mes stagiaires</p>
              </div>
           </div>
        </button>
        {onSwitchToRegister && (
            <div className="text-center pt-4">
                <button onClick={onSwitchToRegister} className="text-sm text-indigo-600 hover:underline font-semibold">
                    Pas encore de compte ? Voir les offres.
                </button>
            </div>
        )}
    </div>
  );

  const renderAdminForm = () => (
     <form onSubmit={handleAdminLogin} className="w-full max-w-sm bg-white p-6 rounded-xl shadow-lg border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
         <div className="text-center mb-6">
            <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                <Lock size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Connexion Admin</h3>
            <p className="text-sm text-gray-500">Veuillez saisir votre identifiant et code PIN</p>
        </div>
        
        <div className="space-y-4">
            <input 
                type="text"
                value={adminIdentifiant}
                onChange={(e) => setAdminIdentifiant(e.target.value)}
                placeholder="Identifiant (e-mail)"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                autoFocus
            />
            <div className="relative">
                <input 
                    type={showAdminPin ? "text" : "password"} 
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="Code PIN"
                    className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                    type="button"
                    onClick={() => setShowAdminPin(!showAdminPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                    {showAdminPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
            <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2"
            >
                <LogIn size={20} /> Entrer
            </button>
            <button 
                type="button"
                onClick={() => setSelectedRole(null)}
                className="w-full text-gray-500 hover:text-gray-800 text-sm py-2"
            >
                Retour
            </button>
        </div>
     </form>
  );
  
  const renderTutorForm = () => (
     <form onSubmit={handleTutorLogin} className="w-full max-w-sm bg-white p-6 rounded-xl shadow-lg border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
        <div className="text-center mb-6">
            <div className="bg-sky-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-sky-600">
                <Briefcase size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Espace Tuteur</h3>
            <p className="text-sm text-gray-500">Saisissez vos identifiants pour vous connecter</p>
        </div>
        
        <div className="space-y-4">
            <input 
                type="email" 
                value={tutorEmail}
                onChange={(e) => setTutorEmail(e.target.value)}
                placeholder="votre.email@entreprise.com"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                autoFocus
            />
            <div className="relative">
                <input 
                    type={showTutorPassword ? "text" : "password"} 
                    value={tutorPassword}
                    onChange={(e) => setTutorPassword(e.target.value)}
                    placeholder="Mot de passe"
                    className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                />
                <button
                    type="button"
                    onClick={() => setShowTutorPassword(!showTutorPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                    {showTutorPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
            <button 
                type="submit"
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2"
            >
                <LogIn size={20} /> Connexion
            </button>
            <button 
                type="button"
                onClick={() => setSelectedRole(null)}
                className="w-full text-gray-500 hover:text-gray-800 text-sm py-2"
            >
                Retour
            </button>
        </div>
     </form>
  );

  const renderStudentForm = (isParent: boolean) => (
      <div className="w-full max-w-sm bg-white p-6 rounded-xl shadow-lg border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
        <div className="text-center mb-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isParent ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {isParent ? <Users size={32} /> : <GraduationCap size={32} />}
            </div>
            <h3 className="text-xl font-bold text-gray-800">{isParent ? 'Espace Parents' : 'Espace Élève'}</h3>
            <p className="text-sm text-gray-500">Identifiez-vous pour accéder au suivi</p>
        </div>

        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Classe</label>
                <select 
                    value={selectedClassId}
                    onChange={(e) => {
                        setSelectedClassId(e.target.value);
                        setSelectedStudentId('');
                        setPassword('');
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                    <option value="">-- Choisir une classe --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            <div className={!selectedClassId ? 'opacity-50 pointer-events-none' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'élève</label>
                <select 
                    value={selectedStudentId}
                    onChange={(e) => {
                        setSelectedStudentId(e.target.value)
                        setPassword('');
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                    <option value="">-- Choisir un nom --</option>
                    {classes.find(c => c.id === selectedClassId)?.students.map(s => (
                        <option key={s.id} value={s.id}>{s.lastName} {s.firstName}</option>
                    ))}
                </select>
            </div>

             <div className={!selectedStudentId ? 'opacity-50 pointer-events-none' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <div className="relative">
                    <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input 
                        type={showStudentPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Code à 4 chiffres"
                        className="w-full p-3 pl-9 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button
                        type="button"
                        onClick={() => setShowStudentPassword(!showStudentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                        {showStudentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
            </div>

            <button 
                onClick={() => handleStudentLogin(isParent)}
                disabled={!selectedStudentId}
                className={`w-full font-bold py-3 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 text-white ${isParent ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:opacity-50`}
            >
                <LogIn size={20} /> Connexion
            </button>
            <button 
                type="button"
                onClick={() => {
                    setSelectedRole(null);
                    resetStudentForm();
                }}
                className="w-full text-gray-500 hover:text-gray-800 text-sm py-2"
            >
                Retour
            </button>
        </div>
      </div>
  );

  return (
    <>
        {!selectedRole && renderRoleSelection()}
        {selectedRole === 'admin' && renderAdminForm()}
        {selectedRole === 'student' && renderStudentForm(false)}
        {selectedRole === 'parent' && renderStudentForm(true)}
        {selectedRole === 'tutor' && renderTutorForm()}
    </>
  );
};

export default LoginScreen;
