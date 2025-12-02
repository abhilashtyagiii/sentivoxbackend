/**
 * Graph-based flow continuity analysis
 * Models conversation as a directed graph to detect logical connections and missed follow-ups
 */

export interface FlowNode {
  id: string;
  type: "question" | "answer";
  text: string;
  timestamp: number;
  speaker: string;
  category?: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  type: "direct_response" | "follow_up" | "topic_shift" | "disconnected";
  strength: number;
  logicalConnection: string;
}

export interface MissedFollowUp {
  afterNode: string;
  suggestedQuestion: string;
  importance: "high" | "medium" | "low";
  reasoning: string;
}

export interface FlowGraphAnalysis {
  nodes: FlowNode[];
  edges: FlowEdge[];
  missedFollowUps: MissedFollowUp[];
  logicalConnectionScore: number;
  topicCoherence: number;
  conversationBranches: string[][];
}

/**
 * Build conversation flow graph from Q&A pairs
 */
export function buildFlowGraph(
  questions: Array<{ text: string; timestamp?: number }>,
  answers: Array<{ text: string; timestamp?: number }>
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Create nodes for questions and answers
  for (let i = 0; i < questions.length; i++) {
    const qNode: FlowNode = {
      id: `q${i}`,
      type: "question",
      text: questions[i].text,
      timestamp: questions[i].timestamp || i * 2,
      speaker: "recruiter",
    };
    nodes.push(qNode);

    if (answers[i]) {
      const aNode: FlowNode = {
        id: `a${i}`,
        type: "answer",
        text: answers[i].text,
        timestamp: answers[i].timestamp || i * 2 + 1,
        speaker: "candidate",
      };
      nodes.push(aNode);

      // Direct question-answer edge
      edges.push({
        from: qNode.id,
        to: aNode.id,
        type: "direct_response",
        strength: 1.0,
        logicalConnection: "Direct response to question",
      });
    }
  }

  // Detect follow-up connections between consecutive questions
  for (let i = 0; i < questions.length - 1; i++) {
    const currentQ = questions[i];
    const nextQ = questions[i + 1];

    // Analyze if next question follows up on previous answer
    const connectionType = analyzeQuestionConnection(currentQ.text, nextQ.text);

    edges.push({
      from: `a${i}`,
      to: `q${i + 1}`,
      type: connectionType.type,
      strength: connectionType.strength,
      logicalConnection: connectionType.reasoning,
    });
  }

  return { nodes, edges };
}

/**
 * Analyze connection between consecutive questions
 */
function analyzeQuestionConnection(prevQ: string, nextQ: string): {
  type: "follow_up" | "topic_shift" | "disconnected";
  strength: number;
  reasoning: string;
} {
  const prevWords = prevQ.toLowerCase().split(/\s+/);
  const nextWords = nextQ.toLowerCase().split(/\s+/);

  // Check for shared keywords (simple heuristic)
  const sharedKeywords = prevWords.filter(w => nextWords.includes(w) && w.length > 4);

  if (sharedKeywords.length >= 2) {
    return {
      type: "follow_up",
      strength: 0.8,
      reasoning: `Follow-up on same topic (${sharedKeywords.slice(0, 2).join(", ")})`,
    };
  } else if (sharedKeywords.length === 1) {
    return {
      type: "topic_shift",
      strength: 0.5,
      reasoning: "Related but different topic",
    };
  } else {
    return {
      type: "disconnected",
      strength: 0.2,
      reasoning: "No clear logical connection",
    };
  }
}

/**
 * Detect missed follow-up opportunities
 */
export function detectMissedFollowUps(
  questions: Array<{ text: string }>,
  answers: Array<{ text: string; keySkills?: string[] }>,
  edges: FlowEdge[]
): MissedFollowUp[] {
  const missed: MissedFollowUp[] = [];

  for (let i = 0; i < answers.length - 1; i++) {
    const answer = answers[i];
    const nextQuestion = questions[i + 1];

    // Check if answer mentioned technical skills but wasn't followed up
    if (answer.keySkills && answer.keySkills.length > 0) {
      const wasFollowedUp = answer.keySkills.some(skill =>
        nextQuestion.text.toLowerCase().includes(skill.toLowerCase())
      );

      if (!wasFollowedUp) {
        missed.push({
          afterNode: `a${i}`,
          suggestedQuestion: `Can you elaborate on your experience with ${answer.keySkills[0]}?`,
          importance: "high",
          reasoning: `Candidate mentioned ${answer.keySkills.join(", ")} but recruiter didn't explore further`,
        });
      }
    }

    // Check for disconnected edges (topic jumps)
    const edge = edges.find(e => e.from === `a${i}` && e.to === `q${i + 1}`);
    if (edge && edge.type === "disconnected") {
      missed.push({
        afterNode: `a${i}`,
        suggestedQuestion: "Can you tell me more about that?",
        importance: "medium",
        reasoning: "Recruiter changed topic without properly exploring the previous answer",
      });
    }
  }

  return missed;
}

/**
 * Calculate logical connection score
 */
export function calculateLogicalScore(edges: FlowEdge[]): number {
  if (edges.length === 0) return 0;

  const avgStrength = edges.reduce((sum, e) => sum + e.strength, 0) / edges.length;
  return avgStrength * 100;
}

/**
 * Identify conversation branches (topic threads)
 */
export function identifyConversationBranches(
  nodes: FlowNode[],
  edges: FlowEdge[]
): string[][] {
  const branches: string[][] = [];
  let currentBranch: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.type === "question") {
      // Check if this is a topic shift
      const incomingEdge = edges.find(e => e.to === node.id);

      if (incomingEdge && incomingEdge.type === "topic_shift" && currentBranch.length > 0) {
        branches.push([...currentBranch]);
        currentBranch = [];
      }
    }

    currentBranch.push(node.id);
  }

  if (currentBranch.length > 0) {
    branches.push(currentBranch);
  }

  return branches;
}
