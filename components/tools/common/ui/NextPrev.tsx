import { Button } from "@/components/ui/button";

interface NextPrevProps {
  nextDisabled: boolean;
  prevHidden?: boolean;
  onNext: () => void;
  onPrev: () => void;
}

export default function NextPrev({
  nextDisabled,
  prevHidden = false,
  onNext,
  onPrev,
}: NextPrevProps) {
  return (
    <div className="flex justify-between">
      {!prevHidden && (
        <Button onClick={onPrev} variant="secondary">
          Back
        </Button>
      )}
      <Button className="ml-auto" onClick={onNext} disabled={nextDisabled} variant="default">
        Continue
      </Button>
    </div>
  );
}
