import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_DEV } from "../data/constants";


export const useFetchOpportunity = () => {
    return useQuery({
      queryKey: ["opportunity"],
      queryFn: async () => {
        const res = await axios.get(`${API_DEV}/opportunity`);
        return res.data.data as any;
      },
      staleTime: Infinity,
    });
  };
  