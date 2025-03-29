import { Input, InputProps } from "./Input";
import { Button } from "./Button";
import { X } from "lucide-react";

type InputArrayProps = {
    label: string,
    values: string[],
    onChange: (values: string[]) => void,
    placeholder?: string,
    notesUnderInput?: string,
    disabled?: boolean,
    disableAddRemove?: boolean,
} & Omit<InputProps, 'label' | 'value' | 'onChange' | 'notes'>;

export const InputArray = ({
    label,
    values,
    onChange,
    placeholder,
    notesUnderInput,
    disableAddRemove,
    ...inputProps
}: InputArrayProps) => {
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
            <label className="block text-sm font-medium ">
                {label}
            </label>
            {values.map((value, index) => (
                <div key={index} className="flex gap-2">
                    <div className="flex-grow relative">
                        <Input
                            {...inputProps}
                            label={`Entry ${index + 1}`}
                            value={value}
                            onChange={(newValue) => handleChange(index, newValue)}
                            placeholder={placeholder}
                            helperText={index === 0 ? notesUnderInput : undefined}
                        />
                        {!disableAddRemove && (
                            <button
                                onClick={() => handleRemove(index)}
                                disabled={inputProps.disabled}
                                className="absolute top-9 right-2 p-1  hover: disabled:"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
            {values.length === 0 && (
                <p className="text-sm  italic">No entries yet. Click "Add Entry" to begin.</p>
            )}
            {!disableAddRemove && (
                <Button
                    onClick={handleAdd}
                    disabled={inputProps.disabled}
                    className="w-full mt-2"
                >
                    Add Entry
                </Button>
            )}
        </div>
    );
};

