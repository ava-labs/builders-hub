import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { errorMsg } from "@/utils/error-mapping";
import { API_DEV } from "../data/constants";
import {
  ISkillsResponse,
  IUpdateSponsorProfileBody,
  IUpdateTalentProfileBody,
} from "../interfaces/onbaord";
import axiosInstance from "./axios";

export const useSelectRoleMutation = () => {
  const queryclient = useQueryClient();
  return useMutation({
    mutationKey: ["selectRole"],
    mutationFn: async (role: string) => {
      const res = await axiosInstance.post(`${API_DEV}/users/select-role`, {
        role,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryclient.invalidateQueries({ queryKey: ["fetchUserProfile"] });
      toast.success(data.message);
    },
    onError: (err) => errorMsg(err),
  });
};

export const useUpdateSponsorProfileMutation = () => {
  const queryclient = useQueryClient();
  return useMutation({
    mutationKey: ["updateSponsorProfile"],
    mutationFn: async (args: IUpdateSponsorProfileBody) => {
      const res = await axiosInstance.post(
        `${API_DEV}/users/update-sponsor-profile`,
        args
      );
      return res.data;
    },
    onSuccess: (data) => {
      queryclient.invalidateQueries({ queryKey: ["fetchUserProfile"] });
      toast.success(data.message);
    },
    onError: (err) => errorMsg(err),
  });
};

export const useUpdateTalentProfileMutation = () => {
  const queryclient = useQueryClient();
  return useMutation({
    mutationKey: ["updateTalentProfile"],
    mutationFn: async (args: IUpdateTalentProfileBody) => {
      const res = await axiosInstance.post(
        `${API_DEV}/users/update-talent-profile`,
        args
      );
      return res.data;
    },
    onSuccess: (data) => {
      queryclient.invalidateQueries({ queryKey: ["fetchUserProfile"] });
      toast.success(data.message);
    },
    onError: (err) => errorMsg(err),
  });
};

export const useCheckUsernameAvailabilityMutation = () => {
  return useMutation({
    mutationKey: ["checkUsernameAvailability"],
    mutationFn: async (username: string) => {
      const res = await axiosInstance.post(
        `${API_DEV}/users/check-username-availability`,
        {
          username,
        }
      );
      return res.data.data as {
        is_available: boolean;
      };
    },
    onError: (err) => errorMsg(err),
  });
};

export const useCheckCompanyUsernameAvailabilityMutation = () => {
  return useMutation({
    mutationKey: ["checkUsernameAvailability"],
    mutationFn: async (username: string) => {
      const res = await axiosInstance.post(
        `${API_DEV}/users/check-company-username-availability`,
        {
          username,
        }
      );
      return res.data.data as {
        is_available: boolean;
      };
    },
    onError: (err) => errorMsg(err),
  });
};

export const useFetchAllSkills = () => {
  return useQuery({
    queryKey: ["skills"],
    queryFn: async () => {
      const res = await axiosInstance.get(`${API_DEV}/skill`);
      return res.data.data as ISkillsResponse[];
    },
    staleTime: Infinity,
  });
};

export const useFileUploadMutation = (type?: string) => {
  return useMutation({
    mutationKey: ["fileUpload"],
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      type && formData.append("type", type);
      const res = await axiosInstance.post(
        `${API_DEV}/file-upload?type=${type}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return res.data.data;
    },
    onError: (err) => errorMsg(err),
  });
};
