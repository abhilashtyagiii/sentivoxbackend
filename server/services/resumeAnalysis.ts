import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('GEMINI_API_KEY environment variable is required.');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export interface ResumeAnalysisResult {
  recruiterQuestionRelevance: {
    totalQuestions: number;
    resumeRelatedQuestions: number;
    relevancePercentage: number;
    examples: Array<{
      question: string;
      isResumeRelated: boolean;
      resumeSection?: string;
    }>;
  };
  candidateResponseQuality: {
    consistencyScore: number;
    depthScore: number;
    examples: Array<{
      claim: string;
      response: string;
      isConsistent: boolean;
      notes: string;
    }>;
  };
  overallAssessment: {
    recruiterEffectiveness: number;
    candidatePerformance: number;
    summary: string;
  };
}

export interface CandidateReportData {
  skillsDemonstration: {
    claimedSkills: string[];
    demonstratedSkills: string[];
    score: number;
  };
  consistencyCheck: {
    score: number;
    inconsistencies: string[];
  };
  communicationRating: {
    clarity: number;
    confidence: number;
    depth: number;
  };
  strengths: string[];
  areasForImprovement: string[];
  overallScore: number;
  summary: string;
}

export interface RecruiterReportData {
  questionQuality: {
    resumeRelevance: number;
    depth: number;
    engagement: number;
  };
  interviewCoverage: {
    experienceCovered: string[];
    skillsCovered: string[];
    missedOpportunities: string[];
  };
  effectiveness: {
    score: number;
    strengths: string[];
    improvements: string[];
  };
  overallScore: number;
  summary: string;
}

export async function analyzeResumeTranscriptAlignment(
  resumeText: string,
  transcriptSegments: Array<{ speaker: string; text: string; timestamp?: string }>,
  jobDescription?: string
): Promise<{
  resumeAnalysis: ResumeAnalysisResult;
  candidateReport: CandidateReportData;
  recruiterReport: RecruiterReportData;
}> {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const recruiterSegments = transcriptSegments.filter(s => 
      s.speaker.toLowerCase().includes('recruiter') || s.speaker.toLowerCase().includes('interviewer')
    );
    const candidateSegments = transcriptSegments.filter(s => 
      s.speaker.toLowerCase().includes('candidate') || s.speaker.toLowerCase().includes('interviewee')
    );

    const prompt = `You are an expert interview analyst. Analyze this interview based on the candidate's resume.

**RESUME:**
${resumeText}

${jobDescription ? `**JOB DESCRIPTION:**\n${jobDescription}\n` : ''}

**INTERVIEW TRANSCRIPT:**
${transcriptSegments.map(s => `${s.speaker}: ${s.text}`).join('\n')}

Provide a comprehensive analysis in JSON format with the following structure:

{
  "resumeAnalysis": {
    "recruiterQuestionRelevance": {
      "totalQuestions": <number>,
      "resumeRelatedQuestions": <number>,
      "relevancePercentage": <0-100>,
      "examples": [
        {
          "question": "<question text>",
          "isResumeRelated": <boolean>,
          "resumeSection": "<which part of resume this relates to, if applicable>"
        }
      ]
    },
    "candidateResponseQuality": {
      "consistencyScore": <0-10>,
      "depthScore": <0-10>,
      "examples": [
        {
          "claim": "<claim from resume>",
          "response": "<how candidate responded>",
          "isConsistent": <boolean>,
          "notes": "<analysis notes>"
        }
      ]
    },
    "overallAssessment": {
      "recruiterEffectiveness": <0-10>,
      "candidatePerformance": <0-10>,
      "summary": "<brief overall summary>"
    }
  },
  "candidateReport": {
    "skillsDemonstration": {
      "claimedSkills": ["<skill from resume>"],
      "demonstratedSkills": ["<skill shown in interview>"],
      "score": <0-10>
    },
    "consistencyCheck": {
      "score": <0-10>,
      "inconsistencies": ["<any inconsistencies found>"]
    },
    "communicationRating": {
      "clarity": <0-10>,
      "confidence": <0-10>,
      "depth": <0-10>
    },
    "strengths": ["<strength 1>", "<strength 2>"],
    "areasForImprovement": ["<area 1>", "<area 2>"],
    "overallScore": <0-10>,
    "summary": "<2-3 sentence summary for candidate>"
  },
  "recruiterReport": {
    "questionQuality": {
      "resumeRelevance": <0-10>,
      "depth": <0-10>,
      "engagement": <0-10>
    },
    "interviewCoverage": {
      "experienceCovered": ["<experience areas discussed>"],
      "skillsCovered": ["<skills assessed>"],
      "missedOpportunities": ["<what could have been explored>"]
    },
    "effectiveness": {
      "score": <0-10>,
      "strengths": ["<strength 1>", "<strength 2>"],
      "improvements": ["<suggestion 1>", "<suggestion 2>"]
    },
    "overallScore": <0-10>,
    "summary": "<2-3 sentence summary for recruiter>"
  }
}

Focus on:
1. How well recruiter questions align with candidate's resume
2. How effectively candidate demonstrated their claimed skills and experience
3. Consistency between resume claims and interview responses
4. Quality of communication and depth of answers
5. Professional assessment for both parties`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from AI response");
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return {
      resumeAnalysis: analysis.resumeAnalysis,
      candidateReport: analysis.candidateReport,
      recruiterReport: analysis.recruiterReport
    };
  } catch (error) {
    console.error("Resume analysis error:", error);
    throw new Error("Failed to analyze resume-transcript alignment: " + (error instanceof Error ? error.message : 'Unknown error'));
  }
}
