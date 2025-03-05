
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { FileDown } from "lucide-react";
import { downloadSampleFile } from "@/utils/sampleFiles";

export function SampleFilesDownloader() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="mr-2 h-4 w-4" />
          Download Sample Files
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Sample Data Files</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => downloadSampleFile("dissolution-csv")}
          className="cursor-pointer"
        >
          Dissolution Test Data (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => downloadSampleFile("particle-csv")}
          className="cursor-pointer"
        >
          Particle Size Data (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
