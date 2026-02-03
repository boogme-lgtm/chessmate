# Questionnaire Design Research - Best Practices for BooGMe

## Research Summary

This document synthesizes best practices from leading matching platforms to inform the design of BooGMe's comprehensive 20-question AI-powered coach matching questionnaire.

## Key Findings from Matching Platforms

### eHarmony (Dating/Relationship Matching)
**Approach:** 70-question Compatibility Quiz
- **Compatibility Score:** 60-140 range based on mutual compatibility
- **Question Categories:**
  - Personality traits and values
  - Relationship goals and expectations
  - Communication style preferences
  - Role in relationships
  - Likes and dislikes
- **Key Insight:** Deep personality profiling with both straightforward and psychological questions to understand motivations

### IvyTutor (Tutoring Matching)
**Approach:** Intake questionnaire focusing on learning style and personality
- **Teaching Style Archetypes:**
  1. The Wise Sage (Yoda) - Wisdom, patience, self-discovery
  2. The Disciplinarian (McGonagall) - Structure, high expectations
  3. The Nurturer (Dr. Murphy) - Empathetic, supportive
  4. The Eccentric Innovator (Ms. Frizzle) - Hands-on, unconventional
  5. The Inspirational Coach (Captain America) - Motivational, confidence-building
- **Key Insight:** Using relatable archetypes makes abstract teaching styles concrete and engaging

### General Best Practices from Research

**Question Design Principles:**
1. **Mix question types** - Multiple choice, rating scales, open-ended
2. **Balance positive and negative wording** - Reduces response bias
3. **Progress from easy to complex** - Start with demographics, build to psychological
4. **Include both explicit and implicit measures** - Ask directly AND infer from behavior
5. **Use validated psychological frameworks** - Big Five personality traits (OCEAN model)
6. **Make questions unbiased** - Avoid favoring one response over another

**Questionnaire Structure:**
1. **Introduction** - Explain purpose and time commitment
2. **Demographics** - Basic information (5-10%)
3. **Core Assessment** - Main matching criteria (70-80%)
4. **Preferences** - Specific requirements (10-15%)
5. **Open-ended** - Capture nuances algorithms might miss (5%)

**User Experience Best Practices:**
1. **Show progress indicators** - Reduce abandonment
2. **Allow saving and returning** - Don't force completion
3. **Provide estimated time** - Set expectations (10-15 minutes for 20 questions)
4. **Use visual elements** - Icons, images, sliders for engagement
5. **Explain why you're asking** - Transparency builds trust
6. **Immediate feedback** - Show processing/analysis in real-time

## Application to Chess Coaching (BooGMe)

### Recommended Question Categories for 20-Question Assessment:

**1. Chess Background & Skill Level (4 questions)**
- Current rating/playing strength
- Years of experience
- Competitive history
- Self-assessment of strengths/weaknesses

**2. Learning Goals & Objectives (3 questions)**
- Primary goal (tournament play, casual improvement, specific rating target)
- Timeline and urgency
- Specific areas to improve (openings, tactics, endgames, strategy)

**3. Learning Style & Preferences (4 questions)**
- Teaching style archetype preference (adapted from IvyTutor)
- Lesson format preference (analysis, lectures, exercises, games)
- Feedback style (direct/blunt vs gentle/encouraging)
- Pace preference (intensive vs gradual)

**4. Practical Considerations (4 questions)**
- Budget range per lesson
- Frequency preference (weekly, bi-weekly, intensive)
- Time zone and availability
- Lesson format (online, in-person, hybrid)

**5. Personality & Communication (3 questions)**
- Communication style preference
- Motivation type (competitive drive, intellectual curiosity, social)
- Comfort with technology/online tools

**6. Coach Characteristics (2 questions)**
- Title/credential importance (GM, IM, FM, titled vs untitled)
- Preferred coach background (tournament player, professional coach, both)

### Matching Algorithm Considerations:

**Hard Filters (Must Match):**
- Budget compatibility
- Schedule/timezone overlap
- Lesson format availability

**Weighted Compatibility Scoring:**
- Skill level appropriateness (30%)
- Learning style alignment (25%)
- Goal compatibility (20%)
- Communication style match (15%)
- Personality fit (10%)

**Output:**
- Compatibility score (similar to eHarmony's 60-140 scale)
- Top 3-5 coach recommendations
- Explanation of why each coach matches
- Highlight specific compatibility factors

## Implementation Recommendations

1. **Multi-step interface** - Break 20 questions into 4-5 logical sections
2. **Visual progress bar** - Show completion percentage
3. **Save progress** - Allow users to return later
4. **Estimated time** - "Takes 8-10 minutes"
5. **AI processing animation** - Show "analyzing your responses" with step-by-step breakdown
6. **Personalized results** - Show compatibility scores with explanations
7. **Allow refinement** - "Not quite right? Adjust your preferences"

## Chess-Specific Enhancements

1. **Interactive rating selector** - Visual slider for chess rating
2. **Opening repertoire selector** - Multi-select for openings played
3. **Position-based questions** - Show chess positions to assess style (tactical vs positional)
4. **Game analysis preference** - Upload a game for analysis to demonstrate needs
5. **Famous player comparison** - "Which player's style resonates with you?" (Tal, Petrosian, Carlsen, etc.)

## Next Steps

1. Draft specific 20 questions based on these categories
2. Design multi-step UI with progress tracking
3. Create coach archetype system (similar to IvyTutor)
4. Implement compatibility scoring algorithm
5. Design results page with coach recommendations
