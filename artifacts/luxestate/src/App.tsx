import { Switch, Route, Redirect, Router as WouterRouter } from "wouter"
import { Component, type ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/query-client"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { useCurrentUser } from "@/lib/user-api"
import { Loader2 } from "lucide-react"
import OnboardingPage from "@/pages/onboarding"
import { PlanProvider } from "@/lib/plan-context"
import { PermissionsProvider, usePermissions } from "@/lib/permissions-context"
import { AccessDenied } from "@/components/dashboard/access-denied"

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-3xl">⚠️</div>
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{this.state.error.message}</p>
          <button
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => { this.setState({ error: null }); window.location.href = "/dashboard" }}
          >
            Return to Dashboard
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

import NotFound from "@/pages/not-found"
import MarketingPage from "@/pages/marketing"
import SignInPage from "@/pages/auth/sign-in"
import SignUpPage from "@/pages/auth/sign-up"
import ForgotPasswordPage from "@/pages/auth/forgot-password"
import AcceptInvitePage from "@/pages/auth/accept-invite"
import { DashboardLayout } from "@/pages/dashboard/layout"
import OverviewPage from "@/pages/dashboard/overview"
import LeadsPage from "@/pages/dashboard/leads"
import LeadProfilePage from "@/pages/dashboard/lead-profile"
import PropertiesPage from "@/pages/dashboard/properties"
import MessagesPage from "@/pages/dashboard/messages"
import AnalyticsPage from "@/pages/dashboard/analytics"
import AIIntelligencePage from "@/pages/dashboard/ai-intelligence"
import AutomationsPage from "@/pages/dashboard/automations"
import TeamPage from "@/pages/dashboard/team"
import DealsPage from "@/pages/dashboard/deals"
import DocumentsPage from "@/pages/dashboard/documents"
import CalendarPage from "@/pages/dashboard/calendar"
import SettingsPage from "@/pages/dashboard/settings"
import IntegrationsPage from "@/pages/dashboard/integrations"
import CalculatorPage from "@/pages/dashboard/calculator"
import DealersPage from "@/pages/dashboard/dealers"
import BillingPage from "@/pages/dashboard/billing"
import { AdminLayout } from "@/pages/admin/layout"
import AdminOverview from "@/pages/admin/overview"
import AdminOrganizations from "@/pages/admin/organizations"
import AdminPayments from "@/pages/admin/payments"
import AdminAiUsage from "@/pages/admin/ai-usage"
import AdminAuditLogs from "@/pages/admin/audit-logs"
import AdminSupport from "@/pages/admin/support"
import AdminAiSettings from "@/pages/admin/ai-settings"
import AIUsagePage from "@/pages/dashboard/ai-usage"
import { LanguageProvider } from "@/lib/i18n"

const basePath = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")

function LoadingScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/25">
          <span className="text-xl font-bold text-primary-foreground">L</span>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!session) return <Redirect to="/sign-in" />
  return <>{children}</>
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useCurrentUser(session?.user?.id)
  if (loading || (!!session && profileLoading)) return <LoadingScreen />
  if (!session) return <Redirect to="/sign-in" />
  if (profile && !profile.onboarded) return <Redirect to="/onboarding" />
  return <>{children}</>
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useCurrentUser(session?.user?.id)
  if (loading || (!!session && profileLoading)) return <LoadingScreen />
  if (!session) return <Redirect to="/sign-in" />
  if (profile?.onboarded) return <Redirect to="/dashboard" />
  return <>{children}</>
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (session) return <Redirect to="/dashboard" />
  return <>{children}</>
}

function HomeRedirect() {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (session) return <Redirect to="/dashboard" />
  return <MarketingPage />
}

function PermissionGuard({
  resource,
  children,
}: {
  resource: string
  children: React.ReactNode
}) {
  const { canView, isAdmin, isLoading } = usePermissions()
  if (isLoading) return <LoadingScreen />
  if (isAdmin || canView(resource)) return <>{children}</>
  return <AccessDenied resource={resource} />
}

