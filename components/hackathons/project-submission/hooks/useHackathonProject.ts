import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { HackathonHeader } from '@/types/hackathons';
import { useCountdown } from './Count-down';
import { apiFetch } from '@/lib/api/client';



export const useHackathonProject = (hackathonId: string,invitationid:string) => {
  const { data: session } = useSession();
  const [hackathon, setHackathon] = useState<HackathonHeader | null>(null);
  const [project, setProject] = useState<any>(null);
  
  const [deadline, setDeadline] = useState<number>(
    new Date().getTime() + 12 * 60 * 60 * 1000
  );
  const [loadData, setLoadData] = useState<boolean>(true);
  const timeLeft = useCountdown(deadline);

  const getHackathon = async () => {
    if (!hackathonId) return;
    try {
      const data = await apiFetch<HackathonHeader>(`/api/hackathons/${hackathonId}`);
      setHackathon(data);
      if ((data as any)?.content?.submission_deadline) {
        setDeadline(new Date((data as any).content.submission_deadline).getTime());
      }
    } catch (err) {
      console.error("API Error:", err);
    }
  };

  const getProject = async () => {
    try {
      const params = new URLSearchParams();
      if (hackathonId) params.set('hackathon_id', hackathonId);
      if (session?.user?.id) params.set('user_id', session.user.id);
      if (invitationid) params.set('invitation_id', invitationid);
      const data = await apiFetch<{ project?: any }>(`/api/project?${params.toString()}`);
      if (data.project) {
        setProject(data.project);
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
    loadData,
    setLoadData,
    getProject,
  };
}; 