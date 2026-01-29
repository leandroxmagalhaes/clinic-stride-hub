// PatientImportService - Handles batch import of patients from Excel/CSV files
import * as XLSX from 'xlsx';
import { CreatePatientData } from '@/services/PatientService';
import { supabase } from '@/integrations/supabase/client';

export interface ImportRow {
  nome: string;
  nif: string;
  telefone?: string;
  email?: string;
  nascimento?: string;
  genero?: string;
  morada?: string;
  contato_emergencia?: string;
  telefone_emergencia?: string;
  seguradora?: string;
  observacoes?: string;
}

export interface ValidationResult {
  row: number;
  valid: boolean;
  errors: string[];
  data?: CreatePatientData;
  originalData: ImportRow;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Parse date from DD/MM/YYYY or DD-MM-YYYY format to YYYY-MM-DD
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Try DD/MM/YYYY or DD-MM-YYYY format
  const match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    
    // Basic validation
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  
  // Try YYYY-MM-DD format (already correct)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return dateStr;
  }
  
  return null;
}

// Normalize gender value
function normalizeGender(gender: string | undefined): string | null {
  if (!gender) return null;
  const g = gender.trim().toUpperCase();
  if (g === 'M' || g === 'MASCULINO' || g === 'MALE') return 'M';
  if (g === 'F' || g === 'FEMININO' || g === 'FEMALE') return 'F';
  if (g === 'O' || g === 'OUTRO' || g === 'OTHER') return 'O';
  return null;
}

