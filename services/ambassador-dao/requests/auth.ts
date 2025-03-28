import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  ISponsorStats,
  IUserDetails,
  IUserStats,
  IVerifiedDetails,
} from "../interfaces/user";
import { errorMsg } from "@/utils/error-mapping";
import { API_DEV } from "../data/constants";
import { IVerifyPasscodeBody } from "../interfaces/auth";
axios.defaults.withCredentials = true;

export const useRequestPasscodeMutation = () => {
  return useMutation({
    mutationKey: ["requestPasscode"],
    mutationFn: async (email: string) => {
      const res = await axios.post(`${API_DEV}/auth/request-passcode`, {
        email,
      });
      return res.data.data as IUserDetails;
    },
    onSuccess: () => {
      toast.success("Passcode sent successfully");
    },
    onError: (err) => errorMsg(err),
  });
};

export const useVerifyPasscodeMutation = (
  stopRedirection: boolean | undefined
) => {
  const queryclient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationKey: ["verifyPasscode"],
    mutationFn: async (args: IVerifyPasscodeBody) => {
      const res = await axios.post(`${API_DEV}/auth/verify-passcode`, args);
      return res.data.data as IVerifiedDetails;
    },
    onSuccess: (data) => {
      queryclient.invalidateQueries({ queryKey: ["fetchUserProfile"] });
      toast.success("Verification successful");

      if (!data.user.role || !data.user.first_name) {
        router.push("/ambassador-dao/onboard");
      } else {
        if (stopRedirection) {
          // do nothing
        } else {
          if (data.user.role === "SPONSOR") {
            router.push("/ambassador-dao/sponsor");
          } else {
            router.push("/ambassador-dao/jobs");
          }
        }
      }
    },
    onError: (err) => errorMsg(err),
  });
};

export const useGoogleAuthUrl = () => {
  return useQuery({
    queryKey: ["googleAuthUrl"],
    queryFn: async () => {
      const res = await axios.get(`${API_DEV}/auth/google`);
      return res.data.data.url as string;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });
};

export const useHandleGoogleCallback = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["googleAuth"],
    mutationFn: async (code: string) => {
      const res = await axios.get(
        `${API_DEV}/auth/google/callback?code=${code}`
      );
      return res.data.data as IVerifiedDetails;
    },
    onSuccess: (data) => {
      toast.success("Google authentication successful");
      queryClient.setQueryData(["fetchUserProfile"], data);
      if (!data.user.role || !data.user.first_name) {
        router.push("/ambassador-dao/onboard");
      } else {
        if (data.user.role === "SPONSOR") {
          router.push("/ambassador-dao/sponsor");
        } else {
          router.push("/ambassador-dao/jobs");
        }
      }
    },
    onError: (err) => errorMsg(err),
  });
};

export const useLogoutMutation = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["logout"],
    mutationFn: async () => {
      toast.loading("Logging you out");
      const res = await axios.post(`${API_DEV}/auth/logout`);
      return res.data;
    },
    onSuccess: () => {
      toast.remove();
      queryClient.invalidateQueries();
      queryClient.clear();
      router.push("/");
    },
    onError: (err) => {
      toast.remove();
      errorMsg(err);
    },
  });
};

export const useFetchUserDataQuery = () => {
  return useQuery({
    queryFn: async () => {
      const res = await axios.get(`${API_DEV}/users/me`);
      return res.data.data;
    },
    queryKey: ["fetchUserProfile"],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
};

export const useFetchUserStatsDataQuery = (
  username: string | undefined | null
) => {
  return useQuery({
    queryFn: async () => {
      const res = await axios.get(`${API_DEV}/users/stats/${username}`);
      return res.data.data as IUserStats;
    },
    queryKey: ["fetchUserStats"],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: !!username,
  });
};

export const useFetchSponsorStatsDataQuery = () => {
  return useQuery({
    queryFn: async () => {
      const res = await axios.get(`${API_DEV}/users/sponsor/stats`);
      return res.data.data as ISponsorStats;
    },
    queryKey: ["fetchSponsorStats"],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
};
