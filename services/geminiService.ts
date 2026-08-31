

import { GoogleGenAI, Type } from "@google/genai";
import { SESSION_DESIGN_SYSTEM_INSTRUCTION, SYSTEM_INSTRUCTION, LATEX_CORRECTION_SYSTEM_INSTRUCTION } from "../constants";
import { TechnicalDoc, RepositoryData, ScheduleEvent, SequenceType, Holiday } from "../types";

// FIX: Per API Key guidelines, API key must come exclusively from process.env.API_KEY.
// The apiKey parameter is removed and the function now only relies on the environment variable.
const getAiClient = () => {
  const finalApiKey = process.env.API_KEY;
  if (!finalApiKey) {
    // FIX: Per API Key guidelines, do not prompt user for API key. Changed error message.
    throw new Error("La clé API Gemini n'est pas configurée dans l'environnement.");
  }
  return new GoogleGenAI({ apiKey: finalApiKey });
};

const handleApiError = (error: unknown, context: string) => {
    console.error(`API Error in ${context}:`, error);
    const errorString = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    
    if (errorString.includes('400')) {
        throw new Error(`[${context}] Erreur de requête (400). Le contenu envoyé est peut-être invalide ou la taille des fichiers est trop importante. Limite totale: 15Mo.`);
    }
    // FIX: Per API Key guidelines, do not prompt user for API key. Changed error message.
    if (errorString.includes('api key not valid') || errorString.includes('401') || errorString.includes('unauthenticated')) {
        throw new Error(`[${context}] Clé API invalide ou non autorisée (401). Veuillez vérifier la configuration de l'environnement.`);
    }
    if (errorString.includes('429')) {
        throw new Error(`[${context}] Trop de requêtes envoyées (429). Veuillez patienter un moment avant de réessayer.`);
    }
    if (errorString.includes('500') || errorString.includes('503') || errorString.includes('internal') || errorString.includes('unknown')) {
        throw new Error(`[${context}] Le service IA a rencontré une erreur interne (500). C'est souvent temporaire. Veuillez réessayer. Si le problème persiste, vérifiez la taille de vos fichiers.`);
    }
    
    if (error instanceof Error) {
        throw new Error(`[${context}] Erreur: ${error.message}`);
    }
    throw new Error(`[${context}] Une erreur inconnue est survenue avec le service IA.`);
};


