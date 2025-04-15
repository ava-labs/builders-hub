import dayjs from "dayjs";

export const timeAgo = (timestamp: string) => {
  const now = dayjs();
  const updatedTime = dayjs(timestamp);
  const diffInMinutes = now.diff(updatedTime, "minute");

  if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`;
  }

  const diffInHours = now.diff(updatedTime, "hour");
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
  }

  const diffInDays = now.diff(updatedTime, "day");
  return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
};

export const getTimeLeft = (expiryTimestamp: string) => {
  const now = new Date();
  const expiryDate = new Date(expiryTimestamp);
  const diff = expiryDate.getTime() - now.getTime();

  if (diff <= 0) {
    return "Expired";
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  } else {
    return `${seconds} second${seconds > 1 ? "s" : ""}`;
  }
};

export const getDetailedTimeLeft = (expiryTimestamp: string) => {
  const now = new Date();
  const expiryDate = new Date(expiryTimestamp);
  const diff = expiryDate.getTime() - now.getTime();

  if (diff <= 0) {
    return "Expired";
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  let result = "";
  if (days > 0) result += `${days} day${days > 1 ? "s" : ""} `;
  if (hours > 0) result += `${hours} hour${hours > 1 ? "s" : ""} `;
  if (minutes > 0) result += `${minutes} minute${minutes > 1 ? "s" : ""} `;
  if (seconds > 0) result += `${seconds} second${seconds > 1 ? "s" : ""}`;

  return result.trim();
};

export const formatTimeDifference = (timestamp: string) => {
  const now = dayjs();
  const past = dayjs(timestamp);
  const diffInDays = now.diff(past, "days");
  const diffInMonths = now.diff(past, "months");
  const diffInYears = now.diff(past, "years");

  if (diffInYears >= 1)
    return `${diffInYears} year${diffInYears > 1 ? "s" : ""}`;
  if (diffInMonths >= 1)
    return `${diffInMonths} month${diffInMonths > 1 ? "s" : ""}`;
  return `${diffInDays} day${diffInDays > 1 ? "s" : ""}`;
};

export const formatDate = (timestamp: string) => {
  if (!timestamp || timestamp === "—") return "—";

  const formattedDate = dayjs(timestamp).format("DD/MM/YYYY");
  return formattedDate === "Invalid Date" ? "-" : formattedDate;
};
