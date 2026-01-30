import React, { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Shield, FileText } from "lucide-react";

export const AppFooter = forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  function AppFooter(props, ref) {
    return (
      <footer 
        ref={ref} 
        className="border-t bg-muted/30 py-4 px-6 mt-auto" 
        {...props}
      >
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} Sistema de Gestão Clínica. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            <Link 
              to="/privacy" 
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Shield className="h-3.5 w-3.5" />
              Política de Privacidade
            </Link>
            <Link 
              to="/terms" 
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Termos de Uso
            </Link>
          </div>
        </div>
      </footer>
    );
  }
);
