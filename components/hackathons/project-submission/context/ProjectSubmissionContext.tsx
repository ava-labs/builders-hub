'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

// Types simplificados sin ownership
export interface ProjectState {
  id: string | null;
  hackathonId: string | null;
  invitationId: string | null;
  isEditing: boolean;
  status: 'idle' | 'loading' | 'editing' | 'saving' | 'error';
  error: string | null;
}

export interface ProjectContextType {
  state: ProjectState;
  actions: {
    initializeProject: (hackathonId: string, invitationId?: string) => Promise<void>;
    saveProject: (data: any) => Promise<boolean>;
    resetProject: () => void;
  };
}

// Action Types simplificados sin ownership
type ProjectAction =
  | { type: 'SET_PROJECT_ID'; payload: string }
  | { type: 'SET_HACKATHON_ID'; payload: string }
  | { type: 'SET_INVITATION_ID'; payload: string }
  | { type: 'SET_EDITING'; payload: boolean }
  | { type: 'SET_STATUS'; payload: ProjectState['status'] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' };

// Initial State simplificado sin ownership
const initialState: ProjectState = {
  id: null,
  hackathonId: null,
  invitationId: null,
  isEditing: false,
  status: 'idle',
  error: null,
};

// Reducer simplificado sin ownership
function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_PROJECT_ID':
      return { ...state, id: action.payload };
    case 'SET_HACKATHON_ID':
      return { ...state, hackathonId: action.payload };
    case 'SET_INVITATION_ID':
      return { ...state, invitationId: action.payload };
    case 'SET_EDITING':
      return { ...state, isEditing: action.payload };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
}

// Context
const ProjectSubmissionContext = createContext<ProjectContextType | undefined>(undefined);

// Provider Component simplificado sin ownership
export function ProjectSubmissionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Auto-initialize cuando el componente se monta
  useEffect(() => {
    const hackathonId = searchParams.get('hackathon');
    const invitationId = searchParams.get('invitation');
    
    if (hackathonId && !state.hackathonId) {
      initializeProject(hackathonId, invitationId || undefined);
    }
  }, [searchParams, state.hackathonId]);

  const initializeProject = useCallback(async (hackathonId: string, invitationId?: string) => {
    try {
      dispatch({ type: 'SET_STATUS', payload: 'loading' });
      dispatch({ type: 'SET_HACKATHON_ID', payload: hackathonId });
      
      if (invitationId) {
        dispatch({ type: 'SET_INVITATION_ID', payload: invitationId });
        
        // Validar invitación y obtener proyecto (sin validación de ownership)
        const response = await axios.get(`/api/project/check-invitation`, {
          params: { invitation: invitationId, user_id: session?.user?.id }
        });
        
        if (response.data?.invitation?.exists && response.data?.project) {
          const project = response.data.project;
          
          // No validar ownership - solo establecer el proyecto
          dispatch({ type: 'SET_PROJECT_ID', payload: project.project_id });
          dispatch({ type: 'SET_EDITING', payload: true });
        }
      } else {
        // Nuevo proyecto
        dispatch({ type: 'SET_EDITING', payload: true });
      }
      
      dispatch({ type: 'SET_STATUS', payload: 'editing' });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      dispatch({ type: 'SET_STATUS', payload: 'error' });
      
      toast({
        title: 'Error initializing project',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [session?.user?.id, toast]);

  const saveProject = useCallback(async (data: any): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_STATUS', payload: 'saving' });
      
      // Validar estado básico
      if (!state.hackathonId) {
        throw new Error('No hackathon selected');
      }
      
      // Preparar datos para API
      const projectData = {
        ...data,
        hackathon_id: state.hackathonId,
        user_id: session?.user?.id,
        id: state.id || undefined,
      };
      
      const response = await axios.post('/api/project', projectData);
      
      if (response.data?.id) {
        dispatch({ type: 'SET_PROJECT_ID', payload: response.data.id });
        dispatch({ type: 'SET_STATUS', payload: 'editing' });
        
        toast({
          title: 'Project saved successfully',
          description: 'Your project has been saved.',
        });
        
        return true;
      }
      
      return false;
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      dispatch({ type: 'SET_STATUS', payload: 'error' });
      
      toast({
        title: 'Error saving project',
        description: error.message,
        variant: 'destructive',
      });
      
      return false;
    }
  }, [state.hackathonId, state.id, session?.user?.id, toast]);

  const resetProject = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, []);

  const contextValue: ProjectContextType = {
    state,
    actions: {
      initializeProject,
      saveProject,
      resetProject,
    },
  };

  return (
    <ProjectSubmissionContext.Provider value={contextValue}>
      {children}
    </ProjectSubmissionContext.Provider>
  );
}

// Custom Hook
export function useProjectSubmission() {
  const context = useContext(ProjectSubmissionContext);
  if (context === undefined) {
    throw new Error('useProjectSubmission must be used within a ProjectSubmissionProvider');
  }
  return context;
} 