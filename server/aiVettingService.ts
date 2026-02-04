import { invokeLLM } from "./_core/llm";

// Type definitions
export interface CoachApplicationData {
  fullName: string;
  email: string;
  phone?: string;
  chessTitle: string;
  currentRating: number;
  ratingOrg: string;
  yearsExperience: string;
  totalStudents?: number;
  certifications?: string;
  achievements: string;
  specializations: string; // JSON array
  targetLevels: string; // JSON array
  teachingPhilosophy: string;
  hourlyRateCents: number;
  lessonFormats: string; // JSON array
  languages: string; // JSON array
  bio: string;
  whyBoogme: string;
  sampleLesson: string;
  timezone: string;
  country: string;
}

export interface VettingResult {
  approved: boolean;
  confidenceScore: number; // 0-100
  recommendation: "APPROVE" | "REVIEW" | "REJECT";
  reasoning: string;
  redFlags: string[];
  scoreBreakdown: {
    credentialScore: number;
    teachingScore: number;
    professionalismScore: number;
    pricingScore: number;
    completionScore: number;
    platformFitScore: number;
    llmContentScore: number;
  };
  humanReviewReason?: string;
}

// Market rate ranges by title (in cents)
const RATE_RANGES: Record<string, { min: number; max: number }> = {
  GM: { min: 8000, max: 20000 },
  IM: { min: 5000, max: 15000 },
  FM: { min: 3500, max: 10000 },
  CM: { min: 2500, max: 7500 },
  NM: { min: 2500, max: 7500 },
  Expert: { min: 2000, max: 6000 },
  "No Title": { min: 1500, max: 6000 },
};

// Rating ranges by title
const RATING_RANGES: Record<string, { min: number; max: number }> = {
  GM: { min: 2500, max: 3000 },
  IM: { min: 2400, max: 2700 },
  FM: { min: 2300, max: 2600 },
  CM: { min: 2200, max: 2500 },
  NM: { min: 2200, max: 2500 },
  Expert: { min: 2000, max: 2400 },
};

/**
 * Main AI vetting function
 */
export async function vetCoachApplication(
  application: CoachApplicationData
): Promise<VettingResult> {
  const redFlags: string[] = [];
  let credentialScore = 0;
  let teachingScore = 0;
  let pricingScore = 0;
  let completionScore = 0;

  // Step 1: Validate chess credentials (0-30 points)
  const credentialResult = validateCredentials(application);
  credentialScore = credentialResult.score;
  redFlags.push(...credentialResult.redFlags);

  // Step 2: Validate teaching experience (0-25 points, preliminary)
  const teachingResult = validateTeachingExperience(application);
  teachingScore = teachingResult.score;
  redFlags.push(...teachingResult.redFlags);

  // Step 3: Validate pricing (0-10 points)
  const pricingResult = validatePricing(application);
  pricingScore = pricingResult.score;
  redFlags.push(...pricingResult.redFlags);

  // Step 4: Check application completion (0-10 points)
  const completionResult = validateCompletion(application);
  completionScore = completionResult.score;
  redFlags.push(...completionResult.redFlags);

  // Step 5: LLM content analysis (0-75 points)
  const llmResult = await analyzeLLMContent(application);
  redFlags.push(...llmResult.redFlags);

  // Step 6: Calculate final confidence score
  const totalRawScore =
    credentialScore +
    teachingScore +
    pricingScore +
    completionScore +
    llmResult.totalContentScore;

  // Normalize to 0-100 scale (max possible: 150 points)
  const confidenceScore = Math.round((totalRawScore / 150) * 100);

  // Step 7: Determine recommendation
  let recommendation: "APPROVE" | "REVIEW" | "REJECT";
  let approved = false;
  let humanReviewReason: string | undefined;

  if (confidenceScore >= 85 && redFlags.length === 0) {
    recommendation = "APPROVE";
    approved = true;
  } else if (confidenceScore >= 70 && redFlags.length <= 2) {
    recommendation = "REVIEW";
    humanReviewReason = `Confidence score: ${confidenceScore}/100. Red flags: ${redFlags.join(", ") || "None, but score below auto-approval threshold"}`;
  } else if (confidenceScore >= 50) {
    recommendation = "REVIEW";
    humanReviewReason = `Low confidence score: ${confidenceScore}/100. Needs human assessment.`;
  } else {
    recommendation = "REJECT";
    humanReviewReason = `Confidence score too low: ${confidenceScore}/100. Major issues detected.`;
  }

  return {
    approved,
    confidenceScore,
    recommendation,
    reasoning: llmResult.reasoning,
    redFlags,
    scoreBreakdown: {
      credentialScore,
      teachingScore: teachingScore + llmResult.teachingScore,
      professionalismScore: llmResult.professionalismScore,
      pricingScore,
      completionScore,
      platformFitScore: llmResult.platformFitScore,
      llmContentScore: llmResult.totalContentScore,
    },
    humanReviewReason,
  };
}

