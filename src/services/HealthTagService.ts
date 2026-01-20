// HealthTagService - Business logic for patient health tags and scheduling validations (SRP)
// Implements soft-block warning system for scheduling conflicts

export type HealthTag = 
  | 'mobilidade_reduzida'
  | 'prefere_manha'
  | 'prefere_tarde'
  | 'dor_cronica'
  | 'idoso'
  | 'gestante'
  | 'necessita_acompanhante'
  | 'alergia_latex'
  | 'cardiopata'
  | 'diabetico';

export interface HealthTagConfig {
  id: HealthTag;
  label: string;
  color: string;
  icon?: string;
  description: string;
}

export interface ScheduleWarning {
  type: 'preference' | 'restriction' | 'info';
  severity: 'low' | 'medium' | 'high';
  message: string;
  tag: HealthTag;
}

export const HEALTH_TAG_CONFIG: Record<HealthTag, HealthTagConfig> = {
  mobilidade_reduzida: {
    id: 'mobilidade_reduzida',
    label: 'Mobilidade Reduzida',
    color: '#F59E0B',
    description: 'Paciente com dificuldade de locomoção',
  },
  prefere_manha: {
    id: 'prefere_manha',
    label: 'Prefere Manhã',
    color: '#3B82F6',
    description: 'Paciente prefere atendimento no período da manhã',
  },
  prefere_tarde: {
    id: 'prefere_tarde',
    label: 'Prefere Tarde',
    color: '#8B5CF6',
    description: 'Paciente prefere atendimento no período da tarde',
  },
  dor_cronica: {
    id: 'dor_cronica',
    label: 'Dor Crônica',
    color: '#EF4444',
    description: 'Paciente com quadro de dor crônica',
  },
  idoso: {
    id: 'idoso',
    label: 'Idoso (65+)',
    color: '#6B7280',
    description: 'Paciente idoso, requer atenção especial',
  },
  gestante: {
    id: 'gestante',
    label: 'Gestante',
    color: '#EC4899',
    description: 'Paciente gestante, protocolos especiais',
  },
  necessita_acompanhante: {
    id: 'necessita_acompanhante',
    label: 'Necessita Acompanhante',
    color: '#14B8A6',
    description: 'Paciente deve vir acompanhado',
  },
  alergia_latex: {
    id: 'alergia_latex',
    label: 'Alergia a Látex',
    color: '#F97316',
    description: 'Paciente alérgico a látex',
  },
  cardiopata: {
    id: 'cardiopata',
    label: 'Cardiopata',
    color: '#DC2626',
    description: 'Paciente com doença cardíaca',
  },
  diabetico: {
    id: 'diabetico',
    label: 'Diabético',
    color: '#7C3AED',
    description: 'Paciente diabético',
  },
};

export class HealthTagService {
  /**
   * Get all available health tags
   */
  static getAllTags(): HealthTagConfig[] {
    return Object.values(HEALTH_TAG_CONFIG);
  }

  /**
   * Get configuration for a specific tag
   */
  static getTagConfig(tag: HealthTag): HealthTagConfig | undefined {
    return HEALTH_TAG_CONFIG[tag];
  }

  /**
   * Parse health tags from string array to HealthTag array
   */
  static parseTags(tags: string[] | null | undefined): HealthTag[] {
    if (!tags || !Array.isArray(tags)) return [];
    return tags.filter((tag): tag is HealthTag => tag in HEALTH_TAG_CONFIG);
  }

  /**
   * Validate scheduling time against patient's health tags (soft-block system)
   * Returns warnings but doesn't prevent scheduling
   */
  static validateScheduling(
    healthTags: HealthTag[],
    scheduledHour: number
  ): ScheduleWarning[] {
    const warnings: ScheduleWarning[] = [];

    // Check morning preference conflict
    if (healthTags.includes('prefere_manha') && scheduledHour >= 12) {
      warnings.push({
        type: 'preference',
        severity: 'medium',
        message: 'Paciente prefere atendimentos pela manhã',
        tag: 'prefere_manha',
      });
    }

    // Check afternoon preference conflict
    if (healthTags.includes('prefere_tarde') && scheduledHour < 12) {
      warnings.push({
        type: 'preference',
        severity: 'medium',
        message: 'Paciente prefere atendimentos à tarde',
        tag: 'prefere_tarde',
      });
    }

    // Early morning warning for elderly patients
    if (healthTags.includes('idoso') && scheduledHour < 8) {
      warnings.push({
        type: 'info',
        severity: 'low',
        message: 'Horário muito cedo para paciente idoso',
        tag: 'idoso',
      });
    }

    // Late evening warning for elderly patients
    if (healthTags.includes('idoso') && scheduledHour >= 18) {
      warnings.push({
        type: 'info',
        severity: 'low',
        message: 'Horário tardio para paciente idoso',
        tag: 'idoso',
      });
    }

    // Companion reminder
    if (healthTags.includes('necessita_acompanhante')) {
      warnings.push({
        type: 'info',
        severity: 'medium',
        message: 'Lembrete: paciente necessita de acompanhante',
        tag: 'necessita_acompanhante',
      });
    }

    // Mobility reminder for early/late appointments
    if (healthTags.includes('mobilidade_reduzida') && (scheduledHour < 8 || scheduledHour >= 18)) {
      warnings.push({
        type: 'info',
        severity: 'low',
        message: 'Considere horário com menos movimento para facilitar acesso',
        tag: 'mobilidade_reduzida',
      });
    }

    return warnings;
  }

  /**
   * Get visual badge styling for a tag
   */
  static getTagBadgeStyle(tag: HealthTag): { backgroundColor: string; color: string } {
    const config = HEALTH_TAG_CONFIG[tag];
    if (!config) {
      return { backgroundColor: '#6B7280', color: '#FFFFFF' };
    }

    // Calculate contrasting text color
    const bgColor = config.color;
    return {
      backgroundColor: `${bgColor}20`, // 20% opacity background
      color: bgColor,
    };
  }

  /**
   * Check if patient has any critical health conditions
   */
  static hasCriticalConditions(healthTags: HealthTag[]): boolean {
    const criticalTags: HealthTag[] = ['cardiopata', 'gestante', 'dor_cronica'];
    return healthTags.some((tag) => criticalTags.includes(tag));
  }

  /**
   * Get priority tags (most important to display first)
   */
  static sortTagsByPriority(healthTags: HealthTag[]): HealthTag[] {
    const priorityOrder: HealthTag[] = [
      'gestante',
      'cardiopata',
      'dor_cronica',
      'alergia_latex',
      'diabetico',
      'idoso',
      'mobilidade_reduzida',
      'necessita_acompanhante',
      'prefere_manha',
      'prefere_tarde',
    ];

    return [...healthTags].sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a);
      const bIndex = priorityOrder.indexOf(b);
      return aIndex - bIndex;
    });
  }
}
