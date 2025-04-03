import { errorMsg } from "@/utils/error-mapping";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { API_DEV } from "../data/constants";
import {
  ICreateOpportunityBody,
  IOpportunityListing,
  IOppotunityApplicationsResponse,
  IOppotunityListingResponse,
  IOppotunitySubmissionsResponse,
  ISingleOppotunityApplicationResponse,
  ISingleOppotunitySubmissionResponse,
} from "../interfaces/sponsor";
import { useRouter } from "next/navigation";
import axiosInstance from "./axios";

export const useCreateOpportunityMutation = () => {
  const queryclient = useQueryClient();
  return useMutation({
    mutationKey: ["createOpportunity"],
    mutationFn: async (args: ICreateOpportunityBody) => {
      const res = await axiosInstance.post(`${API_DEV}/opportunity`, args);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryclient.invalidateQueries({ queryKey: ["allListings"] });
    },
    onError: (err) => errorMsg(err),
  });
};

export const usePublishOpportunityMutation = (id: string) => {
  const queryclient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationKey: ["publishOpportunity"],
    mutationFn: async (should_publish: boolean) => {
      const res = await axiosInstance.patch(`${API_DEV}/opportunity/${id}`, {
        should_publish,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryclient.invalidateQueries({ queryKey: ["allListings"] });
      router.push("/ambassador-dao/sponsor/listings");
    },
    onError: (err) => errorMsg(err),
  });
};

export const useDeleteOpportunityMutation = (id: string) => {
  const queryclient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationKey: ["deleteOpportunity"],
    mutationFn: async () => {
      const res = await axiosInstance.delete(`${API_DEV}/opportunity/${id}`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryclient.invalidateQueries({ queryKey: ["allListings"] });
      router.push("/ambassador-dao/sponsor/listings");
    },
    onError: (err) => errorMsg(err),
  });
};

export const useReviewApplicantMutation = (applicationId: string) => {
  const queryclient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationKey: ["reviewApplicant"],
    mutationFn: async (args: { status: string; feedback: string }) => {
      const res = await axiosInstance.patch(
        `${API_DEV}/opportunity/applications/${applicationId}/review`,
        args
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryclient.invalidateQueries({ queryKey: ["allListings"] });
      router.push("/ambassador-dao/sponsor/listings");
    },
    onError: (err) => errorMsg(err),
  });
};

export const useReviewSubmissionMutation = (submissionId: string) => {
  const queryclient = useQueryClient();
  return useMutation({
    mutationKey: ["reviewSubmission"],
    mutationFn: async (args: { status: string; feedback: string }) => {
      const res = await axiosInstance.patch(
        `${API_DEV}/opportunity/submissions/${submissionId}/review`,
        args
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryclient.invalidateQueries({ queryKey: ["allListings"] });
      queryclient.invalidateQueries({ queryKey: ["singleListings"] });
    },
    onError: (err) => errorMsg(err),
  });
};

export const useCompleteJobMutation = (
  applicationId: string,
  opportunityId: string
) => {
  const queryclient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationKey: ["completeJob"],
    mutationFn: async () => {
      const res = await axiosInstance.patch(
        `${API_DEV}/opportunity/${opportunityId}/complete-job`,
        {
          application_id: applicationId,
        }
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryclient.invalidateQueries({ queryKey: ["allListings"] });
      router.push("/ambassador-dao/sponsor/listings");
    },
    onError: (err) => errorMsg(err),
  });
};

