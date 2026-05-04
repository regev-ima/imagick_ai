import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function ShortLinkRedirect() {
  const { shortId } = useParams<{ shortId: string }>();
  const [galleryLink, setGalleryLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const findGallery = async () => {
      if (!shortId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Use secure RPC function to resolve short link (bypasses RLS)
      const { data, error } = await supabase
        .rpc("resolve_short_link", { p_short_id: shortId });

      if (error || !data) {
        setNotFound(true);
      } else {
        setGalleryLink(data);
      }
      
      setLoading(false);
    };

    findGallery();
  }, [shortId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !galleryLink) {
    return <Navigate to="/404" replace />;
  }

  return <Navigate to={`/gallery/${galleryLink}`} replace />;
}
