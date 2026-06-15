import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search,
  Shield,
  ShieldCheck,
  User,
  MoreHorizontal,
  ArrowLeft,
  Eye,
  Gift,
  BarChart3,
  LogIn,
  Undo2,
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
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { GrantCreditsModal } from "@/components/admin/GrantCreditsModal";
import { useAuth } from "@/hooks/useAuth";
import { useImpersonation } from "@/hooks/useImpersonation";

interface AdminUser {
  id: string;
  email: string;
  provider: string;
  created_at: string;
  last_sign_in_at: string | null;
  full_name: string | null;
  role: string | null;
  can_view_analytics: boolean;
  plan_name: string;
  galleries_count: number;
  images_count: number;
  edits_count: number;
}

export default function UsersManagement() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { isImpersonating, targetUser, startImpersonation, stopImpersonation } = useImpersonation();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [grantTarget, setGrantTarget] = useState<{ userId: string; email: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-list-users`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      return data.users;
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "moderator" | "user" | null }) => {
      if (role === null) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("User role updated");
    },
    onError: () => toast.error("Failed to update role"),
  });

  const toggleAnalyticsMutation = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: string; enabled: boolean }) => {
      // Ensure user has a row in user_roles first
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("user_roles")
          .update({ can_view_analytics: enabled })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, can_view_analytics: enabled });
        if (error) throw error;
      }
    },
    onSuccess: (_, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success(enabled ? "Analytics access granted" : "Analytics access revoked");
    },
    onError: () => toast.error("Failed to update analytics access"),
  });

  const getRoleBadge = (role: string | null) => {
    if (role === "admin") return <Badge variant="destructive">Admin</Badge>;
    if (role === "moderator")
      return (
        <Badge
          className="border-[hsl(var(--rating)/0.4)] bg-[hsl(var(--rating)/0.15)] text-[hsl(var(--rating))]"
        >
          Moderator
        </Badge>
      );
    return <Badge variant="outline">User</Badge>;
  };

  const filtered = users.filter((u) => {
    if (roleFilter !== "all") {
      if (roleFilter === "user" && u.role !== null) return false;
      if (roleFilter !== "user" && u.role !== roleFilter) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q);
    }
    return true;
  });

  const openDetail = (id: string) => {
    navigate(`/dashboard/admin/users/${id}`);
  };

  const handleStartImpersonation = (target: AdminUser) => {
    if (!currentUser?.id) return;
    if (target.id === currentUser.id) {
      toast.info("You are already this user");
      return;
    }

    startImpersonation({
      id: target.id,
      email: target.email,
      fullName: target.full_name,
    });
    toast.success(`Now viewing as ${target.email}`);
    navigate("/dashboard/galleries");
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
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Users Management</h1>
            <p className="caption mt-1 flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              {users.length} users total
            </p>
          </div>
          {isImpersonating && targetUser && (
            <Button
              variant="outline"
              className="ml-auto gap-2"
              onClick={() => {
                stopImpersonation();
                toast.success("Impersonation stopped");
              }}
            >
              <Undo2 className="w-4 h-4" />
              Exit {targetUser.email}
            </Button>
          )}
        </div>

        <div className="glass-card overflow-hidden rounded-[--radius]">
          {/* Toolbar — search + filter */}
          <div className="flex flex-col justify-between gap-3 border-b border-border bg-background/40 p-3 sm:flex-row">
            <div className="flex max-w-md flex-1 items-center gap-2 rounded-[--radius] border border-border bg-background px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 border-0 bg-transparent px-0 focus-visible:ring-0"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="moderator">Moderators</SelectItem>
                <SelectItem value="user">Users</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="caption py-12 text-center">Loading users…</div>
          ) : filtered.length === 0 ? (
            <div className="caption py-12 text-center">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="aura-microlabel">Email</TableHead>
                    <TableHead className="aura-microlabel">Auth</TableHead>
                    <TableHead className="aura-microlabel">Role</TableHead>
                    <TableHead className="aura-microlabel">Sign Up</TableHead>
                    <TableHead className="aura-microlabel text-center">Collections</TableHead>
                    <TableHead className="aura-microlabel text-center">Images</TableHead>
                    <TableHead className="aura-microlabel text-center">Edits</TableHead>
                    <TableHead className="aura-microlabel text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((user) => (
                    <TableRow
                      key={user.id}
                      className={`cursor-pointer hover:bg-foreground/[0.03] ${targetUser?.id === user.id ? "bg-primary/5" : ""}`}
                      onClick={() => openDetail(user.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-[200px] truncate font-medium">{user.email}</p>
                            {user.full_name && (
                              <p className="truncate text-xs text-muted-foreground">{user.full_name}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.provider === "google" ? "default" : "outline"} className="text-xs">
                          {user.provider === "google" ? "Google" : "Email"}
                        </Badge>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="folio text-sm text-muted-foreground">
                        {format(new Date(user.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="folio text-center">{user.galleries_count}</TableCell>
                      <TableCell className="folio text-center">{user.images_count}</TableCell>
                      <TableCell className="folio text-center">{user.edits_count}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openDetail(user.id)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ userId: user.id, role: "admin" })}>
                                <ShieldCheck className="w-4 h-4 mr-2" /> Make Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ userId: user.id, role: "moderator" })}>
                                <Shield className="w-4 h-4 mr-2" /> Make Moderator
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ userId: user.id, role: null })}>
                                <User className="w-4 h-4 mr-2" /> Remove Role
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setGrantTarget({ userId: user.id, email: user.email })}>
                                <Gift className="w-4 h-4 mr-2" /> Grant Credits
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleAnalyticsMutation.mutate({ userId: user.id, enabled: !user.can_view_analytics })}>
                                <BarChart3 className="w-4 h-4 mr-2" /> {user.can_view_analytics ? "Revoke Analytics" : "Grant Analytics"}
                              </DropdownMenuItem>
                              {currentUser?.id !== user.id && (
                                <DropdownMenuItem onClick={() => handleStartImpersonation(user)}>
                                  <LogIn className="w-4 h-4 mr-2" /> {targetUser?.id === user.id ? "Re-open as User" : "Impersonate User"}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {grantTarget && (
          <GrantCreditsModal
            isOpen={!!grantTarget}
            onClose={() => setGrantTarget(null)}
            userId={grantTarget.userId}
            userEmail={grantTarget.email}
            onGranted={() => {
              setGrantTarget(null);
              queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
            }}
          />
        )}
      </div>
    </div>
  );
}
