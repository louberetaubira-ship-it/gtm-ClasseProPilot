import { Diploma, CompetencyCode, ActivityCode } from '../types';

export const DEFAULT_DIPLOMAS: Diploma[] = [
  {
    id: 'bac-pro-melec-default',
    name: 'BAC PRO MELEC',
    repository: {
      savoirs: [
        { code: 'S01', label: "Chaîne d'énergie" },
        { code: 'S02', label: "Chaîne d'informations" },
        { code: 'S03', label: "Grandeurs électriques, mécaniques, dimensionnelles" },
        { code: 'S04', label: "Ressources et outils professionnels" },
        { code: 'S05', label: "Qualité - Santé - Sécurité - Environnement (QSSE)" },
        { code: 'S06', label: "Diagnostic" },
        { code: 'S07', label: "Communication" }
      ],
      activities: [
        {
          code: 'A1',
          label: "Préparation des opérations de réalisation, de mise en service et de maintenance",
          tasks: [
            { code: 'T1.1', label: "Prendre connaissance du dossier relatif aux opérations à réaliser, le constituer pour une opération simple" },
            { code: 'T1.2', label: "Rechercher et expliquer les informations relatives aux opérations et aux conditions d'exécution" },
            { code: 'T1.3', label: "Vérifier et compléter si nécessaire la liste des matériels, équipements et outillages nécessaires aux opérations" },
            { code: 'T1.4', label: "Répartir les tâches en fonction des habilitations, des certifications des équipiers et du planning des autres intervenants" }
          ]
        },
        {
          code: 'A2',
          label: "Réalisation",
          tasks: [
            { code: 'T2.1', label: "Organiser le poste de travail" },
            { code: 'T2.2', label: "Implanter, poser, installer les matériels électriques" },
            { code: 'T2.3', label: "Câbler, raccorder les matériels électriques" },
            { code: 'T2.4', label: "Gérer les activités de son équipe" },
            { code: 'T2.5', label: "Coordonner son activité par rapport à celles des autres intervenants" },
            { code: 'T2.6', label: "Mener son activité de manière éco-responsable" }
          ]
        },
        {
          code: 'A3',
          label: "Mise en service",
          tasks: [
            { code: 'T3.1', label: "Réaliser les vérifications, les réglages, les paramétrages, les essais nécessaires à la mise en service de l'installation" },
            { code: 'T3.2', label: "Participer à la réception de l'installation" }
          ]
        },
        {
          code: 'A4',
          label: "Maintenance",
          tasks: [
            { code: 'T4.1', label: "Réaliser une opération de maintenance préventive" },
            { code: 'T4.2', label: "Réaliser une opération de dépannage" }
          ]
        },
        {
          code: 'A5',
          label: "Communication",
          tasks: [
            { code: 'T5.1', label: "Participer à la mise à jour du dossier technique de l'installation" },
            { code: 'T5.2', label: "Échanger sur le déroulement des opérations, expliquer le fonctionnement de l'installation à l'interne et à l'externe" },
            { code: 'T5.3', label: "Conseiller le client, l'utilisateur sur l'efficacité énergétique, la sécurité et les évolutions technologiques" }
          ]
        }
      ],
      competencies: [
        { code: CompetencyCode.C1, label: "Analyser les conditions de l'opération et son contexte", activities: ['A1', 'A5'], criteria: [] },
        { code: CompetencyCode.C2, label: "Organiser l'opération dans son contexte", activities: ['A1', 'A2', 'A3', 'A4'], criteria: [] },
        { code: CompetencyCode.C3, label: "Définir une installation à l'aide de solutions préétablies", activities: ['A1'], criteria: [] },
        { code: CompetencyCode.C4, label: "Réaliser une installation de manière éco-responsable", activities: ['A1', 'A2'], criteria: [] },
        { code: CompetencyCode.C5, label: "Contrôler les grandeurs caractéristiques de l'installation", activities: ['A3'], criteria: [] },
        { code: CompetencyCode.C6, label: "Régler, paramétrer les matériels de l'installation", activities: ['A3'], criteria: [] },
        { code: CompetencyCode.C7, label: "Valider le fonctionnement de l'installation", activities: ['A3'], criteria: [] },
        { code: CompetencyCode.C8, label: "Diagnostiquer un dysfonctionnement", activities: ['A4'], criteria: [] },
        { code: CompetencyCode.C9, label: "Remplacer un matériel défectueux", activities: ['A4'], criteria: [] },
        { code: CompetencyCode.C10, label: "Exploiter les outils numériques dans le contexte professionnel", activities: ['A1', 'A2', 'A3', 'A4', 'A5'], criteria: [] },
        { code: CompetencyCode.C11, label: "Compléter les documents liés aux opérations", activities: ['A1', 'A2', 'A3', 'A4', 'A5'], criteria: [] },
        { code: CompetencyCode.C12, label: "Communiquer entre professionnels sur l'opération", activities: ['A5'], criteria: [] },
        { code: CompetencyCode.C13, label: "Communiquer avec le client/usager sur l'opération", activities: ['A5'], criteria: [] }
      ],
      exams: [
        {
          code: 'E2',
          label: "Préparation des opérations à réaliser",
          coef: 3,
          isProfessional: true,
          competencies: [
            { code: CompetencyCode.C1, weight: 20 },
            { code: CompetencyCode.C2, weight: 20 },
            { code: CompetencyCode.C3, weight: 20 },
            { code: CompetencyCode.C10, weight: 20 },
            { code: CompetencyCode.C11, weight: 20 }
          ]
        },
        {
          code: 'E31',
          label: "Réalisation et mise en service d'une installation",
          coef: 7,
          isProfessional: true,
          competencies: [
            { code: CompetencyCode.C2, weight: 14 },
            { code: CompetencyCode.C4, weight: 14 },
            { code: CompetencyCode.C5, weight: 14 },
            { code: CompetencyCode.C6, weight: 14 },
            { code: CompetencyCode.C7, weight: 14 },
            { code: CompetencyCode.C12, weight: 14 },
            { code: CompetencyCode.C13, weight: 14 }
          ]
        },
        {
          code: 'E32',
          label: "Maintenance d'une installation",
          coef: 2,
          isProfessional: true,
          competencies: [
            { code: CompetencyCode.C8, weight: 50 },
            { code: CompetencyCode.C9, weight: 50 }
          ]
        }
      ]
    }
  }
];
