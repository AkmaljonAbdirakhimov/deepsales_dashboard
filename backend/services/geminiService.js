const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const fs = require('fs');
const path = require('path');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('WARNING: GEMINI_API_KEY is not set in environment variables');
}

// Initialize Gemini clients - these will fail at runtime if apiKey is invalid/undefined
// but are needed at module level for the exported functions
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const fileManager = apiKey ? new GoogleAIFileManager(apiKey) : null;

const MODEL_CATEGORY_IDENTIFICATION = "gemini-2.0-flash-lite";
const MODEL_TRANSCRIPTION = "gemini-2.5-pro";
const MODEL_ANALYSIS = "gemini-3-pro-preview";

// Prepare file
async function uploadToGemini(filePath, mimeType) {
    if (!apiKey || !fileManager) {
        throw new Error('GEMINI_API_KEY is not configured. Please set it in your environment variables.');
    }
    try {
        const uploadResult = await fileManager.uploadFile(filePath, {
            mimeType,
            displayName: path.basename(filePath),
        });

        const file = uploadResult.file;
        console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
        return file;
    } catch (error) {
        console.error("Error uploading to Gemini:", error);
        throw error;
    }
}

async function waitForFileActive(file, isCancelled = null) {
    if (!apiKey || !fileManager) {
        throw new Error('GEMINI_API_KEY is not configured. Please set it in your environment variables.');
    }
    console.log("Waiting for file processing...");
    let currentFile = await fileManager.getFile(file.name);
    while (currentFile.state === "PROCESSING") {
        // Check for cancellation before waiting
        if (isCancelled && isCancelled()) {
            throw new Error('File processing cancelled by user');
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // Check for cancellation after waiting
        if (isCancelled && isCancelled()) {
            throw new Error('File processing cancelled by user');
        }
        currentFile = await fileManager.getFile(file.name);
    }
    if (currentFile.state !== "ACTIVE") {
        throw new Error(`File ${file.name} failed to process`);
    }
    console.log(`File ${file.name} is ready`);
    console.log(`File object properties:`, {
        name: currentFile.name,
        uri: currentFile.uri,
        displayName: currentFile.displayName,
        state: currentFile.state
    });
    return currentFile;
}

// Get categories from database
async function getCategories(db, withCriteria = false) {
    try {
        const categories = await db.all('SELECT * FROM conversation_categories ORDER BY created_at ASC');

        // Get criteria for each category
        if (withCriteria) {
            for (const category of categories) {
                const criteria = await db.all(
                    'SELECT * FROM conversation_criteria WHERE category_id = ? ORDER BY created_at ASC',
                    category.id
                );
                category.criteria = criteria;
            }
        }

        return categories;
    } catch (error) {
        console.error('Error fetching categories with criteria:', error);
        throw error;
    }
}

function buildCriteriaList(categories) {
    // Build a flat list of all criteria with their descriptions
    let criteriaList = [];
    for (const category of categories) {
        if (!category.criteria || category.criteria.length === 0) {
            continue;
        }
        for (const criterion of category.criteria) {
            criteriaList.push({
                name: criterion.name,
                description: criterion.description || ''
            });
        }
    }
    return criteriaList;
}

// Create prompts
function buildTranscriptionPrompt() {
    const prompt = `
        ## Role
        You are an Audio Transcription and Speaker Diarization Expert.
        
        ## Goal
        Your job is to transcribe the audio and identify speakers.
        
        ## Rules
        - The audio may include Uzbek, Russian, and English (mixed speech).
        - Transcribe EXACTLY what is spoken - word for word, exactly as heard.
        - DO NOT correct grammar, fix mistakes, or improve sentences.
        - DO NOT paraphrase, summarize, or rephrase anything.
        - DO NOT guess words you cannot clearly hear - use "[inaudible]" or "[unclear]" instead.
        - DO NOT remove filler words (um, uh, like, etc.) - include them exactly as spoken.
        - Preserve all languages exactly as spoken - use the original alphabet/script for each language.
        
        ## Speaker Identification
        - Identify the speaker as one of: "manager", "client", or "system" (for the automated robot/IVR voice).
        - Split the conversation into segments. Each segment should contain only one continuous speech from one speaker.
        - Include timestamps for each segment in HH:MM:SS format or seconds.
    `;
    return prompt;
}

function buildCategoryPrompt(categories) {
    let categoryText = '';
    let hasCategories = categories.length > 0;
    if (hasCategories) {
        categoryText = '## Available conversation categories:\n\n';
        for (const category of categories) {
            categoryText += `${category.name};\n`;
        }
    }

    const prompt = `
        ## Role
        You are a Conversation Category Classifier.
        
        ## Goal
        Your job is to ${hasCategories ? 'quickly identify' : 'create'} the conversation category that best matches the call by analyzing the conversation type, topics discussed, and context.
        
        ## Rules
        - Analyze the conversation transcription segments provided.
        - The conversation may include Uzbek, Russian, and English (mixed speech).
        - Identify the primary purpose and topic of the conversation based on the transcribed text.
        
        ${categoryText}
    `;

    return prompt;
}

function buildAnalysisPrompt(categories, selectedCategoryName = null) {
    // If a category is selected, only include criteria for that category
    let relevantCategories = categories;
    if (selectedCategoryName) {
        relevantCategories = categories.filter(cat => cat.name === selectedCategoryName);
    }

    const criteriaList = buildCriteriaList(relevantCategories);

    const prompt = `
    ## Role
    You are a Call Quality Expert.
    
    ## Goal
    Your job is to analyze conversation calls, detect mistakes, evaluate the manager's performance, identify objections, tag them, and generate structured, short, strict recommendations.
    
    ## Rules
    - You analyze the call based on the conversation transcription segments provided.
    - The conversation may include Uzbek, Russian, and English (mixed speech).
    - Your tone must be: strict, professional, unemotional.
    
    ## Analysis Requirements
    You must perform the following steps:
    
    1. Evaluate the call ONLY by the criteria provided from 0–100%
    
    2. Evaluate mood of voice as well
    
    3. Detect mistakes and list them in "mistakes" with recommendations from most important to least important order. For each mistake, include the exact timestamp when it occurred during the call.
    
    4. Identify "objections" automatically and "tag" each one from most important to least important order. For each objection, include the exact timestamp when it occurred during the call.
    
    5. Generate "recommendations" — short, strict, actionable (1–2 sentences each) from most important to least important order.
    
    6. Generate "feedback" — overall conclusion based on the whole call.
    
    ## Available criteria
    ${criteriaList}
    
    ## Examples
    - Objection tags can be these but not limited
    Important: Before confirming the context as an objection, confirm that the statement clearly blocks, delays, or resists the manager’s goal (payment, visit, commitment, decision). 
    If not — do not write it as an objection or tag.

    "price"
    
    "trust"
    
    "quality"
    
    "time"
    
    "need"
    
    "other" (specify if you know)
    
    - Mistakes must be tagged with appropriate categories. Mistake tags can be:
    
    "greeting" - for greeting-related mistakes (e.g., "not greeting", "poor greeting")
    
    "introduction" - for introduction mistakes (e.g., "not introducing oneself", "not introducing company")
    
    "questioning" - for questioning mistakes (e.g., "not asking for name", "not asking SPIN questions", "problem not identified")
    
    "explanation" - for product/service explanation mistakes (e.g., "explaining product generally", "not mentioning benefits", "not explaining steps")
    
    "objection_handling" - for objection handling mistakes (e.g., "immediately responding to objection", "not summarizing objections")
    
    "closing" - for closing mistakes (e.g., "poor closing questions", "not closing properly")
    
    "communication" - for communication style mistakes (e.g., "unnecessary talk", "repetitive explanations", "going into monologue", "pressuring the client")
    
    "other" - for other mistakes that don't fit the above categories
    
    - Mistakes can be these but not limited:
    
    "not greeting"
    
    "not asking for name"
    
    "not introducing oneself"
    
    "not asking SPIN questions"
    
    "problem not identified"
    
    "explaining product generally"
    
    "not mentioning benefits"
    
    "not explaining steps"
    
    "immediately responding to objection"
    
    "not summarizing objections"
    
    "poor closing questions"
    
    "pressuring the client"
    
    "unnecessary talk"
    
    "repetitive explanations"
    
    "going into monologue"
    
    ## Recommendation format
    
    - Short (1–2 sentences)
    
    - Strict, professional
    
    - Direct
    
    - Actionable
    `;

    return prompt;
}

function buildTranscriptionSchema() {
    return {
        type: "object",
        properties: {
            segments: {
                type: "array",
                description: "Array of conversation segments with speaker identification",
                items: {
                    type: "object",
                    properties: {
                        speaker: {
                            type: "string",
                            enum: ["manager", "client", "system"],
                            description: "Speaker identifier"
                        },
                        text: {
                            type: "string",
                            description: "Exact transcription of what was said"
                        },
                        timestamp: {
                            type: "string",
                            description: "Start time in HH:MM:SS format or seconds"
                        }
                    },
                    required: ["speaker", "text", "timestamp"]
                }
            }
        },
        required: ["segments"]
    };
}

// Create schemas
function buildCategoryIdentificationSchema(categories) {
    const categoryNames = categories.map(cat => cat.name);
    const categoryProperty = categories.length > 0
        ? {
            type: "string",
            enum: categoryNames,
            description: "The conversation category that best matches this call. Must be one of the available categories."
        }
        : {
            type: "string",
            description: "A new category name you create based on the conversation content. Should be descriptive, in Uzbek language (or appropriate language), and concise (2-4 words). Examples: 'Sotuv', 'Texnik yordam', 'Shikoyat', etc."
        };

    return {
        type: "object",
        properties: {
            category: categoryProperty,
        },
        required: ["category"]
    };
}

function buildAnalysisSchema(categories, selectedCategoryName = null) {
    // If a category is selected, only include criteria for that category
    let relevantCategories = categories;
    if (selectedCategoryName) {
        relevantCategories = categories.filter(cat => cat.name === selectedCategoryName);
    }

    const criteriaList = buildCriteriaList(relevantCategories);

    // Build dynamic scores schema based on criteria
    const scoresProperties = {};
    const scoresRequired = [];
    criteriaList.forEach(criterion => {
        scoresProperties[criterion.name] = {
            type: "number",
            description: criterion.description || `Score for ${criterion.name}`,
            minimum: 0,
            maximum: 100
        };
        scoresRequired.push(criterion.name);
    });

    return {
        type: "object",
        properties: {
            scores: {
                type: "object",
                description: "Scores for each criterion (0-100) based on the selected category.",
                properties: scoresProperties,
                required: scoresRequired
            },
            objections: {
                type: "array",
                description: "Array of client objections",
                items: {
                    type: "object",
                    properties: {
                        text: {
                            type: "string",
                            description: "Exact text of the objection in uzbek language"
                        },
                        tag: {
                            type: "string",
                            enum: ["price", "trust", "quality", "time", "need", "other"],
                            description: "Category tag for the objection"
                        },
                        timestamp: {
                            type: "string",
                            description: "Timestamp when the objection occurred (HH:MM:SS format or seconds), matching the exact time from the conversation segments"
                        }
                    },
                    required: ["text", "tag", "timestamp"]
                }
            },
            mistakes: {
                type: "array",
                description: "Array of mistakes with recommendations and tags",
                items: {
                    type: "object",
                    properties: {
                        mistake: {
                            type: "string",
                            description: "Description of the mistake in uzbek language"
                        },
                        recommendation: {
                            type: "string",
                            description: "Short, strict, actionable recommendation (1-2 sentences) in uzbek language"
                        },
                        tag: {
                            type: "string",
                            description: "Category tag for the mistake",
                            enum: ["greeting", "introduction", "questioning", "explanation", "objection_handling", "closing", "communication", "other"]
                        },
                        timestamp: {
                            type: "string",
                            description: "Timestamp when the mistake occurred (HH:MM:SS format or seconds), matching the exact time from the conversation segments"
                        }
                    },
                    required: ["mistake", "recommendation", "tag", "timestamp"]
                }
            },
            mood: {
                type: "object",
                description: "Mood evaluation",
                properties: {
                    manager: {
                        type: "string",
                        enum: ["positive", "neutral", "negative"],
                        description: "Manager's mood in uzbek language"
                    },
                    client: {
                        type: "string",
                        enum: ["positive", "neutral", "negative"],
                        description: "Client's mood in uzbek language"
                    },
                    overall: {
                        type: "string",
                        description: "Description of overall mood in uzbek language"
                    }
                },
                required: ["manager", "client", "overall"]
            },
            feedback: {
                type: "string",
                description: "Overall conclusion based on the whole call in uzbek language"
            }
        },
        required: ["scores", "objections", "mistakes", "mood", "feedback"]
    };
}

// Format segments for prompt
function formatSegmentsForPrompt(segments) {
    if (!segments || segments.length === 0) {
        return 'No conversation segments available.';
    }

    let formattedText = '## Conversation Transcription:\n\n';
    segments.forEach((segment, index) => {
        formattedText += `[${segment.timestamp}] ${segment.speaker}: ${segment.text}\n`;
    });

    return formattedText;
}


// Start process
async function transcribeAndDiarize(fileUri, mimeType, isCancelled = null) {
    // Check for cancellation before starting
    if (isCancelled && isCancelled()) {
        throw new Error('Transcription cancelled by user');
    }

    // Validate API key
    if (!apiKey || !genAI) {
        throw new Error('GEMINI_API_KEY is not configured. Please set it in your environment variables.');
    }

    // Validate fileUri format
    if (!fileUri || typeof fileUri !== 'string') {
        throw new Error(`Invalid fileUri: ${fileUri}. Expected a string.`);
    }

    const systemInstruction = buildTranscriptionPrompt();
    const jsonSchema = buildTranscriptionSchema();

    const model = genAI.getGenerativeModel({
        model: MODEL_TRANSCRIPTION,
        systemInstruction: systemInstruction,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: jsonSchema
        }
    });

    if (isCancelled && isCancelled()) {
        throw new Error('Transcription cancelled by user');
    }

    try {
        const generateContentPromise = model.generateContent([
            {
                fileData: {
                    mimeType: mimeType,
                    fileUri: fileUri,
                },
            },
        ]);

        let result = await generateContentPromise;
        let responseText = result.response.text();
        let parsed = JSON.parse(responseText);
        return parsed.segments || [];
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function identifyCategory(segments, db, isCancelled = null) {
    // Check for cancellation before starting
    if (isCancelled && isCancelled()) {
        throw new Error('Category identification cancelled by user');
    }

    // Validate API key
    if (!apiKey || !genAI) {
        throw new Error('GEMINI_API_KEY is not configured. Please set it in your environment variables.');
    }

    // Validate segments format
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
        throw new Error(`Invalid segments: Expected a non-empty array of conversation segments.`);
    }

    // Fetch categories from database
    const categories = await getCategories(db);

    // Check for cancellation after fetching categories
    if (isCancelled && isCancelled()) {
        throw new Error('Category identification cancelled by user');
    }

    const systemInstruction = buildCategoryPrompt(categories);
    const jsonSchema = buildCategoryIdentificationSchema(categories);
    const model = genAI.getGenerativeModel({
        model: MODEL_CATEGORY_IDENTIFICATION,
        systemInstruction: systemInstruction,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: jsonSchema
        }
    });

    if (isCancelled && isCancelled()) {
        throw new Error('Category identification cancelled by user');
    }

    try {
        const conversationText = formatSegmentsForPrompt(segments);
        const generateContentPromise = model.generateContent(conversationText);

        let result = await generateContentPromise;
        let responseText = result.response.text();
        let parsed = JSON.parse(responseText);
        return parsed.category;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function analyzeAudio(segments, category, db, isCancelled = null) {
    // Check for cancellation before starting
    if (isCancelled && isCancelled()) {
        throw new Error('Analysis cancelled by user');
    }

    // Validate API key
    if (!apiKey || !genAI) {
        throw new Error('GEMINI_API_KEY is not configured. Please set it in your environment variables.');
    }

    // Validate segments format
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
        throw new Error(`Invalid segments: Expected a non-empty array of conversation segments.`);
    }

    // Fetch categories and criteria from database
    const categories = await getCategories(db, true);

    // Check for cancellation after fetching categories
    if (isCancelled && isCancelled()) {
        throw new Error('Analysis cancelled by user');
    }

    // Check if category exists in database
    const categoryExists = categories.some(cat => cat.name === category);

    // If category doesn't exist, it was likely created by AI during identification
    // Allow analysis to proceed, but it will have no criteria to evaluate
    if (!categoryExists) {
        console.warn(`Category "${category}" not found in database. This appears to be a newly created category. Analysis will proceed without category-specific criteria.`);
    }

    const systemInstruction = buildAnalysisPrompt(categories, category);
    const jsonSchema = buildAnalysisSchema(categories, category);

    const model = genAI.getGenerativeModel({
        model: MODEL_ANALYSIS,
        systemInstruction: systemInstruction,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: jsonSchema
        }
    });

    try {
        const conversationText = formatSegmentsForPrompt(segments);
        const generateContentPromise = model.generateContent(conversationText);

        let result = await generateContentPromise;
        let responseText = result.response.text();
        let parsed = JSON.parse(responseText);
        return parsed;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

// Update callback function type:
// async function updateCallback(step, data)
// step: 'transcription' | 'category' | 'analysis'
// data: varies by step
async function updateAnalysisStep(step, data, audioFileId, db) {
    try {
        switch (step) {
            case 'transcription':
                // Save or update transcription
                const segments = data.segments || [];
                const fullText = segments.map(s => s.text).join(' ');

                // Check if transcription already exists
                const existingTranscription = await db.get(
                    'SELECT id FROM transcriptions WHERE audio_file_id = ?',
                    audioFileId
                );

                if (existingTranscription) {
                    await db.run(
                        'UPDATE transcriptions SET full_text = ?, segments = ? WHERE audio_file_id = ?',
                        fullText,
                        JSON.stringify(segments),
                        audioFileId
                    );
                } else {
                    await db.run(
                        'INSERT INTO transcriptions (audio_file_id, full_text, segments) VALUES (?, ?, ?)',
                        audioFileId,
                        fullText,
                        JSON.stringify(segments)
                    );
                }
                console.log(`Updated transcription for file ${audioFileId}`);
                break;

            case 'category':
                // Update category in analysis if it exists, otherwise prepare for full analysis save
                const category = data.category;

                // Check if analysis already exists
                const existingAnalysis = await db.get(
                    'SELECT id FROM analyses WHERE audio_file_id = ?',
                    audioFileId
                );

                if (existingAnalysis) {
                    await db.run(
                        'UPDATE analyses SET category = ? WHERE audio_file_id = ?',
                        category,
                        audioFileId
                    );
                } else {
                    // Create a placeholder analysis record with just the category
                    await db.run(
                        'INSERT INTO analyses (audio_file_id, category) VALUES (?, ?)',
                        audioFileId,
                        category
                    );
                }
                console.log(`Updated category for file ${audioFileId}: ${category}`);
                break;

            case 'analysis':
                // Save full analysis results
                // The analysis result from analyzeAudio has: scores, objections, mistakes, mood, feedback
                const analysis = data;

                // Calculate overall_score as average of all criterion scores
                let overallScore = null;
                if (analysis.scores && typeof analysis.scores === 'object') {
                    const scoreValues = Object.values(analysis.scores).filter(v => typeof v === 'number');
                    if (scoreValues.length > 0) {
                        overallScore = Math.round(
                            scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length
                        );
                    }
                }

                // Get category from the analysis record if it was set earlier
                const existingCategoryRecord = await db.get(
                    'SELECT category FROM analyses WHERE audio_file_id = ?',
                    audioFileId
                );
                const savedCategory = existingCategoryRecord ? existingCategoryRecord.category : null;

                await db.run(
                    'UPDATE analyses SET category = ?, overall_score = ?, criteria_scores = ?, objections = ?, mistakes = ?, mood = ?, feedback = ?, explanation = ? WHERE audio_file_id = ?',
                    savedCategory,
                    overallScore,
                    JSON.stringify(analysis.scores || {}), // criteria_scores maps to the scores object
                    JSON.stringify(analysis.objections || []),
                    JSON.stringify(analysis.mistakes || []),
                    JSON.stringify(analysis.mood || {}),
                    analysis.feedback || '',
                    analysis.feedback || '', // explanation same as feedback
                    audioFileId
                );
                console.log(`Updated full analysis for file ${audioFileId}`);
                break;

            default:
                console.warn(`Unknown step type: ${step}`);
        }
    } catch (error) {
        console.error(`Error updating ${step} for file ${audioFileId}:`, error);
        throw error;
    }
}

async function transcribeAndAnalyzeAudio(fileUri, mimeType, db, isCancelled = null) {
    // Check for cancellation before starting
    if (isCancelled && isCancelled()) {
        throw new Error('Analysis cancelled by user');
    }

    // Validate API key
    if (!apiKey || !genAI) {
        throw new Error('GEMINI_API_KEY is not configured. Please set it in your environment variables.');
    }

    // Validate fileUri format
    if (!fileUri || typeof fileUri !== 'string') {
        throw new Error(`Invalid fileUri: ${fileUri}. Expected a string.`);
    }

    console.log(`Using file URI: ${fileUri}`);
    console.log('Starting three-step analysis process...');

    try {

        // Step 1: Transcribe and diarize using Gemini 2.5 Pro
        console.log('Step 1/3: Transcribing and diarizing audio...');
        const segments = await transcribeAndDiarize(fileUri, mimeType, isCancelled);
        console.log(`Transcription complete: ${segments.length} segments`);
        console.log(segments);

        // Step 2: Identify category using Gemini 2.0 Flash Lite
        console.log('Step 2/3: Identifying conversation category...');
        const category = await identifyCategory(segments, db, isCancelled);
        console.log(`Category identified: ${category}`);


        // Step 3: Analyze using Gemini 3.0 Pro with identified category and transcription
        console.log('Step 3/3: Analyzing conversation with identified category...');
        const result = await analyzeAudio(segments, category, db, isCancelled);
        console.log('Analysis complete');
        console.log(result);
        return result;
    } catch (error) {
        console.error('Error in three-step analysis process:', error);
        throw error;
    }
}

async function transcribeAndAnalyzeAudioWithUpdates(fileUri, mimeType, audioFileId, db, isCancelled = null) {
    // Check for cancellation before starting
    if (isCancelled && isCancelled()) {
        throw new Error('Analysis cancelled by user');
    }

    // Validate API key
    if (!apiKey || !genAI) {
        throw new Error('GEMINI_API_KEY is not configured. Please set it in your environment variables.');
    }

    // Validate fileUri format
    if (!fileUri || typeof fileUri !== 'string') {
        throw new Error(`Invalid fileUri: ${fileUri}. Expected a string.`);
    }

    // Validate audioFileId
    if (!audioFileId) {
        throw new Error('audioFileId is required for incremental updates');
    }

    console.log(`Using file URI: ${fileUri}`);
    console.log('Starting three-step analysis process with incremental updates...');

    try {
        // Step 1: Transcribe and diarize using Gemini 2.5 Pro
        console.log('Step 1/3: Transcribing and diarizing audio...');
        const segments = await transcribeAndDiarize(fileUri, mimeType, isCancelled);
        console.log(`Transcription complete: ${segments.length} segments`);

        // Update database with transcription
        await updateAnalysisStep('transcription', { segments }, audioFileId, db);

        // Step 2: Identify category using Gemini 2.0 Flash Lite
        console.log('Step 2/3: Identifying conversation category...');
        const category = await identifyCategory(segments, db, isCancelled);
        console.log(`Category identified: ${category}`);

        // Update database with category
        await updateAnalysisStep('category', { category }, audioFileId, db);

        // Step 3: Analyze using Gemini 3.0 Pro with identified category and transcription
        console.log('Step 3/3: Analyzing conversation with identified category...');
        const result = await analyzeAudio(segments, category, db, isCancelled);
        console.log('Analysis complete');

        // Update database with full analysis
        await updateAnalysisStep('analysis', result, audioFileId, db);

        // Return result with category included for compatibility
        return {
            ...result,
            category: category
        };
    } catch (error) {
        console.error('Error in three-step analysis process:', error);
        throw error;
    }
}

module.exports = {
    uploadToGemini,
    waitForFileActive,
    transcribeAndAnalyzeAudio,
    transcribeAndAnalyzeAudioWithUpdates,
    updateAnalysisStep
};
