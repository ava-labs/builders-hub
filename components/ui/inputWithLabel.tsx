export const Input: React.FC<{
  id: string;
  label?: string;
  description?: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ id, label, description, placeholder, onChange }) => {
  return (
    <div className="mb-8">
      {label && <label className="block text-sm font-medium">{label}</label>}
      {description && <p className="text-sm mb-0 mt-1">{description}</p>}
      <input
        type="text"
        id="first_name"
        placeholder={placeholder}
        onChange={onChange}
        className="mt-2 block w-full p-2.5 bg-muted border border-b text-sm rounded-lg focus:ring-[#2a3f85] focus:border-[#2a3f85]  dark:focus:ring-[#2a3f85] dark:focus:border-[#2a3f85]"
      />
    </div>
  );
};
