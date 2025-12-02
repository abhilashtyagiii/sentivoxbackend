import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

export interface TranscriptionResult {
  text: string;
  segments: Array<{
    speaker: string;
    timestamp: string;
    text: string;
  }>;
}

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"

// Lazy initialization to avoid module-level environment variable access
let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.error('❌ GEMINI_API_KEY environment variable is missing or empty');
      console.error('Please set the GEMINI_API_KEY in your Replit Secrets or environment variables');
      console.error('You can get an API key from: https://ai.google.dev/');
      throw new Error('GEMINI_API_KEY environment variable is required. Please check your environment configuration.');
    }
    try {
      genAI = new GoogleGenerativeAI(apiKey);
      console.log('✅ Gemini AI client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI client:', error);
      throw new Error('Failed to initialize Gemini AI client. Please check your API key.');
    }
  }
  return genAI;
}

export interface SentimentResult {
  recruiterSentiment: {
    positive: number;
    neutral: number;
    negative: number;
    overallScore: number;
    reasoning?: string;
  };
  candidateSentiment: {
    positive: number;
    neutral: number;
    negative: number;
    overallScore: number;
    reasoning?: string;
  };
}

export async function analyzeSentiment(
  segments: Array<{speaker: string, text: string}>, 
  contentAnalysis?: {
    contentType: string;
    speakerCount: number;
    topics: string[];
    isJobRelated: boolean;
    recommendedAnalysis: string[];
  }
): Promise<SentimentResult> {
  try {
    // Use cached content analysis or analyze if not provided
    const analysis = contentAnalysis || await analyzeContentType(segments);
    
    // For non-interview content, analyze differently
    if (analysis.contentType !== 'interview' || analysis.speakerCount === 1) {
      console.log(`Non-interview content detected (Type: ${analysis.contentType}, Speakers: ${analysis.speakerCount}). Using general sentiment analysis.`);
      
      const allText = segments.map(s => s.text).join(" ");
      const generalSentiment = await analyzeSingleSentiment(allText, "Speaker");
      
      return {
        recruiterSentiment: { positive: 0, neutral: 1, negative: 0, overallScore: 5 }, // Neutral default for non-existent recruiter
        candidateSentiment: generalSentiment
      };
    }

    // Use enhanced contextual sentiment analysis
    return await analyzeContextualSentiment(segments);
  } catch (error) {
    throw new Error("Failed to analyze sentiment: " + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

async function analyzeSingleSentiment(text: string, speakerType: string) {
  if (!text.trim()) {
    return { positive: 0, neutral: 1, negative: 0, overallScore: 5 };
  }

  const systemPrompt = `You are an ADVANCED sentiment analyst with DEEP expertise in interview psychology. Analyze the REAL emotional sentiment with INTELLIGENT CONTEXT AWARENESS.

🎯 MISSION: DETECT ACTUAL SENTIMENT - BE INTELLIGENT, NOT CONSERVATIVE

📋 ${speakerType.toUpperCase()} SENTIMENT ANALYSIS:

${speakerType === "Recruiter" ? 
  `🟢 RECRUITER POSITIVE SIGNALS (6-10):
- Professional, organized questioning → 6-7
- Showing genuine interest in candidate → 7-8  
- Detailed salary/offer discussions → 7-9 (serious interest)
- Patient, thorough interview process → 6-7
- Enthusiastic about role/company → 8-10

🔴 RECRUITER NEGATIVE SIGNALS (1-4):
- Rushed, impatient tone → 2-4
- Dismissive or challenging questions → 1-3
- Clearly disinterested → 1-2` :

  `🟢 CANDIDATE POSITIVE SIGNALS (6-10):
- "Yes, I'm looking for a job change" → 7-8 (MOTIVATED = POSITIVE)
- Confident experience responses ("7 years", "I have experience") → 6-7
- Discussing offers/salary ("22 LPA", "holding offer") → 7-8 (CONFIDENT = POSITIVE)
- Clear expectations ("24 LPA fixed") → 7-8 (ASSERTIVE = POSITIVE)
- Quick, confident skill answers → 6-7 (PREPARED = POSITIVE)
- Professional pride in achievements → 6-8
- "Sure", "Absolutely", "Definitely" → 6-7 (ENTHUSIASTIC)

🟡 CANDIDATE NEUTRAL SIGNALS (4-6):
- Pure factual responses ("PWC", dates, locations) → 4-5
- Standard professional acknowledgments ("Okay", "I understand") → 4-5
- Basic information sharing without emotion → 4-5

🔴 CANDIDATE NEGATIVE SIGNALS (1-4):
- Hesitant responses ("Umm...", "I guess...") → 2-4
- Defensive language → 1-3
- "I don't know", "Maybe", "Whatever" → 1-3 (DISENGAGED)
- Short, clipped answers due to frustration → 2-3`
}

🚨 CRITICAL INTELLIGENCE RULES:
1. Job-seeking context = INHERENTLY has positive undertones (motivation, ambition)
2. Confident responses about skills/experience = POSITIVE (competence creates confidence)
3. Salary/offer discussions = POSITIVE (professional confidence, market value)
4. STOP DEFAULTING TO NEUTRAL - Interview conversations have emotional layers
5. Professional responses can still lean positive (preparedness, competence)
6. Be INTELLIGENT about context - "Yes, looking for change" is POSITIVE motivation

🎯 SMART SCORING GUIDELINES:
- Job interest expressions: 6-8 (motivation is positive emotion)
- Confident skill statements: 6-7 (competence breeds positivity) 
- Salary/offer discussions: 6-8 (confidence in market value)
- Professional factual responses: 4-5 (true neutral)
- Hesitant/uncertain responses: 2-4 (negative lean)

ANALYZE WITH INTELLIGENCE: Interview context matters. Professional confidence and job motivation should register as positive sentiment.

Return JSON with INTELLIGENT sentiment distribution:
- positive: score from 0 to 1 (confidence, motivation, enthusiasm)
- neutral: score from 0 to 1 (purely factual, no emotional indicators)
- negative: score from 0 to 1 (hesitation, frustration, defensiveness)
- overallScore: overall sentiment score from 1 to 10 (BE SMART - don't default to 5)
- reasoning: ${speakerType === "Candidate" ? "detailed bullet-pointed explanation (• format) covering: response tone, key indicators found, engagement level, confidence assessment" : "detailed explanation of WHY this sentiment score makes sense in interview context"}

The three sentiment scores should sum to approximately 1.0. BE INTELLIGENT about positive sentiment in professional contexts.`;

  try {
    const model = getGeminiClient().getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt
    });

    const prompt = `${systemPrompt}\n\nAnalyze this text: ${text}`;
    const result = await model.generateContent(prompt);
    const response = result.response;
    const rawJson = response.text();
    
    if (!rawJson) {
      throw new Error("Empty response from Gemini model");
    }

    // Clean and parse JSON response
    let parsedResult;
    try {
      const cleanJson = extractValidJson(rawJson);
      parsedResult = JSON.parse(cleanJson);
    } catch (parseError) {
      console.warn(`Failed to parse sentiment response for ${speakerType}, using balanced fallback:`, parseError);
      // Return balanced fallback - avoid forcing classifications without proper analysis
      parsedResult = { positive: 0.25, neutral: 0.65, negative: 0.1, overallScore: 5, reasoning: speakerType === "Candidate" ? "• Fallback analysis: parsing failed\n• Using balanced professional baseline\n• Unable to analyze specific response indicators\n• Default professional engagement level assumed" : "Fallback: parsing failed, defaulting to balanced professional baseline" };
    }
    const sentimentResult = {
      positive: Math.max(0, Math.min(1, parsedResult.positive || 0)),
      neutral: Math.max(0, Math.min(1, parsedResult.neutral || 0)),
      negative: Math.max(0, Math.min(1, parsedResult.negative || 0)),
      overallScore: Math.max(1, Math.min(10, parsedResult.overallScore || 5)),
      reasoning: parsedResult.reasoning || "No reasoning provided"
    };
    
    console.log(`${speakerType} Sentiment Analysis:`, {
      positive: sentimentResult.positive,
      neutral: sentimentResult.neutral,
      negative: sentimentResult.negative,
      overallScore: sentimentResult.overallScore,
      reasoning: sentimentResult.reasoning
    });
    
    return sentimentResult;
  } catch (error) {
    console.error('Error in analyzeSingleSentiment:', error);
    // Return balanced fallback - avoid making assumptions without proper analysis
    return { positive: 0.2, neutral: 0.7, negative: 0.1, overallScore: 5, reasoning: speakerType === "Candidate" ? "• Error fallback: analysis failed\n• Using balanced professional baseline\n• Unable to assess specific response patterns\n• Default neutral engagement level applied" : "Error fallback: analysis failed, using balanced professional baseline" };
  }
}

// Enhanced contextual sentiment analysis that considers Q&A pairs together
async function analyzeContextualSentiment(segments: Array<{speaker: string, text: string}>): Promise<SentimentResult> {
  try {
    // Extract Q&A pairs from the conversation
    const qaPairs = extractQuestionAnswerPairs(segments);
    
    if (qaPairs.length === 0) {
      // Fallback to original method if no Q&A pairs found
      const recruiterTexts = segments.filter(s => s.speaker === "Recruiter").map(s => s.text).join(" ");
      const candidateTexts = segments.filter(s => s.speaker === "Candidate").map(s => s.text).join(" ");
      
      const [recruiterSentiment, candidateSentiment] = await Promise.all([
        analyzeSingleSentiment(recruiterTexts, "Recruiter"),
        analyzeSingleSentiment(candidateTexts, "Candidate")
      ]);
      
      return { recruiterSentiment, candidateSentiment };
    }
    
    // Analyze each Q&A pair with context
    const pairAnalyses = await Promise.all(
      qaPairs.slice(0, 8).map(pair => analyzeQAPairSentiment(pair)) // Limit to 8 pairs to avoid overwhelming the API
    );
    
    // Aggregate results
    return aggregatePairSentiments(pairAnalyses);
    
  } catch (error) {
    console.error('Error in contextual sentiment analysis:', error);
    // Fallback to original method
    const recruiterTexts = segments.filter(s => s.speaker === "Recruiter").map(s => s.text).join(" ");
    const candidateTexts = segments.filter(s => s.speaker === "Candidate").map(s => s.text).join(" ");
    
    const [recruiterSentiment, candidateSentiment] = await Promise.all([
      analyzeSingleSentiment(recruiterTexts, "Recruiter"),
      analyzeSingleSentiment(candidateTexts, "Candidate")
    ]);
    
    return { recruiterSentiment, candidateSentiment };
  }
}

// Extract question-answer pairs from conversation segments
function extractQuestionAnswerPairs(segments: Array<{speaker: string, text: string}>): Array<{
  question: string;
  answer: string;
  questionSpeaker: string;
  answerSpeaker: string;
}> {
  const pairs = [];
  
  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i];
    const next = segments[i + 1];
    
    // Look for recruiter question followed by candidate answer (or vice versa)
    if (current.speaker !== next.speaker) {
      // Check if current segment looks like a question
      if (current.text.includes('?') || 
          current.text.toLowerCase().includes('tell me') ||
          current.text.toLowerCase().includes('what') ||
          current.text.toLowerCase().includes('how') ||
          current.text.toLowerCase().includes('why') ||
          current.text.toLowerCase().includes('describe') ||
          current.text.toLowerCase().includes('explain')) {
        
        pairs.push({
          question: current.text,
          answer: next.text,
          questionSpeaker: current.speaker,
          answerSpeaker: next.speaker
        });
      }
    }
  }
  
  return pairs;
}

