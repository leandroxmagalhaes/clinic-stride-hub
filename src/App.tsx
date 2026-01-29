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
import Dashboard from "./pages/Dashboard";
import Agenda from "./pages/Agenda";
import Pacientes from "./pages/Pacientes";
import Prontuarios from "./pages/Prontuarios";
import Profissionais from "./pages/Profissionais";
import Financeiro from "./pages/Financeiro";
import Servicos from "./pages/Servicos";
import Comercial from "./pages/Comercial";
import Engajamento from "./pages/Engajamento";
import Configuracoes from "./pages/Configuracoes";
import PatientPortal from "./pages/PatientPortal";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

const queryClient = new QueryClient();

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
              
              {/* Protected routes with permission checks */}
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/agenda" element={
                <ProtectedRoute>
                  <PermissionGuard module="agenda"><Agenda /></PermissionGuard>
                </ProtectedRoute>
              } />
              <Route path="/pacientes" element={
                <ProtectedRoute>
                  <PermissionGuard module="pacientes"><Pacientes /></PermissionGuard>
                </ProtectedRoute>
              } />
              <Route path="/prontuarios" element={
                <ProtectedRoute>
                  <PermissionGuard module="prontuarios"><Prontuarios /></PermissionGuard>
                </ProtectedRoute>
              } />
              <Route path="/profissionais" element={
                <ProtectedRoute>
                  <PermissionGuard module="profissionais"><Profissionais /></PermissionGuard>
                </ProtectedRoute>
              } />
              <Route path="/financeiro" element={
                <ProtectedRoute>
                  <PermissionGuard module="financeiro"><Financeiro /></PermissionGuard>
                </ProtectedRoute>
              } />
              <Route path="/servicos" element={
                <ProtectedRoute>
                  <PermissionGuard module="servicos"><Servicos /></PermissionGuard>
                </ProtectedRoute>
              } />
              <Route path="/comercial" element={
                <ProtectedRoute>
                  <PermissionGuard module="comercial"><Comercial /></PermissionGuard>
                </ProtectedRoute>
              } />
              <Route path="/engajamento" element={
                <ProtectedRoute>
                  <PermissionGuard module="engajamento"><Engajamento /></PermissionGuard>
                </ProtectedRoute>
              } />
              <Route path="/configuracoes" element={
                <ProtectedRoute>
                  <PermissionGuard module="configuracoes"><Configuracoes /></PermissionGuard>
                </ProtectedRoute>
              } />
              
              {/* Patient Portal - role check is handled inside the component */}
              <Route path="/patient-portal" element={<ProtectedRoute><PatientPortal /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </LocaleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
