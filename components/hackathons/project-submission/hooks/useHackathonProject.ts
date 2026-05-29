import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { HackathonHeader } from '@/types/hackathons';
import { useCountdown } from './Count-down';



export type SubmissionWindowStatus = "not_yet_open" | "open" | "closed";

export const useHackathonProject = (hackathonId: string,invitationid:string) => {
  const { data: session } = useSession();
  const [hackathon, setHackathon] = useState<HackathonHeader | null>(null);
  const [project, setProject] = useState<any>(null);

  const [deadline, setDeadline] = useState<number>(
    new Date().getTime() + 12 * 60 * 60 * 1000
  );
  const [submissionOpenAt, setSubmissionOpenAt] = useState<number>(0);
  const [loadData, setLoadData] = useState<boolean>(true);
  const timeLeft = useCountdown(deadline);
  const openCountdown = useCountdown(submissionOpenAt);

  const submissionStatus: SubmissionWindowStatus = (() => {
    const now = Date.now();
    if (submissionOpenAt && now < submissionOpenAt) return "not_yet_open";
    if (deadline && now > deadline) return "closed";
    return "open";
  })();

  const getHackathon = async () => {
    if (!hackathonId) return;
    try {
      const response = await axios.get(`/api/events/${hackathonId}`);
      setHackathon(response.data);
      if (response.data?.content?.submission_deadline) {
        setDeadline(new Date(response.data.content.submission_deadline).getTime());
      }
      if (response.data?.content?.submission_open) {
        const openMs = new Date(response.data.content.submission_open).getTime();
        if (Number.isFinite(openMs)) {
          setSubmissionOpenAt(openMs);
        }
      }
    } catch (err) {
      console.error("API Error:", err);
    }
  };

  const getProject = async () => {
    try {
      const response = await axios.get(`/api/project`, {
        params: {
          hackathon_id: hackathonId,        
          user_id: session?.user?.id,       
          invitation_id: invitationid,      
        },
      });
      if (response.data.project) {
        setProject(response.data.project);  
      }
    } catch (err) {
      console.error("Error fetching project:", err);
    }
  };

  useEffect(() => {
    getHackathon();
  }, [hackathonId]);

  useEffect(() => {
    if (hackathonId && session?.user?.id && loadData) {
      getProject();
    }
  }, [hackathonId, session?.user?.id, loadData,invitationid]);

  return {
    hackathon,
    project,
    timeLeft,
    openCountdown,
    submissionStatus,
    submissionOpenAt,
    loadData,
    setLoadData,
    getProject,
  };
};