export const generateSupportImage = async (theme: string): Promise<string | null> => {
    const ai = getAiClient();
    const prompt = `Crée une image de support didactique claire et technique pour une séquence pédagogique sur le thème suivant : "${theme}". 
    L'image doit être un schéma électrique, un synoptique ou une illustration de l'équipement concerné. Style épuré, format schéma. Pas de texte superflu.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }],
            },
            config: {
                imageConfig: {
                    aspectRatio: "4:3",
                },
            },
        });
        
        if (response.candidates && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64EncodeString: string = part.inlineData.data;
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    return `data:${mimeType};base64,${base64EncodeString}`;
                }
            }
        }
        return null;
    } catch (error) {
        handleApiError(error, "Génération d'image de support");
        return null;
    }
};

export const generateActivityDiagram = async (prompt: string): Promise<string | null> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: `Génère un schéma électrique technique, clair et didactique pour un TP selon la description suivante. Pas de fioriture, fond blanc, trait net. Description : ${prompt}` }],
            },
            config: {
                imageConfig: { aspectRatio: "4:3" },
            },
        });
        
        if (response.candidates && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64EncodeString: string = part.inlineData.data;
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    return `data:${mimeType};base64,${base64EncodeString}`;
                }
            }
        }
        return null;
    } catch (error) {
        handleApiError(error, "Génération de schéma d'activité");
        return null;
    }
};

export const generateTpSuggestions = async (description: string, title: string) => {
  const ai = getAiClient();
  
  const prompt = `
  Analyse la séquence pédagogique suivante pour la filière concernée :
  Titre: ${title}
  Description: ${description}
  
  Suggère les Activités (A1-A5) et les Compétences (C1-C13) les plus pertinentes à évaluer.
  Retourne uniquement du JSON.
  `;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    suggestedActivities: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Codes activités (ex: A1, A2)"
                    },
                    suggestedCompetencies: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Codes compétences (ex: C1, C4)"
                    },
                    reasoning: {
                        type: Type.STRING,
                        description: "Courte explication pédagogique"
                    }
                }
            }
        }
      });

      const text = response.text || "{}";
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

      try {
        return JSON.parse(cleanText);
      } catch (e) {
        console.error("Failed to parse AI response", e);
        return {};
      }
    } catch (error) {
        handleApiError(error, "Suggestions de compétences");
        return {};
    }
};

export const generateFullSessionDesign = async (
    theme: string, 
    audience: string, 
    duration: string, 
    description: string, 
    sequenceType: SequenceType, 
    imageBase64?: string, 
    technicalDocs?: TechnicalDoc[], 
    pedagogicalInspiration?: TechnicalDoc[],
    repository?: RepositoryData, 
    selectedActivities?: string[] // New parameter
) => {
    const ai = getAiClient();
    
    let repositoryContext = '';
    if (repository && repository.competencies && repository.competencies.length > 0) {
        const competencyList = repository.competencies.map(c => `- ${c.code}: ${c.label}`).join('\n');
        repositoryContext = `
IMPORTANT: Tu dois OBLIGATOIREMENT baser tes suggestions de compétences sur la liste suivante, issue du référentiel en vigueur. N'invente aucun code qui n'est pas dans cette liste.
--- DEBUT LISTE COMPÉTENCES ---
${competencyList}
--- FIN LISTE COMPÉTENCES ---
`;
    }

    const promptText = `
    Tu dois concevoir une séquence pédagogique complète et détaillée de type "${sequenceType}" sur le thème : "${theme}".
    
    ${description ? `Description détaillée / Contexte de la séquence: "${description}"` : ""}

    ${selectedActivities && selectedActivities.length > 0 ? `
    FOCUS ACTIVITÉS DU RÉFÉRENTIEL : 
    La séance doit spécifiquement traiter et mettre en œuvre les activités du référentiel suivantes que l'utilisateur a sélectionnées : 
    ${selectedActivities.join(', ')}.
    Assure-toi que le déroulement de la séance (les tâches élèves) correspond bien à ces activités professionnelles.
    ` : ""}

    ${imageBase64 ? "Une image du support didactique est fournie. Utilise les éléments visuels (composants, schémas, références) présents dans l'image pour contextualiser précisément le matériel, les consignes et la correction." : ""}
    
    ${technicalDocs && technicalDocs.length > 0 ? "Des documents techniques (PDF, schémas, notices) sont également fournis. Utilise-les pour extraire les références, les spécificités techniques et les procédures pour enrichir le contenu de la séquence." : ""}

    ${pedagogicalInspiration && pedagogicalInspiration.length > 0 ? "INSPIRATION PÉDAGOGIQUE : Un ou plusieurs documents (Word/PDF) sont fournis comme base. Étudie attentivement la structure de ce TP existant, les activités abordées et la pédagogie. Ta mission est de reproduire la même chose mais en MIEUX : améliore la clarté, complète les consignes, enrichis le scénario pédagogique et modernise l'approche tout en respectant l'esprit du document original." : ""}
    
    Contraintes :
    - Public : ${audience}
    - Durée totale : ${duration}

    ${repositoryContext}
    
    Tu dois générer un objet JSON strict contenant :

    1. **objectives** : Une liste de 3 à 5 objectifs pédagogiques opérationnels (commençant par un verbe d'action).
    2. **competencies** : La liste des codes de compétences (ex: "C1", "C10") du référentiel en vigueur réellement travaillées dans ce TP.
    3. **materials** : La liste complète du matériel nécessaire (EPI, Outillage, Appareils de mesure, Composants, Logiciels).
    4. **activitiesBreakdown** : Le découpage séquentiel de la séance en 3 ou 4 activités.
       POUR CHAQUE ACTIVITÉ, tu dois rédiger du contenu précis :
       - "title": Titre technique de l'activité.
       - "duration": Durée estimée.
       - "description": Le contexte/mise en situation (Ce que l'élève doit comprendre avant de commencer).
       - "studentConsignes": LE CONTENU DU DOCUMENT ÉLÈVE. Liste précise des tâches, questions, mesures à faire. (Ex: "1. Consigner l'armoire. 2. Vérifier l'absence de tension...")
       - "teacherCorrection": LE CONTENU DU DOCUMENT PROFESSEUR. Les réponses attendues, les valeurs de mesures types, les réglages spécifiques, les points de vigilance sécurité.

    5. **evaluationCriteria** : Une liste de critères d'évaluation observables pour noter les élèves, liés aux compétences sélectionnées.
    `;
    
    const parts: any[] = [{ text: promptText }];

    if (imageBase64) {
        const imgParts = imageBase64.split(',');
        if (imgParts.length === 2) {
            const mimeType = imgParts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            const data = imgParts[1];
            parts.push({
                inlineData: { mimeType, data }
            });
        }
    }

    if (technicalDocs) {
        technicalDocs.forEach(doc => {
            const docParts = doc.data.split(',');
            if (docParts.length === 2) {
                const mimeType = doc.type;
                const data = docParts[1];
                parts.push({
                    inlineData: { mimeType, data }
                });
            }
        });
    }

    if (pedagogicalInspiration) {
        pedagogicalInspiration.forEach(doc => {
            const docParts = doc.data.split(',');
            if (docParts.length === 2) {
                const mimeType = doc.type;
                const data = docParts[1];
                parts.push({
                    inlineData: { mimeType, data }
                });
            }
        });
    }

    let response;
    const modelConfig = {
        systemInstruction: SESSION_DESIGN_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                objectives: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Liste des objectifs (ex: Câbler un départ moteur)"
                },
                competencies: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Codes compétences C1 à C13"
                },
                materials: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Liste du matériel (ex: Multimètre, Tournevis isolé)"
                },
                activitiesBreakdown: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            duration: { type: Type.STRING },
                            description: { type: Type.STRING, description: "Mise en situation / Contexte narratif" },
                            studentConsignes: { type: Type.STRING, description: "Instructions détaillées pour l'élève (liste d'actions)" },
                            teacherCorrection: { type: Type.STRING, description: "Éléments de correction technique pour le prof" },
                            diagramPrompt: { type: Type.STRING, description: "S'il est fortement nécessaire d'avoir un schéma électrique explicatif pour comprendre l'activité, rédige un prompt précis pour le générateur d'image (ex: 'Schéma électrique minimaliste d'un départ moteur avec Q1 et KM1'). Sinon omettre." }
                        },
                        required: ["title", "duration", "description", "studentConsignes", "teacherCorrection"]
                    }
                },
                evaluationCriteria: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            competencyCode: { type: Type.STRING },
                            criterion: { type: Type.STRING, description: "Critère observable spécifique (ex: Serrage des bornes conforme)" }
                        }
                    }
                }
            },
            required: ["objectives", "competencies", "materials", "activitiesBreakdown", "evaluationCriteria"]
        }
    };

    try {
        response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: { parts: parts },
            config: modelConfig
        });
    } catch (error) {
        handleApiError(error, "Génération de la séance complète");
        return null;
    }

    const text = response.text || "{}";
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

    try {
        const data = JSON.parse(cleanText);

        // --- FIX: Clean up titles to prevent duplication like "Activité 1 : Activité 1 : ..." ---
        if (data.activitiesBreakdown) {
             data.activitiesBreakdown.forEach((act: any) => {
                if (act.title) {
                    act.title = act.title.replace(/^(Activité|Activity)\s*\d+\s*[:\-]?\s*/i, '').trim();
                }
             });
        }
        // ---------------------------------------------------------------------------------------

        const placeholderRegex = /\(LATEX_[\d\w]+\)/i;
        const separator = "\n---_---_---\n";
        const textsToCorrect: string[] = [];
        let needsCorrection = false;

        const add = (text: string | null | undefined) => {
            const str = text || '';
            if (placeholderRegex.test(str)) {
                needsCorrection = true;
            }
            textsToCorrect.push(str);
        };
        
        (data.objectives || []).forEach(add);
        (data.materials || []).forEach(add);
        (data.activitiesBreakdown || []).forEach((act: any) => {
            add(act.title);
            add(act.description);
            add(act.studentConsignes);
            add(act.teacherCorrection);
        });
        (data.evaluationCriteria || []).forEach((crit: any) => add(crit.criterion));
        
        if (needsCorrection) {
            console.warn("Placeholders détectés. Lancement de l'auto-correction.");
            const combinedText = textsToCorrect.join(separator);
            const correctionPrompt = `Le texte suivant est une concaténation de plusieurs champs, séparés par "${separator}".\nCorrige chaque champ en remplaçant les placeholders (LATEX_XX) par les formules appropriées en texte simple.\nConserve les séparateurs EXACTEMENT.\n\n---\n\n${combinedText}`;

            const correctionResponse = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: correctionPrompt,
                config: { systemInstruction: LATEX_CORRECTION_SYSTEM_INSTRUCTION }
            });
            
            const correctedCombinedText = correctionResponse.text;
            if (correctedCombinedText) {
                const correctedTexts = correctedCombinedText.split(separator);
                if (correctedTexts.length === textsToCorrect.length) {
                    let i = 0;
                    data.objectives = (data.objectives || []).map(() => correctedTexts[i++]);
                    data.materials = (data.materials || []).map(() => correctedTexts[i++]);
                    (data.activitiesBreakdown || []).forEach((act: any) => {
                        act.title = correctedTexts[i++];
                        act.description = correctedTexts[i++];
                        act.studentConsignes = correctedTexts[i++];
                        act.teacherCorrection = correctedTexts[i++];
                    });
                    (data.evaluationCriteria || []).forEach((crit: any) => {
                        crit.criterion = correctedTexts[i++];
                    });
                } else {
                    console.error("Échec de la correction : le nombre de séparateurs ne correspond pas.", { expected: textsToCorrect.length, got: correctedTexts.length });
                }
            }
        }

        // --- NEW: Generate diagrams for activities ---
        if (data.activitiesBreakdown) {
             await Promise.all(data.activitiesBreakdown.map(async (act: any) => {
                 if (act.diagramPrompt) {
                     try {
                         const diagramImage = await generateActivityDiagram(act.diagramPrompt);
                         if (diagramImage) {
                             act.diagramImage = diagramImage;
                         }
                     } catch (err) {
                         console.error("Failed to generate diagram for prompt: " + act.diagramPrompt, err);
                     }
                 }
             }));
        }
        // ---------------------------------------------

        return {
            objectives: data.objectives || [],
            competencies: data.competencies || [],
            materials: data.materials || [],
            activitiesBreakdown: data.activitiesBreakdown || [],
            evaluationCriteria: data.evaluationCriteria || []
        };
    } catch (e) {
        console.error("Failed to parse AI response", e);
        return null;
    }
};

export const generateSimpleSessionContent = async (
    theme: string, 
    description: string, 
    sequenceType: SequenceType, 
    audience: string, 
    duration: string,
    repository?: RepositoryData
): Promise<string | null> => {
    const ai = getAiClient();
    
    let repositoryContext = '';
    if (repository && repository.competencies && repository.competencies.length > 0) {
        const competencyList = repository.competencies.map(c => `- ${c.code}: ${c.label}`).join('\n');
        repositoryContext = `
Rappel du référentiel de compétences à disposition (à utiliser si pertinent pour l'évaluation) :
--- DEBUT LISTE COMPÉTENCES ---
${competencyList}
--- FIN LISTE COMPÉTENCES ---
`;
    }

    const prompt = `
    Tu es SéanceGPT.
    Génère le contenu complet pour une séance de type "${sequenceType}".
    
    Thème: "${theme}"
    Contexte/Description: ${description || "Aucun contexte particulier."}
    
    Contraintes :
    - Public : ${audience}
    - Durée : ${duration}

    ${repositoryContext}

    Applique scrupuleusement le format de sortie défini dans tes instructions pour le type "${sequenceType}".
    Génère UNIQUEMENT le contenu pédagogique en format Markdown, prêt à être lu par l'enseignant ou distribué.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
                systemInstruction: SESSION_DESIGN_SYSTEM_INSTRUCTION,
            }
        });
        
        let content = response.text || null;

        if (content && /\(LATEX_[\d\w]+\)/i.test(content)) {
            console.warn("Placeholder détecté. Lancement de l'auto-correction.");
            
            const correctionPrompt = `Voici le texte à corriger :\n\n---\n\n${content}`;

            const correctionResponse = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: correctionPrompt,
                config: {
                    systemInstruction: LATEX_CORRECTION_SYSTEM_INSTRUCTION,
                }
            });

            content = correctionResponse.text || content;
        }

        return content;
    } catch (error) {
        handleApiError(error, "Génération de contenu simple");
        return null;
    }
};

