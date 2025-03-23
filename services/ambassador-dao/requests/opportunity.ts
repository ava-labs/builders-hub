import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { API_DEV } from "../data/constants";
import { useRouter } from "next/navigation";
import { errorMsg } from "@/utils/error-mapping";
import toast from "react-hot-toast";
import { IBountySubmissionBody, IJobApplicationBody } from "../interfaces/opportunity";

  
export const useFetchOpportunity = (filters = {}) => {
  return useQuery({
    queryKey: ["opportunity", filters],
    queryFn: async () => {
      const res = await axios.get(`${API_DEV}/opportunity`, { params: filters });
      return res.data.data;
    },
    staleTime: Infinity,
  });
};


export const useFetchOpportunityDetails = (opportunity_id: string) => {
  return useQuery({
    queryKey: ["opportunity-details", opportunity_id],
    queryFn: async () => {
      const res = await axios.get(`${API_DEV}/opportunity/${opportunity_id}`);
      return res.data.data;
    },
    staleTime: Infinity,
  });
};


export const useFetchOpportunityComment = (opportunity_id: string) => {
  return useQuery({
    queryKey: ["opportunity-comments"],
    queryFn: async () => {
      const res = await axios.get(`${API_DEV}/opportunity/${opportunity_id}/comments`);
      return res.data.data;
    },
    staleTime: Infinity,
  });
};



export const useSubmitJobApplication = (opportunity_id: string) => {
  const queryclient = useQueryClient();

  return useMutation({
    mutationKey: ["jobApplication"],
    mutationFn: async (args: IJobApplicationBody) => {
      const res = await axios.post(`${API_DEV}/opportunity/${opportunity_id}/apply`, args);
      return res.data.data as any;
    },
    onSuccess: (data) => {
      toast.success(data?.message);
      queryclient.invalidateQueries({ queryKey: ["opportunity-details"] });
    },
    onError: (err) => errorMsg(err),
  });
};


export const useSubmitBountySubmissions = (opportunity_id: string) => {
  const queryclient = useQueryClient();

  return useMutation({
    mutationKey: ["jobApplication"],
    mutationFn: async (args: IBountySubmissionBody) => {
      const res = await axios.post(`${API_DEV}/opportunity/${opportunity_id}/submissions/bounty`, args);
      return res.data as any;
    },
    onSuccess: (data) => {
      toast.success(data?.message);
      queryclient.invalidateQueries({ queryKey: ["opportunity-details"] });
    },
    onError: (err) => errorMsg(err),
  });
};
