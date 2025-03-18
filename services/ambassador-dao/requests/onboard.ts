import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { errorMsg } from "@/utils/error-mapping";
import { API_DEV } from "../data/constants";
import {
  ISkillsResponse,
  IUpdateSponsorProfileBody,
  IUpdateTalentProfileBody,
} from "../interfaces/onbaord";
axios.defaults.withCredentials = true;

export const useSelectRoleMutation = () => {
  return useMutation({
    mutationKey: ["selectRole"],
    mutationFn: async (role: string) => {
      const res = await axios.post(`${API_DEV}/users/select-role`, {
        role,
      });
      return res.data;
    },
    onError: (err) => errorMsg(err),
  });
};

export const useUpdateSponsorProfileMutation = () => {
  return useMutation({
    mutationKey: ["updateSponsorProfile"],
    mutationFn: async (args: IUpdateSponsorProfileBody) => {
      const res = await axios.post(
        `${API_DEV}/users/update-sponsor-profile`,
        args
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (err) => errorMsg(err),
  });
};

export const useUpdateTalentProfileMutation = () => {
  return useMutation({
    mutationKey: ["updateTalentProfile"],
    mutationFn: async (args: IUpdateTalentProfileBody) => {
      const res = await axios.post(
        `${API_DEV}/users/update-talent-profile`,
        args
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (err) => errorMsg(err),
  });
};

export const useCheckUsernameAvailabilityMutation = () => {
  return useMutation({
    mutationKey: ["checkUsernameAvailability"],
    mutationFn: async (username: string) => {
      const res = await axios.post(
        `${API_DEV}/users/check-username-availability`,
        {
          username,
        }
      );
      return res.data;
    },
    onError: (err) => errorMsg(err),
  });
};

export const useCheckCompanyUsernameAvailabilityMutation = () => {
  return useMutation({
    mutationKey: ["checkUsernameAvailability"],
    mutationFn: async (username: string) => {
      const res = await axios.post(
        `${API_DEV}/users/check-company-username-availability`,
        {
          username,
        }
      );
      return res.data;
    },
    onError: (err) => errorMsg(err),
  });
};

export const useFetchAllSkills = () => {
  return useQuery({
    queryKey: ["skills"],
    queryFn: async () => {
      const res = await axios.get(`${API_DEV}/users/skills`);
      return res.data.data as ISkillsResponse[];
    },
    staleTime: Infinity,
  });
};

export const useFileUploadMutation = () => {
  return useMutation({
    mutationKey: ["fileUpload"],
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API_DEV}/file-upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return res.data.data.url as string;
    },
    onError: (err) => errorMsg(err),
  });
};