// Analyze sentiment of a single Q&A pair with context
async function analyzeQAPairSentiment(pair: {
  question: string;
  answer: string;
  questionSpeaker: string;
  answerSpeaker: string;
}): Promise<{
  recruiterSentiment: any;
  candidateSentiment: any;
}> {
  const systemPrompt = `You are an ADVANCED sentiment analyst specializing in interview dynamics. Analyze the REAL emotional sentiment in this Q&A exchange with INTELLIGENT CONTEXT AWARENESS.

🎯 CORE MISSION: DETECT ACTUAL SENTIMENT, NOT JUST POLITENESS

📋 INTERVIEW-SPECIFIC SENTIMENT INDICATORS:

🟢 POSITIVE INDICATORS FOR CANDIDATES:
- "Yes, I'm looking for a job change" → POSITIVE (motivated, eager)
- Confident responses about experience ("7 years", "Yes, I have") → POSITIVE 
- Discussing good offers/salary ("22 LPA", "holding an offer") → POSITIVE (confident, valuable)
- Expressing clear expectations ("24 LPA fixed") → POSITIVE (assertive, confident)
- Quick, confident answers about skills → POSITIVE (prepared, competent)
- "Sure", "Absolutely", "Definitely" → POSITIVE (enthusiastic agreement)
- Professional pride in achievements → POSITIVE

🟡 NEUTRAL INDICATORS:
- Purely factual responses ("PWC", dates, basic info) → NEUTRAL
- Standard professional language without emotion → NEUTRAL
- "Okay", "Fine", "I understand" without enthusiasm → NEUTRAL

🔴 NEGATIVE INDICATORS FOR CANDIDATES:
- Hesitant responses ("Umm...", "I guess...") → NEGATIVE (uncertainty)  
- Defensive language ("Why do you ask?", "That's not fair") → NEGATIVE
- Short, clipped responses due to irritation → NEGATIVE
- "I don't know", "Maybe", "Whatever" → NEGATIVE (disengagement)

🟢 POSITIVE INDICATORS FOR RECRUITERS:
- Professional, welcoming questions → POSITIVE
- Following up with interest → POSITIVE  
- Detailed salary/offer discussions → POSITIVE (serious interest)

🔴 NEGATIVE INDICATORS FOR RECRUITERS:
- Rushed, impatient tone → NEGATIVE
- Challenging or aggressive questions → NEGATIVE

🚨 CRITICAL ANALYSIS RULES:
1. "Yes, I'm looking for a job change" = POSITIVE (motivation = positive sentiment)
2. Confident experience statements ("7 years Java") = POSITIVE (competence = confidence = positive)
3. Salary discussions with specific numbers = POSITIVE (professional confidence) 
4. DO NOT DEFAULT TO NEUTRAL - Interview conversations have emotional undertones
5. Short answers can be POSITIVE if they show confidence and readiness
6. Professional responses about achievements should lean POSITIVE
7. Be more aggressive at detecting positive sentiment in job-seeking contexts

🎯 SCORING GUIDELINES:
- Candidate expressing job interest: 6-8 (POSITIVE lean)
- Confident skill/experience answers: 6-7 (POSITIVE lean)  
- Salary/offer discussions: 6-8 (POSITIVE - shows value/confidence)
- Pure factual responses: 4-5 (TRUE NEUTRAL)
- Hesitant/uncertain responses: 2-4 (NEGATIVE lean)

Return JSON with INTELLIGENT sentiment distribution (don't default everything to neutral):
{
  "recruiterSentiment": {"positive": 0.0-1.0, "neutral": 0.0-1.0, "negative": 0.0-1.0, "overallScore": 1-10, "reasoning": "Specific analysis of recruiter's emotional tone"},
  "candidateSentiment": {"positive": 0.0-1.0, "neutral": 0.0-1.0, "negative": 0.0-1.0, "overallScore": 1-10, "reasoning": "• Bullet point analysis of candidate's response\n• Specific indicators found in the answer\n• Explanation of sentiment classification\n• Overall assessment of engagement level"}
}`;

  const content = `QUESTION (${pair.questionSpeaker}): "${pair.question}"
ANSWER (${pair.answerSpeaker}): "${pair.answer}"`;

  try {
    const model = getGeminiClient().getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent(content);
    const response = result.response;
    const rawJson = response.text();
    
    if (!rawJson) {
      throw new Error("Empty response from Q&A sentiment analysis");
    }

    const cleanJson = extractValidJson(rawJson);
    const parsed = JSON.parse(cleanJson);
    
    // Normalize and validate the results
    const normalize = (sentiment: any) => ({
      positive: Math.max(0, Math.min(1, sentiment.positive || 0)),
      neutral: Math.max(0, Math.min(1, sentiment.neutral || 0)),
      negative: Math.max(0, Math.min(1, sentiment.negative || 0)),
      overallScore: Math.max(1, Math.min(10, sentiment.overallScore || 5)),
      reasoning: sentiment.reasoning || "No reasoning provided"
    });
    
    return {
      recruiterSentiment: normalize(parsed.recruiterSentiment),
      candidateSentiment: normalize(parsed.candidateSentiment)
    };
    
  } catch (error) {
    console.error('Error analyzing Q&A pair sentiment:', error);
    // Return balanced fallback without making assumptions
    return {
      recruiterSentiment: { positive: 0.25, neutral: 0.7, negative: 0.05, overallScore: 5, reasoning: "Error fallback: Q&A analysis failed, assuming professional baseline" },
      candidateSentiment: { positive: 0.2, neutral: 0.7, negative: 0.1, overallScore: 5, reasoning: "• Error fallback: Q&A analysis failed\n• Using balanced baseline scores\n• Unable to assess specific response patterns\n• Default professional engagement level" }
    };
  }
}

