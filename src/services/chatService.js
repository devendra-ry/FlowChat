import { GoogleGenerativeAI } from "@google/generative-ai";
// Replace tiktoken with gpt-tokenizer
import { encode } from 'gpt-tokenizer';

// --- Configuration ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.0-flash-lite"; // Using the model name you confirmed
const generationConfig = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 1024,
};

// Maximum tokens to allow for the entire context (system prompt + history + current message)
const MAX_CONTEXT_TOKENS = 8000; // Adjust based on your model's limits

// --- Token Counting Utility ---
const countTokens = (text) => {
  if (!text || typeof text !== 'string') return 0;
  try {
    // Using gpt-tokenizer instead of tiktoken
    return encode(text).length;
  } catch (error) {
    console.warn("Token counting error:", error);
    // Fallback to rough approximation if tokenizer fails
    return Math.ceil(text.length / 4);
  }
};

// --- System Prompt ---
// Your detailed system prompt remains the same
const systemPrompt = `You are an intelligent assistant designed to provide helpful, accurate, and well-structured responses.

# Response Guidelines
- Format your answers using **Markdown** for enhanced readability
- Structure information with headings, bullet points, and short paragraphs
- Use code blocks with syntax highlighting when sharing code snippets
- Include relevant examples when explaining complex concepts

# Tone & Style
- Maintain a friendly, conversational tone while remaining professional
- Be concise but thorough (aim for complete answers without unnecessary text)
- Respond directly to the user's query without adding unrelated information
- Avoid unnecessarily formal language or technical jargon unless appropriate

# Interaction Approach
- When faced with ambiguous questions, seek clarification instead of making assumptions
- For multi-part questions, address each component separately and clearly
- If you don't know something, acknowledge this rather than providing speculative information
- Personalize responses based on context from the conversation history
- Offer follow-up suggestions when appropriate to guide the conversation

Remember to provide value in every interaction while respecting the user's time and attention.`;

// Pre-calculate system prompt tokens
const SYSTEM_PROMPT_TOKENS = countTokens(systemPrompt);

// --- Initialization ---
let genAI;
let model;

if (!API_KEY) {
  console.error("ERROR: VITE_GEMINI_API_KEY environment variable is not set or empty.");
  // Depending on your app structure, you might throw an error here
  // or handle it gracefully in the generateResponse function.
} else {
  try {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        // Pass systemInstruction here IF you want it applied universally by this model instance
        // systemInstruction: { parts: [{ text: systemPrompt }] }
        // OR pass it per-request/chat as done below (more flexible)
    });
  } catch (initError) {
     console.error("Error initializing GoogleGenerativeAI or getting model:", initError);
     // Handle initialization error - perhaps set model to null or throw
  }
}


