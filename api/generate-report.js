export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { answers, score, missingSkills, tier } = req.body;
  if (!answers) {
    return res.status(400).json({ error: 'Missing answers' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Build context from answers
  const skillLabels = {
    storytelling: 'Storytelling & Narrative Structure',
    connection: 'Viewer Connection & Primal Branding',
    thumbnail_psych: 'Thumbnail Psychology',
    copywriting: 'Title Copywriting & Hooks',
    analytics: 'Analytics Diagnosis',
    audience: 'Audience Clarity & Targeting',
    structure: 'Engagement Architecture',
    topic_strategy: 'Topic Strategy & Content Planning',
    positioning: 'Channel Positioning & Differentiation',
    monetization: 'Monetization Strategy',
  };

  const situationLabels = [
    "haven't started yet — still planning",
    "fewer than 1,000 subscribers",
    "between 1,000 and 10,000 subscribers",
    "between 10,000 and 100,000 subscribers",
    "over 100,000 subscribers",
  ];

  const solutionLabels = [
    "Self-study (videos, courses, content)",
    "AI-powered coaching (vidIQ AI Coach)",
    "One-on-one human coaching",
  ];

  const yesSkills = Object.entries(answers)
    .filter(([k, v]) => v === true && skillLabels[k])
    .map(([k]) => skillLabels[k]);
  const noSkills = Object.entries(answers)
    .filter(([k, v]) => v === false && skillLabels[k])
    .map(([k]) => skillLabels[k]);

  const situationText = answers.situation !== undefined ? situationLabels[answers.situation] || 'unknown' : 'unknown';
  const goalText = answers.goal90_text || 'not specified';
  const obstacleText = answers.obstacle_text || 'not specified';
  const solutionText = answers.solution !== undefined ? solutionLabels[answers.solution] || 'unknown' : 'unknown';
  const openText = answers.anything_else || '';

  const prompt = `You are a senior YouTube coaching strategist at vidIQ. You've coached 5,000+ creators and your coaching clients see an average 832% subscriber growth and 2,828% view growth.

A creator just completed our YouTube Creator Skills Assessment. Generate a personalized, actionable report for them.

THEIR PROFILE:
- Channel size: ${situationText}
- 90-day goal: ${goalText}
- Biggest obstacle: ${obstacleText}
- Preferred support: ${solutionText}
- Additional context: ${openText || 'None provided'}
- Score: ${score}/100

SKILLS THEY HAVE (answered Yes):
${yesSkills.length > 0 ? yesSkills.map(s => `✅ ${s}`).join('\n') : 'None — they answered No to all skill questions'}

SKILLS THEY'RE MISSING (answered No):
${noSkills.length > 0 ? noSkills.map(s => `❌ ${s}`).join('\n') : 'None — they have all skills'}

IMPORTANT CONTEXT:
- This is a CREATOR SKILLS assessment, not a data/analytics assessment
- The key insight: data tells you what happened AFTER publishing. Skills determine what happens BEFORE and DURING content creation
- A coach teaches skills through real-time feedback on YOUR content. AI can give insights, but can't teach you to execute like a coach watching your plays
- Think of it like a soccer coach — you need someone watching you play and giving feedback, not just stats after the game
- vidIQ offers: free YouTube channel + podcast (self-study), AI Coach (in Boost/Max plans), and 1-on-1 human coaching

Generate a JSON response with this exact structure:
{
  "headline": "A punchy, personalized one-line summary (e.g., 'Your biggest growth unlock: learning to make viewers feel something')",
  "summary": "2-3 sentence overview connecting their specific situation, score, and the gap between where they are and where they want to be. Reference their specific goal and obstacle.",
  "primarySkill": {
    "name": "The #1 skill they should develop",
    "why": "Why this specific skill matters most for THEIR situation and goal (2-3 sentences, specific to their answers)",
    "impact": "The concrete impact mastering this skill will have on their channel metrics and goal (1-2 sentences with specific examples from vidIQ coaching data)"
  },
  "secondarySkill": {
    "name": "The #2 skill to develop after the primary",
    "why": "Why this matters for them specifically (1-2 sentences)",
    "impact": "Concrete impact (1 sentence)"
  },
  "coachingInsight": "A powerful, specific insight about why a human coach is the best path for developing these skills — NOT generic. Reference the specific skills they need and why watching, practicing, and getting real-time feedback accelerates mastery of those particular skills. If they preferred AI or self-study, acknowledge that path but explain what a coach adds on top. (2-3 sentences)",
  "nextStep": "The specific recommended next step based on their solution preference and tier"
}

Be specific. Reference their actual answers. No generic advice. Make them feel like this report was written just for them.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI error:', err);
      return res.status(502).json({ error: 'AI generation failed' });
    }

    const data = await response.json();
    const reportText = data.choices?.[0]?.message?.content;
    if (!reportText) {
      return res.status(502).json({ error: 'Empty AI response' });
    }

    const report = JSON.parse(reportText);
    return res.status(200).json(report);
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
