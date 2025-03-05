
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, LineChart } from "@/components/ui/chart";
import { FileArchive, Users, Database, FileCheck2 } from "lucide-react";

export function StatsSection() {
  // Mock data
  const barChartData = [
    {
      name: "Mon",
      dissolution: 12,
      particle: 18,
    },
    {
      name: "Tue",
      dissolution: 8,
      particle: 15,
    },
    {
      name: "Wed",
      dissolution: 22,
      particle: 19,
    },
    {
      name: "Thu",
      dissolution: 15,
      particle: 17,
    },
    {
      name: "Fri",
      dissolution: 25,
      particle: 13,
    },
    {
      name: "Sat",
      dissolution: 5,
      particle: 2,
    },
    {
      name: "Sun",
      dissolution: 3,
      particle: 0,
    },
  ];

  const lineChartData = [
    {
      name: "Week 1",
      uploads: 15,
    },
    {
      name: "Week 2",
      uploads: 28,
    },
    {
      name: "Week 3",
      uploads: 32,
    },
    {
      name: "Week 4",
      uploads: 24,
    },
    {
      name: "Week 5",
      uploads: 35,
    },
    {
      name: "Week 6",
      uploads: 42,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-all duration-300 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <FileArchive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">328</div>
            <p className="text-xs text-muted-foreground mt-1">
              +12% from last month
            </p>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground mt-1">
              3 currently uploading
            </p>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Size</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">425 MB</div>
            <p className="text-xs text-muted-foreground mt-1">
              32MB added today
            </p>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Jobs</CardTitle>
            <FileCheck2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">285</div>
            <p className="text-xs text-muted-foreground mt-1">
              42 new this week
            </p>
          </CardContent>
        </Card>
      </div>
      <Tabs defaultValue="files" className="space-y-4">
        <TabsList className="grid grid-cols-2 h-9">
          <TabsTrigger value="files" className="text-xs sm:text-sm">Files by Type</TabsTrigger>
          <TabsTrigger value="trends" className="text-xs sm:text-sm">Upload Trends</TabsTrigger>
        </TabsList>
        <TabsContent value="files" className="space-y-4">
          <Card className="transition-all duration-300 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Daily File Uploads by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart 
                data={barChartData}
                index="name"
                categories={["dissolution", "particle"]}
                colors={["#3b82f6", "#10b981"]}
                yAxisWidth={35}
                className="w-full aspect-[4/3]"
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="trends" className="space-y-4">
          <Card className="transition-all duration-300 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Weekly Upload Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart 
                data={lineChartData}
                index="name"
                categories={["uploads"]}
                colors={["#3b82f6"]}
                yAxisWidth={35}
                className="w-full aspect-[4/3]"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
