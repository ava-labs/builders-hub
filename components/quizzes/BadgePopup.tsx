"use client";
import React from 'react';
import { X, Award, Star } from 'lucide-react';
import { cn } from '@/utils/cn';

interface BadgePopupProps {
  isOpen: boolean;
  onClose: () => void;
  badges: Array<{
    name: string;
    image_path: string;
    completed_requirement?: {
      description?: string;
    };
  }>;
  courseName: string;
}

export const BadgePopup: React.FC<BadgePopupProps> = ({
  isOpen,
  onClose,
  badges,
  courseName
}) => {
  if (!isOpen || badges.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center justify-center mb-4">
            <div className="bg-white/20 rounded-full p-3">
              <Award className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            🎉 Congratulations!
          </h2>
          <p className="text-white/90 text-lg">
            You've earned a new badge!
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              Course Completed: {courseName}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              You've successfully completed all quizzes and earned your badge!
            </p>
          </div>

          {/* Badge Display */}
          <div className="space-y-4">
            {badges.map((badge, index) => (
              <div key={index} className="flex items-center p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                <div className="flex-shrink-0 mr-4">
                  <img 
                    src={badge.image_path} 
                    alt={badge.name}
                    className="w-16 h-16 object-contain"
                    onError={(e) => {
                      // Fallback to a default badge icon if image fails to load
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center hidden">
                    <Star className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800 dark:text-white text-lg">
                    {badge.name}
                  </h4>
                  {badge.completed_requirement?.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {badge.completed_requirement.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className={cn(
                "flex-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-semibold py-3 px-6 rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all duration-200 transform hover:scale-105"
              )}
            >
              Awesome! 🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