export const generateStudentResponseSheet = async (tpTitle: string, studentInstructions: string): Promise<string | null> => {
    const ai = getAiClient();
    const prompt = `
    En tant qu'assistant pédagogique expert, transforme les consignes suivantes d'une séquence pédagogique en un document réponse structuré pour un élève.
    Le document doit être clair, aéré et prêt à être rempli.

    Titre de la séquence : "${tpTitle}"

    Consignes de l'élève :
    ---
    ${studentInstructions}
    ---

    INSTRUCTIONS DE FORMATAGE STRICTES :
    1.  **Titres**: Commence les titres d'activité par \`## \` (ex: \`## Activité 1: Analyse\`).
    2.  **Sous-titres**: Commence les sous-titres par \`### \` (ex: \`### 1. Identification\`).
    3.  **Questions**: Pour chaque question ou point nécessitant une réponse, écris le texte et termine la ligne par \`[LIGNE]\` pour une réponse courte, ou \`[LIGNES:3]\` pour une réponse longue de 3 lignes.
    4.  **Tableaux**: Pour les mesures, crée un tableau simple en texte brut, comme dans l'exemple ci-dessous.
    5.  **Ne pas utiliser**: N'utilise pas de \`*\`, \`-\`, \`_\` ou d'autre formatage.

    Exemple de sortie attendue :
    ## Activité 1: Préparation et Analyse
    ### 1. Identification des composants
    Armoire de commande : [LIGNE]
    Disjoncteurs : [LIGNE]

    ### 2. Tableau de mesures
    | Grandeur | Point de mesure | Valeur attendue | Valeur mesurée |
    |----------|-----------------|-----------------|----------------|
    | Tension  | Uab             | 230 V           |                |
    | Courant  | I1              | 5 A             |                |

    ### 3. Procédure de consignation
    Décrire les étapes de la consignation : [LIGNES:5]

    Génère UNIQUEMENT le contenu du document réponse en suivant ce formatage à la lettre.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
            }
        });

        return response.text || null;

    } catch (error) {
        handleApiError(error, "Génération de fiche réponse élève");
        return null;
    }
};

export const generateCorrectedResponseSheet = async (tpTitle: string, studentInstructions: string, teacherCorrections: string): Promise<string | null> => {
    const ai = getAiClient();
    const prompt = `
    En tant qu'assistant pédagogique expert, crée le CORRIGÉ d'un document réponse élève.
    Tu dois reprendre la structure des consignes de l'élève et la remplir avec les informations de la correction du professeur.

    Titre de la séquence : "${tpTitle}"

    Consignes élève (la structure à suivre) :
    ---
    ${studentInstructions}
    ---

    Correction professeur (les informations pour remplir) :
    ---
    ${teacherCorrections}
    ---

    INSTRUCTIONS DE FORMATAGE STRICTES :
    1.  **Structure**: Reproduis EXACTEMENT la structure des consignes (titres, questions, tableaux).
    2.  **Remplissage et Marquage**: Remplace les zones de réponse (ex: \`[LIGNE]\`, cellules de tableau vides) par les réponses de la correction. **CRUCIAL : Chaque réponse ajoutée DOIT être entourée de doubles accolades, comme ceci : \`{{LA RÉPONSE}}\`.**
    3.  **Exemple de marquage**: Si la consigne est "Armoire de commande : [LIGNE]" et la correction "TGBT-01", la sortie doit être "Armoire de commande : {{TGBT-01}}". Pour un tableau, la cellule de réponse doit contenir \`{{4.95 A}}\`.
    4.  **Clarté**: N'utilise aucun autre formatage (gras, italique).
    5.  **Formatage**: Conserve le formatage des titres (\`## \`, \`### \`) et des tableaux.
    6.  **Ne pas inventer**: N'ajoute aucune information qui n'est pas dans la correction. Si une réponse n'est pas trouvée, laisse la zone vide.

    Exemple de sortie attendue :
    ## Activité 1: Préparation et Analyse
    ### 1. Identification des composants
    Armoire de commande : {{TGBT-01}}
    Disjoncteurs : {{Q1, Q2, F3}}

    ### 2. Tableau de mesures
    | Grandeur | Point de mesure | Valeur attendue | Valeur mesurée |
    |----------|-----------------|-----------------|----------------|
    | Tension  | Uab             | 230 V           | {{231.5 V}}    |
    | Courant  | I1              | 5 A             | {{4.95 A}}     |

    ### 3. Procédure de consignation
    {{1. Séparer l'équipement.
    2. Condamner en position d'ouverture.
    3. Identifier l'ouvrage.
    4. Vérifier l'absence de tension.
    5. Mettre à la terre et en court-circuit.}}

    Génère UNIQUEMENT le contenu du document corrigé.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
            }
        });

        return response.text || null;

    } catch (error) {
        handleApiError(error, "Génération de fiche corrigée");
        return null;
    }
};

export const analyzeRepositoryDocument = async (docData: { name: string, type: string, data: string }): Promise<RepositoryData | null> => {
    const ai = getAiClient();

    const promptText = `
    En tant qu'ingénieur pédagogique expert, analyse le document de référentiel fourni pour la filière concernée.
    Extrais les informations clés pour mettre à jour la base de données de l'application.
    Le document contient la liste des savoirs (parfois appelés "connaissances associées"), activités, tâches, compétences, critères et épreuves.

    Tu dois retourner un objet JSON strict avec la structure suivante :
    1.  **savoirs**: Une liste de tous les savoirs (S1, S2, etc.), parfois intitulée "Connaissances associées". Pour chaque savoir :
        - "code": Le code du savoir (ex: "S1").
        - "label": L'intitulé complet.
        
        **Instruction Spécifique pour les Savoirs :** Dans les tableaux de savoirs, si une catégorie principale (par exemple "Chaîne d'énergie") s'étend sur plusieurs lignes et regroupe plusieurs sous-thèmes (par exemple "Architecture", "Sources", "Distribution"), tu dois extraire **uniquement la catégorie principale** comme un seul savoir. Ne pas extraire les sous-thèmes comme des savoirs séparés. Le résultat doit être, par exemple, \`{ "code": "S1", "label": "Chaîne d'énergie" }\`.

    2.  **activities**: Une liste des 5 activités principales (A1 à A5). Pour chaque activité :
        - "code": Le code de l'activité (ex: "A1").
        - "label": L'intitulé de l'activité (ex: "Préparation").
        - "tasks": Une liste de toutes les tâches associées. Pour chaque tâche :
            - "code": Le code de la tâche (ex: "T1-1").
            - "label": L'intitulé complet de la tâche.

    3.  **competencies**: Une liste de toutes les compétences (C1 à C13 ou plus). Pour chaque compétence :
        - "code": Le code de la compétence (ex: "C1").
        - "label": L'intitulé complet de la compétence (ex: "Analyser les conditions de l’opération...").
        - "activities": La liste des codes d'activités associées (ex: ["A1"]).
        - "criteria": Une liste de 5 à 8 critères d'évaluation observables et mesurables liés à cette compétence. Sois précis et concis (ex: "Les informations nécessaires sont recueillies").

    4.  **exams**: Une liste des épreuves. Pour chaque épreuve :
        - "code": Le code de l'épreuve (ex: "U31", "EP1", "E2").
        - "label": L'intitulé de l'épreuve.
        - "coef": Le coefficient de l'épreuve (un nombre).
        - "competencies": La liste des codes de compétences évaluées dans cette épreuve.
        - "isProfessional": Un booléen.

        **Instructions spécifiques pour les épreuves :**
        - **Priorité aux tableaux :** Recherche activement les tableaux de liaison, souvent intitulés "UNITÉS CERTIFICATIVES", "Épreuves Professionnelles" ou "Blocs de compétences". Ces tableaux lient des épreuves (avec des codes comme U2, U31, EP1, E2) à des compétences (C1.1, C2, CO1, etc.) avec des 'X'.
        - **Utilise ces tableaux comme source principale** pour définir les épreuves et les compétences associées.
        - **Détermination de \`isProfessional\` :** Une épreuve est professionnelle (\`isProfessional: true\`) si elle est explicitement liée à des compétences techniques/métier dans ces tableaux. Les épreuves d'enseignement général (français, maths, PSE, etc.) qui n'apparaissent pas dans ces tableaux de liaison avec des compétences techniques sont \`isProfessional: false\`. Si une épreuve n'a aucune compétence métier associée, elle doit être marquée comme \`isProfessional: false\`.

    Analyse attentivement le document pour peupler ces champs de la manière la plus complète et précise possible.
    Ignore les textes non pertinents.
    `;

    const parts: any[] = [{ text: promptText }];

    const docParts = docData.data.split(',');
    if (docParts.length === 2) {
        const mimeType = docData.type;
        const data = docParts[1];
        parts.push({
            inlineData: { mimeType, data }
        });
    } else {
        console.error("Invalid document data format for AI analysis");
        return null;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash', // Use a robust model for document analysis
            contents: { parts: parts },
            config: {
                systemInstruction: "Tu es un expert en ingénierierie pédagogique spécialisé dans les référentiels de l'Éducation Nationale française pour les filières techniques. Tu es précis, structuré et tu retournes uniquement du JSON valide.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        savoirs: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    code: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                },
                                required: ["code", "label"]
                            }
                        },
                        activities: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    code: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                    tasks: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                code: { type: Type.STRING },
                                                label: { type: Type.STRING },
                                            },
                                            required: ["code", "label"]
                                        }
                                    }
                                },
                                required: ["code", "label", "tasks"]
                            }
                        },
                        competencies: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    code: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                    activities: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    criteria: { type: Type.ARRAY, items: { type: Type.STRING } }
                                },
                                required: ["code", "label", "activities", "criteria"]
                            }
                        },
                        exams: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    code: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                    coef: { type: Type.NUMBER },
                                    competencies: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    isProfessional: { type: Type.BOOLEAN, description: "True if it is a professional exam, false for general studies." }
                                },
                                required: ["code", "label", "coef", "competencies", "isProfessional"]
                            }
                        }
                    },
                    required: ["savoirs", "activities", "competencies", "exams"]
                }
            }
        });

        const text = response.text || "{}";
        const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
        const data = JSON.parse(cleanText);
        
        const correctedExams = (data.exams || []).map((exam: any) => ({
            ...exam,
            isProfessional: !!(exam.isProfessional && exam.competencies && exam.competencies.length > 0)
        }));

        const examsWithWeights = correctedExams.map((exam: any) => {
            const codes = exam.competencies || [];
            if (codes.length === 0) {
                return { ...exam, competencies: [] };
            }
            const equalWeight = 100 / codes.length;
            const weightedCompetencies = codes.map((code: string) => ({
                code,
                weight: equalWeight
            }));
            return { ...exam, competencies: weightedCompetencies };
        });


        const processedSavoirs = (data.savoirs || []).map((savoir: { label: string }, index: number) => {
            const cleanedLabel = savoir.label.replace(/^S\s*\.?\d+\s*[\-.:]?\s*/i, '').trim();
            return {
                code: `S${(index + 1).toString().padStart(2, '0')}`,
                label: cleanedLabel,
            };
        });

        return {
            competencies: data.competencies || [],
            exams: examsWithWeights,
            savoirs: processedSavoirs,
            activities: data.activities || [],
        };

    } catch (e) {
        handleApiError(e, "Analyse du référentiel");
        return null;
    }
};

