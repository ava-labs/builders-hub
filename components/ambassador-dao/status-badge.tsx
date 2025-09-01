export const StatusBadge = ({ status }: { status: string }) => {
  const getStatusStyles = (status: string) => {
    switch (status) {
      case "Draft":
      case "DRAFT":
      case "PENDING":
      case "SUBMITTED":
      case "APPLIED":
        return "bg-[#6D6D6D] text-white";
      case "Live Job":
      case "OPEN":
        return "bg-[#155DFC] text-white";
      case "In Review":
      case "IN_REVIEW":
      case "IN_PROGRESS":
        return "bg-yellow-500 text-white";
      case "COMPLETED":
      case "Complete":
      case "REWARDED":
        return "bg-[#00A63E] text-white";
      case "PUBLISHED":
      case "VERIFIED":
      case "APPROVED":
      case "ACCEPTED":
        return "bg-[#00D492] text-white";
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
      className={`px-3 py-1 w-fit rounded-full text-xs font-medium ${getStatusStyles(
        status
      )}`}
    >
      {status}
    </span>
  );
};
