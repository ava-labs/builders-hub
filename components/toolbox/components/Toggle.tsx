export const Toggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => {
  return (
    <label className="inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        value=""
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="relative h-5 w-9 border border-zinc-300 bg-zinc-100 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-3.5 after:w-3.5 after:bg-white after:transition-all after:content-[''] hover:border-zinc-400 peer-checked:border-zinc-900 peer-checked:bg-zinc-900 peer-checked:after:translate-x-4 peer-focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:after:bg-zinc-500 dark:hover:border-zinc-600 dark:peer-checked:border-zinc-100 dark:peer-checked:bg-zinc-100 dark:peer-checked:after:bg-zinc-900 rtl:peer-checked:after:-translate-x-4"></div>
      <span className="ms-3 text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
    </label>
  );
};
