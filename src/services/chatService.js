import { GoogleGenerativeAI } from "@google/generative-ai";

// --- Configuration ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.0-flash-lite"; // Using the model name you confirmed
const generationConfig = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 1024,
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


// --- History Mapping Helper ---
const mapHistoryForApi = (history = []) => {
  if (!Array.isArray(history)) {
      console.warn("Invalid history provided, expected an array. Using empty history.");
      return [];
  }
  return history
    .filter(msg => msg && typeof msg.sender === 'string' && typeof msg.message === 'string') // Basic validation
    .map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        // Ensure parts always exists, even if message is empty (though filtered above)
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

  const apiHistory = mapHistoryForApi(history);
  const systemInstruction = { parts: [{ text: systemPrompt }] }; // Define once for use

  // --- Primary Method: Chat ---
  try {
    console.log("Attempting to generate response using startChat...");
    const chat = model.startChat({
      history: apiHistory,
      generationConfig: generationConfig,
      systemInstruction: systemInstruction // Correctly pass system prompt here
    });

    const result = await chat.sendMessage(message);
    // No await needed for result.response
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