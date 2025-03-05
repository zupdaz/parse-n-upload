
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Project = {
  id: string;
  name: string;
};

interface ProjectSelectorProps {
  onProjectSelect: (projectId: string) => void;
}

export function ProjectSelector({ onProjectSelect }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulating fetching projects from a CSV file
  useEffect(() => {
    const fetchProjects = async () => {
      // In a real application, this would fetch from an actual endpoint
      // that reads from your CSV file
      setLoading(true);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock data
      const mockProjects: Project[] = [
        { id: "proj-001", name: "Pharma Research A" },
        { id: "proj-002", name: "Biotech Analysis" },
        { id: "proj-003", name: "Clinical Trial X" },
        { id: "proj-004", name: "Development Study Y" },
        { id: "proj-005", name: "Research Initiative Z" },
      ];
      
      setProjects(mockProjects);
      setLoading(false);
    };

    fetchProjects();
  }, []);

  return (
    <div className="w-full space-y-2 animate-fade-in">
      <Label htmlFor="project" className="text-sm font-medium">
        Select Project
      </Label>
      
      {loading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <Select onValueChange={onProjectSelect}>
          <SelectTrigger id="project" className="w-full">
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem 
                key={project.id} 
                value={project.id}
                className="cursor-pointer transition-colors"
              >
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
