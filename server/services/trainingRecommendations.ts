/**
 * Training Recommendations Generator
 * Provides actionable training recommendations based on recruiter performance gaps
 */

export interface TrainingRecommendation {
  area: string;
  priority: "critical" | "high" | "medium" | "low";
  issue: string;
  recommendation: string;
  resources: string[];
  expectedImprovement: string;
}

export interface PerformanceGap {
  metric: string;
  currentScore: number;
  targetScore: number;
  gap: number;
  severity: "critical" | "moderate" | "minor";
}

/**
 * Generate training recommendations based on analysis results
 */
export function generateTrainingRecommendations(
  jdAnalysis: any,
  flowAnalysis: any,
  sentimentAnalysis: any,
  missedFollowUps?: any[]
): {
  recommendations: TrainingRecommendation[];
  performanceGaps: PerformanceGap[];
  strengthAreas: string[];
  overallRating: "excellent" | "good" | "needs_improvement" | "poor";
} {
  const recommendations: TrainingRecommendation[] = [];
  const performanceGaps: PerformanceGap[] = [];
  const strengthAreas: string[] = [];

  // Analyze JD relevance
  if (jdAnalysis?.overallScore !== undefined) {
    if (jdAnalysis.overallScore < 60) {
      performanceGaps.push({
        metric: "JD Relevance",
        currentScore: jdAnalysis.overallScore,
        targetScore: 80,
        gap: 80 - jdAnalysis.overallScore,
        severity: jdAnalysis.overallScore < 40 ? "critical" : "moderate",
      });

      recommendations.push({
        area: "Job Description Alignment",
        priority: jdAnalysis.overallScore < 40 ? "critical" : "high",
        issue: "Questions are not well-aligned with job requirements",
        recommendation: "Study the job description thoroughly before interviews and prepare targeted questions for each requirement",
        resources: [
          "JD Analysis Training Module",
          "Competency-Based Interviewing Guide",
          "Technical Skills Assessment Framework",
        ],
        expectedImprovement: "Increase JD relevance score by 20-30 points",
      });
    } else if (jdAnalysis.overallScore >= 80) {
      strengthAreas.push("Strong job description alignment");
    }
  }

  // Analyze flow continuity
  if (flowAnalysis?.continuityScore !== undefined) {
    if (flowAnalysis.continuityScore < 70) {
      performanceGaps.push({
        metric: "Flow Continuity",
        currentScore: flowAnalysis.continuityScore,
        targetScore: 85,
        gap: 85 - flowAnalysis.continuityScore,
        severity: flowAnalysis.continuityScore < 50 ? "critical" : "moderate",
      });

      recommendations.push({
        area: "Conversation Flow",
        priority: flowAnalysis.continuityScore < 50 ? "critical" : "high",
        issue: "Questions lack logical flow and follow-up",
        recommendation: "Practice active listening and ask follow-up questions based on candidate responses. Build a narrative thread throughout the interview",
        resources: [
          "Active Listening Techniques",
          "Follow-up Question Framework",
          "Interview Flow Best Practices",
        ],
        expectedImprovement: "Improve flow continuity by 15-20 points",
      });
    } else if (flowAnalysis.continuityScore >= 85) {
      strengthAreas.push("Excellent conversation flow and continuity");
    }
  }

  // Analyze missed follow-ups
  if (missedFollowUps && missedFollowUps.length > 3) {
    recommendations.push({
      area: "Follow-up Questions",
      priority: missedFollowUps.length > 5 ? "high" : "medium",
      issue: `Missed ${missedFollowUps.length} follow-up opportunities`,
      recommendation: "Take notes during candidate responses and identify key points to explore further. Don't move to the next question too quickly",
      resources: [
        "Deep Dive Questioning Techniques",
        "STAR Method Interview Guide",
        "Probing Questions Checklist",
      ],
      expectedImprovement: "Reduce missed follow-ups by 50%",
    });
  }

  // Analyze sentiment
  if (sentimentAnalysis?.recruiterSentiment) {
    const recruiterScore = sentimentAnalysis.recruiterSentiment.overallScore * 10;
    
    if (recruiterScore < 60) {
      recommendations.push({
        area: "Interview Tone",
        priority: "medium",
        issue: "Recruiter tone could be more positive and engaging",
        recommendation: "Practice maintaining an enthusiastic and welcoming demeanor. Show genuine interest in candidate responses",
        resources: [
          "Positive Interview Techniques",
          "Building Rapport with Candidates",
          "Non-verbal Communication in Interviews",
        ],
        expectedImprovement: "Increase candidate comfort and engagement",
      });
    }
  }

  // Determine overall rating
  const avgScore = [
    jdAnalysis?.overallScore || 0,
    flowAnalysis?.continuityScore || 0,
    (sentimentAnalysis?.recruiterSentiment?.overallScore || 0) * 10,
  ].reduce((a, b) => a + b, 0) / 3;

  let overallRating: "excellent" | "good" | "needs_improvement" | "poor";
  if (avgScore >= 85) overallRating = "excellent";
  else if (avgScore >= 70) overallRating = "good";
  else if (avgScore >= 50) overallRating = "needs_improvement";
  else overallRating = "poor";

  return {
    recommendations,
    performanceGaps,
    strengthAreas,
    overallRating,
  };
}