function DashboardRoutes() {
  return (
    <OnboardingGuard>
      <DashboardLayout>
        <Switch>
          <Route path="/dashboard" component={OverviewPage} />
          <Route path="/dashboard/leads">
            <PermissionGuard resource="leads"><LeadsPage /></PermissionGuard>
          </Route>
          <Route path="/dashboard/properties">
            <PermissionGuard resource="properties"><PropertiesPage /></PermissionGuard>
          </Route>
          <Route path="/dashboard/messages">
            <PermissionGuard resource="messages"><MessagesPage /></PermissionGuard>
          </Route>
          <Route path="/dashboard/analytics">
            <PermissionGuard resource="analytics"><AnalyticsPage /></PermissionGuard>
          </Route>
          <Route path="/dashboard/ai-intelligence">
            <PermissionGuard resource="ai_intelligence"><AIIntelligencePage /></PermissionGuard>
          </Route>
          <Route path="/dashboard/automations">
            <PermissionGuard resource="automations"><AutomationsPage /></PermissionGuard>
          </Route>
          <Route path="/dashboard/team">
            <PermissionGuard resource="team"><TeamPage /></PermissionGuard>
          </Route>
          <Route path="/dashboard/deals">
            <PermissionGuard resource="deals"><DealsPage /></PermissionGuard>
          </Route>
          <Route path="/dashboard/documents">
            <PermissionGuard resource="documents"><DocumentsPage /></PermissionGuard>
          </Route>
          <Route path="/dashboard/calendar">
            <PermissionGuard resource="calendar"><CalendarPage /></PermissionGuard>
          </Route>
          <Route path="/dashboard/settings">
            <PermissionGuard resource="settings"><SettingsPage /></PermissionGuard>
          </Route>
          <Route path="/dashboard/integrations">
            <PermissionGuard resource="leads"><IntegrationsPage /></PermissionGuard>
          </Route>
          <Route path="/dashboard/dealers">
            <PermissionGuard resource="dealers"><DealersPage /></PermissionGuard>
          </Route>
          <Route path="/dashboard/calculator" component={CalculatorPage} />
          <Route path="/dashboard/billing" component={BillingPage} />
          <Route path="/dashboard/ai-usage" component={AIUsagePage} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    </OnboardingGuard>
  )
}

function LeadProfileRoute({ params }: { params: { id: string } }) {
  return (
    <OnboardingGuard>
      <DashboardLayout>
        <PermissionGuard resource="leads">
          <LeadProfilePage params={params} />
        </PermissionGuard>
      </DashboardLayout>
    </OnboardingGuard>
  )
}

function AdminRoutes() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Switch>
          <Route path="/admin" component={AdminOverview} />
          <Route path="/admin/organizations" component={AdminOrganizations} />
          <Route path="/admin/payments" component={AdminPayments} />
          <Route path="/admin/ai-usage" component={AdminAiUsage} />
          <Route path="/admin/ai-settings" component={AdminAiSettings} />
          <Route path="/admin/audit-logs" component={AdminAuditLogs} />
          <Route path="/admin/support" component={AdminSupport} />
          <Route component={NotFound} />
        </Switch>
      </AdminLayout>
    </ProtectedRoute>
  )
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in">
        <PublicOnlyRoute><SignInPage /></PublicOnlyRoute>
      </Route>
      <Route path="/sign-up">
        <PublicOnlyRoute><SignUpPage /></PublicOnlyRoute>
      </Route>
      <Route path="/accept-invite" component={AcceptInvitePage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/onboarding">
        <OnboardingRoute><OnboardingPage /></OnboardingRoute>
      </Route>
      <Route path="/dashboard/leads/:id" component={LeadProfileRoute} />
      <Route path="/dashboard" component={DashboardRoutes} />
      <Route path="/dashboard/:rest*" component={DashboardRoutes} />
      <Route path="/admin" component={AdminRoutes} />
      <Route path="/admin/:rest*" component={AdminRoutes} />
      <Route component={NotFound} />
    </Switch>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <WouterRouter base={basePath}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider
            attribute="class"
            defaultTheme="gold"
            storageKey="luxestate-theme"
            enableSystem={false}
            themes={["light", "dark", "midnight", "corporate-blue", "emerald", "gold", "modern-gray", "ocean", "ocean-dark", "rose", "rose-dark", "slate", "slate-dark", "violet", "violet-dark"]}
          >
            <TooltipProvider>
              <LanguageProvider>
                <AuthProvider>
                  <PlanProvider>
                    <PermissionsProvider>
                      <ErrorBoundary>
                        <Router />
                      </ErrorBoundary>
                      <Toaster />
                    </PermissionsProvider>
                  </PlanProvider>
                </AuthProvider>
              </LanguageProvider>
            </TooltipProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </WouterRouter>
    </ErrorBoundary>
  )
}

export default App
