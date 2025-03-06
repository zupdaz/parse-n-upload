
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
      <DropdownMenuContent align="end" className="w-72">
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
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-yellow-500">Test Error Samples</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => downloadSampleFile("error-dissolution-csv")}
          className="cursor-pointer text-yellow-600"
        >
          Dissolution Test Data with Errors (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => downloadSampleFile("error-particle-csv")}
          className="cursor-pointer text-yellow-600"
        >
          Particle Size Data with Errors (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