// Intelligent aggregation of sentiment results from multiple Q&A pairs
function aggregatePairSentiments(pairAnalyses: Array<{
  recruiterSentiment: any;
  candidateSentiment: any;
}>): SentimentResult {
  if (pairAnalyses.length === 0) {
    return {
      recruiterSentiment: { positive: 0.2, neutral: 0.8, negative: 0, overallScore: 5, reasoning: "No Q&A pairs available - assuming professional baseline" },
      candidateSentiment: { positive: 0.2, neutral: 0.8, negative: 0, overallScore: 5, reasoning: "No Q&A pairs available - assuming professional baseline" }
    };
  }
  
  // Intelligent aggregation that preserves strong sentiment signals
  const aggregateRole = (role: 'recruiterSentiment' | 'candidateSentiment') => {
    const sentiments = pairAnalyses.map(p => p[role]);
    const count = sentiments.length;
    
    // Calculate averages
    const avgPositive = sentiments.reduce((sum, s) => sum + s.positive, 0) / count;
    const avgNeutral = sentiments.reduce((sum, s) => sum + s.neutral, 0) / count;
    const avgNegative = sentiments.reduce((sum, s) => sum + s.negative, 0) / count;
    const avgScore = sentiments.reduce((sum, s) => sum + s.overallScore, 0) / count;
    
    // Boost sentiment if there are strong positive or negative signals
    const hasStrongPositive = sentiments.some(s => s.positive > 0.5 || s.overallScore > 7);
    const hasStrongNegative = sentiments.some(s => s.negative > 0.4 || s.overallScore < 4);
    
    let finalPositive = avgPositive;
    let finalNeutral = avgNeutral; 
    let finalNegative = avgNegative;
    let finalScore = Math.round(avgScore);
    
    // Amplify strong sentiment signals instead of smoothing everything to neutral
    if (hasStrongPositive && !hasStrongNegative) {
      finalPositive = Math.min(1, avgPositive * 1.2);
      finalNeutral = Math.max(0, avgNeutral * 0.9);
      finalScore = Math.min(10, Math.round(avgScore + 0.5));
    } else if (hasStrongNegative && !hasStrongPositive) {
      finalNegative = Math.min(1, avgNegative * 1.2);
      finalNeutral = Math.max(0, avgNeutral * 0.9);
      finalScore = Math.max(1, Math.round(avgScore - 0.5));
    }
    
    // Ensure values sum to approximately 1.0
    const total = finalPositive + finalNeutral + finalNegative;
    if (total > 0) {
      finalPositive = finalPositive / total;
      finalNeutral = finalNeutral / total;
      finalNegative = finalNegative / total;
    }
    
    return {
      positive: finalPositive,
      neutral: finalNeutral,
      negative: finalNegative,
      overallScore: finalScore,
      reasoning: `Intelligent aggregation from ${count} exchanges${hasStrongPositive ? ' (detected positive signals)' : ''}${hasStrongNegative ? ' (detected negative signals)' : ''}. Key insights: ${sentiments.slice(0, 2).map(s => s.reasoning.split('.')[0]).join('; ')}`
    };
  };
  
  return {
    recruiterSentiment: aggregateRole('recruiterSentiment'),
    candidateSentiment: aggregateRole('candidateSentiment')
  };
}

