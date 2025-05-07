import axios from "axios";
import { API_DEV } from "../data/constants";

// Create axios instance with default config
const axiosInstance = axios.create({
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

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // You can add any request preprocessing here
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401 errors for POST requests
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.method?.toLowerCase() !== "post"
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // If token refresh is in progress, queue the request
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
      // Attempt to refresh the token
      await axiosInstance.post("/auth/refresh-token");
      processQueue();
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);

      window.location.href = "/";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default axiosInstance;
