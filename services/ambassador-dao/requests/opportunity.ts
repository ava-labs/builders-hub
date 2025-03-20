import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_DEV } from "../data/constants";

  
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