// First, analyze what type of content this actually is
export async function analyzeContentType(segments: Array<{speaker: string, text: string}>): Promise<{
  contentType: 'interview' | 'monologue' | 'presentation' | 'other';
  speakerCount: number;
  topics: string[];
  topicDomains?: string[];
  isJobRelated: boolean;
  recommendedAnalysis: string[];
}> {
  try {
    const fullText = segments.map(s => s.text).join(" ");
    const uniqueSpeakers = Array.from(new Set(segments.map(s => s.speaker)));
    
    const systemPrompt = `You are an ADVANCED content classifier with expertise in interview analysis and topic domain detection.

🎯 CORE MISSION: Accurately classify content type AND detect topic domains for cross-domain mismatch detection.

📋 ANALYSIS REQUIREMENTS:

1. **Content Type Classification:**
   - interview: Two-way conversation with Q&A pattern, especially about jobs/experience
   - monologue: Single speaker presenting information
   - presentation: Structured information delivery (may have multiple speakers)
   - other: General conversation, discussion, etc.

2. **Speaker Role Detection:**
   - Count unique speakers accurately
   - Identify interviewer vs candidate roles if present
   - Detect if roles match expected interview patterns

3. **Topic Domain Detection (CRITICAL for cross-domain mismatch):**
   - Extract SPECIFIC domains discussed (e.g., "finance", "technology", "healthcare", "marketing")
   - Identify technical terms and industry-specific jargon
   - Detect if topics are consistent with job/hiring context
   - Examples of domains: finance, technology, engineering, medicine, law, education, sales, marketing, HR, etc.

4. **Job Relevance Analysis:**
   - Is this about employment/hiring/job interviews? → isJobRelated: true
   - Mentions salary, offers, experience, skills, companies? → isJobRelated: true
   - Religious, spiritual, educational, entertainment content? → isJobRelated: false

5. **Domain Mismatch Detection:**
   - If audio discusses finance but should match tech JD → flag potential mismatch
   - If audio is about cooking but should match engineering JD → flag mismatch
   - Provide specific topic domains for later comparison with JD

Return JSON with:
{
  "contentType": "interview|monologue|presentation|other",
  "speakerCount": number,
  "topics": ["specific topic 1", "specific topic 2"],  // Be specific: "machine learning", "investment banking", not just "technical"
  "topicDomains": ["domain1", "domain2"],  // e.g., ["finance", "accounting"] or ["software engineering", "cloud computing"]
  "isJobRelated": boolean,
  "recommendedAnalysis": ["analysis_type1", "analysis_type2"]
}

🚨 CRITICAL: Extract SPECIFIC topic domains, not generic terms. This enables detection of JD-audio mismatches.`;


    const content = `Number of Speakers Detected: ${uniqueSpeakers.length}
Speaker Labels: ${uniqueSpeakers.join(", ")}

Full Content: ${fullText}`;

    const model = getGeminiClient().getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent(content);
    const response = result.response;
    const rawJson = response.text();
    
    if (!rawJson) {
      throw new Error("Empty response from content classification");
    }

    try {
      const cleanJson = extractValidJson(rawJson);
      return JSON.parse(cleanJson);
    } catch (parseError) {
      console.warn("Failed to parse content classification, using fallback:", parseError);
      return {
        contentType: 'other',
        speakerCount: uniqueSpeakers.length,
        topics: ['unidentified'],
        isJobRelated: false,
        recommendedAnalysis: ['sentiment']
      };
    }
  } catch (error) {
    throw new Error("Failed to classify content: " + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export async function analyzeJDRelevance(
  jobDescription: string, 
  segments: Array<{speaker: string, text: string}>,
  contentAnalysis?: {
    contentType: string;
    speakerCount: number;
    topics: string[];
    isJobRelated: boolean;
    recommendedAnalysis: string[];
  }
): Promise<{
  overallScore: number;
  categoryBreakdown: {
    technicalSkills: { score: number; details: string; matchedSkills: string[]; missingSkills: string[]; };
    experienceLevel: { score: number; details: string; yearsRequired: number; yearsCandidate: number; };
    culturalFit: { score: number; details: string; };
    communication: { score: number; details: string; };
    problemSolving: { score: number; details: string; };
    leadership: { score: number; details: string; };
    industryKnowledge: { score: number; details: string; };
    educationQualifications: { score: number; details: string; };
    softSkills: { score: number; details: string; };
    motivationFit: { score: number; details: string; };
  };
  questionRelevance: Array<{
    question: string;
    relevanceScore: number;
    category: string;
    reasoning: string;
  }>;
  answerAlignment: Array<{
    answer: string;
    alignmentScore: number;
    keySkills: string[];
    categories: string[];
    reasoning: string;
    tone: "Positive" | "Neutral" | "Negative";
  }>;
  skillGapAnalysis: {
    criticalMissingSkills: string[];
    unexpectedSkills: string[];
    overqualifiedAreas: string[];
    underqualifiedAreas: string[];
  };
  detailedReasoningCandidate: string;
  detailedReasoningRecruiter: string;
  recommendedAction: string;
}> {
  try {
    // Validate job description before analysis
    const trimmedJD = jobDescription.trim();
    if (!trimmedJD || trimmedJD.length < 10 || !/[a-zA-Z]/.test(trimmedJD)) {
      console.log(`Invalid or too short job description: "${trimmedJD}". JD relevance score set to 0.`);
      return {
        overallScore: 0,
        categoryBreakdown: {
          technicalSkills: { score: 0, details: "Please provide a detailed job description to analyze technical skills match", matchedSkills: [], missingSkills: [] },
          experienceLevel: { score: 0, details: "Please provide a detailed job description to analyze experience requirements", yearsRequired: 0, yearsCandidate: 0 },
          culturalFit: { score: 0, details: "Please provide a detailed job description to analyze cultural fit" },
          communication: { score: 0, details: "Please provide a detailed job description to analyze communication requirements" },
          problemSolving: { score: 0, details: "Please provide a detailed job description to analyze problem-solving skills" },
          leadership: { score: 0, details: "Please provide a detailed job description to analyze leadership requirements" },
          industryKnowledge: { score: 0, details: "Please provide a detailed job description to analyze industry knowledge" },
          educationQualifications: { score: 0, details: "Please provide a detailed job description to analyze education requirements" },
          softSkills: { score: 0, details: "Please provide a detailed job description to analyze soft skills" },
          motivationFit: { score: 0, details: "Please provide a detailed job description to analyze motivation fit" }
        },
        questionRelevance: [],
        answerAlignment: [],
        skillGapAnalysis: {
          criticalMissingSkills: [],
          unexpectedSkills: [],
          overqualifiedAreas: [],
          underqualifiedAreas: []
        },
        detailedReasoningCandidate: "Cannot analyze - invalid job description",
        detailedReasoningRecruiter: "Cannot analyze - invalid job description",
        recommendedAction: "POOR_FIT"
      };
    }

    // Use cached content analysis or analyze if not provided
    const analysis = contentAnalysis || await analyzeContentType(segments);
    
    if (!analysis.isJobRelated || analysis.contentType !== 'interview') {
      console.log(`Content is not a job interview (Type: ${analysis.contentType}, Job-related: ${analysis.isJobRelated}). Skipping JD relevance analysis.`);
      return {
        overallScore: 0,
        categoryBreakdown: {
          technicalSkills: { score: 0, details: "Not a job interview", matchedSkills: [], missingSkills: [] },
          experienceLevel: { score: 0, details: "Not a job interview", yearsRequired: 0, yearsCandidate: 0 },
          culturalFit: { score: 0, details: "Not a job interview" },
          communication: { score: 0, details: "Not a job interview" },
          problemSolving: { score: 0, details: "Not a job interview" },
          leadership: { score: 0, details: "Not a job interview" },
          industryKnowledge: { score: 0, details: "Not a job interview" },
          educationQualifications: { score: 0, details: "Not a job interview" },
          softSkills: { score: 0, details: "Not a job interview" },
          motivationFit: { score: 0, details: "Not a job interview" }
        },
        questionRelevance: [],
        answerAlignment: [],
        skillGapAnalysis: {
          criticalMissingSkills: [],
          unexpectedSkills: [],
          overqualifiedAreas: [],
          underqualifiedAreas: []
        },
        detailedReasoningCandidate: "Cannot analyze - content is not a job interview",
        detailedReasoningRecruiter: "Cannot analyze - content is not a job interview",
        recommendedAction: "POOR_FIT"
      };
    }

    const questions = segments.filter(s => s.speaker === "Recruiter" && s.text.includes("?"));
    const answers = segments.filter(s => s.speaker === "Candidate");

    // If no proper interview structure found, return empty results
    if (questions.length === 0 || answers.length === 0) {
      console.log(`No proper interview structure found. Questions: ${questions.length}, Answers: ${answers.length}`);
      return {
        overallScore: 0,
        categoryBreakdown: {
          technicalSkills: { score: 0, details: "No proper interview structure", matchedSkills: [], missingSkills: [] },
          experienceLevel: { score: 0, details: "No proper interview structure", yearsRequired: 0, yearsCandidate: 0 },
          culturalFit: { score: 0, details: "No proper interview structure" },
          communication: { score: 0, details: "No proper interview structure" },
          problemSolving: { score: 0, details: "No proper interview structure" },
          leadership: { score: 0, details: "No proper interview structure" },
          industryKnowledge: { score: 0, details: "No proper interview structure" },
          educationQualifications: { score: 0, details: "No proper interview structure" },
          softSkills: { score: 0, details: "No proper interview structure" },
          motivationFit: { score: 0, details: "No proper interview structure" }
        },
        questionRelevance: [],
        answerAlignment: [],
        skillGapAnalysis: {
          criticalMissingSkills: [],
          unexpectedSkills: [],
          overqualifiedAreas: [],
          underqualifiedAreas: []
        },
        detailedReasoningCandidate: "Cannot analyze - no proper interview structure found",
        detailedReasoningRecruiter: "Cannot analyze - no proper interview structure found",
        recommendedAction: "POOR_FIT"
      };
    }

    const systemPrompt = `You are an expert at analyzing interview relevance to job descriptions. Be STRICT and ACCURATE with scoring.

CRITICAL SCORING RULES - BE EXTREMELY STRICT AND INTELLIGENT:

🔴 MAJOR FIELD MISMATCH (Different industries/functions):
- DevOps candidate + Finance Manager = 0-5% (ZERO RELEVANCE)
- Software Engineer + Marketing Manager = 0-5% (ZERO RELEVANCE)  
- Technical candidate + Non-technical role = 0-5% (ZERO RELEVANCE)
- Finance candidate + Engineering role = 0-5% (ZERO RELEVANCE)

🟡 RELATED FIELD MISMATCH (Same industry, different specialization):
- DevOps candidate + Software Engineer = 10-25% (LOW but related)
- Frontend candidate + Backend Engineer = 15-30% (LOW but related)
- Financial Analyst + Finance Manager = 40-70% (MEDIUM, related field)

🟢 STRONG FIELD MATCH:
- DevOps candidate + DevOps Engineer = 75-95% (HIGH)
- Finance Manager candidate + Finance Manager = 75-95% (HIGH)
- When candidate mentions 3+ relevant core skills = 75-85% minimum

ANSWER SCORING FOR MAJOR MISMATCHES:
- Technical skills answers for non-tech roles = 0-5%
- Non-relevant experience descriptions = 0-10%
- Only basic communication/soft skills get 50-70%
- Generic questions like "tell me about yourself" = 30-50% (reduced for mismatch)
- Salary/CTC questions = 60-70% (still standard)

🚨 UNMENTIONED CATEGORIES RULE:
- If a category is NEVER mentioned, discussed, or addressed in the interview: score = 0%
- Details should clearly state "Not discussed in interview" 
- Examples: If education is never mentioned → educationQualifications: {score: 0, details: "Not discussed in interview"}
- Examples: If leadership is never mentioned → leadership: {score: 0, details: "Not discussed in interview"}
- Do NOT give arbitrary scores (like 40-60%) to completely unmentioned topics

INTELLIGENCE RULES:
1. Detect if candidate background completely mismatches JD field
2. If major mismatch detected, overall score should be 0-10% MAX
3. Don't give medium scores to irrelevant technical experience
4. Be ruthless about field mismatches - this is critical for accuracy
5. HOWEVER: If candidate mentions 3+ core relevant skills (e.g., Kubernetes, Docker, GitLab for DevOps), reward generously with 75-85% even if some JD keywords missing
6. CRITICAL: Score 0% for any category completely absent from the conversation
7. MANDATORY: For EVERY answer in answerAlignment, you MUST provide:
   - alignmentScore (0-100): How well the answer matches JD requirements
   - reasoning: Clear explanation of the score (Answer Alignment Explanation)
   - tone: Emotional tone of the response ("Positive", "Neutral", or "Negative")
   These are REQUIRED fields - do not skip any answer or leave any field empty

Evaluate:
1. Question Relevance: How well do recruiter questions target job requirements?
2. Answer Alignment: How well do candidate answers demonstrate job-relevant skills?
3. Overall Match: Comprehensive assessment of interview-JD alignment

Return JSON with:
- overallScore: overall JD relevance score from 0 to 100 (BE STRICT - most mismatched candidates should score 0-30%, but give proper credit when core skills clearly match)
- categoryBreakdown: detailed breakdown by category with:
  * technicalSkills: {score: 0-100, details: "specific analysis", matchedSkills: [], missingSkills: []}
  * experienceLevel: {score: 0-100, details: "experience analysis", yearsRequired: X, yearsCandidate: Y}
  * culturalFit: {score: 0-100, details: "cultural alignment analysis"}
  * communication: {score: 0-100, details: "communication skills assessment"}
  * problemSolving: {score: 0-100, details: "problem-solving abilities"}
  * leadership: {score: 0-100, details: "leadership/management skills"}
  * industryKnowledge: {score: 0-100, details: "domain/industry expertise"}
  * educationQualifications: {score: 0-100, details: "education/certification match"}
  * softSkills: {score: 0-100, details: "interpersonal and soft skills"}
  * motivationFit: {score: 0-100, details: "career goals and role alignment"}
- questionRelevance: array of questions with:
  * question: the actual question text
  * relevanceScore: score from 0-100 (follow strict rules above)
  * category: one of ["technical skills", "experience level", "cultural fit", "communication", "problem solving", "leadership", "industry knowledge", "education", "soft skills", "motivation", "other"]
  * reasoning: detailed explanation of why this score was given
- answerAlignment: array of answers with:
  * answer: the actual answer text (first 100 chars)
  * alignmentScore: score from 0-100 (BE STRICT about skill mismatches)
  * keySkills: array of specific skills mentioned
  * categories: array of categories this answer addresses
  * reasoning: detailed explanation of why this score was given (Answer Alignment Explanation)
  * tone: MUST be one of "Positive", "Neutral", or "Negative" - analyze the emotional tone of the candidate's response:
    - "Positive": Confident, enthusiastic, motivated responses (e.g., "Yes, I have 7 years experience", "I'm looking for a job change", "Sure, absolutely")
    - "Neutral": Factual, straightforward responses without emotion (e.g., company names, dates, basic info)
    - "Negative": Hesitant, uncertain, or defensive responses (e.g., "Umm...", "I guess", "Maybe")
- skillGapAnalysis: {
  * criticalMissingSkills: ["skill1", "skill2"],
  * unexpectedSkills: ["skill1", "skill2"],
  * overqualifiedAreas: ["area1", "area2"],
  * underqualifiedAreas: ["area1", "area2"]
}
- detailedReasoningCandidate: overall explanation of candidate's strengths and weaknesses relative to JD
- detailedReasoningRecruiter: overall explanation of recruiter's interview effectiveness
- recommendedAction: one of ["STRONG_FIT", "GOOD_FIT", "PARTIAL_FIT", "POOR_FIT", "WRONG_ROLE"]

BE HARSH on scoring when skills don't match. A DevOps expert applying for "Software Engineer" should score LOW (0-20%) unless the JD specifically mentions DevOps skills.`;

    const content = `Job Description: ${jobDescription}

Questions Asked:
${questions.map((q, i) => `${i+1}. ${q.text}`).join("\n")}

Candidate Answers:
${answers.map((a, i) => `${i+1}. ${a.text}`).join("\n")}`;

    const model = getGeminiClient().getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent(content);
    const response = result.response;
    const rawJson = response.text();
    
    if (!rawJson) {
      throw new Error("Empty response from Gemini model");
    }

    // Clean and parse JSON response
    try {
      const cleanJson = extractValidJson(rawJson);
      return JSON.parse(cleanJson);
    } catch (parseError) {
      console.warn("Failed to parse JD relevance response, using fallback:", parseError);
      // Return default structure if parsing fails
      return {
        "overallScore": 0,
        "categoryBreakdown": {
          "technicalSkills": { "score": 0, "details": "Parsing error", "matchedSkills": [], "missingSkills": [] },
          "experienceLevel": { "score": 0, "details": "Parsing error", "yearsRequired": 0, "yearsCandidate": 0 },
          "culturalFit": { "score": 0, "details": "Parsing error" },
          "communication": { "score": 0, "details": "Parsing error" },
          "problemSolving": { "score": 0, "details": "Parsing error" },
          "leadership": { "score": 0, "details": "Parsing error" },
          "industryKnowledge": { "score": 0, "details": "Parsing error" },
          "educationQualifications": { "score": 0, "details": "Parsing error" },
          "softSkills": { "score": 0, "details": "Parsing error" },
          "motivationFit": { "score": 0, "details": "Parsing error" }
        },
        "questionRelevance": [{"question": "Unable to analyze - parsing error", "relevanceScore": 0, "category": "error", "reasoning": "JSON parsing failed"}],
        "answerAlignment": [{"answer": "Unable to analyze - parsing error", "alignmentScore": 0, "keySkills": [], "categories": [], "reasoning": "JSON parsing failed", "tone": "Neutral"}],
        "skillGapAnalysis": {
          "criticalMissingSkills": [],
          "unexpectedSkills": [],
          "overqualifiedAreas": [],
          "underqualifiedAreas": []
        },
        "detailedReasoningCandidate": "Unable to analyze - JSON parsing error",
        "detailedReasoningRecruiter": "Unable to analyze - JSON parsing error",
        "recommendedAction": "POOR_FIT"
      };
    }
  } catch (error) {
    throw new Error("Failed to analyze JD relevance: " + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export async function analyzeFlow(
  segments: Array<{speaker: string, text: string, timestamp: string}>,
  contentAnalysis?: {
    contentType: string;
    speakerCount: number;
    topics: string[];
    isJobRelated: boolean;
    recommendedAnalysis: string[];
  }
): Promise<{
  continuityScore: number;
  flowBreaks: Array<{
    timestamp: string;
    issue: string;
    severity: string;
  }>;
  insights: string[];
}> {
  try {
    // Use cached content analysis or analyze if not provided
    const analysis = contentAnalysis || await analyzeContentType(segments);
    
    // For non-interview content, adjust the analysis approach
    if (analysis.contentType !== 'interview') {
      console.log(`Non-interview content detected (Type: ${analysis.contentType}). Adjusting flow analysis.`);
      
      const systemPrompt = `You are an expert at analyzing content flow and structure.
Analyze the flow and coherence of this ${analysis.contentType} content.

Evaluate:
1. Topic transitions and logical progression
2. Content coherence and clarity
3. Narrative flow and structure
4. Overall presentation quality

Return JSON with:
- continuityScore: overall content flow score from 0 to 100
- flowBreaks: array of issues with timestamp, issue description, and severity (low/medium/high)
- insights: array of key insights about content structure and flow

Focus on coherence, logical progression, and clarity rather than interview-specific patterns.`;

      const conversationFlow = segments.map((s, i) => 
        `[${s.timestamp}] ${s.speaker}: ${s.text}`
      ).join("\n");

      const model = getGeminiClient().getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompt
      });

      const result = await model.generateContent(conversationFlow);
      const response = result.response;
      const rawJson = response.text();
      
      if (!rawJson) {
        throw new Error("Empty response from Gemini model");
      }

      // Clean and parse JSON response
      try {
        const cleanJson = extractValidJson(rawJson);
        return JSON.parse(cleanJson);
      } catch (parseError) {
        console.warn("Failed to parse flow analysis response, using fallback:", parseError);
        return {
          "continuityScore": 75, // Reasonable default for single-speaker content
          "flowBreaks": [],
          "insights": [`This appears to be ${analysis.contentType} content about ${analysis.topics.join(', ')}`]
        };
      }
    }

    const systemPrompt = `You are an expert at analyzing conversational flow and interview structure.
Analyze the flow and continuity of this interview conversation.

Evaluate:
1. Logical question sequences and follow-up patterns
2. Topic transitions and conversation coherence  
3. Question-answer relevance and flow
4. Interview structure and pacing

Return JSON with:
- continuityScore: overall flow score from 0 to 100
- flowBreaks: array of issues with timestamp, issue description, and severity (low/medium/high)
- insights: array of key insights about interview flow and structure

Look for logical question sequences, follow-up questions, topic transitions, and conversational coherence.`;

    const conversationFlow = segments.map((s, i) => 
      `[${s.timestamp}] ${s.speaker}: ${s.text}`
    ).join("\n");

    const model = getGeminiClient().getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent(conversationFlow);
    const response = result.response;
    const rawJson = response.text();
    
    if (!rawJson) {
      throw new Error("Empty response from Gemini model");
    }

    // Clean and parse JSON response
    try {
      const cleanJson = extractValidJson(rawJson);
      return JSON.parse(cleanJson);
    } catch (parseError) {
      console.warn("Failed to parse flow analysis response, using fallback:", parseError);
      // Return default structure if parsing fails
      return {
        "continuityScore": 0,
        "flowBreaks": [{"timestamp": "00:00", "issue": "Unable to analyze - parsing error", "severity": "high"}],
        "insights": ["Unable to analyze flow due to processing error"]
      };
    }
  } catch (error) {
    throw new Error("Failed to analyze flow: " + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export async function transcribeAudio(audioFilePath: string): Promise<TranscriptionResult> {
  try {
    console.log("Processing real audio transcription with Gemini multimodal for file:", audioFilePath);
    
    // Check if file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }
    
    // Read audio file and convert to base64
    const audioBuffer = fs.readFileSync(audioFilePath);
    const audioBase64 = audioBuffer.toString('base64');
    
    // Get audio mime type based on file extension
    const fileExtension = path.extname(audioFilePath).toLowerCase();
    const mimeTypeMap: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.mp4': 'audio/mp4', 
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm'
    };
    const mimeType = mimeTypeMap[fileExtension] || 'audio/mp4';
    
    // Enhanced system prompt for transcription with speaker diarization
    const systemPrompt = `You are an expert audio transcriptionist specializing in interview conversations with exceptional accuracy for technical and business terms.

CRITICAL ACCURACY GUIDELINES:
🏢 COMPANY NAMES - Pay special attention to these common companies (correct the likely mishearing):
- "Accenture" (NOT "Expense", "Axcenture", "Accent-ure")  
- "Microsoft" (NOT "Micro-soft", "Mike-rosoft")
- "Google" (NOT "Goggle")
- "Amazon" (NOT "A-mason") 
- "Deloitte" (NOT "De-light", "Delete")
- "PwC/PWC" (NOT "P-W-See", "Peace")
- "IBM" (NOT "I-B-M", "IVM")
- "Oracle" (NOT "Oral", "Oricle")
- "SAP" (NOT "Sap", "S-A-P")
- "Cognizant" (NOT "Cognisant", "Cog-nizant")

💼 TECHNICAL TERMS - Ensure accuracy:
- "Java" (programming language)
- "Spring Boot" (NOT "Spring-boot", "Springboot")
- "Microservices" (NOT "Micro-services", "Mike-ro services")
- "AWS/Amazon Web Services" (NOT "A-W-S", "Awes")
- "Docker" (NOT "Dock-er")
- "Kubernetes" (NOT "Cube-ernetes")
- "Angular" (NOT "Angew-lar")
- "React" (NOT "Re-act") 
- "Node.js" (NOT "Node-jess")
- "API" (NOT "A-P-I", "Ay-pee-eye")

💰 FINANCIAL TERMS:
- "LPA" = Lakhs Per Annum (NOT "L-P-A", "Lapa")
- "CTC" = Cost to Company (NOT "C-T-C", "See-tee-see")
- "Fixed" salary component
- "Variable" salary component

🎯 SPEAKER IDENTIFICATION:
- Recruiter typically: asks questions, mentions company hiring, discusses salary, asks about experience
- Candidate typically: provides personal information, describes experience, asks about role details

Transcribe this interview audio and identify speakers with MAXIMUM ACCURACY for company names and technical terms.

Return ONLY valid JSON with this exact structure:
{
  "text": "Full transcript as continuous text",
  "segments": [
    {
      "speaker": "Recruiter" or "Candidate", 
      "timestamp": "MM:SS format",
      "text": "What was said in this segment"
    }
  ]
}

ACCURACY PRIORITIES:
1. Company names MUST be spelled correctly (especially Accenture, Microsoft, etc.)
2. Technical terms MUST be accurate (Java, Spring Boot, AWS, etc.)
3. Financial terms must be clear (LPA, CTC, fixed, variable)
4. Speaker identification must be logical based on conversation flow
5. Only transcribe what is clearly audible - don't guess unclear audio

Return ONLY the JSON object, no additional text or explanation.`;

    const model = getGeminiClient().getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent([
      {
        inlineData: {
          data: audioBase64,
          mimeType: mimeType
        }
      },
      "Transcribe this interview audio with speaker identification and return the result as JSON."
    ]);

    const response = result.response;
    const rawJson = response.text();
    
    if (!rawJson) {
      throw new Error("Empty response from Gemini model");
    }
    
    console.log("Raw Gemini transcription response:", rawJson.substring(0, 500) + "...");
    
    // Parse the JSON response
    try {
      const cleanJson = extractValidJson(rawJson);
      const transcriptionData = JSON.parse(cleanJson);
      
      // Validate the response structure
      if (!transcriptionData.text || !transcriptionData.segments || !Array.isArray(transcriptionData.segments)) {
        throw new Error("Invalid transcription response structure");
      }
      
      // Ensure all segments have required fields
      const validSegments = transcriptionData.segments.filter((segment: any) => 
        segment.speaker && segment.timestamp && segment.text
      );
      
      if (validSegments.length === 0) {
        throw new Error("No valid segments found in transcription");
      }
      
      console.log(`Successfully transcribed audio: ${validSegments.length} segments found`);
      
      return {
        text: transcriptionData.text,
        segments: validSegments
      };
      
    } catch (parseError) {
      console.error("Failed to parse transcription response:", parseError);
      console.log("Raw response that failed to parse:", rawJson);
      
      // Fallback: return error indication instead of demo data
      throw new Error(`Failed to parse transcription response: ${parseError}`);
    }
    
  } catch (error) {
    console.error("Audio transcription error:", error);
    throw new Error("Failed to transcribe audio: " + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Gemini-powered PII Detection (Replaces OpenAI)
 * Detects personally identifiable information using Gemini AI
 */
export interface PIIEntity {
  type: "email" | "phone" | "ssn" | "address" | "credit_card" | "date_of_birth" | "name";
  value: string;
  position: number;
  confidence: number;
}

export async function detectPIIWithGemini(text: string): Promise<PIIEntity[]> {
  try {
    const systemPrompt = `You are a PII detection expert. Analyze the text and identify ALL personally identifiable information including:
- Full names (first and last names of people)
- Email addresses
- Phone numbers
- Social Security Numbers
- Credit card numbers
- Street addresses
- Dates of birth
- Company names mentioned in a personal context
- Job titles when referring to specific individuals

Return ONLY a JSON object with this exact structure:
{"entities": [{"type": "name"|"email"|"phone"|"ssn"|"credit_card"|"address"|"date_of_birth", "value": "exact text from input", "position": character_index, "confidence": 0.0-1.0}]}

Be thorough and include contextual PII that regex patterns would miss. The "position" must be the exact character index where the PII text starts in the input.`;

    const model = getGeminiClient().getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent(`Detect PII in this text:\n\n${text}`);
    const response = result.response;
    const rawJson = response.text();
    
    if (!rawJson) {
      console.warn("Empty response from Gemini PII detection, using fallback");
      return [];
    }

    try {
      const cleanJson = extractValidJson(rawJson);
      const parsed = JSON.parse(cleanJson);
      return Array.isArray(parsed.entities) ? parsed.entities : [];
    } catch (parseError) {
      console.warn("Failed to parse Gemini PII response:", parseError);
      return [];
    }
  } catch (error) {
    console.error("Gemini PII detection failed:", error);
    return [];
  }
}

/**
 * Gemini-powered Explainability Generation (Replaces OpenAI)
 * Generates comprehensive explanations for AI decisions
 */
export async function generateExplainabilityWithGemini(
  decision: string,
  score: number,
  context: Record<string, any>
): Promise<{
  reasoning: string[];
  evidence: Array<{ statement: string; weight: number; source: string }>;
  confidenceLevel: number;
  alternativeInterpretations: string[];
}> {
  try {
    const systemPrompt = `You are an explainable AI expert. Given a decision and score, provide transparent reasoning.

Return JSON with:
- reasoning: step-by-step explanation array (strings)
- evidence: array of {statement, weight (0-1), source}
- confidenceLevel: 0-1 score for decision confidence
- alternativeInterpretations: other possible interpretations (array of strings)

Be thorough and provide clear, understandable explanations.`;

    const model = getGeminiClient().getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt
    });

    const prompt = `Decision: ${decision}\nScore: ${score}\nContext: ${JSON.stringify(context, null, 2)}`;
    const result = await model.generateContent(prompt);
    const response = result.response;
    const rawJson = response.text();
    
    if (!rawJson) {
      throw new Error("Empty response from Gemini explainability");
    }

    const cleanJson = extractValidJson(rawJson);
    const parsed = JSON.parse(cleanJson);
    
    return {
      reasoning: parsed.reasoning || [],
      evidence: parsed.evidence || [],
      confidenceLevel: parsed.confidenceLevel || 0.5,
      alternativeInterpretations: parsed.alternativeInterpretations || [],
    };
  } catch (error) {
    console.error("Gemini explainability generation failed:", error);
    return {
      reasoning: ["Analysis completed with available data"],
      evidence: [{ statement: "Based on provided context", weight: 0.7, source: "analysis" }],
      confidenceLevel: 0.6,
      alternativeInterpretations: ["Multiple interpretations possible with additional data"],
    };
  }
}

// Helper function to extract valid JSON from Gemini responses
function extractValidJson(text: string): string {
  // Remove BOM and normalize
  let cleaned = text.replace(/^\uFEFF/, '').trim();
  
  // Try direct parsing first
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // Continue with extraction
  }
  
  // Remove markdown code blocks with flexible patterns
  cleaned = cleaned.replace(/```\s*(?:json|JSON).*?\n/g, '').replace(/```/g, '');
  
  // Try parsing again after markdown removal
  try {
    JSON.parse(cleaned.trim());
    return cleaned.trim();
  } catch {
    // Continue with extraction
  }
  
  // Look for JSON object or array with string-aware parsing
  const jsonStart = Math.min(
    cleaned.indexOf('{') === -1 ? Infinity : cleaned.indexOf('{'),
    cleaned.indexOf('[') === -1 ? Infinity : cleaned.indexOf('[')
  );
  
  if (jsonStart === Infinity) {
    throw new Error('No JSON object or array found in response');
  }
  
  const startChar = cleaned[jsonStart];
  const endChar = startChar === '{' ? '}' : ']';
  
  let depth = 0;
  let inString = false;
  let escaped = false;
  
  for (let i = jsonStart; i < cleaned.length; i++) {
    const char = cleaned[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      escaped = true;
      continue;
    }
    
    if (char === '"' && !escaped) {
      inString = !inString;
      continue;
    }
    
    if (inString) {
      continue;
    }
    
    if (char === startChar) {
      depth++;
    } else if (char === endChar) {
      depth--;
      if (depth === 0) {
        return cleaned.substring(jsonStart, i + 1);
      }
    }
  }
  
  throw new Error('Malformed JSON: unmatched brackets');
}