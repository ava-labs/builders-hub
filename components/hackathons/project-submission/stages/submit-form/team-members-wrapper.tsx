import React from 'react'
import MembersComponent from '../../components/Members'
import { Track } from '@/types/hackathons'
import { useProjectSubmission } from '../../context/ProjectSubmissionContext'
import { useHackathonProject } from '../../hooks/useHackathonProject'
import { useSubmissionFormSecure } from '../../hooks/useSubmissionFormSecure'

type Props = {
  projectId: string
  hackathonId: string
  userId: string
  teamName: string
  stage: number
  userEmail: string
  userName: string
  availableTracks: Track[]
}

export default function TeamMembersWrapper({ hackathonId, projectId, teamName, userId, stage, userEmail, userName, availableTracks }: Props): React.JSX.Element {
  const { state: projectState, dispatch } = useProjectSubmission();
  const invitationLink = ''
  const { hackathon, project, timeLeft, getProject } = useHackathonProject(
    hackathonId as string,
    invitationLink as string
  );
  const { handleSaveWithoutRoute } = useSubmissionFormSecure();

  const openCurrentProject = projectState.openCurrentProject;
  const openJoinTeamDialog = projectState.openJoinTeam;


  return (
    <MembersComponent
      project_id={projectId}
      hackaton_id={hackathonId}
      user_id={userId}
      teamName={teamName}
      invite_stage={stage}
      openCurrentProject={openCurrentProject}
      setOpenCurrentProject={(open) =>
        dispatch({
          type: "SET_OPEN_CURRENT_PROJECT",
          payload: open,
        })
      }
      openjoinTeamDialog={openJoinTeamDialog}
      onOpenChange={(open) =>
        dispatch({ type: "SET_OPEN_JOIN_TEAM", payload: open })
      }
      currentEmail={userEmail}
      currentUserName={userName}
      onProjectCreated={getProject}
      onHandleSave={async () => {
        await handleSaveWithoutRoute();
      }}
      availableTracks={availableTracks}
    />
  )
}