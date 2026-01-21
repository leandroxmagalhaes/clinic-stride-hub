import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SalesLead } from "@/services/LeadService";
import { UserPlus } from "lucide-react";

interface ConvertToPatientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: SalesLead | null;
  onConfirm: () => void;
  onSkip: () => void;
}

export function ConvertToPatientModal({
  open,
  onOpenChange,
  lead,
  onConfirm,
  onSkip,
}: ConvertToPatientModalProps) {
  const navigate = useNavigate();

  const handleConfirm = () => {
    onConfirm();
    // Navigate to patients page with lead data as query params
    const params = new URLSearchParams();
    if (lead?.name) params.set("name", lead.name);
    if (lead?.phone) params.set("phone", lead.phone);
    if (lead?.email) params.set("email", lead.email);
    params.set("leadId", lead?.id || "");
    navigate(`/pacientes?newPatient=true&${params.toString()}`);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-green-600" />
            </div>
            <AlertDialogTitle className="text-xl">
              Parabéns pela conversão! 🎉
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            O lead <strong>{lead?.name}</strong> foi movido para "Fechado/Ganho".
            <br /><br />
            Deseja cadastrar este prospect como <strong>Utente oficial</strong> agora?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onSkip}>
            Agora não
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className="bg-green-600 hover:bg-green-700">
            <UserPlus className="h-4 w-4 mr-2" />
            Cadastrar Utente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
