import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "@/contexts/DataContext";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { ThemeApplicator } from "@/components/ThemeApplicator";
import { PersistentLayout } from "@/components/layout/PersistentLayout";
import { Suspense, lazy } from "react";
import { PageLoadingFallback } from "@/components/layout/PageLoadingFallback";
import type { PermissionModule } from "@/hooks/usePermissions";

// Lazy load all page components
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Pacientes = lazy(() => import("./pages/Pacientes"));
const Prontuarios = lazy(() => import("./pages/Prontuarios"));
const Profissionais = lazy(() => import("./pages/Profissionais"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Servicos = lazy(() => import("./pages/Servicos"));
const Comercial = lazy(() => import("./pages/Comercial"));
const Engajamento = lazy(() => import("./pages/Engajamento"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const PatientPortal = lazy(() => import("./pages/PatientPortal"));
const PreRegisto = lazy(() => import("./pages/PreRegisto"));

// Non-lazy pages (auth/static - load immediately)
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

// Optimized QueryClient with intelligent caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes before data is considered stale
      gcTime: 30 * 60 * 1000,        // 30 minutes before garbage collection
      retry: 1,
      refetchOnWindowFocus: false,   // Prevent refetch when switching tabs
      refetchOnReconnect: false,     // Prevent refetch on reconnect
    },
  },
});

// Wrapper component for protected routes with Suspense
function ProtectedPage({ 
  children, 
  module 
}: { 
  children: React.ReactNode; 
  module?: PermissionModule;
}) {
  const content = module ? (
    <PermissionGuard module={module}>{children}</PermissionGuard>
  ) : (
    children
  );

  return (
    <ProtectedRoute>
      <PersistentLayout>
        <Suspense fallback={<PageLoadingFallback />}>
          {content}
        </Suspense>
      </PersistentLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LocaleProvider>
        <DataProvider>
          <ThemeApplicator />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/pre-registo/:token" element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <PreRegisto />
                </Suspense>
              } />
              
              {/* Protected routes with persistent layout */}
              <Route path="/" element={
                <ProtectedPage>
                  <Dashboard />
                </ProtectedPage>
              } />
              <Route path="/agenda" element={
                <ProtectedPage module="agenda">
                  <Agenda />
                </ProtectedPage>
              } />
              <Route path="/pacientes" element={
                <ProtectedPage module="pacientes">
                  <Pacientes />
                </ProtectedPage>
              } />
              <Route path="/prontuarios" element={
                <ProtectedPage module="prontuarios">
                  <Prontuarios />
                </ProtectedPage>
              } />
              <Route path="/profissionais" element={
                <ProtectedPage module="profissionais">
                  <Profissionais />
                </ProtectedPage>
              } />
              <Route path="/financeiro" element={
                <ProtectedPage module="financeiro">
                  <Financeiro />
                </ProtectedPage>
              } />
              <Route path="/servicos" element={
                <ProtectedPage module="servicos">
                  <Servicos />
                </ProtectedPage>
              } />
              <Route path="/comercial" element={
                <ProtectedPage module="comercial">
                  <Comercial />
                </ProtectedPage>
              } />
              <Route path="/engajamento" element={
                <ProtectedPage module="engajamento">
                  <Engajamento />
                </ProtectedPage>
              } />
              <Route path="/configuracoes" element={
                <ProtectedPage module="configuracoes">
                  <Configuracoes />
                </ProtectedPage>
              } />
              
              {/* Patient Portal - special handling */}
              <Route path="/patient-portal" element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <PatientPortal />
                  </Suspense>
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </LocaleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
