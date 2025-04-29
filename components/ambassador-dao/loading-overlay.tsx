export default function LoadingOverlay({ message = "Loading..." }) {
  return (
    <div className='fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center'>
      <div className='bg-[var(--background-color)] p-6 rounded-lg shadow-lg flex flex-col items-center'>
        <div className='w-12 h-12 mb-4 border-4 border-t-[var(--primary-color)] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin'></div>
        <p className='text-[var(--primary-text-color)]'>{message}</p>
      </div>
    </div>
  );
}
