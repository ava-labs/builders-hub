import { errorMsg } from "@/utils/error-mapping";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { API_DEV } from "../data/constants";
import {
  ICreateOpportunityBody,
  IOpportunityListing,
  IOppotunityApplicationsResponse,
  IOppotunityListingResponse,
} from "../interfaces/sponsor";

export const useCreateOpportunityMutation = () => {
  return useMutation({
    mutationKey: ["createOpportunity"],
    mutationFn: async (args: ICreateOpportunityBody) => {
      const res = await axios.post(`${API_DEV}/opportunity`, args);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
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
      const res = await axios.get(`${API_DEV}/opportunity/listings`, {
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

export const useFetchSingleListing = (id: string) => {
  return useQuery({
    queryKey: ["singleListings"],
    queryFn: async () => {
      const res = await axios.get(`${API_DEV}/opportunity/${id}`);
      return res.data.data as IOpportunityListing;
    },
    staleTime: Infinity,
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
    queryKey: ["singleListingsSubmissions", query, page, limit, status],
    queryFn: async () => {
      const res = await axios.get(`${API_DEV}/opportunity/${id}/submissions`, {
        params: {
          query,
          page,
          limit,
          status: status === "ALL" ? undefined : status,
        },
      });
      return res.data as IOppotunityApplicationsResponse;
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
    queryKey: ["singleListingsApplications", query, page, limit, status],
    queryFn: async () => {
      const res = await axios.get(`${API_DEV}/opportunity/${id}/applications`, {
        params: {
          query,
          page,
          limit,
          status: status === "ALL" ? undefined : status,
        },
      });
      return res.data as IOppotunityApplicationsResponse;
    },
    staleTime: Infinity,
  });
};
