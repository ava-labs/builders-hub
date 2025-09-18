'use client';

import { useState, useEffect } from 'react';

interface ModalState {
    isOpen: boolean;
    options: any;
    resolve: ((result: any) => void) | null;
    reject: ((error: Error) => void) | null;
}

// Global state for modals
let globalModalState: ModalState = {
    isOpen: false,
    options: null,
    resolve: null,
    reject: null,
};

// Listeners for modal state changes
const modalStateListeners = new Set<() => void>();

const notifyModalStateChange = () => {
    modalStateListeners.forEach(listener => listener());
};

// Hook for components that need to trigger modals
export function useModalTrigger<T>() {
    const openModal = async (options?: any): Promise<T> => {
        return new Promise<T>((resolve, reject) => {
            globalModalState = {
                isOpen: true,
                options: options || null,
                resolve,
                reject,
            };
            notifyModalStateChange();
        });
    };

    return {
        openModal
    };
}

// Hook for modal components to manage state
export function useModalState() {
    const [, forceUpdate] = useState({});
    
    // Subscribe to modal state changes
    useEffect(() => {
        const listener = () => forceUpdate({});
        modalStateListeners.add(listener);
        return () => {
            modalStateListeners.delete(listener);
        };
    }, []);

    const closeModal = (result: any = { success: false }) => {
        if (globalModalState.resolve) {
            globalModalState.resolve(result);
        }
        globalModalState = {
            isOpen: false,
            options: null,
            resolve: null,
            reject: null,
        };
        notifyModalStateChange();
    };

    const rejectModal = (error: Error) => {
        if (globalModalState.reject) {
            globalModalState.reject(error);
        }
        globalModalState = {
            isOpen: false,
            options: null,
            resolve: null,
            reject: null,
        };
        notifyModalStateChange();
    };

    return {
        isOpen: globalModalState.isOpen,
        options: globalModalState.options,
        closeModal,
        rejectModal,
    };
}
