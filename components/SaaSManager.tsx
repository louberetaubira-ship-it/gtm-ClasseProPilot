

import React, { useState, useEffect, useRef } from 'react';
import { Subscriber, SubscriptionPlan } from '../types';
import { getSubscribers, saveSubscribers, deleteSubscriberData } from '../services/saasService';
import { Users, Plus, Edit, Trash2, LogIn, X, CheckCircle, XCircle, LogOut, LayoutDashboard, Settings, BarChart3, Database, CreditCard, BrainCircuit, Loader2, Users2, FileArchive, Share2, Smartphone, Bot } from 'lucide-react';
import { useConfirm } from './ConfirmContext';

interface Props {
    onImpersonate: (subscriber: Subscriber) => void;
    onLogout: () => void;
}

type SaaSView = 'dashboard' | 'clients' | 'settings';

const SaaSManager: React.FC<Props> = ({ onImpersonate, onLogout }) => {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
    const [view, setView] = useState<SaaSView>('dashboard');
    const { confirm } = useConfirm();

    useEffect(() => {
        setSubscribers(getSubscribers());
    }, []);

    const handleOpenModal = (subscriber: Subscriber | null = null) => {
        setEditingSubscriber(subscriber);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSubscriber(null);
    };

    const handleSaveSubscriber = (subscriberData: Omit<Subscriber, 'id' | 'createdAt'>) => {
        let updatedSubscribers;
        if (editingSubscriber) {
            updatedSubscribers = subscribers.map(s => s.id === editingSubscriber.id ? { ...editingSubscriber, ...subscriberData } : s);
        } else {
            const newSubscriber: Subscriber = {
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                ...subscriberData,
            };
            updatedSubscribers = [...subscribers, newSubscriber];
        }
        setSubscribers(updatedSubscribers);
        saveSubscribers(updatedSubscribers);
        handleCloseModal();
    };
    
    const handleDeleteSubscriber = (id: string) => {
        const sub = subscribers.find(s => s.id === id);
        if (sub) {
            confirm({
                title: "Supprimer l'abonné",
                message: `⚠️ ATTENTION\n\nVous allez supprimer l'abonné "${sub.name}" et TOUTES ses données (classes, élèves, TPs, etc.).\n\nCette action est irréversible. Continuer ?`,
                isDestructive: true,
                onConfirm: () => {
                    const updatedSubscribers = subscribers.filter(s => s.id !== id);
                    setSubscribers(updatedSubscribers);
                    saveSubscribers(updatedSubscribers);
                    deleteSubscriberData(id);
                }
            });
        }
    };

    const toggleStatus = (id: string) => {
        const updatedSubscribers = subscribers.map((s): Subscriber => s.id === id ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s);
        setSubscribers(updatedSubscribers);
        saveSubscribers(updatedSubscribers);
    };

    const stats = {
        total: subscribers.length,
        active: subscribers.filter(s => s.status === 'active').length,
        premium: subscribers.filter(s => s.subscriptionPlan === 'Premium').length,
        pro: subscribers.filter(s => s.subscriptionPlan === 'Pro').length,
    };

    const NavItem: React.FC<{ viewName: SaaSView; label: string; icon: React.ReactNode }> = ({ viewName, label, icon }) => (
        <button
            onClick={() => setView(viewName)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                view === viewName ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
        >
            {icon}
            {label}
        </button>
    );

    const renderContent = () => {
        switch (view) {
            case 'dashboard':
                return <DashboardView stats={stats} />;
            case 'clients':
                return <ClientsView 
                          subscribers={subscribers}
                          onAdd={() => handleOpenModal()}
                          onEdit={handleOpenModal}
                          onDelete={handleDeleteSubscriber}
                          onImpersonate={onImpersonate}
                          onToggleStatus={toggleStatus}
                       />;
            case 'settings':
                return <SettingsView />;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-800 text-white flex-shrink-0 flex flex-col">
                <div className="p-6 border-b border-slate-700">
                    <h1 className="text-2xl font-bold tracking-tight">SaaS<span className="text-indigo-400">Panel</span></h1>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <NavItem viewName="dashboard" label="Tableau de bord" icon={<LayoutDashboard size={20}/>} />
                    <NavItem viewName="clients" label="Clients" icon={<Users size={20}/>} />
                    <NavItem viewName="settings" label="Paramètres" icon={<Settings size={20}/>} />
                </nav>
                <div className="p-4 border-t border-slate-700">
                     <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors text-slate-300 hover:bg-slate-700/50 hover:text-white">
                        <LogOut size={20}/> Déconnexion
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                {renderContent()}
            </main>

            {isModalOpen && (
                <SubscriberModal 
                    subscriber={editingSubscriber} 
                    onClose={handleCloseModal} 
                    onSave={handleSaveSubscriber} 
                />
            )}
        </div>
    );
};

// --- Views ---

const DashboardView: React.FC<{ stats: { total: number; active: number; premium: number; pro: number } }> = ({ stats }) => (
    <div className="animate-in fade-in">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Tableau de bord</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard title="Abonnés Actifs" value={stats.active} icon={<CheckCircle className="text-emerald-500"/>} />
            <MetricCard title="Total Abonnés" value={stats.total} icon={<Users className="text-blue-500"/>} />
            <MetricCard title="Plans Premium" value={stats.premium} icon={<BarChart3 className="text-amber-500"/>} />
            <MetricCard title="Plans Pro" value={stats.pro} icon={<BarChart3 className="text-violet-500"/>} />
        </div>
    </div>
);

const ClientsView: React.FC<{ 
    subscribers: Subscriber[],
    onAdd: () => void,
    onEdit: (sub: Subscriber) => void,
    onDelete: (id: string) => void,
    onImpersonate: (sub: Subscriber) => void,
    onToggleStatus: (id: string) => void,
}> = ({ subscribers, onAdd, onEdit, onDelete, onImpersonate, onToggleStatus }) => (
     <div className="animate-in fade-in">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Clients</h2>
            <button onClick={onAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 shadow-sm transition-colors font-bold">
                <Plus size={18} /> Ajouter un abonné
            </button>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
                    <tr>
                        <th className="px-6 py-4 font-semibold">Nom</th>
                        <th className="px-6 py-4 font-semibold">Email</th>
                        <th className="px-6 py-4 font-semibold">Plan</th>
                        <th className="px-6 py-4 font-semibold text-center">Statut</th>
                        <th className="px-6 py-4 font-semibold">Date de création</th>
                        <th className="px-6 py-4 font-semibold text-center">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {subscribers.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-12 text-gray-500">Aucun abonné.</td></tr>
                    )}
                    {subscribers.map(sub => (
                        <tr key={sub.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-bold text-gray-900">{sub.name}</td>
                            <td className="px-6 py-4 text-gray-600">{sub.email}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                    sub.subscriptionPlan === 'Premium' ? 'bg-amber-100 text-amber-800' :
                                    sub.subscriptionPlan === 'Pro' ? 'bg-violet-100 text-violet-800' :
                                    'bg-blue-100 text-blue-800'}`}>
                                    {sub.subscriptionPlan}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <button onClick={() => onToggleStatus(sub.id)} className={`flex items-center gap-1.5 justify-center w-full max-w-[100px] mx-auto px-2 py-1 rounded-full text-xs font-bold transition-colors ${sub.status === 'active' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}>
                                    {sub.status === 'active' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                    {sub.status === 'active' ? 'Actif' : 'Suspendu'}
                                </button>
                            </td>
                            <td className="px-6 py-4 text-gray-500">{new Date(sub.createdAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => onImpersonate(sub)} className="text-blue-600 hover:text-blue-800 p-2 rounded-md hover:bg-blue-50" title="Gérer (Se connecter en tant que)"><LogIn size={16} /></button>
                                    <button onClick={() => onEdit(sub)} className="text-gray-500 hover:text-gray-800 p-2 rounded-md hover:bg-gray-100" title="Modifier"><Edit size={16} /></button>
                                    <button onClick={() => onDelete(sub.id)} className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50" title="Supprimer"><Trash2 size={16} /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const SETTINGS_KEY = 'classpropilot-saas-settings';

interface SaaSSettings {
    stripePublicKey: string;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
    geminiApiKey: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
}

const SettingsView: React.FC = () => {
    const [settings, setSettings] = useState<SaaSSettings>(() => {
        try {
            const saved = localStorage.getItem(SETTINGS_KEY);
            const defaults = { stripePublicKey: '', stripeSecretKey: '', stripeWebhookSecret: '', geminiApiKey: '', supabaseUrl: '', supabaseAnonKey: '' };
            return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        } catch {
            return { stripePublicKey: '', stripeSecretKey: '', stripeWebhookSecret: '', geminiApiKey: '', supabaseUrl: '', supabaseAnonKey: '' };
        }
    });

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
    }, []);

    useEffect(() => {
        if (saveStatus === 'saving') {
            try {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
                setSaveStatus('saved');
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = window.setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (error) {
                console.error("Failed to save SaaS settings:", error);
                alert("Erreur lors de la sauvegarde des paramètres.");
                setSaveStatus('idle');
            }
        }
    }, [settings, saveStatus]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const triggerSave = () => {
        if (saveStatus !== 'saving') {
             setSaveStatus('saving');
        }
    };

    const isStripeConfigured = settings.stripePublicKey && settings.stripeSecretKey;
    const isSupabaseConfigured = settings.supabaseUrl && settings.supabaseAnonKey;
    const isGeminiConfigured = !!settings.geminiApiKey;

    const supabaseFeatures = [
        { icon: <Database size={18} className="text-emerald-600"/>, text: "Base de données PostgreSQL" },
        { icon: <Users2 size={18} className="text-emerald-600"/>, text: "Authentification des utilisateurs" },
        { icon: <FileArchive size={18} className="text-emerald-600"/>, text: "Stockage de fichiers (images, PDF)" },
        { icon: <Share2 size={18} className="text-emerald-600"/>, text: "APIs automatiques (REST & GraphQL)" },
        { icon: <Smartphone size={18} className="text-emerald-600"/>, text: "Connexion facile pour web et mobiles" },
        { icon: <Bot size={18} className="text-emerald-600"/>, text: "Intégration avec Google AI Studio" }
    ];

    return (
        <div className="animate-in fade-in max-w-3xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold text-gray-900">Paramètres</h2>
            
            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1 flex items-center gap-3">
                           <CreditCard className="text-indigo-500" />
                           Intégration Paiement (Stripe)
                        </h3>
                        <p className="text-sm text-gray-500">Connectez votre compte Stripe pour gérer les abonnements.</p>
                    </div>
                    <div className={`flex items-center gap-2 text-xs font-bold px-2 py-1 rounded-full ${isStripeConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${isStripeConfigured ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                        {isStripeConfigured ? 'Connecté' : 'Non configuré'}
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Clé API Publique Stripe</label>
                        <input 
                            type="password"
                            name="stripePublicKey"
                            value={settings.stripePublicKey}
                            onChange={handleInputChange}
                            onBlur={triggerSave}
                            placeholder="pk_live_************************"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                            title="Votre clé publique Stripe, trouvable dans votre tableau de bord Stripe."
                        />
                    </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Clé API Secrète Stripe</label>
                        <input 
                            type="password"
                            name="stripeSecretKey"
                            value={settings.stripeSecretKey}
                            onChange={handleInputChange}
                            onBlur={triggerSave}
                            placeholder="sk_live_************************"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                            title="Votre clé secrète Stripe, à ne jamais partager publiquement."
                        />
                    </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Secret Webhook Stripe</label>
                        <input 
                            type="password"
                            name="stripeWebhookSecret"
                            value={settings.stripeWebhookSecret}
                            onChange={handleInputChange}
                            onBlur={triggerSave}
                            placeholder="whsec_************************"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                            title="Le secret de signature pour sécuriser vos webhooks Stripe."
                        />
                    </div>
                </div>
                 <div className="mt-6 flex justify-end">
                    <button onClick={() => alert('Fonctionnalité de test non implémentée.')} className="text-sm font-semibold bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                        Tester la connexion
                    </button>
                </div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1 flex items-center gap-3">
                           <Database className="text-emerald-500" /> Intégration Supabase
                        </h3>
                        <p className="text-sm text-gray-500">Connectez votre projet Supabase pour profiter d'un backend complet.</p>
                    </div>
                    <div className={`flex items-center gap-2 text-xs font-bold px-2 py-1 rounded-full ${isSupabaseConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                        {isSupabaseConfigured ? 'Connecté' : 'Non configuré'}
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6 bg-gray-50 p-4 rounded-lg border">
                    {supabaseFeatures.map(feature => (
                        <div key={feature.text} className="flex items-center gap-3">
                            {feature.icon}
                            <span className="text-sm text-gray-700">{feature.text}</span>
                        </div>
                    ))}
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL du Projet Supabase</label>
                        <input
                            type="password"
                            name="supabaseUrl"
                            value={settings.supabaseUrl}
                            onChange={handleInputChange}
                            onBlur={triggerSave}
                            placeholder="https://<project-ref>.supabase.co"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                            title="L'URL de votre projet, trouvable dans les paramètres API de Supabase."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Clé Publique (Anon) Supabase</label>
                        <input
                            type="password"
                            name="supabaseAnonKey"
                            value={settings.supabaseAnonKey}
                            onChange={handleInputChange}
                            onBlur={triggerSave}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                            title="La clé 'anon' (publique) de votre projet Supabase."
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={() => alert('Fonctionnalité de test non implémentée.')} className="text-sm font-semibold bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                        Tester la connexion
                    </button>
                </div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1 flex items-center gap-3">
                            <BrainCircuit className="text-rose-500"/>
                            Intégration IA Externe
                        </h3>
                        <p className="text-sm text-gray-500">Utilisez une clé API externe pour les fonctionnalités d'IA si nécessaire.</p>
                    </div>
                    <div className={`flex items-center gap-2 text-xs font-bold px-2 py-1 rounded-full ${isGeminiConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${isGeminiConfigured ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                        {isGeminiConfigured ? 'Configurée' : 'Non configurée'}
                    </div>
                </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Clé API Google Gemini</label>
                    <input 
                        type="password"
                        name="geminiApiKey"
                        value={settings.geminiApiKey}
                        onChange={handleInputChange}
                        onBlur={triggerSave}
                        placeholder="AIzaSy************************"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                        title="Votre clé API personnelle pour Google AI Studio (Gemini)."
                    />
                </div>
            </div>

            <div className="flex justify-end items-center h-6">
                {saveStatus === 'saving' && (
                    <span className="text-sm font-semibold text-gray-500 flex items-center gap-2 animate-pulse">
                        <Loader2 size={16} className="animate-spin"/> Sauvegarde...
                    </span>
                )}
                {saveStatus === 'saved' && (
                     <span className="text-sm font-semibold text-emerald-600 flex items-center gap-2 animate-in fade-in">
                        <CheckCircle size={16}/> Enregistré
                    </span>
                )}
            </div>
        </div>
    );
};


// --- Components ---

const MetricCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex items-center gap-6">
        <div className="p-4 bg-gray-100 rounded-full">
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
    </div>
);

const SubscriberModal: React.FC<{
    subscriber: Subscriber | null;
    onClose: () => void;
    onSave: (data: Omit<Subscriber, 'id' | 'createdAt'>) => void;
}> = ({ subscriber, onClose, onSave }) => {
    const [name, setName] = useState(subscriber?.name || '');
    const [email, setEmail] = useState(subscriber?.email || '');
    const [plan, setPlan] = useState<SubscriptionPlan>(subscriber?.subscriptionPlan || 'Essentiel');
    const [status, setStatus] = useState<'active' | 'inactive'>(subscriber?.status || 'active');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !email.trim()) {
            alert("Le nom et l'email sont obligatoires.");
            return;
        }
        onSave({ name, email, subscriptionPlan: plan, status });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h3 className="font-bold text-lg text-gray-800">{subscriber ? 'Modifier' : 'Nouvel'} abonné</h3>
                    <button type="button" onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-100"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email (Identifiant)</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Formule</label>
                            <select value={plan} onChange={e => setPlan(e.target.value as SubscriptionPlan)} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                                <option value="Essentiel">Essentiel</option>
                                <option value="Premium">Premium</option>
                                <option value="Pro">Pro</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                            <select value={status} onChange={e => setStatus(e.target.value as 'active' | 'inactive')} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                                <option value="active">Actif</option>
                                <option value="inactive">Suspendu</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end items-center gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-md text-sm font-bold">Annuler</button>
                    <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 text-sm">
                        Enregistrer
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SaaSManager;