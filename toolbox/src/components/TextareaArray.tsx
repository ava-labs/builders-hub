import { Textarea } from "./Textarea";
import { Button } from "./Button";
import { X } from "lucide-react";

type TextareaArrayProps = {
    label: string;
    values: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
};

export const TextareaArray = ({
    label,
    values,
    onChange,
    placeholder
}: TextareaArrayProps) => {
    const handleAdd = () => {
        onChange([...values, ""]);
    };

    const handleRemove = (index: number) => {
        onChange(values.filter((_, i) => i !== index));
    };

    const handleChange = (index: number, value: string) => {
        const newValues = [...values];
        newValues[index] = value;
        onChange(newValues);
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium">
                {label}
            </label>
            {values.map((value, index) => (
                <div key={index} className="flex gap-2">
                    <div className="flex-grow relative">
                        <Textarea
                            label={`Entry ${index + 1}`}
                            value={value}
                            onChange={(newValue) => handleChange(index, newValue)}
                            placeholder={placeholder}
                        />
                        <button
                            onClick={() => handleRemove(index)}
                            className="absolute top-9 right-2 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            ))}
            {values.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">No entries yet. Click "Add Entry" to begin.</p>
            )}
            <Button
                onClick={handleAdd}
                className="w-full mt-2"
            >
                Add Entry
            </Button>
        </div>
    );
};
