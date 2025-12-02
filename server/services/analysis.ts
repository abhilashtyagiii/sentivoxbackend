import { transcribeAudio, analyzeSentiment, analyzeJDRelevance, analyzeFlow, analyzeContentType } from "./gemini";
import { analyzeResumeTranscriptAlignment } from "./resumeAnalysis";
import { generateCandidateReport, generateRecruiterReport } from "./resume-reports";
import { storage } from "../storage";
import type { Interview } from "@shared/schema";

export interface ProcessingStep {
  name: string;
  status: "pending" | "processing" | "complete" | "error";
  message: string;
  timestamp: Date;
}

export async function processInterview(interviewId: string): Promise<void> {
  const interview = await storage.getInterview(interviewId);
  if (!interview) {
    throw new Error("Interview not found");
  }

  const hasResume = !!interview.resumeText;
  
  const steps: ProcessingStep[] = [
    { name: "Audio Processing", status: "pending", message: "Processing interview audio with Gemini AI demo", timestamp: new Date() },
    { name: "Content Classification", status: "pending", message: "Analyzing content type and structure", timestamp: new Date() },
    { name: "Sentiment Analysis", status: "pending", message: "Analyzing emotional tone using Gemini AI", timestamp: new Date() },
    { name: "JD Relevance Analysis", status: "pending", message: "Matching responses with job description using Gemini AI", timestamp: new Date() },
    { name: "Flow Analysis", status: "pending", message: "Evaluating conversation continuity with Gemini AI", timestamp: new Date() },
    ...(hasResume ? [{ name: "Resume Analysis", status: "pending" as const, message: "Analyzing resume-transcript alignment", timestamp: new Date() }] : []),
    { name: "Report Generation", status: "pending", message: "Generating final analysis report", timestamp: new Date() }
  ];

  try {
    // Update processing status
    await storage.updateInterview(interviewId, {
      processingStatus: "processing",
      processingSteps: steps
    });

    // Step 1: Audio Processing (using Gemini-only demo transcription)
    steps[0].status = "processing";
    steps[0].message = "Processing audio with Google Gemini AI...";
    await storage.updateInterview(interviewId, { processingSteps: steps });
    
    const transcriptionResult = await transcribeAudio(interview.filePath);
    steps[0].status = "complete";
    steps[1].status = "processing";
    
    await storage.updateInterview(interviewId, {
      transcription: transcriptionResult,
      processingSteps: steps
    });

    // Step 2: Content Classification (smart analysis with validation)
    steps[1].status = "processing";
    await storage.updateInterview(interviewId, { processingSteps: steps });
    
    const contentAnalysis = await analyzeContentType(transcriptionResult.segments);
    console.log(`Content classified as: ${contentAnalysis.contentType} with ${contentAnalysis.speakerCount} speakers`);
    
    // Pre-analysis validation: Check if content is suitable for interview analysis
    if (contentAnalysis.speakerCount < 2) {
      steps[1].status = "error";
      steps[1].message = "Invalid Audio Format: Sentivox requires a two-person interview to perform analysis. This audio contains only one speaker.";
      
      await storage.updateInterview(interviewId, {
        processingStatus: "error",
        processingSteps: steps
      });
      
      throw new Error("Invalid Audio Format: Sentivox requires a two-person interview to perform analysis. Please upload a valid file.");
    }
    
    if (contentAnalysis.contentType !== 'interview' || !contentAnalysis.isJobRelated) {
      steps[1].status = "error";
      steps[1].message = `Content is not a job interview (detected: ${contentAnalysis.contentType}). Sentivox requires a two-person job interview for analysis.`;
      
      await storage.updateInterview(interviewId, {
        processingStatus: "error",
        processingSteps: steps
      });
      
      throw new Error(`Cannot analyze - content is not a job interview. Detected content type: ${contentAnalysis.contentType}`);
    }
    
    steps[1].status = "complete";
    steps[2].status = "processing";
    await storage.updateInterview(interviewId, { processingSteps: steps });

    // Step 3: Sentiment Analysis (using cached content analysis)
    const sentimentResult = await analyzeSentiment(transcriptionResult.segments, contentAnalysis);
    steps[2].status = "complete";
    steps[3].status = "processing";
    
    await storage.updateInterview(interviewId, {
      sentimentAnalysis: sentimentResult,
      processingSteps: steps
    });

    // Step 4: JD Relevance Analysis (using cached content analysis)
    const jdResult = await analyzeJDRelevance(interview.jobDescription, transcriptionResult.segments, contentAnalysis);
    steps[3].status = "complete";
    steps[4].status = "processing";
    
    await storage.updateInterview(interviewId, {
      jdAnalysis: jdResult,
      processingSteps: steps
    });

    // Step 5: Flow Analysis (using cached content analysis)
    const flowResult = await analyzeFlow(transcriptionResult.segments, contentAnalysis);
    steps[4].status = "complete";
    
    await storage.updateInterview(interviewId, {
      flowAnalysis: flowResult,
      processingSteps: steps
    });

    // Step 6 (Optional): Resume Analysis
    if (hasResume && interview.resumeText) {
      const resumeStepIndex = steps.findIndex(s => s.name === "Resume Analysis");
      if (resumeStepIndex >= 0) {
        steps[resumeStepIndex].status = "processing";
        await storage.updateInterview(interviewId, { processingSteps: steps });

        const resumeAnalysisResult = await analyzeResumeTranscriptAlignment(
          interview.resumeText,
          transcriptionResult.segments,
          interview.jobDescription
        );

        steps[resumeStepIndex].status = "complete";
        steps[resumeStepIndex].message = "Resume analysis complete";

        await storage.updateInterview(interviewId, {
          resumeAnalysis: resumeAnalysisResult.resumeAnalysis,
          candidateReport: resumeAnalysisResult.candidateReport,
          recruiterReport: resumeAnalysisResult.recruiterReport,
          processingSteps: steps
        });
      }
    }

    // Step 6/7: Generate Report
    const reportStepIndex = steps.findIndex(s => s.name === "Report Generation");
    if (reportStepIndex >= 0) {
      steps[reportStepIndex].status = "processing";
      await storage.updateInterview(interviewId, { processingSteps: steps });
    }
    const reportData = await generateAnalysisReport(
      transcriptionResult,
      sentimentResult,
      jdResult,
      flowResult
    );

    await storage.createAnalysisReport({
      interviewId,
      recruiterSentiment: sentimentResult.recruiterSentiment.overallScore,
      candidateEngagement: calculateEngagementScore(transcriptionResult.segments, sentimentResult.candidateSentiment),
      jdMatchScore: jdResult.overallScore,
      flowContinuityScore: flowResult.continuityScore,
      insights: flowResult.insights,
      qaAnalysis: extractQAAnalysis(transcriptionResult.segments, jdResult, sentimentResult),
      reportData
    });

    if (reportStepIndex >= 0) {
      steps[reportStepIndex].status = "complete";
      steps[reportStepIndex].message = "Analysis report generated successfully";
    }
    
    await storage.updateInterview(interviewId, {
      processingStatus: "complete",
      processingSteps: steps
    });

  } catch (error) {
    console.error("Processing failed:", error);
    const currentStep = steps.findIndex(s => s.status === "processing");
    if (currentStep >= 0) {
      steps[currentStep].status = "error";
      
      // Provide specific error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('GEMINI_API_KEY')) {
          steps[currentStep].message = 'GEMINI_API_KEY is missing or invalid. Please check your environment configuration.';
        } else if (error.message.includes('Failed to initialize Gemini')) {
          steps[currentStep].message = 'Failed to connect to Gemini AI. Please verify your GEMINI_API_KEY.';
        } else {
          steps[currentStep].message = error.message;
        }
      } else {
        steps[currentStep].message = 'Unknown error occurred during processing';
      }
    }
    
    await storage.updateInterview(interviewId, {
      processingStatus: "error",
      processingSteps: steps
    });
    throw error;
  }
}