export const useUpdateOpportunityMutation = (id: string) => {
  const queryclient = useQueryClient();
  return useMutation({
    mutationKey: ["updateOpportunity"],
    mutationFn: async (args: ICreateOpportunityBody) => {
      const res = await axiosInstance.patch(
        `${API_DEV}/opportunity/${id}`,
        args
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryclient.invalidateQueries({ queryKey: ["allListings"] });
      queryclient.invalidateQueries({ queryKey: ["singleListings"] });
    },
    onError: (err) => errorMsg(err),
  });
};

export const useFetchAllListings = (
  query: string,
  type: string,
  page: number,
  limit: number,
  status: string
) => {
  return useQuery({
    queryKey: ["allListings", query, type, page, limit, status],
    queryFn: async () => {
      const res = await axiosInstance.get(`${API_DEV}/opportunity/listings`, {
        params: {
          query,
          type: type === "all" ? undefined : type,
          page,
          limit,
          status,
        },
      });
      return res.data as IOppotunityListingResponse;
    },
    staleTime: Infinity,
  });
};

export const useFetchSingleListing = (id: string | undefined) => {
  return useQuery({
    queryKey: ["singleListings", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`${API_DEV}/opportunity/${id}`);
      return res.data.data as IOpportunityListing;
    },
    staleTime: Infinity,
    enabled: !!id,
  });
};

export const useFetchSingleListingSubmissions = (
  id: string,
  query: string,
  page: number,
  limit: number,
  status: string
) => {
  return useQuery({
    queryKey: ["singleListingsSubmissions", query, page, limit, status, id],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `${API_DEV}/opportunity/${id}/submissions`,
        {
          params: {
            query,
            page,
            limit,
            status: status === "ALL" ? undefined : status,
          },
        }
      );
      return res.data as IOppotunitySubmissionsResponse;
    },
    staleTime: Infinity,
  });
};

export const useFetchSingleListingApplications = (
  id: string,
  query: string,
  page: number,
  limit: number,
  status: string
) => {
  return useQuery({
    queryKey: ["singleListingsApplications", query, page, limit, status, id],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `${API_DEV}/opportunity/${id}/applications`,
        {
          params: {
            query,
            page,
            limit,
            status: status === "ALL" ? undefined : status,
          },
        }
      );
      return res.data as IOppotunityApplicationsResponse;
    },
    staleTime: Infinity,
  });
};

export const useFetchSingleListingApplication = (
  id: string,
  applicationId: string
) => {
  return useQuery({
    queryKey: ["singleListingApplication", id, applicationId],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `${API_DEV}/opportunity/applications/${applicationId}`
      );
      return res.data.data as ISingleOppotunityApplicationResponse;
    },
    staleTime: Infinity,
  });
};

export const useFetchSingleListingSubmission = (submissionId: string) => {
  return useQuery({
    queryKey: ["singleListingSubmission", submissionId],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `${API_DEV}/opportunity/submissions/${submissionId}`
      );
      return res.data.data as ISingleOppotunitySubmissionResponse;
    },
    staleTime: Infinity,
  });
};

export const useUpdateBountyRewardMutation = () => {
  const queryclient = useQueryClient();
  return useMutation({
    mutationKey: ["updateRewardBounty"],
    mutationFn: async (args: {
      winner_id: string;
      opportunityId: string;
      rewardId: string;
    }) => {
      const res = await axiosInstance.post(
        `${API_DEV}/opportunity/${args.opportunityId}/rewards/${args.rewardId}/bounty`,
        {
          winner_id: args.winner_id,
        }
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryclient.invalidateQueries({ queryKey: ["allListings"] });
      queryclient.invalidateQueries({ queryKey: ["singleListings"] });
    },
    onError: (err) => errorMsg(err),
  });
};

export const useMarkSubmissionAsPaidMutation = (
  submissionId: string,
  opportunityId: string
) => {
  const queryclient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationKey: ["markSubmissionAsPaid"],
    mutationFn: async () => {
      const res = await axiosInstance.patch(
        `${API_DEV}/opportunity/${opportunityId}/mark-submission-paid`,
        {
          submission_id: submissionId,
        }
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryclient.invalidateQueries({ queryKey: ["allListings"] });
      router.push("/ambassador-dao/sponsor/listings");
    },
    onError: (err) => errorMsg(err),
  });
};