/**
 * Validate chess credentials
 */
function validateCredentials(application: CoachApplicationData): {
  score: number;
  redFlags: string[];
} {
  const redFlags: string[] = [];
  let score = 0;

  // Check if title matches rating
  const titleRange = RATING_RANGES[application.chessTitle];
  if (titleRange) {
    if (
      application.currentRating >= titleRange.min &&
      application.currentRating <= titleRange.max + 200 // Allow 200 point buffer
    ) {
      score += 30; // Perfect match
    } else if (application.currentRating < titleRange.min) {
      redFlags.push(
        `Rating (${application.currentRating}) is below expected range for ${application.chessTitle} (${titleRange.min}+)`
      );
      score += 10; // Significant mismatch
    } else {
      score += 25; // Rating higher than expected (acceptable)
    }
  } else if (application.chessTitle === "No Title") {
    // No title is fine, just check rating is reasonable
    if (
      application.currentRating >= 800 &&
      application.currentRating <= 3000
    ) {
      score += 25;
    } else {
      redFlags.push(
        `Rating (${application.currentRating}) is outside reasonable bounds`
      );
      score += 10;
    }
  } else {
    redFlags.push(`Unrecognized chess title: ${application.chessTitle}`);
    score += 10;
  }

  // Check rating organization
  const validOrgs = ["FIDE", "USCF", "Chess.com", "Lichess", "Other"];
  if (!validOrgs.includes(application.ratingOrg)) {
    redFlags.push(`Unrecognized rating organization: ${application.ratingOrg}`);
  }

  return { score, redFlags };
}

/**
 * Validate teaching experience (preliminary, before LLM analysis)
 */
function validateTeachingExperience(application: CoachApplicationData): {
  score: number;
  redFlags: string[];
} {
  const redFlags: string[] = [];
  let score = 0;

  // Check years of experience
  const yearsMatch = application.yearsExperience.match(/\d+/);
  if (yearsMatch) {
    const years = parseInt(yearsMatch[0]);
    if (years >= 5) {
      score += 15;
    } else if (years >= 2) {
      score += 10;
    } else if (years >= 1) {
      score += 5;
    } else {
      redFlags.push("Less than 1 year of teaching experience");
    }
  } else {
    redFlags.push("Years of experience not clearly specified");
  }

  // Check if total students mentioned
  if (
    application.totalStudents &&
    application.totalStudents > 0
  ) {
    score += 10;
  } else {
    score += 5; // Not critical, but helpful
  }

  return { score, redFlags };
}

/**
 * Validate pricing
 */
function validatePricing(application: CoachApplicationData): {
  score: number;
  redFlags: string[];
} {
  const redFlags: string[] = [];
  let score = 0;

  const rateRange = RATE_RANGES[application.chessTitle] || RATE_RANGES["No Title"];
  const rate = application.hourlyRateCents;

  if (rate >= rateRange.min && rate <= rateRange.max) {
    score += 10; // Perfect pricing
  } else if (rate < rateRange.min && rate >= 1500) {
    score += 8; // Below range but reasonable
  } else if (rate > rateRange.max && rate <= rateRange.max * 1.5) {
    score += 7; // Above range but not excessive
  } else if (rate < 1500) {
    redFlags.push(`Hourly rate ($${rate / 100}) is suspiciously low`);
    score += 3;
  } else {
    redFlags.push(
      `Hourly rate ($${rate / 100}) is significantly above market for ${application.chessTitle}`
    );
    score += 5;
  }

  return { score, redFlags };
}

/**
 * Validate application completion
 */
function validateCompletion(application: CoachApplicationData): {
  score: number;
  redFlags: string[];
} {
  const redFlags: string[] = [];
  let score = 0;

  // Check required fields
  const requiredFields = [
    "fullName",
    "email",
    "chessTitle",
    "currentRating",
    "yearsExperience",
    "achievements",
    "specializations",
    "targetLevels",
    "teachingPhilosophy",
    "bio",
    "whyBoogme",
    "sampleLesson",
  ];

  let completedFields = 0;
  for (const field of requiredFields) {
    const value = application[field as keyof CoachApplicationData];
    if (value && value.toString().trim().length > 0) {
      completedFields++;
    }
  }

  const completionRate = completedFields / requiredFields.length;
  if (completionRate === 1) {
    score += 10;
  } else if (completionRate >= 0.9) {
    score += 8;
  } else if (completionRate >= 0.8) {
    score += 6;
    redFlags.push("Some optional fields are missing");
  } else {
    redFlags.push("Application is incomplete (multiple required fields missing)");
    score += 3;
  }

  // Check bio length
  if (application.bio.length >= 150 && application.bio.length <= 500) {
    score += 0; // Already counted in completion
  } else if (application.bio.length < 150) {
    redFlags.push("Bio is too short (< 150 characters)");
  } else if (application.bio.length > 500) {
    // Too long is fine, just note it
  }

  return { score, redFlags };
}

