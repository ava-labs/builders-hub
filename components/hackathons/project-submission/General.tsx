// import { useState, useEffect } from 'react';
// import { ProjectMemberWarningDialog } from './components/ProjectMemberWarningDialog';
// import { getInvitation } from '@/lib/actions/invitation';
// import { getHackathonProject } from '@/lib/actions/hackathon';

// interface GeneralProps {
//   searchParams: {
//     invitationId?: string;
//   };
// }

// export default function General({ searchParams }: GeneralProps) {
//   const { invitationId } = searchParams;
//   const [showWarningDialog, setShowWarningDialog] = useState(false);
//   const [currentProjectName, setCurrentProjectName] = useState('');

//   useEffect(() => {
//     const checkInvitation = async () => {
//       if (invitationId) {
//         try {
//           const invitation = await getInvitation(invitationId);
//           if (invitation) {
//             const currentProject = await getHackathonProject(invitation.projectId);
//             if (currentProject) {
//               setCurrentProjectName(currentProject.name);
//               setShowWarningDialog(true);
//             }
//           }
//         } catch (error) {
//           console.error('Error checking invitation:', error);
//         }
//       }
//     };

//     checkInvitation();
//   }, [invitationId]);

//   return (
//     <>
//       <ProjectMemberWarningDialog
//         open={showWarningDialog}
//         onOpenChange={setShowWarningDialog}
//         projectName={currentProjectName}
//       />
//     </>
//   );
// } 