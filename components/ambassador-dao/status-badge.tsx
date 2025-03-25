export const StatusBadge = ({ status }: { status: string }) => {
  const getStatusStyles = (status: string) => {
    switch (status) {
      case "Draft":
      case "DRAFT":
        return "bg-[#6D6D6D]";
      case "Live Job":
      case "OPEN":
        return "bg-[#155DFC] text-white";
      case "In Review":
      case "IN_REVIEW":
      case "Payment Pending":
      case "Pending Reviews":
        return "bg-[#00D492] text-white";
      case "Complete":
      case "COMPLETED":
      case "SUBMITTED":
      case "VERIFIED":
      case "APPROVED":
      case "ACCEPTED":
      case "REWARDED":
      case "PUBLISHED":
        return "bg-[#00A63E] text-white";
      case "PENDING":
      case "APPLIED":
        return "bg-[#6D6D6D] text-white"; // Same as "Payment Pending"
      case "REJECTED":
      case "WITHDRAWN":
      case "SUSPENDED":
        return "bg-red-600 text-white"; // Same as "Draft"
      case "ALL":
        return "bg-gray-700";
      default:
        return "bg-gray-700";
    }
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusStyles(
        status
      )}`}
    >
      {status}
    </span>
  );
};
