import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

function getENV(envName){
  if(process.env[envName] && process.env[envName].length === 0){
    console.error(`Error loading env variable ${envName}`)
    process.exit(1)
  }
  return process.env[envName]
}

const API_KEY = getENV("API_KEY")
const API_URL = getENV("API_URL")
const API_MODEL = getENV("API_MODEL")

const openai = new OpenAI({
  apiKey: API_KEY,
  baseURL: API_URL
});

/**
 * Send chat completion request to OpenAI API
 * @param {Array} messages - Conversation messages array
 * @returns {Promise} API response with completion
 */
export async function apiChat(messages) {
  const completion = await openai.chat.completions.create({
    model: API_MODEL,
    messages: messages,
    response_format: { type: "json_object" }
  });
  return completion;
}

/**
 * Initialize guessing game with analyzed face data
 * @param {Object} analyzedData - Face analysis results
 * @returns {Object} Game state with messages and configuration
 */
export function initializeGuessingGame(analyzedData) {
  const MAX_QUESTIONS = parseInt(process.env.MAX_QUESTIONS || '20');
  
  const cleanData = {
    totalPeople: analyzedData.summary.totalFaces,
    people: analyzedData.people.map(person => ({
      personIndex: person.personIndex,
      name: person.name,
      age: person.face?.age ? Math.round(person.face.age) : null,
      gender: person.face?.gender || null,
      emotion: person.face?.emotion || null,
      primaryEmotion: person.face?.primaryEmotion || null,
      headDirection: person.face.headDirection?.direction || null,
      gazeDirection: person.face?.gazeDirection?.direction || null,
      eyes: person.face?.eyes ? {
        left: person.face.eyes.left,
        right: person.face.eyes.right,
        bothOpen: person.face.eyes.bothOpen,
        blinking: person.face.eyes.blinking
      } : null,
      mouth: person.face?.mouth || null,
      distance: person.face?.distance || null,
      eyeColor: person.face?.eyeColor ? {
        detailedColorName: person.face.eyeColor.color,
        simpleColorName: person.face.eyeColor.simpleColorName,
        hex: person.face.eyeColor.hex,
        confidence: person.face.eyeColor.confidence
      } : null,
      hairColor: person.face?.hairColor ? {
        detailedColorName: person.face.hairColor.colorName,
        simpleColorName: person.face.hairColor.simpleColorName,
        hex: person.face.hairColor.hex,
        confidence: person.face.hairColor.confidence
      } : null,
      skinTone: person.face?.skinTone ? {
        type: `${person.face.skinTone.tone} ${person.face.skinTone.undertone} ${person.face.skinTone.fitzpatrick}`,
        detailedColorName: person.face.skinTone.colorName,
        simpleColorName: person.face.skinTone.simpleColorName,
        hex: person.face.skinTone.hex,
        confidence: person.face.skinTone.confidence
      } : null,
      gestures: person.faceGestures || [],
      hands: person.hands ? person.hands.flatMap(h => h.gestures || []) : null
    }))
  };
  
  const messages = [
    { 
      role: "system", 
      content: `GAME SETUP: You are playing a guessing game. The user is thinking of one person from a group of ${cleanData.totalPeople} people. Ask YES/NO questions ONLY to identify which person. You have a maximum of ${MAX_QUESTIONS} questions. Base ALL questions on the analyzed data provided. The user can respond: YES, NO, or UNSURE.`
    },
    {
      role: "system",
      content: `TASK RULES:
- Track the question number
- When you receive UNSURE, try different distinguishing features
- If you guess wrong, you can continue with remaining questions
- When told your guess was wrong, re-analyze and verify previous answers if needed
- At maximum questions, you MUST make a final guess - you cannot give up
- When you guess wrong about a person, ELIMINATE that person and focus on remaining candidates ONLY`
    },
    {
      role: "system",
      content: `ABSOLUTE RULES - NEVER VIOLATE:
- NEVER ask "Is the person [name]?" for a single person - This is FORBIDDEN
- Questions must ONLY be about observable ATTRIBUTES (age, gender, color, gestures, etc.)
- EXCEPTION: When narrowed to 3-4 candidates, you MAY ask "Is the person one of these: [name1, name2, name3]?" - MINIMUM 3 PEOPLE REQUIRED
- NEVER ask questions that target eliminating ONE specific person (e.g., "Is the person NOT [name]?" or "Is the person one of these 2: [name1, name2]?") - This is FORBIDDEN
- If you know who it is, use the isGuessed format - DO NOT ask about it
- Names and personIndex ONLY in: final guess OR group questions of MINIMUM 3 people, NEVER for individual questions or 2-person groups`
    },
    {
      role: "system",
      content: `QUESTION FORMAT - CRITICAL:
- Ask DIRECTLY and CONCISELY - NO explanations, NO summaries, NO recaps
- DO NOT say "Earlier you answered YES to..." or "Based on previous answers..."
- DO NOT list previous answers before asking your question
- JUST ASK THE QUESTION
- Example: "Is the person's hair blonde?" NOT "Earlier you said YES to age 24 and YES to female, so is the person's hair blonde?"
- Keep questions short and to the point
- Your question should be ONE clear sentence ending with a question mark`
    },
    {
      role: "system",
      content: `CRITICAL GUESSING RULES:
- You MUST ONLY guess people from the provided data list - NEVER guess someone outside
- Before final guess, TRIPLE-CHECK that the person matches ALL YES answers
- Be EXTREMELY STRICT - verify every single attribute matches
- DO NOT HALLUCINATE or make up person names or attributes
- Your guess MUST be one of the ${cleanData.totalPeople} people with their exact personIndex and name
- Cross-reference your conclusion with original data before submitting
- If answers don't perfectly match anyone, choose closest match - but NEVER invent a new person
- If you guessed wrong previously, that person is ELIMINATED - do not consider them again`
    },
    {
      role: "system",
      content: `QUESTIONING GUIDELINES:
- Ask ONE question at a time - DO NOT combine attributes (e.g., DON'T ask "age 24 and primary emotion neutral", ask separately)
- For colors: use descriptive names, NOT hex codes
- For HAIR COLOR: use both general type AND specific name (e.g., "blonde, specifically Wheatberry colored")
- Ask about: distance from camera, head direction, gaze direction, eye state, mouth state, facial expressions, gestures, emotions with confidence scores, skin tone characteristics
- For AGE: Follow this EXACT progression: 1) First ask general category (young adult/adult/middle-aged), 2) Then ask age range (20-25, 25-30, 30-35), 3) Finally ask exact age number. NEVER combine category and exact age in one question
- For PERCENTAGES: Use sparingly and only in parentheses for context (e.g., "happy (90% confidence)" or "mouth open (about 30%)").
- Prioritize distinctive features that narrow choices quickly`
    },
    {
      role: "system",
      content: `JSON FORMAT - You MUST respond in this EXACT format:
{"isGuessed": false, "question": "Your yes/no question here?", "guessed": null, "questionNumber": 1}

When confident you know who it is:
{"isGuessed": true, "question": "", "guessed": {"personIndex": <number>, "personName": "<name>", "extraNote": "<any relevant observation>"}, "questionNumber": <current_number>}`
    },
    {
      role: "system",
      content: `BEFORE MAKING YOUR FINAL GUESS:
1. Review ALL answers you received (yes, no, unsure)
2. Go through data list and DOUBLE-CHECK each candidate's attributes against answers
3. Verify chosen person matches ALL "yes" answers
4. Verify chosen person does NOT match any "no" answers
5. "Unsure" answers should not eliminate candidates
6. Exclude any people you previously guessed incorrectly
7. Only after verification, submit guess with exact personIndex and name from data`
    },
    { role: "user", content: `Here is the analyzed data: ${JSON.stringify(cleanData)}` },
    { role: "assistant", content: JSON.stringify({
      isGuessed: false,
      question: "Let me start guessing! Please think of one person from the group.",
      guessed: null,
      questionNumber: 0
    })}
  ];

  return {
    messages,
    maxQuestions: MAX_QUESTIONS,
    analyzedData: analyzedData
  };
}