export const analyzeScheduleDocument = async (docData: { name: string, type: string, data: string }): Promise<ScheduleEvent[]> => {
    const ai = getAiClient();

    const promptText = `
    Analyse cette image ou ce document qui représente un emploi du temps scolaire hebdomadaire.
    Extrais la liste de tous les cours/événements visibles.

    Pour chaque cours, identifie :
    1. **dayIndex**: Le jour de la semaine (Lundi=0, Mardi=1, Mercredi=2, Jeudi=3, Vendredi=4, Samedi=5, Dimanche=6).
    2. **startTime**: L'heure de début au format "HHhMM" (ex: "08h30"). Arrondis aux créneaux standard si proche (07h30, 08h30, 09h20, 10h30, 11h30, 12h30, 13h30, 14h30, 15h20, 16h30, 17h30).
    3. **endTime**: L'heure de fin au format "HHhMM" (ex: "10h30").
    4. **title**: Le nom de la matière ou du cours (ex: "MATHÉMATIQUES", "ANGLAIS", "ATELIER").
    5. **subtitle**: Le nom du professeur ou de la classe (ex: "M. DUPONT", "TBPMELEC1").
    6. **details**: La salle ou info supplémentaire (ex: "B202", "ATELIER").

    Retourne un tableau JSON strict d'objets.
    Assigne une couleur par défaut si non détectée, mais essaie de varier.
    Si une plage horaire couvre plusieurs créneaux standards, tu peux créer un seul événement avec l'heure de début et de fin globales.
    `;

    const parts: any[] = [{ text: promptText }];
    const docParts = docData.data.split(',');
    
    if (docParts.length === 2) {
        parts.push({
            inlineData: { mimeType: docData.type, data: docParts[1] }
        });
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: { parts: parts },
            config: {
                systemInstruction: "Tu es un assistant administratif scolaire. Tu extrais des données d'emploi du temps avec précision. Tu retournes uniquement du JSON.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            dayIndex: { type: Type.INTEGER },
                            startTime: { type: Type.STRING },
                            endTime: { type: Type.STRING },
                            title: { type: Type.STRING },
                            subtitle: { type: Type.STRING },
                            details: { type: Type.STRING },
                        },
                        required: ["dayIndex", "startTime", "endTime", "title"]
                    }
                }
            }
        });

        const text = response.text || "[]";
        const events = JSON.parse(text);
        
        return events.map((evt: any) => ({
            ...evt,
            id: crypto.randomUUID(),
            color: 'bg-indigo-100 border-indigo-200 text-indigo-800' // Default color
        }));

    } catch (e) {
        handleApiError(e, "Analyse de l'emploi du temps");
        return [];
    }
};

