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
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminLoading } from "@/components/admin/AdminLoading";

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
        return <Badge variant="secondary">Ready</Badge>;
      case "training":
        return (
          <Badge className="border-[hsl(var(--rating)/0.4)] bg-[hsl(var(--rating)/0.15)] text-[hsl(var(--rating))]">
            Training
          </Badge>
        );
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getVisibilityBadge = (visibility: string, isPreset: boolean) => {
    if (isPreset) {
      return <Badge variant="secondary"><Star className="w-3 h-3 mr-1" />Preset</Badge>;
    }
    if (visibility === "public") {
      return <Badge variant="default"><Globe className="w-3 h-3 mr-1" />Public</Badge>;
    }
    return <Badge variant="outline"><Lock className="w-3 h-3 mr-1" />Private</Badge>;
  };

  return (
    <div className="min-h-full bg-background p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1320px] space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/admin" aria-label="Back to admin">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Styles & Showcase</h1>
          <p className="caption mt-1 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            Manage styles, presets, and before/after previews
          </p>
        </div>
        <Button onClick={() => navigate("/dashboard/styles/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Create Style
        </Button>
      </div>

      <Tabs defaultValue="styles" className="space-y-5">
        <TabsList>
          <TabsTrigger value="styles">Manage Styles</TabsTrigger>
          <TabsTrigger value="showcase">Showcase Manager</TabsTrigger>
        </TabsList>

        <TabsContent value="styles">
          <div className="glass-card overflow-hidden rounded-[--radius]">
            <div className="flex flex-col justify-between gap-3 border-b border-border bg-background/40 p-3 sm:flex-row">
              <div className="flex max-w-md flex-1 items-center gap-2 rounded-[--radius] border border-border bg-background px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="Search styles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 border-0 bg-transparent px-0 focus-visible:ring-0"
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
            <div>
              {isLoading ? (
                <AdminLoading rows={6} label="Loading styles" />
              ) : styles?.length === 0 ? (
                <AdminEmptyState
                  icon={Sparkles}
                  title="No styles found"
                  hint={searchQuery || visibilityFilter !== "all" ? "Try adjusting your search or filter." : "Trained styles will appear here."}
                />
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                     <TableRow className="hover:bg-transparent">
                       <TableHead className="aura-microlabel">Style</TableHead>
                       <TableHead className="aura-microlabel">Status</TableHead>
                       <TableHead className="aura-microlabel">Visibility</TableHead>
                       <TableHead className="aura-microlabel">Active</TableHead>
                       <TableHead className="aura-microlabel">Created</TableHead>
                       <TableHead className="aura-microlabel text-right">Actions</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                    {styles?.map((style) => (
                      <TableRow key={style.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-[--radius] bg-muted plate-keyline">
                              {style.thumbnail_url ? (
                                <img
                                  src={style.thumbnail_url}
                                  alt={style.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Sparkles className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{style.name}</p>
                              <p className="max-w-xs truncate text-sm text-muted-foreground">
                                {style.description || "No description"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(style.status)}</TableCell>
                         <TableCell>{getVisibilityBadge(style.visibility, style.is_preset)}</TableCell>
                         <TableCell>
                           {style.is_active ? (
                             <Badge variant="default"><Power className="w-3 h-3 mr-1" />Active</Badge>
                           ) : (
                             <Badge variant="outline" className="text-muted-foreground"><PowerOff className="w-3 h-3 mr-1" />Inactive</Badge>
                           )}
                         </TableCell>
                         <TableCell className="folio text-muted-foreground">
                           {format(new Date(style.created_at), "MMM d, yyyy")}
                         </TableCell>
                         <TableCell className="text-right">
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon" aria-label="Style actions">
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
                </div>
              )}
            </div>
          </div>
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
    </div>
  );
}
