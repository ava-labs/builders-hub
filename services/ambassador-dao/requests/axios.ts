import axios from "axios";
import { API_DEV } from "../data/constants";

const axiosInstance = axios.create({
  baseURL: API_DEV,
  withCredentials: true,
});

const refreshAxiosInstance = axios.create({
  baseURL: API_DEV,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

const REFRESH_ENDPOINT = "/auth/refresh-token";
const FULL_REFRESH_URL = `${API_DEV}${REFRESH_ENDPOINT}`;

const isRefreshTokenUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  return url.includes(REFRESH_ENDPOINT) || url === FULL_REFRESH_URL;
};

refreshAxiosInstance.interceptors.response.use(
  response => response,
  error => Promise.reject(error)
);

axiosInstance.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const originalUrl = originalRequest?.url;

    if (isRefreshTokenUrl(originalUrl)) {
      console.log("Silently handling refresh token error");
      window.location.href = "/";
      return Promise.reject(new Error("Session expired"));
    }

    if (
      error.response?.status !== 401 ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => {
          return axiosInstance(originalRequest);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      await refreshAxiosInstance.post(REFRESH_ENDPOINT);
      processQueue();
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      
      window.location.href = "/";
      return Promise.reject(new Error("Session expired"));
    } finally {
      isRefreshing = false;
    }
  }
);


export default axiosInstance;