export const analyzeHolidayDocument = async (docData: { name: string, type: string, data: string }): Promise<Omit<Holiday, 'id'>[]> => {
    const ai = getAiClient();

    const promptText = `
    Analyse ce calendrier scolaire. Extrais TOUTES les périodes de vacances scolaires et les jours fériés.

    Pour chaque période ou jour trouvé, tu dois fournir:
    1. **name**: Le nom de la période (ex: "Vacances de la Toussaint", "Armistice 1918").
    2. **startDate**: La date de DÉBUT au format strict YYYY-MM-DD.
    3. **endDate**: La date de FIN au format strict YYYY-MM-DD.

    Règles importantes:
    - Pour un jour férié unique (ex: 1er mai), la 'startDate' et la 'endDate' doivent être identiques.
    - Pour une période de vacances, la 'startDate' est le premier jour des vacances et la 'endDate' est le dernier jour.
    - Ignore les week-ends s'ils ne font pas partie d'une période de vacances explicite.
    - Ne retourne que les périodes de vacances et les jours fériés, ignore les autres événements.
    - Le résultat doit être un tableau JSON d'objets.
    `;

    const parts: any[] = [{ text: promptText }];
    const docParts = docData.data.split(',');
    
    if (docParts.length === 2) {
        parts.push({
            inlineData: { mimeType: docData.type, data: docParts[1] }
        });
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: { parts: parts },
            config: {
                systemInstruction: "Tu es un assistant administratif spécialisé dans l'analyse de calendriers scolaires. Tu extrais les dates avec une précision absolue et retournes uniquement du JSON valide.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            startDate: { type: Type.STRING },
                            endDate: { type: Type.STRING },
                        },
                        required: ["name", "startDate", "endDate"]
                    }
                }
            }
        });

        const text = response.text || "[]";
        const holidays = JSON.parse(text);
        return holidays;

    } catch (e) {
        handleApiError(e, "Analyse du calendrier");
        return [];
    }
};