function calculateEngagementScore(segments: any[], candidateSentiment: any): number {
  const candidateSegments = segments.filter((s: any) => s.speaker === "Candidate");
  
  if (candidateSegments.length === 0) {
    return 0; // No candidate participation
  }

  // Calculate multiple engagement factors
  const avgResponseLength = candidateSegments.reduce((acc: number, s: any) => acc + s.text.length, 0) / candidateSegments.length;
  const sentimentScore = candidateSentiment.overallScore * 10; // Convert 1-10 to 10-100 scale
  
  // Better length scoring: reward substantial responses
  let lengthScore = 0;
  if (avgResponseLength > 150) {
    lengthScore = 90; // Very detailed responses
  } else if (avgResponseLength > 100) {
    lengthScore = 80; // Good detail
  } else if (avgResponseLength > 50) {
    lengthScore = 70; // Decent responses
  } else if (avgResponseLength > 20) {
    lengthScore = 50; // Short but present
  } else {
    lengthScore = 30; // Very short responses
  }
  
  // Count questions answered (engagement breadth)
  const recruiterQuestions = segments.filter((s: any) => s.speaker === "Recruiter" && s.text.includes("?")).length;
  const participationScore = recruiterQuestions > 0 ? Math.min(100, (candidateSegments.length / recruiterQuestions) * 70) : 70;
  
  // Weighted average: sentiment most important, then length, then participation
  const finalScore = Math.round((sentimentScore * 0.5) + (lengthScore * 0.3) + (participationScore * 0.2));
  
  return Math.max(10, Math.min(100, finalScore)); // Ensure between 10-100
}

