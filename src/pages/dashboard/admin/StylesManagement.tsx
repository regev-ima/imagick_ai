import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  Search,
  Trash2,
  ArrowLeft,
  Eye,
  Globe,
  Lock,
  Star,
  MoreHorizontal,
  Plus,
  Power,
  PowerOff
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import ShowcaseManager from "./ShowcaseManager";

interface Style {
   id: string;
   name: string;
   description: string | null;
   status: string;
   visibility: string;
   is_preset: boolean;
   is_active: boolean;
   thumbnail_url: string | null;
   created_at: string;
   user_id: string;
 }

export default function StylesManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
  const [deleteStyleId, setDeleteStyleId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: styles, isLoading } = useQuery({
    queryKey: ["admin-styles", searchQuery, visibilityFilter],
    queryFn: async () => {
      let query = supabase
        .from("styles")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      if (visibilityFilter !== "all") {
        if (visibilityFilter === "preset") {
          query = query.eq("is_preset", true);
        } else {
          query = query.eq("visibility", visibilityFilter);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Style[];
    },
  });

  const updateStyleMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Style> }) => {
      const { error } = await supabase
        .from("styles")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-styles"] });
      toast.success("Style updated successfully");
    },
    onError: (error) => {
      console.error("Error updating style:", error);
      toast.error("Failed to update style");
    },
  });

  const deleteStyleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("styles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-styles"] });
      toast.success("Style deleted successfully");
      setDeleteStyleId(null);
    },
    onError: (error) => {
      console.error("Error deleting style:", error);
      toast.error("Failed to delete style");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/50">Ready</Badge>;
      case "training":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/50">Training</Badge>;
      case "error":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/50">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getVisibilityBadge = (visibility: string, isPreset: boolean) => {
    if (isPreset) {
      return <Badge className="bg-secondary/10 text-secondary border-secondary/50"><Star className="w-3 h-3 mr-1" />Preset</Badge>;
    }
    if (visibility === "public") {
      return <Badge className="bg-primary/10 text-primary border-primary/50"><Globe className="w-3 h-3 mr-1" />Public</Badge>;
    }
    return <Badge variant="outline"><Lock className="w-3 h-3 mr-1" />Private</Badge>;
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/admin">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Styles & Showcase</h1>
          <p className="text-muted-foreground">Manage styles, presets, and before/after previews</p>
        </div>
        <Button onClick={() => navigate("/dashboard/styles/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Create Style
        </Button>
      </div>

      <Tabs defaultValue="styles" className="space-y-6">
        <TabsList>
          <TabsTrigger value="styles">Manage Styles</TabsTrigger>
          <TabsTrigger value="showcase">Showcase Manager</TabsTrigger>
        </TabsList>

        <TabsContent value="styles">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search styles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Styles</SelectItem>
                    <SelectItem value="preset">Presets Only</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading styles...</div>
              ) : styles?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No styles found</div>
              ) : (
                <Table>
                  <TableHeader>
                     <TableRow>
                       <TableHead>Style</TableHead>
                       <TableHead>Status</TableHead>
                       <TableHead>Visibility</TableHead>
                       <TableHead>Active</TableHead>
                       <TableHead>Created</TableHead>
                       <TableHead className="text-right">Actions</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                    {styles?.map((style) => (
                      <TableRow key={style.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden">
                              {style.thumbnail_url ? (
                                <img
                                  src={style.thumbnail_url}
                                  alt={style.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Sparkles className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{style.name}</p>
                              <p className="text-sm text-muted-foreground truncate max-w-xs">
                                {style.description || "No description"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(style.status)}</TableCell>
                         <TableCell>{getVisibilityBadge(style.visibility, style.is_preset)}</TableCell>
                         <TableCell>
                           {style.is_active ? (
                             <Badge className="bg-primary/10 text-primary border-primary/50"><Power className="w-3 h-3 mr-1" />Active</Badge>
                           ) : (
                             <Badge variant="outline" className="text-muted-foreground"><PowerOff className="w-3 h-3 mr-1" />Inactive</Badge>
                           )}
                         </TableCell>
                         <TableCell className="text-muted-foreground">
                           {format(new Date(style.created_at), "MMM d, yyyy")}
                         </TableCell>
                         <TableCell className="text-right">
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon">
                                 <MoreHorizontal className="w-4 h-4" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end">
                               <DropdownMenuItem onClick={() => navigate(`/dashboard/styles/${style.id}`)}>
                                 <Eye className="w-4 h-4 mr-2" />
                                 View Details
                               </DropdownMenuItem>
                               <DropdownMenuSeparator />
                               <DropdownMenuItem
                                 onClick={() => updateStyleMutation.mutate({
                                   id: style.id,
                                   updates: { is_preset: !style.is_preset }
                                 })}
                               >
                                 <Star className="w-4 h-4 mr-2" />
                                 {style.is_preset ? "Remove Preset" : "Make Preset"}
                               </DropdownMenuItem>
                               <DropdownMenuItem
                                 onClick={() => updateStyleMutation.mutate({
                                   id: style.id,
                                   updates: { visibility: style.visibility === "public" ? "private" : "public" }
                                 })}
                               >
                                 {style.visibility === "public" ? (
                                   <>
                                     <Lock className="w-4 h-4 mr-2" />
                                     Make Private
                                   </>
                                 ) : (
                                   <>
                                     <Globe className="w-4 h-4 mr-2" />
                                     Make Public
                                   </>
                                 )}
                               </DropdownMenuItem>
                               <DropdownMenuItem
                                 onClick={() => updateStyleMutation.mutate({
                                   id: style.id,
                                   updates: { is_active: !style.is_active }
                                 })}
                               >
                                 {style.is_active ? (
                                   <>
                                     <PowerOff className="w-4 h-4 mr-2" />
                                     Deactivate
                                   </>
                                 ) : (
                                   <>
                                     <Power className="w-4 h-4 mr-2" />
                                     Activate
                                   </>
                                 )}
                               </DropdownMenuItem>
                               <DropdownMenuSeparator />
                               <DropdownMenuItem
                                 className="text-destructive"
                                 onClick={() => setDeleteStyleId(style.id)}
                               >
                                 <Trash2 className="w-4 h-4 mr-2" />
                                 Delete Style
                               </DropdownMenuItem>
                             </DropdownMenuContent>
                           </DropdownMenu>
                         </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="showcase">
          <ShowcaseManager />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteStyleId} onOpenChange={() => setDeleteStyleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Style?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the style
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteStyleId && deleteStyleMutation.mutate(deleteStyleId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
