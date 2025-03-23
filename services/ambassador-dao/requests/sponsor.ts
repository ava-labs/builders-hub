import { errorMsg } from "@/utils/error-mapping";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { API_DEV } from "../data/constants";
import { ICreateOpportunityBody } from "../interfaces/sponsor";

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
