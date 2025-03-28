import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { API_DEV } from "../data/constants";
import { IJobApplicationBody } from "../interfaces/opportunity";
import toast from "react-hot-toast";
import { errorMsg } from "@/utils/error-mapping";
import { IClaimXP } from "../interfaces/user";

export const useFetchPublicUserDetails = (
    username: string | undefined | null
  ) => {
    return useQuery({
      queryFn: async () => {
        const res = await axios.get(`${API_DEV}/users/details/${username}`);
        return res.data.data;
      },
      queryKey: ["userDetails"],
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      enabled: !!username,
    });
  };



  export const useFetchPastOpportunities = (
    username: string | undefined | null,
    type: string
  ) => {
    return useQuery({
      queryFn: async () => {
        const res = await axios.get(`${API_DEV}/users/past-opportunities/${username}?type=${type}`);
        return res.data.data;
      },
      queryKey: ["past-opportunities", type],
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      enabled: !!username,
    });
  };




  export const useFetchUserPendingRewards = () => {
    return useQuery({
      queryFn: async () => {
        const res = await axios.get(`${API_DEV}/users/pending-rewards`);
        return res.data.data;
      },
      queryKey: ["pendingRewards"],
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    });
  };



  export const useFetchUserProjects= () => {
    return useQuery({
      queryFn: async () => {
        const res = await axios.get(`${API_DEV}/users/projects`);
        return res.data.data;
      },
      queryKey: ["userProjects"],
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    });
  };


  export const useClaimXP = (opportunity_id: string) => {
    const queryclient = useQueryClient();
  
    return useMutation({
      mutationKey: ["claimXP"],
      mutationFn: async (args: IClaimXP) => {
        const res = await axios.post(`${API_DEV}/opportunity/${opportunity_id}/apply`, args);
        return res.data.data as any;
      },
      onSuccess: (data) => {
        toast.success(data?.message);
        queryclient.invalidateQueries({ queryKey: ["opportunity-details"] });
        queryclient.invalidateQueries({ queryKey: ["has-applied"] });
      },
      onError: (err) => errorMsg(err),
    });
  };

  