import React, { createContext, useContext, useState, ReactNode } from 'react';
import ConfirmModal from './ConfirmModal';

interface ConfirmContextType {
  confirm: (options: { title: string; message: string; isDestructive?: boolean; onConfirm: () => void; onCancel?: () => void }) => void;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    isDestructive: true,
    onConfirm: () => {},
    onCancel: undefined,
  });

  const confirm = ({ title, message, isDestructive = true, onConfirm, onCancel }: { title: string; message: string; isDestructive?: boolean; onConfirm: () => void; onCancel?: () => void }) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      isDestructive,
      onConfirm: () => {
        onConfirm();
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        if (onCancel) onCancel();
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCancel = () => {
    if (confirmState.onCancel) {
        confirmState.onCancel();
    } else {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
        onConfirm={confirmState.onConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
};
