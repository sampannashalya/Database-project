/**
 * Google Gemini Service
 * Interacts with Google's Generative AI models to generate Mermaid ER diagrams.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash';
    this.genAI = null;
    this.model = null;

    // Create a simpler prompt for Mermaid diagram generation
    this.systemPrompt = 
      "Create a valid Mermaid ER diagram from this database description. Output only the diagram code starting with 'erDiagram'. Use PK for primary keys, FK for foreign keys, and proper cardinality notation. Use data types: string, number, date, boolean.";

    this.initialize();
  }

  // ... the rest of the file is unchanged ...

  initialize() {
    if (this.isInitialized()) {
      logger.info('Gemini Service already initialized.');
      return;
    }
    if (!this.apiKey) {
      logger.error('GEMINI_API_KEY is not set in environment variables. Service will not function.');
      return;
    }
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });
      logger.info(`Gemini Service initialized successfully with model: ${this.modelName}`);
    } catch (error) {
      logger.error('Failed to initialize Gemini Service', { error: error.message });
      this.model = null;
    }
  }

  isInitialized() {
    return !!this.model;
  }

  extractMermaidCode(text) {
    if (!text) return '';
    const mermaidRegex = /```(?:mermaid)?([\s\S]*?)```/;
    const match = text.match(mermaidRegex);
    if (match && match[1]) {
      return match[1].trim();
    }
    if (text.trim().startsWith('erDiagram')) {
        return text.trim();
    }
    logger.warn('Could not extract Mermaid code from response.', { responsePrefix: text.substring(0, 100) });
    return '';
  }

  async generateERDiagram(textInput) {
    if (!this.isInitialized()) {
      this.initialize();
      if (!this.isInitialized()) {
        return {
          success: false,
          error: 'Gemini Service is not initialized. Please check your GEMINI_API_KEY.',
          mermaidCode: null,
        };
      }
    }

    try {
      logger.info('Generating ER diagram with Gemini', { inputLength: textInput.length });

      // Create the messages array with user content (not using system prompt as direct text)
      const result = await this.model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${this.systemPrompt}\n\n---\n\nGenerate a diagram for the following description:\n\n${textInput}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: 'text/plain',
        }
      });

      const response = await result.response;
      const rawText = response.text();
      const mermaidCode = this.extractMermaidCode(rawText);

      if (!mermaidCode || !mermaidCode.includes('erDiagram')) {
        logger.error('Generated content is not a valid Mermaid ER diagram', { response: rawText });
        return {
          success: false,
          error: 'The generated response was not a valid Mermaid ER diagram. Please try rephrasing your request.',
          mermaidCode: null,
        };
      }
      logger.info('Successfully generated ER diagram', { outputLength: mermaidCode.length });
      return {
        success: true,
        error: null,
        mermaidCode,
      };
    } catch (error) {
      logger.error('Error generating ER diagram with Gemini', { error: error.message });
      const clientError = error.message.includes('API key') 
        ? 'An authentication error occurred. Please check the server configuration.'
        : `Failed to generate diagram: An internal error occurred.`;
      return {
        success: false,
        error: clientError,
        mermaidCode: null,
      };
    }
  }
}

module.exports = new GeminiService();