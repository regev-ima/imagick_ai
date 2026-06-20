import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { useAuth } from "./hooks/useAuth";
import { useSessionTracker } from "./hooks/useSessionTracker";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { ImpersonationProvider } from "./hooks/useImpersonation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
      retry: 1,
    },
  },
});
const AuthPage = lazy(() => import("./pages/AuthPage"));
const DashboardLayout = lazy(() => import("./components/layout/DashboardLayout"));
const DashboardHome = lazy(() => import("./pages/dashboard/DashboardHome"));
const GalleriesPage = lazy(() => import("./pages/dashboard/GalleriesPage"));
const GalleryEditorPage = lazy(() => import("./pages/dashboard/GalleryEditorPage"));
const CreateGalleryPage = lazy(() => import("./pages/dashboard/CreateGalleryPage"));
const StylesPage = lazy(() => import("./pages/dashboard/StylesPage"));
const StyleDetailsPage = lazy(() => import("./pages/dashboard/StyleDetailsPage"));
const CreateStylePage = lazy(() => import("./pages/dashboard/CreateStylePage"));
const BillingPage = lazy(() => import("./pages/dashboard/BillingPage"));
const SettingsPage = lazy(() => import("./pages/dashboard/SettingsPage"));
const ClientGalleryPage = lazy(() => import("./pages/ClientGalleryPage"));
const ShortLinkRedirect = lazy(() => import("./pages/ShortLinkRedirect"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const UnsubscribePage = lazy(() => import("./pages/UnsubscribePage"));
const PrivacyPage = lazy(() => import("./pages/legal/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/legal/TermsPage"));
const AdminDashboard = lazy(() => import("./pages/dashboard/admin/AdminDashboard"));
const UsersManagement = lazy(() => import("./pages/dashboard/admin/UsersManagement"));
const PlansManagement = lazy(() => import("./pages/dashboard/admin/PlansManagement"));
const StylesManagement = lazy(() => import("./pages/dashboard/admin/StylesManagement"));
const GalleriesManagement = lazy(() => import("./pages/dashboard/admin/GalleriesManagement"));
const BrandingManagement = lazy(() => import("./pages/dashboard/admin/BrandingManagement"));
const ShowcaseManager = lazy(() => import("./pages/dashboard/admin/ShowcaseManager"));
const EmailLogsPage = lazy(() => import("./pages/dashboard/admin/EmailLogsPage"));
const EmailTemplatesPage = lazy(() => import("./pages/dashboard/admin/EmailTemplatesPage"));
const NotificationsSettingsPage = lazy(() => import("./pages/dashboard/admin/NotificationsSettingsPage"));
const CustomerJourneyPage = lazy(() => import("./pages/dashboard/admin/CustomerJourneyPage"));
const EmailSequencesPage = lazy(() => import("./pages/dashboard/admin/EmailSequencesPage"));
const OnboardingInsightsPage = lazy(() => import("./pages/dashboard/admin/OnboardingInsightsPage"));
const SubscribersManagement = lazy(() => import("./pages/dashboard/admin/SubscribersManagement"));
const PayPalSettingsPage = lazy(() => import("./pages/dashboard/admin/PayPalSettingsPage"));
const LeadImportsPage = lazy(() => import("./pages/dashboard/admin/LeadImportsPage"));
const LeadCampaignsPage = lazy(() => import("./pages/dashboard/admin/LeadCampaignsPage"));
const LeadTemplatesPage = lazy(() => import("./pages/dashboard/admin/LeadTemplatesPage"));
const LeadAnalyticsPage = lazy(() => import("./pages/dashboard/admin/LeadAnalyticsPage"));
const UserDetailPage = lazy(() => import("./pages/dashboard/admin/UserDetailPage"));
// Internal design exploration — "create a new collection" concepts (static mocks).
const CreateConceptIndex = lazy(() => import("./pages/preview/CreateConceptIndex"));
const CreateConceptPlan = lazy(() => import("./pages/preview/CreateConceptPlan"));
const CreateConceptChat = lazy(() => import("./pages/preview/CreateConceptChat"));
const CreateConceptCanvas = lazy(() => import("./pages/preview/CreateConceptCanvas"));

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <svg className="w-6 h-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  </div>
);

function SessionTrackerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  useSessionTracker(user?.id ?? null);
  return <>{children}</>;
}

