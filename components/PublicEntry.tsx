import React, { useState } from 'react';
import { AuthUser, StudentClass, InternshipDataStore, SubscriptionPlan, Subscriber } from '../types';
import LoginScreen from './LoginScreen';
import { getSubscribers, saveSubscribers } from '../services/saasService';
import { ArrowRight, CheckCircle, CreditCard, Mail, ShieldCheck, X } from 'lucide-react';

interface Props {
  classes: StudentClass[];
  onLogin: (user: AuthUser) => void;
  establishmentLogo?: string;
  internshipData: InternshipDataStore;
}

const PublicEntry: React.FC<Props> = (props) => {
    const [view, setView] = useState<'pricing' | 'login' | 'success'>(() => {
        const subscribers = getSubscribers();
        return subscribers.length > 0 ? 'login' : 'pricing';
    });
    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
    const [customerEmail, setCustomerEmail] = useState('');

    const handleSelectPlan = (plan: SubscriptionPlan) => {
        setSelectedPlan(plan);
        setCustomerEmail('');
        setCheckoutModalOpen(true);
    };

    const handleProcessPayment = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
            alert('Adresse e-mail invalide.');
            return;
        }

        const subscribers = getSubscribers();
        if (subscribers.some(s => s.email.toLowerCase() === customerEmail.toLowerCase())) {
            alert('Cet e-mail est déjà enregistré. Veuillez vous connecter.');
            setCheckoutModalOpen(false);
            setView('login');
            return;
        }

        const newSubscriber: Subscriber = {
            id: crypto.randomUUID(),
            name: customerEmail.split('@')[0], // a default name
            email: customerEmail,
            subscriptionPlan: selectedPlan!,
            status: 'active',
            createdAt: new Date().toISOString(),
        };

        saveSubscribers([...subscribers, newSubscriber]);
        
        setCheckoutModalOpen(false);
        setView('success');
    };

    const renderPricing = () => (
        <div className="w-full max-w-4xl mx-auto animate-in fade-in">
             <div className="text-center mb-10">
                <h2 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
                    Prêt à piloter votre classe ?
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
                    Choisissez le plan qui correspond à vos besoins.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <PricingCard
                    plan="Essentiel"
                    price="Gratuit"
                    features={['1 classe', '30 élèves', 'Fonctionnalités de base']}
                    onSelect={() => handleSelectPlan('Essentiel')}
                />
                 <PricingCard
                    plan="Premium"
                    price="19.99€"
                    period="/ mois"
                    features={['5 classes', '150 élèves', 'IA avancée', 'Export PDF']}
                    onSelect={() => handleSelectPlan('Premium')}
                    isPopular
                />
                 <PricingCard
                    plan="Pro"
                    price="29.99€"
                    period="/ mois"
                    features={['Classes illimitées', 'Support prioritaire', 'Accès anticipé']}
                    onSelect={() => handleSelectPlan('Pro')}
                />
            </div>
            <div className="text-center mt-10">
                <button onClick={() => setView('login')} className="text-indigo-600 hover:underline font-semibold">
                    Déjà un compte ? Se connecter
                </button>
            </div>
        </div>
    );
    
    const renderCheckoutModal = () => (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md relative">
                <button onClick={() => setCheckoutModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X/></button>
                <div className="p-8">
                    <h3 className="text-2xl font-bold text-center mb-2">Finaliser l'abonnement</h3>
                    <p className="text-center text-gray-500 mb-6">Plan <span className="font-bold text-indigo-600">{selectedPlan}</span></p>
                    
                    <form onSubmit={handleProcessPayment} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse e-mail</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                <input 
                                    type="email" 
                                    value={customerEmail}
                                    onChange={e => setCustomerEmail(e.target.value)}
                                    placeholder="vous@ecole.fr"
                                    className="w-full p-3 pl-9 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Informations de paiement (Simulation)</label>
                             <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg flex items-center gap-3">
                                <CreditCard className="text-gray-400"/>
                                <span className="font-mono text-gray-700 flex-1">4242 4242 4242 4242</span>
                                <span className="font-mono text-gray-500">12/25</span>
                                <span className="font-mono text-gray-500">123</span>
                             </div>
                        </div>

                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2">
                            Payer (Mode Test) <ArrowRight size={18}/>
                        </button>
                    </form>
                </div>
                <div className="bg-gray-50 p-4 text-center text-xs text-gray-500 rounded-b-xl border-t">
                    <ShieldCheck size={14} className="inline-block mr-1 mb-0.5"/> Paiement sécurisé (Simulation). Aucune transaction réelle.
                </div>
            </div>
        </div>
    );

    const renderSuccess = () => (
         <div className="w-full max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-200 text-center animate-in fade-in zoom-in-95">
             <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
             <h2 className="text-2xl font-bold text-gray-800">Inscription réussie !</h2>
             <p className="text-gray-600 mt-2">Votre compte a été créé. Vous pouvez maintenant vous connecter.</p>

             <div className="text-left bg-gray-50 p-4 rounded-lg my-6 border border-gray-200 space-y-2">
                 <p className="font-semibold text-gray-800">Vos identifiants :</p>
                 <p><strong className="w-24 inline-block">Identifiant:</strong> <span className="font-mono text-indigo-700">{customerEmail}</span></p>
                 <p><strong className="w-24 inline-block">Code PIN:</strong> <span className="font-mono text-indigo-700">1234</span></p>
             </div>

             <button 
                onClick={() => setView('login')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors"
            >
                Accéder à la connexion
            </button>
         </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="mb-8 text-center">
                {props.establishmentLogo ? (
                    <img src={props.establishmentLogo} alt="Logo" className="h-24 w-auto mx-auto mb-4 object-contain" />
                ) : (
                    <div className="h-20 w-20 bg-indigo-900 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
                        <span className="text-3xl font-bold text-white">CP</span>
                    </div>
                )}
                <h1 className="text-3xl font-bold text-gray-900">ClassPro<span className="text-indigo-600">Pilot</span></h1>
                <p className="text-gray-500">Plateforme de suivi pédagogique</p>
            </div>
            
            {view === 'pricing' && renderPricing()}
            {view === 'login' && <LoginScreen {...props} onSwitchToRegister={() => setView('pricing')} />}
            {view === 'success' && renderSuccess()}
            
            {isCheckoutModalOpen && renderCheckoutModal()}

            <div className="mt-12 text-center text-xs text-gray-400">
                <p>© 2024 ClassProPilot</p>
            </div>
        </div>
    );
};

const PricingCard: React.FC<{ plan: string, price: string, period?: string, features: string[], onSelect: () => void, isPopular?: boolean }> = ({ plan, price, period, features, onSelect, isPopular }) => (
    <div className={`border rounded-2xl p-8 flex flex-col ${isPopular ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-gray-200'}`}>
        {isPopular && <span className="bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full self-center mb-4 -mt-12">POPULAIRE</span>}
        <h3 className="text-2xl font-bold text-center">{plan}</h3>
        <p className="text-center mt-4">
            <span className="text-4xl font-extrabold">{price}</span>
            {period && <span className="text-gray-500">{period}</span>}
        </p>
        <ul className="mt-6 space-y-4 text-gray-600">
            {features.map(f => (
                <li key={f} className="flex items-center gap-3">
                    <CheckCircle className="text-emerald-500" size={20} />
                    {f}
                </li>
            ))}
        </ul>
        <button 
            onClick={onSelect}
            className={`mt-8 w-full py-3 rounded-lg font-bold text-lg transition-colors ${isPopular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
        >
            Choisir ce plan
        </button>
    </div>
);


export default PublicEntry;
