import { Project } from "@/types/showcase";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export const useProject = () => {
    const { data: session } = useSession();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const getProjects = async () => {
        if (!session?.user?.id) {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            const response = await axios.get(`/api/projects/member/${session?.user?.id}`);
            setProjects(response.data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error("Failed to fetch projects"));
            setProjects([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        getProjects();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.user?.id]);

    return { projects, isLoading, error, refetch: getProjects };
};