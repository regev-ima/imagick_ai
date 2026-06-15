 import { useState } from "react";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Images, 
  Search,
  Eye,
  Trash2,
  ArrowLeft,
  MoreHorizontal,
  ExternalLink,
  User,
  Copy,
  Loader2
} from "lucide-react";
 import { Link, useNavigate } from "react-router-dom";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Badge } from "@/components/ui/badge";
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
import { SHOWCASE_GALLERY_ID } from "@/lib/constants";
 import { toast } from "sonner";
 import { format } from "date-fns";
 
interface Gallery {
  id: string;
  name: string;
  description: string | null;
  status: string;
  total_images: number;
  client_link: string | null;
  created_at: string;
  user_id: string;
  selected_style_ids: string[] | null;
  ai_culling_enabled: boolean;
  categories: string[] | null;
  source_drive_links: string[] | null;
}
 
export default function GalleriesManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteGalleryId, setDeleteGalleryId] = useState<string | null>(null);
  const [showcaseDeleteOpen, setShowcaseDeleteOpen] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const queryClient = useQueryClient();
   const navigate = useNavigate();
 
   const { data: galleries, isLoading } = useQuery({
     queryKey: ["admin-galleries", searchQuery],
     queryFn: async () => {
       let query = supabase
         .from("galleries")
         .select("*")
         .order("created_at", { ascending: false });
 
       if (searchQuery) {
         query = query.ilike("name", `%${searchQuery}%`);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as Gallery[];
     },
   });
 
   const deleteGalleryMutation = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase
         .from("galleries")
         .delete()
         .eq("id", id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["admin-galleries"] });
       toast.success("Gallery deleted successfully");
       setDeleteGalleryId(null);
     },
     onError: (error) => {
       console.error("Error deleting gallery:", error);
       toast.error("Failed to delete gallery");
     },
  });

  const cloneGalleryMutation = useMutation({
    mutationFn: async (gallery: Gallery) => {
      // 1. Create new gallery with same settings
      const { data: newGallery, error: createError } = await supabase
        .from("galleries")
        .insert({
          user_id: gallery.user_id,
          name: `${gallery.name} (clone)`,
          categories: gallery.categories || [],
          ai_culling_enabled: gallery.ai_culling_enabled,
          selected_style_ids: gallery.selected_style_ids || [],
          source_drive_links: gallery.source_drive_links || [],
          total_images: gallery.total_images || 0,
          status: gallery.source_drive_links?.length ? "transferring" : "uploading",
        })
        .select()
        .single();

      if (createError) throw createError;

      // 2. If there are GD links, trigger the import
      if (gallery.source_drive_links?.length) {
        const response = await supabase.functions.invoke("gd-transfer", {
          body: {
            driveLinks: gallery.source_drive_links,
            galleryId: newGallery.id,
            styleIds: gallery.selected_style_ids || [],
            metadataOnly: false,
            totalImageCount: 0, // will be determined by the transfer
          },
        });

        if (response.error) {
          throw new Error(response.error.message || "Failed to start transfer");
        }
      }

      return newGallery;
    },
    onSuccess: (newGallery) => {
      queryClient.invalidateQueries({ queryKey: ["admin-galleries"] });
      setCloningId(null);
      toast.success("Gallery cloned! Import started.");
      navigate(`/dashboard/galleries/${newGallery.id}`);
    },
    onError: (error) => {
      console.error("Error cloning gallery:", error);
      toast.error("Failed to clone gallery");
      setCloningId(null);
    },
  });
 
   const getStatusBadge = (status: string) => {
     switch (status) {
       case "ready":
         return <Badge variant="secondary">Ready</Badge>;
       case "processing":
         return (
           <Badge className="border-[hsl(var(--rating)/0.4)] bg-[hsl(var(--rating)/0.15)] text-[hsl(var(--rating))]">
             Processing
           </Badge>
         );
       case "uploading":
         return <Badge variant="default">Uploading</Badge>;
       default:
         return <Badge variant="outline">{status}</Badge>;
     }
   };

   return (
     <div className="min-h-full bg-background p-6 lg:p-8">
       <div className="mx-auto w-full max-w-[1320px] space-y-5">
       <div className="flex items-center gap-3">
         <Button variant="ghost" size="icon" asChild>
           <Link to="/dashboard/admin">
             <ArrowLeft className="w-5 h-5" />
           </Link>
         </Button>
         <div className="flex-1">
           <h1 className="text-2xl font-semibold tracking-tight">Galleries Management</h1>
           <p className="caption mt-1 flex items-center gap-1.5">
             <Images className="h-3 w-3" />
             View and manage all galleries
           </p>
         </div>
       </div>

       <div className="glass-card overflow-hidden rounded-[--radius]">
         <div className="border-b border-border bg-background/40 p-3">
           <div className="flex max-w-md items-center gap-2 rounded-[--radius] border border-border bg-background px-3">
             <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
             <Input
               placeholder="Search galleries..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="flex-1 border-0 bg-transparent px-0 focus-visible:ring-0"
             />
           </div>
         </div>
         <div>
           {isLoading ? (
             <div className="caption py-12 text-center">Loading galleries…</div>
           ) : galleries?.length === 0 ? (
             <div className="caption py-12 text-center">No galleries found</div>
           ) : (
             <Table>
               <TableHeader>
                 <TableRow className="hover:bg-transparent">
                   <TableHead className="aura-microlabel">Gallery</TableHead>
                   <TableHead className="aura-microlabel">Status</TableHead>
                   <TableHead className="aura-microlabel">Images</TableHead>
                   <TableHead className="aura-microlabel">Owner</TableHead>
                   <TableHead className="aura-microlabel">Created</TableHead>
                   <TableHead className="aura-microlabel text-right">Actions</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {galleries?.map((gallery) => (
                   <TableRow key={gallery.id}>
                     <TableCell>
                       <div>
                         <p className="font-medium">{gallery.name}</p>
                         <p className="max-w-xs truncate text-sm text-muted-foreground">
                           {gallery.description || "No description"}
                         </p>
                       </div>
                     </TableCell>
                     <TableCell>{getStatusBadge(gallery.status)}</TableCell>
                     <TableCell className="folio">{gallery.total_images}</TableCell>
                     <TableCell>
                       <div className="flex items-center gap-2">
                         <User className="w-4 h-4 text-muted-foreground" />
                         <span className="font-mono text-sm text-muted-foreground">
                           {gallery.user_id.substring(0, 8)}...
                         </span>
                       </div>
                     </TableCell>
                     <TableCell className="folio text-muted-foreground">
                       {format(new Date(gallery.created_at), "MMM d, yyyy")}
                     </TableCell>
                     <TableCell className="text-right">
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="icon">
                             <MoreHorizontal className="w-4 h-4" />
                           </Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end">
                           <DropdownMenuItem onClick={() => navigate(`/dashboard/galleries/${gallery.id}`)}>
                             <Eye className="w-4 h-4 mr-2" />
                             View Details
                           </DropdownMenuItem>
                           {gallery.client_link && (
                             <DropdownMenuItem asChild>
                               <a
                                 href={`/gallery/${gallery.client_link}`}
                                 target="_blank"
                                 rel="noopener noreferrer"
                               >
                                 <ExternalLink className="w-4 h-4 mr-2" />
                                 Open Client View
                               </a>
                             </DropdownMenuItem>
                           )}
                            <DropdownMenuItem
                              disabled={cloningId === gallery.id || !gallery.source_drive_links?.length}
                              onClick={() => {
                                setCloningId(gallery.id);
                                cloneGalleryMutation.mutate(gallery);
                              }}
                            >
                              {cloningId === gallery.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Copy className="w-4 h-4 mr-2" />
                              )}
                              Clone & Re-import
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (gallery.id === SHOWCASE_GALLERY_ID) {
                                  setShowcaseDeleteOpen(true);
                                } else {
                                  setDeleteGalleryId(gallery.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Gallery
                            </DropdownMenuItem>
                         </DropdownMenuContent>
                       </DropdownMenu>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           )}
         </div>
       </div>

       {/* Delete Confirmation Dialog */}
       <AlertDialog open={!!deleteGalleryId} onOpenChange={() => setDeleteGalleryId(null)}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Delete Gallery?</AlertDialogTitle>
             <AlertDialogDescription>
               This action cannot be undone. This will permanently delete the gallery
               and all associated images.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancel</AlertDialogCancel>
             <AlertDialogAction
               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
               onClick={() => deleteGalleryId && deleteGalleryMutation.mutate(deleteGalleryId)}
             >
               Delete
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
        </AlertDialog>

        {/* Showcase Gallery Delete Warning */}
        <AlertDialog open={showcaseDeleteOpen} onOpenChange={setShowcaseDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>⚠️ Warning: Showcase Gallery</AlertDialogTitle>
              <AlertDialogDescription>
                This gallery serves as the image source for all style Before/After previews (Showcase). 
                Deleting it will break the Before/After display for all styles. Are you sure you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  deleteGalleryMutation.mutate(SHOWCASE_GALLERY_ID);
                  setShowcaseDeleteOpen(false);
                }}
              >
                Delete Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
    );
  }