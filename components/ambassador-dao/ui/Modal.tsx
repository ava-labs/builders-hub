"use client";

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
  showCloseButton?: boolean;
  closeOnOutsideClick?: boolean;
  closeOnEsc?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-3xl",
  showCloseButton = true,
  closeOnOutsideClick = true,
  closeOnEsc = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose, closeOnEsc]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOutsideClick && modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className={`bg-[#111] border border-[#2F2F33] rounded-lg ${maxWidth} w-full max-h-[90vh] overflow-y-auto`}
        aria-modal="true"
        role="dialog"
      >
        {(title || showCloseButton) && (
          <div className="p-6">
            <div className="flex justify-between items-center">
              {title && (
                <div>
                  <h2 className="text-2xl font-bold text-white">{title}</h2>
                  {description && <p className="text-gray-400">{description}</p>}
                </div>
              )}
              {showCloseButton && (
                <button 
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition"
                  aria-label="Close modal"
                >
                  <X size={24} color="#fff" />
                </button>
              )}
            </div>
            {(title || showCloseButton) && <hr className="border-[#2F2F33] my-4" />}
          </div>
        )}
        <div className={!title && !showCloseButton ? "p-6" : ""}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;