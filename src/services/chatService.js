import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

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

export const generateResponse = async (message, history = []) => {
  try {
    // Create a chat session
    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.message }]
      })),
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    // Send the message to the model
    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating response:', error);
    
    // Fallback approach if chat doesn't work
    try {
      // Try the simple generateContent approach instead
      const result = await model.generateContent([
        { text: systemPrompt },
        ...history.map(msg => ({ text: `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.message}` })),
        { text: `User: ${message}` }
      ]);
      const response = await result.response;
      return response.text();
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      return 'Sorry, I encountered an error communicating with the AI service. Please try again.';
    }
  }
};