// --- History Mapping Helper with Token Management ---
// --- Enhanced Token Management Strategy ---
const mapHistoryForApi = (history = [], currentMessage = "") => {
  if (!Array.isArray(history)) {
    console.warn("Invalid history provided, expected an array. Using empty history.");
    return [];
  }
  
  // Calculate tokens for current message
  const currentMessageTokens = countTokens(currentMessage);
  
  // Calculate available tokens for history (reserve tokens for system prompt and current message)
  // Add a buffer of 200 tokens for safety
  const availableHistoryTokens = MAX_CONTEXT_TOKENS - SYSTEM_PROMPT_TOKENS - currentMessageTokens - 200;
  
  // Validate messages
  const validMessages = history
    .filter(msg => msg && typeof msg.sender === 'string' && typeof msg.message === 'string');
  
  if (validMessages.length === 0) return [];
  
  // STRATEGY: Preserve conversation flow with dynamic truncation
  // 1. Always keep the most recent messages (last N turns)
  // 2. For older history, keep important context by sampling
  
  // Step 1: Calculate total tokens in history
  const messageTokenCounts = validMessages.map(msg => ({
    ...msg,
    tokens: countTokens(msg.message)
  }));
  
  const totalHistoryTokens = messageTokenCounts.reduce((sum, msg) => sum + msg.tokens, 0);
  
  // If we're under the limit, use all messages
  if (totalHistoryTokens <= availableHistoryTokens) {
    console.log(`Using complete history (${validMessages.length} messages, ${totalHistoryTokens} tokens)`);
    return validMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.message || '' }]
    }));
  }
  
  // Step 2: Always keep the most recent conversation turns (e.g., last 3-5 exchanges)
  const ALWAYS_KEEP_TURNS = 3; // Keep last 3 user-assistant exchanges (6 messages)
  const recentMessages = [];
  let recentTokens = 0;
  
  // Add most recent messages first (up to ALWAYS_KEEP_TURNS exchanges)
  let userMsgCount = 0;
  for (let i = messageTokenCounts.length - 1; i >= 0; i--) {
    const msg = messageTokenCounts[i];
    
    // Count user messages to track conversation turns
    if (msg.sender === 'user') userMsgCount++;
    
    // Stop after we've included ALWAYS_KEEP_TURNS user messages
    if (userMsgCount > ALWAYS_KEEP_TURNS && recentTokens > 0) break;
    
    recentMessages.unshift(msg);
    recentTokens += msg.tokens;
  }
  
  // Step 3: If recent messages already exceed our budget, keep only the most recent ones
  if (recentTokens > availableHistoryTokens) {
    console.log(`Recent messages exceed token limit. Using only ${recentMessages.length} most recent messages.`);
    // Start removing from the oldest of the "recent" messages until we're under budget
    let usedTokens = 0;
    const truncatedRecent = [];
    
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      if (usedTokens + msg.tokens <= availableHistoryTokens) {
        truncatedRecent.unshift(msg);
        usedTokens += msg.tokens;
      } else {
        break;
      }
    }
    
    console.log(`Token usage - System: ${SYSTEM_PROMPT_TOKENS}, History: ${usedTokens}, Current message: ${currentMessageTokens}`);
    return truncatedRecent.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.message || '' }]
    }));
  }
  
  // Step 4: We have room for some older messages - use strategic sampling
  const remainingBudget = availableHistoryTokens - recentTokens;
  const olderMessages = messageTokenCounts.slice(0, messageTokenCounts.length - recentMessages.length);
  
  // If we have very little budget left, skip older messages
  if (remainingBudget < 100 || olderMessages.length === 0) {
    console.log(`Using only recent messages (${recentMessages.length} messages, ${recentTokens} tokens)`);
    return recentMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.message || '' }]
    }));
  }
  
  // Strategic sampling of older messages:
  // 1. Prioritize user messages (questions often contain important context)
  // 2. Sample more heavily from middle history than very old history
  const sampledOlder = [];
  let sampledTokens = 0;
  
  // First pass: include user messages that fit in our budget, prioritizing more recent ones
  for (let i = olderMessages.length - 1; i >= 0; i--) {
    const msg = olderMessages[i];
    // Prioritize user messages
    if (msg.sender === 'user' && sampledTokens + msg.tokens <= remainingBudget) {
      sampledOlder.unshift(msg);
      sampledTokens += msg.tokens;
      // Remove this message so we don't consider it in the next pass
      olderMessages.splice(i, 1);
    }
  }
  
  // Second pass: include corresponding assistant responses if possible
  // This helps maintain conversation coherence
  if (sampledTokens < remainingBudget && olderMessages.length > 0) {
    for (let i = 0; i < sampledOlder.length; i++) {
      // Find the assistant response that follows this user message
      if (sampledOlder[i].sender === 'user') {
        const userIndex = messageTokenCounts.findIndex(m => m === sampledOlder[i]);
        if (userIndex >= 0 && userIndex < messageTokenCounts.length - 1) {
          const assistantMsg = messageTokenCounts[userIndex + 1];
          if (assistantMsg.sender === 'assistant' && 
              !sampledOlder.includes(assistantMsg) && 
              sampledTokens + assistantMsg.tokens <= remainingBudget) {
            // Insert after the user message
            sampledOlder.splice(i + 1, 0, assistantMsg);
            sampledTokens += assistantMsg.tokens;
            i++; // Skip the newly inserted message
          }
        }
      }
    }
  }
  
  // Combine recent and sampled older messages
  const finalHistory = [...sampledOlder, ...recentMessages];
  const finalTokens = sampledTokens + recentTokens;
  
  console.log(`Using ${finalHistory.length}/${validMessages.length} messages (${finalTokens} tokens): ${sampledOlder.length} sampled older + ${recentMessages.length} recent`);
  
  return finalHistory.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.message || '' }]
  }));
};

// --- Generation Function ---
export const generateResponse = async (message, history = []) => {
  // --- Input and Initialization Checks ---
  if (!API_KEY) {
      console.error("generateResponse failed: API Key not configured.");
      return "Configuration Error: API Key not set. Cannot contact AI service.";
  }
  if (!model) {
      console.error("generateResponse failed: Model not initialized.");
      return "Configuration Error: AI Model could not be initialized. Please check setup and API Key.";
  }
  if (!message || typeof message !== 'string' || message.trim() === '') {
       console.warn("generateResponse called with empty or invalid message.");
       return "Please provide a message to the assistant."; // User-friendly message
  }

  // Use token-aware history mapping with current message
  const apiHistory = mapHistoryForApi(history, message);
  const systemInstruction = { parts: [{ text: systemPrompt }] };

  // --- Primary Method: Chat ---
  try {
    console.log("Attempting to generate response using startChat...");
    const chat = model.startChat({
      history: apiHistory,
      generationConfig: generationConfig,
      systemInstruction: systemInstruction
    });

    const result = await chat.sendMessage(message);
    const response = result.response;
    const text = response.text();
    console.log("Response received via startChat.");
    return text;

  } catch (error) {
    console.error('Error using startChat:', error);
    // Log specific details if available (e.g., error.message, error.stack)
    if (error.message) {
        console.error("startChat Error Message:", error.message);
    }

    // --- Fallback Method: Generate Content ---
    console.warn("startChat failed. Attempting fallback using generateContent...");
    try {
      // Construct the full content list including history and the new message
      const contents = [
        ...apiHistory, // Use the correctly mapped history
        { role: 'user', parts: [{ text: message }] } // Add current message correctly
      ];

      const result = await model.generateContent({ // Pass request object
        contents: contents,
        generationConfig: generationConfig,       // Include config
        systemInstruction: systemInstruction      // Include system prompt
      });

      // No await needed for result.response
      const response = result.response;
      const text = response.text();
      console.log("Response received via generateContent fallback.");
      return text;

    } catch (fallbackError) {
      console.error('Fallback with generateContent also failed:', fallbackError);
       if (fallbackError.message) {
           console.error("generateContent Fallback Error Message:", fallbackError.message);
       }
      // Provide a user-friendly error message indicating multiple failures
      return 'Sorry, I encountered an unexpected issue communicating with the AI service, even after a retry. Please check the console logs or try again later.';
    }
  }
};