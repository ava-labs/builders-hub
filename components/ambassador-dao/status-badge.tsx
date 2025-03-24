export const StatusBadge = ({ status }: { status: string }) => {
  const getStatusStyles = () => {
    switch (status) {
      case "Draft":
        return "bg-[#6D6D6D]";
      case "Live Job":
        return "bg-[#155DFC]";
      case "In Review":
        return "bg-[#00D492]";
      case "Payment Pending":
        return "bg-[#F0B100]";
      case "Pending Reviews":
        return "bg-[#F0B100]";
      case "Complete":
        return "bg-[#E5E7EB] text-black";
      default:
        return "bg-gray-700";
    }
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusStyles()}`}
    >
      {status}
    </span>
  );
};
