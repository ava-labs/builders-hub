import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_DEV } from "../data/constants";
import { errorMsg } from "@/utils/error-mapping";
import toast from "react-hot-toast";
import {
  IBountySubmissionBody,
  IJobApplicationBody,
} from "../interfaces/opportunity";
import { useRouter } from "next/navigation";
import axiosInstance from "./axios";
import axios from "axios";

export const useFetchOpportunity = (filters = {}) => {
  console.log(filters)
  return useQuery({
    queryKey: ["opportunity", filters],
    queryFn: async () => {
      const res = await axiosInstance.get(`${API_DEV}/opportunity`, {
        params: filters,
      });
      return res.data;
    },
    staleTime: Infinity,
  });
};

export const useFetchOpportunityDetails = (opportunity_id: string) => {
  const router = useRouter();

  return useQuery({
    queryKey: ["opportunity-details", opportunity_id],
    queryFn: async () => {
      try {
        const res = await axiosInstance.get(
          `${API_DEV}/opportunity/${opportunity_id}`
        );
        return res.data.data;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          router.push("/404");
        }
        throw error;
      }
    },
    staleTime: 0,
  });
};

export const useCheckJobStatus = (opportunity_id: string) => {
  return useQuery({
    queryKey: ["has-applied", opportunity_id],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `${API_DEV}/opportunity/${opportunity_id}/has-applied`
      );
      return res.data.data;
    },
    staleTime: Infinity,
  });
};

export const useCheckBountyStatus = (opportunity_id: string) => {
  return useQuery({
    queryKey: ["has-submitted", opportunity_id],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `${API_DEV}/opportunity/${opportunity_id}/has-submitted`
      );
      return res.data.data;
    },
    staleTime: Infinity,
  });
};

export const useSubmitOpportunityComment = (opportunity_id: string) => {
  const queryclient = useQueryClient();

  return useMutation({
    mutationKey: ["newComment"],
    mutationFn: async (args: any) => {
      const res = await axiosInstance.post(
        `${API_DEV}/opportunity/${opportunity_id}/comments`,
        args
      );
      return res.data as any;
    },
    onSuccess: (data) => {
      console.log(data);
      queryclient.invalidateQueries({ queryKey: ["opportunity-comments"] });
    },
    onError: (err) => errorMsg(err),
  });
};

export const useEditOpportunityComment = (comment_id: string) => {
  const queryclient = useQueryClient();

  return useMutation({
    mutationKey: ["editComment"],
    mutationFn: async (args: any) => {
      const res = await axiosInstance.post(
        `${API_DEV}/opportunity/comments/${comment_id}`,
        args
      );
      return res.data as any;
    },
    onSuccess: (data) => {
      console.log(data);
      queryclient.invalidateQueries({ queryKey: ["opportunity-comments"] });
    },
    onError: (err) => errorMsg(err),
  });
};

export const useReplyOpportunityComment = (opportunity_id: string) => {
  const queryclient = useQueryClient();

  return useMutation({
    mutationKey: ["replyComment"],
    mutationFn: async (args: any) => {
      const res = await axiosInstance.post(
        `${API_DEV}/opportunity/${opportunity_id}/comments/`,
        args
      );
      return res.data as any;
    },
    onSuccess: (data) => {
      console.log(data);
      queryclient.invalidateQueries({
        queryKey: ["opportunity-comments-replies"],
      });
      queryclient.invalidateQueries({
        queryKey: ["opportunity-comments"],
      });
    },
    onError: (err) => errorMsg(err),
  });
};

export const useFetchOpportunityCommentReplies = (comment_id: string) => {
  return useQuery({
    queryKey: ["opportunity-comments-replies"],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `${API_DEV}/opportunity/comments/${comment_id}/replies`
      );
      return res.data.data;
    },
    staleTime: Infinity,
    refetchOnMount: false,
    enabled: false,
  });
};

export const useDeleteOpportunityComment = (comment_id: string) => {
  const queryclient = useQueryClient();

  return useMutation({
    mutationKey: ["deleteComment"],
    mutationFn: async () => {
      const res = await axiosInstance.delete(
        `${API_DEV}/opportunity/comments/${comment_id}`
      );
      return res.data as any;
    },
    onSuccess: (data) => {
      console.log(data);
      queryclient.invalidateQueries({ queryKey: ["opportunity-comments"] });
    },
    onError: (err) => errorMsg(err),
  });
};

interface PaginationParams {
  page?: number;
  per_page?: number;
}
export const useFetchOpportunityComment = (
  opportunity_id: string,
  paginationParams: PaginationParams = { page: 1, per_page: 10 }
) => {
  return useQuery({
    queryKey: [
      "opportunity-comments",
      opportunity_id,
      paginationParams.page,
      paginationParams.per_page,
    ],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `${API_DEV}/opportunity/${opportunity_id}/comments`,
        {
          params: {
            page: paginationParams.page,
            per_page: paginationParams.per_page,
          },
        }
      );
      return res.data;
    },
    staleTime: Infinity,
  });
};

export const useSubmitJobApplication = (opportunity_id: string) => {
  const queryclient = useQueryClient();

  return useMutation({
    mutationKey: ["jobApplication"],
    mutationFn: async (args: IJobApplicationBody) => {
      const res = await axiosInstance.post(
        `${API_DEV}/opportunity/${opportunity_id}/apply`,
        args
      );
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

export const useSubmitBountySubmissions = (opportunity_id: string) => {
  const queryclient = useQueryClient();

  return useMutation({
    mutationKey: ["jobApplication"],
    mutationFn: async (args: IBountySubmissionBody) => {
      const res = await axiosInstance.post(
        `${API_DEV}/opportunity/${opportunity_id}/submissions/bounty`,
        args
      );
      return res.data as any;
    },
    onSuccess: (data) => {
      toast.success(data?.message);
      queryclient.invalidateQueries({ queryKey: ["opportunity-details"] });
      queryclient.invalidateQueries({ queryKey: ["has-submitted"] });
    },
    onError: (err) => errorMsg(err),
  });
};
