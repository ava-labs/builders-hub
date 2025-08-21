'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';


export interface ProjectState {
  id: string | null;
  hackathonId: string | null;
  invitationId: string | null;
  isEditing: boolean;
  status: 'idle' | 'loading' | 'editing' | 'saving' | 'error';
  error: string | null;
  teamName: string;
  openJoinTeam: boolean;
  openCurrentProject: boolean;
  openInvalidInvitation: boolean;
}

export interface ProjectContextType {
  state: ProjectState;
  dispatch: React.Dispatch<ProjectAction>;
  actions: {
    initializeProject: (hackathonId: string, invitationId?: string) => Promise<void>;
    saveProject: (data: any) => Promise<boolean>;
    resetProject: () => void;
    setTeamName: (name: string) => void;
    setOpenJoinTeam: (open: boolean) => void;
    setOpenCurrentProject: (open: boolean) => void;
    setOpenInvalidInvitation: (open: boolean) => void;
  };
}

type ProjectAction =
  | { type: 'SET_PROJECT_ID'; payload: string }
  | { type: 'SET_HACKATHON_ID'; payload: string }
  | { type: 'SET_INVITATION_ID'; payload: string }
  | { type: 'SET_EDITING'; payload: boolean }
  | { type: 'SET_STATUS'; payload: ProjectState['status'] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' }
  | { type: 'SET_TEAM_NAME'; payload: string }
  | { type: 'SET_OPEN_JOIN_TEAM'; payload: boolean }
  | { type: 'SET_OPEN_CURRENT_PROJECT'; payload: boolean }
  | { type: 'SET_OPEN_INVALID_INVITATION'; payload: boolean };

const initialState: ProjectState = {
  id: null,
  hackathonId: null,
  invitationId: null,
  isEditing: false,
  status: 'idle',
  error: null,
  teamName: '',
  openJoinTeam: false,
  openCurrentProject: false,
  openInvalidInvitation: false,
};


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
    case 'SET_TEAM_NAME':
      return { ...state, teamName: action.payload };
    case 'SET_OPEN_JOIN_TEAM':
      return { ...state, openJoinTeam: action.payload };
    case 'SET_OPEN_CURRENT_PROJECT':
      return { ...state, openCurrentProject: action.payload };
    case 'SET_OPEN_INVALID_INVITATION':
      return { ...state, openInvalidInvitation: action.payload };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
}


const ProjectSubmissionContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectSubmissionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const hasInitialized = useRef(false);
  useEffect(() => {
    const hackathonId = searchParams.get('hackathon');
    const invitationId = searchParams.get('invitation');
    
    if (hackathonId && !state.hackathonId && session?.user?.id && !hasInitialized.current) {
      hasInitialized.current = true; 
      initializeProject(hackathonId, invitationId || undefined);
    }
  }, [searchParams, state.hackathonId, session?.user?.id]); 

  const initializeProject = useCallback(async (hackathonId: string, invitationId?: string) => {
    try {
      dispatch({ type: 'SET_STATUS', payload: 'loading' });
      dispatch({ type: 'SET_HACKATHON_ID', payload: hackathonId });
      
      if (invitationId) {
        dispatch({ type: 'SET_INVITATION_ID', payload: invitationId });
        const response = await axios.get(`/api/project/check-invitation`, {
          params: { invitation: invitationId, user_id: session?.user?.id }
        });
        
        if (response.data?.invitation?.exists) {
          const invitation = response.data.invitation;
          const project = response.data.project;
          dispatch({ type: 'SET_OPEN_JOIN_TEAM', payload: invitation.isConfirming ?? false });
          dispatch({ type: "SET_TEAM_NAME", payload: project.project_name || "" });
          dispatch({ type: 'SET_OPEN_CURRENT_PROJECT', payload: invitation.hasConfirmedProject ?? false });
          dispatch({ type: 'SET_EDITING', payload: true });
        } else {
          dispatch({ type: 'SET_OPEN_INVALID_INVITATION', payload: !response.data?.invitation?.isValid });
          dispatch({ type: 'SET_EDITING', payload: false });
        }
      } else {

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
      
  
      if (!state.hackathonId) {
        throw new Error('No hackathon selected');
      }
      
     
      const projectData = {
        ...data,
        hackaton_id: state.hackathonId, 
        user_id: session?.user?.id,
        id: state.id || undefined,
      };
      
      const response = await axios.post('/api/project', projectData);
      
      if (response.data?.project?.id) {
        dispatch({ type: 'SET_PROJECT_ID', payload: response.data.project.id });
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

  const setTeamName = useCallback((name: string) => {
    dispatch({ type: 'SET_TEAM_NAME', payload: name });
  }, []);

  const setOpenJoinTeam = useCallback((open: boolean) => {
    dispatch({ type: 'SET_OPEN_JOIN_TEAM', payload: open });
  }, []);

  const setOpenCurrentProject = useCallback((open: boolean) => {
    dispatch({ type: 'SET_OPEN_CURRENT_PROJECT', payload: open });
  }, []);

  const setOpenInvalidInvitation = useCallback((open: boolean) => {
    dispatch({ type: 'SET_OPEN_INVALID_INVITATION', payload: open });
  }, []);

  const contextValue: ProjectContextType = {
    state,
    dispatch, 
    actions: {
      initializeProject,
      saveProject,
      resetProject,
      setTeamName,
      setOpenJoinTeam,
      setOpenCurrentProject,
      setOpenInvalidInvitation,
    },
  };

  return (
    <ProjectSubmissionContext.Provider value={contextValue}>
      {children}
    </ProjectSubmissionContext.Provider>
  );
}

export function useProjectSubmission() {
  const context = useContext(ProjectSubmissionContext);
  if (context === undefined) {
    throw new Error('useProjectSubmission must be used within a ProjectSubmissionProvider');
  }
  return context;
} 