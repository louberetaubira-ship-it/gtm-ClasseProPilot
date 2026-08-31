import { Subscriber } from '../types';

const SUBSCRIBERS_KEY = 'classpropilot-saas-subscribers';

export const getSubscribers = (): Subscriber[] => {
    try {
        const saved = localStorage.getItem(SUBSCRIBERS_KEY);
        if (saved) {
            const subscribers = JSON.parse(saved);
            return Array.isArray(subscribers) ? subscribers : [];
        }
    } catch (error) {
        console.error("Error reading subscribers from localStorage", error);
    }
    return [];
};

export const saveSubscribers = (subscribers: Subscriber[]): void => {
    try {
        localStorage.setItem(SUBSCRIBERS_KEY, JSON.stringify(subscribers));
    } catch (error) {
        console.error("Error saving subscribers to localStorage", error);
        alert("Erreur lors de la sauvegarde des abonnés.");
    }
};

export const deleteSubscriberData = (subscriberId: string): void => {
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`${subscriberId}-`)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`Removed ${keysToRemove.length} data entries for subscriber ${subscriberId}`);
    } catch (error) {
        console.error(`Error deleting data for subscriber ${subscriberId}`, error);
    }
};