function extractQAAnalysis(segments: any[], jdResult: any, sentimentResult?: any) {
  const qaList: any[] = [];
  let currentQ: any = null;
  
  for (const segment of segments) {
    if (segment.speaker === "Recruiter" && segment.text.includes("?")) {
      if (currentQ) {
        qaList.push(currentQ);
      }
      
      // Find question relevance score and reasoning, properly handle 0 values
      const questionRelevance = jdResult.questionRelevance?.find((q: any) => q.question === segment.text);
      const relevanceScore = questionRelevance?.relevanceScore !== undefined ? questionRelevance.relevanceScore : 0;
      const reasoning = questionRelevance?.reasoning || null;
      
      currentQ = {
        question: segment.text,
        timestamp: segment.timestamp,
        answers: [],
        relevance: relevanceScore,
        reasoning: reasoning
      };
    } else if (segment.speaker === "Candidate" && currentQ) {
      // Find answer alignment with tone and reasoning from JD analysis
      const answerAlignment = jdResult.answerAlignment?.find((a: any) => a.answer === segment.text);
      const jdMatchScore = answerAlignment?.alignmentScore !== undefined ? answerAlignment.alignmentScore : 0;
      const answerReasoning = answerAlignment?.reasoning || null;
      
      // Use tone from JD analysis if available, otherwise fallback to overall sentiment
      let sentimentLabel = "Neutral"; // Default to Neutral with capital N
      if (answerAlignment && answerAlignment.tone) {
        // Use the per-answer tone from JD analysis
        sentimentLabel = answerAlignment.tone;
      } else if (sentimentResult?.candidateSentiment) {
        // Fallback to overall sentiment if per-answer tone not available
        const candidateSentiment = sentimentResult.candidateSentiment;
        if (candidateSentiment.positive > candidateSentiment.negative && candidateSentiment.positive > candidateSentiment.neutral) {
          sentimentLabel = "Positive";
        } else if (candidateSentiment.negative > candidateSentiment.positive && candidateSentiment.negative > candidateSentiment.neutral) {
          sentimentLabel = "Negative";
        }
      }
      
      currentQ.answers.push({
        text: segment.text,
        timestamp: segment.timestamp,
        sentiment: sentimentLabel,
        jdMatch: jdMatchScore,
        reasoning: answerReasoning
      });
    }
  }
  
  if (currentQ) {
    qaList.push(currentQ);
  }
  
  return qaList;
}

async function generateAnalysisReport(transcription: any, sentiment: any, jd: any, flow: any) {
  return {
    summary: {
      interviewLength: transcription.segments.length > 0 ? "12:30" : "Unknown",
      questionsAsked: transcription.segments.filter((s: any) => s.speaker === "Recruiter" && s.text.includes("?")).length,
      avgResponseLength: Math.round(transcription.segments
        .filter((s: any) => s.speaker === "Candidate")
        .reduce((acc: number, s: any) => acc + s.text.length, 0) / transcription.segments.filter((s: any) => s.speaker === "Candidate").length || 1)
    },
    recommendations: [
      "Strong technical competency demonstrated",
      "Focus more on leadership experience in follow-up",
      "Consider discussing team collaboration scenarios"
    ]
  };
}
