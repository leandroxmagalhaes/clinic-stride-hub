import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "@/contexts/DataContext";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LocaleProvider>
        <DataProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              
              {/* Protected routes */}
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
              <Route path="/pacientes" element={<ProtectedRoute><Pacientes /></ProtectedRoute>} />
              <Route path="/prontuarios" element={<ProtectedRoute><Prontuarios /></ProtectedRoute>} />
              <Route path="/profissionais" element={<ProtectedRoute><Profissionais /></ProtectedRoute>} />
              <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
              <Route path="/servicos" element={<ProtectedRoute><Servicos /></ProtectedRoute>} />
              <Route path="/comercial" element={<ProtectedRoute><Comercial /></ProtectedRoute>} />
              <Route path="/engajamento" element={<ProtectedRoute><Engajamento /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </LocaleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
