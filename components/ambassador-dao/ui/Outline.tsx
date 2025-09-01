export const Outline = ({ label }: any) => {
  return (
    <span className='capitalize text-xs px-2 py-1 rounded-full text-center border border-[var(--default-border-color)] whitespace-nowrap text-gray-600 dark:text-gray-100'>
      {label}
    </span>
  );
};