const App = () => (
  <ThemeProvider defaultTheme="dark" storageKey="imagick-ui-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "group border-border bg-background text-foreground",
              description: "!opacity-100 group-[.toast]:!text-current",
              success:
                "!bg-green-50 !border-green-500/60 !text-green-800 dark:!bg-green-500/10 dark:!border-green-500/50 dark:!text-green-300",
              error:
                "!bg-red-50 !border-destructive/60 !text-red-800 dark:!bg-destructive/10 dark:!border-destructive/50 dark:!text-destructive",
              warning:
                "!bg-yellow-50 !border-yellow-500/60 !text-yellow-800 dark:!bg-yellow-500/10 dark:!border-yellow-500/50 dark:!text-yellow-300",
              info:
                "!bg-primary/5 !border-primary/60 !text-primary dark:!bg-primary/10 dark:!border-primary/50",
            }
          }}
        />
        <BrowserRouter>
          <ImpersonationProvider>
            <SessionTrackerProvider>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                {/* Redirect home to auth - no landing page */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/unsubscribe" element={<UnsubscribePage />} />
                <Route path="/legal/privacy" element={<PrivacyPage />} />
                <Route path="/legal/terms" element={<TermsPage />} />
                <Route path="/g/:shortId" element={<ShortLinkRedirect />} />
                <Route path="/gallery/:galleryId" element={<ClientGalleryPage />} />
                {/* Internal design exploration — create-collection concepts (wired to the real backend; auth required) */}
                <Route path="/preview/create" element={<ProtectedRoute><CreateConceptIndex /></ProtectedRoute>} />
                <Route path="/preview/create-a" element={<ProtectedRoute><CreateConceptPlan /></ProtectedRoute>} />
                <Route path="/preview/create-b" element={<ProtectedRoute><CreateConceptChat /></ProtectedRoute>} />
                <Route path="/preview/create-c" element={<ProtectedRoute><CreateConceptCanvas /></ProtectedRoute>} />
                <Route
                  path="/dashboard"
                  element={(
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  )}
                >
                  <Route index element={<DashboardHome />} />
                  <Route path="galleries" element={<GalleriesPage />} />
                  <Route path="galleries/new" element={<CreateGalleryPage />} />
                  <Route path="galleries/:id" element={<GalleryEditorPage />} />
                  <Route path="styles" element={<StylesPage />} />
                  <Route path="styles/new" element={<CreateStylePage />} />
                  <Route path="styles/:styleId" element={<StyleDetailsPage />} />
                  <Route path="billing" element={<BillingPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  {/* Admin Routes */}
                  <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                  <Route path="admin/users" element={<AdminRoute><UsersManagement /></AdminRoute>} />
                  <Route path="admin/users/:userId" element={<AdminRoute><UserDetailPage /></AdminRoute>} />
                  <Route path="admin/plans" element={<AdminRoute><PlansManagement /></AdminRoute>} />
                  <Route path="admin/styles" element={<AdminRoute><StylesManagement /></AdminRoute>} />
                  <Route path="admin/galleries" element={<AdminRoute><GalleriesManagement /></AdminRoute>} />
                  <Route path="admin/branding" element={<AdminRoute><BrandingManagement /></AdminRoute>} />
                  <Route path="admin/showcase" element={<AdminRoute><ShowcaseManager /></AdminRoute>} />
                  <Route path="admin/email-logs" element={<AdminRoute><EmailLogsPage /></AdminRoute>} />
                  <Route path="admin/email-templates" element={<AdminRoute><EmailTemplatesPage /></AdminRoute>} />
                  <Route path="admin/notifications" element={<AdminRoute><NotificationsSettingsPage /></AdminRoute>} />
                  <Route path="admin/customer-journey" element={<AdminRoute><CustomerJourneyPage /></AdminRoute>} />
                  <Route path="admin/email-sequences" element={<AdminRoute><EmailSequencesPage /></AdminRoute>} />
                  <Route path="admin/onboarding-insights" element={<AdminRoute><OnboardingInsightsPage /></AdminRoute>} />
                  <Route path="admin/subscribers" element={<AdminRoute><SubscribersManagement /></AdminRoute>} />
                  <Route path="admin/paypal" element={<AdminRoute><PayPalSettingsPage /></AdminRoute>} />
                  <Route path="admin/lead-imports" element={<AdminRoute><LeadImportsPage /></AdminRoute>} />
                  <Route path="admin/lead-campaigns" element={<AdminRoute><LeadCampaignsPage /></AdminRoute>} />
                  <Route path="admin/lead-templates" element={<AdminRoute><LeadTemplatesPage /></AdminRoute>} />
                  <Route path="admin/lead-analytics" element={<AdminRoute><LeadAnalyticsPage /></AdminRoute>} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </SessionTrackerProvider>
          </ImpersonationProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
