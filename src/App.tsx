import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "@/contexts/DataContext";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { ThemeApplicator } from "@/components/ThemeApplicator";
import { PersistentLayout } from "@/components/layout/PersistentLayout";
import { Suspense, lazy, useEffect, ComponentType } from "react";
import { PageLoadingFallback } from "@/components/layout/PageLoadingFallback";
import type { PermissionModule } from "@/hooks/usePermissions";

function lazyWithRetry(factory: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(() =>
    factory().catch((err) => {
      const retry = (attempt: number): Promise<{ default: ComponentType<any> }> => {
        if (attempt >= 3) {
          const reloaded = sessionStorage.getItem("chunk_reload");
          if (!reloaded) {
            sessionStorage.setItem("chunk_reload", "1");
            window.location.reload();
          } else {
            sessionStorage.removeItem("chunk_reload");
          }
          throw err;
        }
        return new Promise((resolve) => setTimeout(resolve, 1000 * attempt)).then(() => factory());
      };
      return retry(1);
    }),
  );
}

sessionStorage.removeItem("chunk_reload");

const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Agenda = lazyWithRetry(() => import("./pages/Agenda"));
const Pacientes = lazyWithRetry(() => import("./pages/Pacientes"));
const Prontuarios = lazyWithRetry(() => import("./pages/Prontuarios"));
const Profissionais = lazyWithRetry(() => import("./pages/Profissionais"));
const Financeiro = lazyWithRetry(() => import("./pages/Financeiro"));
const Servicos = lazyWithRetry(() => import("./pages/Servicos"));
const Comercial = lazyWithRetry(() => import("./pages/Comercial"));
const Engajamento = lazyWithRetry(() => import("./pages/Engajamento"));
const Configuracoes = lazyWithRetry(() => import("./pages/Configuracoes"));
const PatientPortal = lazyWithRetry(() => import("./pages/PatientPortal"));
const PreRegisto = lazyWithRetry(() => import("./pages/PreRegisto"));
const RelatorioResp = lazyWithRetry(() => import("./pages/RelatorioRespiratorio"));
const PortalVerificacao = lazyWithRetry(() => import("./pages/PortalVerificacao"));
const PortalOnboarding = lazyWithRetry(() => import("./pages/PortalOnboarding"));
const PortalLogin = lazyWithRetry(() => import("./pages/PortalLogin"));

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

function ProtectedPage({ children, module }: { children: React.ReactNode; module?: PermissionModule }) {
  const content = module ? <PermissionGuard module={module}>{children}</PermissionGuard> : children;

  return (
    <ProtectedRoute>
      <PersistentLayout>
        <Suspense fallback={<PageLoadingFallback />}>{content}</Suspense>
      </PersistentLayout>
    </ProtectedRoute>
  );
}

function AppWithGlobalHandler({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);
  return <>{children}</>;
}

const App = () => (
  <AppWithGlobalHandler>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LocaleProvider>
          <AuthProvider>
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
                  <Route
                    path="/pre-registo/:token"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <PreRegisto />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/portal/:token"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <PortalVerificacao />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/portal/login"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <PortalLogin />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/portal/onboarding"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <PortalOnboarding />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/r/:slug"
                    element={
                      <Suspense fallback={<PageLoadingFallback />}>
                        <PreRegisto />
                      </Suspense>
                    }
                  />

                  {/* Protected routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedPage>
                        <Dashboard />
                      </ProtectedPage>
                    }
                  />
                  <Route
                    path="/agenda"
                    element={
                      <ProtectedPage module="agenda">
                        <Agenda />
                      </ProtectedPage>
                    }
                  />
                  <Route
                    path="/pacientes"
                    element={
                      <ProtectedPage module="pacientes">
                        <Pacientes />
                      </ProtectedPage>
                    }
                  />
                  <Route
                    path="/prontuarios"
                    element={
                      <ProtectedPage module="prontuarios">
                        <Prontuarios />
                      </ProtectedPage>
                    }
                  />
                  <Route
                    path="/profissionais"
                    element={
                      <ProtectedPage module="profissionais">
                        <Profissionais />
                      </ProtectedPage>
                    }
                  />
                  <Route
                    path="/financeiro"
                    element={
                      <ProtectedPage module="financeiro">
                        <Financeiro />
                      </ProtectedPage>
                    }
                  />
                  <Route
                    path="/servicos"
                    element={
                      <ProtectedPage module="servicos">
                        <Servicos />
                      </ProtectedPage>
                    }
                  />
                  <Route
                    path="/comercial"
                    element={
                      <ProtectedPage module="comercial">
                        <Comercial />
                      </ProtectedPage>
                    }
                  />
                  <Route
                    path="/engajamento"
                    element={
                      <ProtectedPage module="engajamento">
                        <Engajamento />
                      </ProtectedPage>
                    }
                  />
                  <Route
                    path="/configuracoes"
                    element={
                      <ProtectedPage module="configuracoes">
                        <Configuracoes />
                      </ProtectedPage>
                    }
                  />

                  {/* ── Relatórios Respiratórios ── */}
                  <Route
                    path="/relatorios-respiratorios"
                    element={
                      <ProtectedPage>
                        <RelatorioResp />
                      </ProtectedPage>
                    }
                  />

                  {/* Patient Portal */}
                  <Route
                    path="/patient-portal"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<PageLoadingFallback />}>
                          <PatientPortal />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </DataProvider>
          </AuthProvider>
        </LocaleProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </AppWithGlobalHandler>
);

export default App;
