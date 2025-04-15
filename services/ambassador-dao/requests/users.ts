import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { API_DEV } from "../data/constants";
import toast from "react-hot-toast";
import { errorMsg } from "@/utils/error-mapping";
import { IClaimXP } from "../interfaces/user";
import axiosInstance from "./axios";

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
  params: {
    per_page: number;
    page: number;
  }
) => {
  return useQuery({
    queryFn: async () => {
      const res = await axiosInstance.get(
        `${API_DEV}/users/past-activity/${username}`,
        { params }
      );
      return res.data;
    },
    queryKey: ["past-opportunities"],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: !!username,
  });
};

export const useFetchUserPendingRewards = (
  page: number,
  needsOnboarding?: boolean
) => {
  return useQuery({
    queryFn: async () => {
      const res = await axiosInstance.get(`${API_DEV}/users/pending-rewards`, {
        params: { page, per_page: 3 },
      });
      return res.data as any;
    },
    queryKey: ["pendingRewards", page],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: needsOnboarding,
  });
};

export const useFetchUserProjects = (params: {
  type: string;
  status: string;
  category: string;
  query: string;
  date_applied_start: string | undefined;
  page: number;
}) => {
  return useQuery({
    queryFn: async () => {
      const res = await axiosInstance.get(`${API_DEV}/users/projects`, {
        params,
      });
      return res.data;
    },
    queryKey: ["userProjects", params],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
};

export const useClaimXP = () => {
  const queryclient = useQueryClient();

  return useMutation({
    mutationKey: ["claimXP"],
    mutationFn: async (args: IClaimXP) => {
      const res = await axiosInstance.post(`${API_DEV}/users/xp-claim`, args);
      return res.data as any;
    },
    onSuccess: (data) => {
      toast.success(data?.message);
      queryclient.invalidateQueries({ queryKey: ["opportunity-details"] });
      queryclient.invalidateQueries({ queryKey: ["has-applied"] });
    },
    onError: (err) => errorMsg(err),
  });
};

export const useUpdateWalletAddress = () => {
  const queryclient = useQueryClient();
  return useMutation({
    mutationKey: ["updateWallet"],
    mutationFn: async (args: { wallet_address: string }) => {
      const res = await axiosInstance.patch(
        `${API_DEV}/users/update-wallet-address`,
        args
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryclient.invalidateQueries({ queryKey: ["fetchUserProfile"] });
    },
    onError: (err) => errorMsg(err),
  });
};
