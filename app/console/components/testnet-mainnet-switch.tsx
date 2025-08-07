
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function TestnetMainnetSwitch() {
    const isTestnet = true;

  return (<DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isTestnet ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
            {isTestnet ? "Testnet" : "Mainnet"}
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
            <DropdownMenuItem >Testnet</DropdownMenuItem>
            <DropdownMenuItem >Mainnet</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>);
}