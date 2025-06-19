import { Button } from "../components/Button";
import { useErrorBoundary } from "react-error-boundary";

export default function Dev() {
    const { showBoundary } = useErrorBoundary();

    return <div className="space-y-4">
        <div>This is a development page, access it with #dev</div>
        <div>
            <Button onClick={() => fetch("https://thisDomainDoesNotExist7131123123123.com").catch(showBoundary)} className="w-90">
                Show a full page error
            </Button>
        </div>
    </div>;
}
