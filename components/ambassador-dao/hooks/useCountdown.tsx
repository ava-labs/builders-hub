import { useState, useEffect } from 'react';

export const useCountdown = (expiryTimestamp: string) => {
  const [timeLeft, setTimeLeft] = useState("");
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const expiryDate = new Date(expiryTimestamp);
      const diff = expiryDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let timeString = "";
      
      if (days > 0) {
        timeString = `${days}d : ${hours}h : ${minutes}m`;
      } else {
        timeString = `${hours}h : ${minutes}m : ${seconds}s`;
      }
      
      setTimeLeft(timeString);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [expiryTimestamp]);

  return timeLeft;
};