// Clean string value
function cleanString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export class PatientImportService {
  // Parse Excel or CSV file and return rows
  static async parseFile(file: File): Promise<ImportRow[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', raw: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: false,
      defval: '',
    });
    
    // Map column names (case-insensitive, handle common variations)
    return rawData.map((row) => {
      const normalizedRow: Record<string, string> = {};
      
      // Create case-insensitive lookup
      Object.entries(row).forEach(([key, value]) => {
        normalizedRow[key.toLowerCase().trim()] = cleanString(value);
      });
      
      return {
        nome: normalizedRow['nome'] || normalizedRow['name'] || normalizedRow['nome completo'] || normalizedRow['full_name'] || '',
        nif: normalizedRow['nif'] || normalizedRow['cpf'] || normalizedRow['tax_id'] || normalizedRow['fiscal'] || '',
        telefone: normalizedRow['telefone'] || normalizedRow['phone'] || normalizedRow['tel'] || normalizedRow['telemóvel'] || '',
        email: normalizedRow['email'] || normalizedRow['e-mail'] || normalizedRow['mail'] || '',
        nascimento: normalizedRow['nascimento'] || normalizedRow['birth_date'] || normalizedRow['data_nascimento'] || normalizedRow['data de nascimento'] || '',
        genero: normalizedRow['genero'] || normalizedRow['género'] || normalizedRow['gender'] || normalizedRow['sexo'] || '',
        morada: normalizedRow['morada'] || normalizedRow['address'] || normalizedRow['endereco'] || normalizedRow['endereço'] || '',
        contato_emergencia: normalizedRow['contato_emergencia'] || normalizedRow['contato emergencia'] || normalizedRow['emergency_contact'] || normalizedRow['contato de emergência'] || '',
        telefone_emergencia: normalizedRow['telefone_emergencia'] || normalizedRow['telefone emergencia'] || normalizedRow['emergency_phone'] || normalizedRow['telefone de emergência'] || '',
        seguradora: normalizedRow['seguradora'] || normalizedRow['health_insurance'] || normalizedRow['seguro'] || normalizedRow['plano'] || '',
        observacoes: normalizedRow['observacoes'] || normalizedRow['observações'] || normalizedRow['notes'] || normalizedRow['notas'] || '',
      };
    });
  }

  // Validate a single row
  static validateRow(row: ImportRow, rowNumber: number): ValidationResult {
    const errors: string[] = [];
    
    // Required fields
    if (!row.nome || row.nome.trim().length < 3) {
      errors.push('Nome deve ter pelo menos 3 caracteres');
    }
    if (!row.nif || row.nif.trim() === '') {
      errors.push('NIF é obrigatório');
    }
    
    // Optional field validations (only if provided)
    if (row.telefone && row.telefone.replace(/\D/g, '').length < 9) {
      errors.push('Telefone inválido (mínimo 9 dígitos)');
    }
    if (row.email && !EMAIL_REGEX.test(row.email)) {
      errors.push('Email inválido');
    }
    if (row.nascimento && !parseDate(row.nascimento)) {
      errors.push('Data de nascimento inválida (use DD/MM/AAAA)');
    }
    if (row.genero && !normalizeGender(row.genero)) {
      errors.push('Gênero inválido (use M, F ou O)');
    }
    
    const isValid = errors.length === 0;
    
    return {
      row: rowNumber,
      valid: isValid,
      errors,
      originalData: row,
      data: isValid ? {
        full_name: row.nome.trim(),
        cpf: row.nif.trim(),
        phone: row.telefone?.trim() || undefined,
        email: row.email?.trim() || undefined,
        birth_date: row.nascimento ? parseDate(row.nascimento) || undefined : undefined,
        gender: normalizeGender(row.genero) || undefined,
        address: row.morada?.trim() || undefined,
        emergency_contact: row.contato_emergencia?.trim() || undefined,
        emergency_phone: row.telefone_emergencia?.trim() || undefined,
        health_insurance: row.seguradora?.trim() || undefined,
        notes: row.observacoes?.trim() || undefined,
      } : undefined,
    };
  }

  // Validate all rows
  static validateRows(rows: ImportRow[]): ValidationResult[] {
    return rows.map((row, index) => this.validateRow(row, index + 1));
  }

  // Import valid patients to database
  static async importPatients(
    validatedRows: ValidationResult[],
    clinicId: string
  ): Promise<ImportResult> {
    const validRows = validatedRows.filter(r => r.valid && r.data);
    const invalidRows = validatedRows.filter(r => !r.valid);
    
    if (validRows.length === 0) {
      return {
        total: validatedRows.length,
        success: 0,
        failed: invalidRows.length,
        errors: invalidRows.map(r => ({ 
          row: r.row, 
          message: r.errors.join(', ') 
        })),
      };
    }
    
    // Prepare data for insertion
    const patientsToInsert = validRows.map(r => ({
      clinic_id: clinicId,
      full_name: r.data!.full_name,
      cpf: r.data!.cpf || null,
      phone: r.data!.phone || null,
      email: r.data!.email || null,
      birth_date: r.data!.birth_date || null,
      gender: r.data!.gender || null,
      address: r.data!.address || null,
      emergency_contact: r.data!.emergency_contact || null,
      emergency_phone: r.data!.emergency_phone || null,
      health_insurance: r.data!.health_insurance || null,
      notes: r.data!.notes || null,
      privacy_consent_at: new Date().toISOString(),
      is_active: true,
      health_tags: [],
    }));
    
    const { data, error } = await supabase
      .from('pacientes')
      .insert(patientsToInsert)
      .select();
    
    if (error) {
      console.error('Erro ao importar pacientes:', error);
      return {
        total: validatedRows.length,
        success: 0,
        failed: validatedRows.length,
        errors: [{ row: 0, message: `Erro na inserção: ${error.message}` }],
      };
    }
    
    return {
      total: validatedRows.length,
      success: data?.length || 0,
      failed: invalidRows.length,
      errors: invalidRows.map(r => ({ 
        row: r.row, 
        message: r.errors.join(', ') 
      })),
    };
  }

  // Generate downloadable template file
  static generateTemplate(): Blob {
    const headers = [
      'nome',
      'nif',
      'telefone',
      'email',
      'nascimento',
      'genero',
      'morada',
      'contato_emergencia',
      'telefone_emergencia',
      'seguradora',
      'observacoes',
    ];
    
    const exampleRow = [
      'João Silva',
      '123456789',
      '+351912345678',
      'joao@email.com',
      '15/03/1985',
      'M',
      'Rua Principal, 123, Lisboa',
      'Maria Silva',
      '+351923456789',
      'ADSE',
      'Paciente regular',
    ];
    
    const instructionRow = [
      '* OBRIGATÓRIO',
      '* OBRIGATÓRIO',
      'Opcional (mín. 9 dígitos)',
      'Opcional',
      'Opcional (DD/MM/AAAA)',
      'Opcional (M, F ou O)',
      'Opcional',
      'Opcional',
      'Opcional',
      'Opcional',
      'Opcional',
    ];
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      headers,
      instructionRow,
      exampleRow,
    ]);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // nome
      { wch: 15 }, // nif
      { wch: 18 }, // telefone
      { wch: 25 }, // email
      { wch: 15 }, // nascimento
      { wch: 10 }, // genero
      { wch: 35 }, // morada
      { wch: 20 }, // contato_emergencia
      { wch: 18 }, // telefone_emergencia
      { wch: 15 }, // seguradora
      { wch: 30 }, // observacoes
    ];
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pacientes');
    
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    return new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  }

  // Download template
  static downloadTemplate(): void {
    const blob = this.generateTemplate();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_importacao_pacientes.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