/**
 * LLM content analysis
 */
async function analyzeLLMContent(application: CoachApplicationData): Promise<{
  teachingScore: number;
  expertiseScore: number;
  professionalismScore: number;
  platformFitScore: number;
  totalContentScore: number;
  reasoning: string;
  redFlags: string[];
}> {
  const prompt = `You are an expert chess coach recruiter evaluating a coaching application for BooGMe, an online chess coaching marketplace. Analyze the following application and provide a structured assessment.

APPLICATION DATA:
- Name: ${application.fullName}
- Chess Title: ${application.chessTitle}
- Current Rating: ${application.currentRating} (${application.ratingOrg})
- Years Experience: ${application.yearsExperience}
- Total Students: ${application.totalStudents || "Not specified"}
- Hourly Rate: $${(application.hourlyRateCents / 100).toFixed(2)}

WRITTEN RESPONSES:

Teaching Philosophy:
${application.teachingPhilosophy}

Sample Lesson Description:
${application.sampleLesson}

Professional Bio:
${application.bio}

Why BooGMe:
${application.whyBoogme}

Achievements:
${application.achievements}

EVALUATION CRITERIA:

1. **Teaching Competence** (0-25 points)
   - Does the teaching philosophy demonstrate understanding of pedagogy?
   - Is the sample lesson specific and shows chess knowledge?
   - Are teaching methods clearly articulated?

2. **Chess Expertise** (0-20 points)
   - Do achievements match the claimed credentials?
   - Does the bio demonstrate deep chess knowledge?
   - Are specializations credible given experience?

3. **Professionalism** (0-20 points)
   - Is the writing clear, professional, and error-free?
   - Does the bio sound authentic (not AI-generated)?
   - Is the tone appropriate for a coaching marketplace?

4. **Platform Fit** (0-10 points)
   - Does "Why BooGMe" show genuine interest?
   - Is the coach committed to online teaching?
   - Do they understand the platform's value proposition?

5. **Red Flags** (list any concerns)
   - Generic or copied content
   - Inconsistencies between fields
   - Inappropriate content or tone
   - Obvious AI-generated text
   - Lack of specific chess knowledge

Provide your assessment in the following JSON format:
{
  "teachingScore": <number 0-25>,
  "expertiseScore": <number 0-20>,
  "professionalismScore": <number 0-20>,
  "platformFitScore": <number 0-10>,
  "redFlags": [<array of strings>],
  "reasoning": "<brief explanation of scores in 2-3 sentences>"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an expert chess coach recruiter. Provide structured, objective assessments in JSON format.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "coach_vetting_assessment",
          strict: true,
          schema: {
            type: "object",
            properties: {
              teachingScore: {
                type: "number",
                description: "Score for teaching competence (0-25)",
              },
              expertiseScore: {
                type: "number",
                description: "Score for chess expertise (0-20)",
              },
              professionalismScore: {
                type: "number",
                description: "Score for professionalism (0-20)",
              },
              platformFitScore: {
                type: "number",
                description: "Score for platform fit (0-10)",
              },
              redFlags: {
                type: "array",
                description: "List of concerns or red flags",
                items: { type: "string" },
              },
              reasoning: {
                type: "string",
                description: "Brief explanation of scores",
              },
            },
            required: [
              "teachingScore",
              "expertiseScore",
              "professionalismScore",
              "platformFitScore",
              "redFlags",
              "reasoning",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from LLM");
    }

    // Handle content as string
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const result = JSON.parse(contentStr);

    return {
      teachingScore: result.teachingScore,
      expertiseScore: result.expertiseScore,
      professionalismScore: result.professionalismScore,
      platformFitScore: result.platformFitScore,
      totalContentScore:
        result.teachingScore +
        result.expertiseScore +
        result.professionalismScore +
        result.platformFitScore,
      reasoning: result.reasoning,
      redFlags: result.redFlags || [],
    };
  } catch (error) {
    console.error("LLM vetting error:", error);
    // Fallback to conservative scores if LLM fails
    return {
      teachingScore: 15,
      expertiseScore: 12,
      professionalismScore: 12,
      platformFitScore: 5,
      totalContentScore: 44,
      reasoning: "LLM analysis unavailable, using conservative fallback scores",
      redFlags: ["LLM analysis failed - requires human review"],
    };
  }
}
