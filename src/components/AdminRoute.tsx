 import { Navigate, useLocation } from "react-router-dom";
 import { useAuth } from "@/hooks/useAuth";
 import { useUserRole } from "@/hooks/useUserRole";
 import { Loader2 } from "lucide-react";
 
 interface AdminRouteProps {
   children: React.ReactNode;
 }
 
 export function AdminRoute({ children }: AdminRouteProps) {
   const { isAuthenticated, isLoading: authLoading } = useAuth();
   const { isAdmin, isLoading: roleLoading } = useUserRole();
   const location = useLocation();
 
   if (authLoading || roleLoading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
         <Loader2 className="w-8 h-8 animate-spin text-primary" />
       </div>
     );
   }
 
   if (!isAuthenticated) {
     return <Navigate to="/auth" state={{ from: location }} replace />;
   }
 
   if (!isAdmin) {
     return <Navigate to="/dashboard" replace />;
   }
 
   return <>{children}</>;
 }