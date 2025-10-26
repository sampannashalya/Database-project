/**
 * Gemini Prompt Enhancement Service
 * Uses Google's Gemini 2.5 Flash model to enhance vague prompts into more detailed ones.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const dotenv = require('dotenv');

// Make sure environment variables are loaded
dotenv.config();

class GeminiPromptEnhancerService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash';
    this.genAI = null;
    this.model = null;

    // System prompt for enhancing database schema descriptions
    this.systemPrompt = 
      "You are a helpful database design assistant. Your task is to enhance database schema prompts by adding more detail while PRESERVING the original intent.\n\n" +
      "IMPORTANT REQUIREMENTS:\n" +
      "1. DO NOT completely rewrite or restructure the prompt\n" +
      "2. DO NOT change the domain or context of the original prompt\n" +
      "3. DO NOT add specific technical implementation details like SQL syntax\n" +
      "4. KEEP the original entities and core relationships intact\n" +
      "5. ADD more specificity to entities and their attributes\n" +
      "6. ADD common relationships that would be expected in the domain\n" +
      "7. CLARIFY vague or ambiguous descriptions\n" +
      "8. EXPAND on the business rules or constraints\n" +
      "9. KEEP your enhancements natural and conversational (not too technical)\n" +
      "10. The enhanced prompt should be 1.5-2 times longer than the original\n\n" +
      "EXAMPLE 1:\n\n" +
      "Original: \"Create a hospital schema\"\n\n" +
      "Enhanced: \"Create a hospital management database schema with departments, doctors, patients, and appointments. Doctors belong to specific departments and have specializations. Patients have personal information, medical history, and can schedule multiple appointments. Each appointment links a patient with a doctor at a specific time and date. The system should also track prescriptions, medical records, and billing information.\"\n\n" +
      "EXAMPLE 2:\n\n" +
      "Original: \"Build a library database\"\n\n" +
      "Enhanced: \"Build a library database to manage books, members, and borrowing transactions. Books should have attributes like title, author, ISBN, publication date, and availability status. Members need to have personal details, membership status, and contact information. The system should track when books are borrowed and returned, including due dates and potential late fees. Consider including categories for books and different membership levels for users.\"\n\n" +
      "CORE PRINCIPLE: The goal is to make the prompt more detailed and specific without changing its fundamental meaning. The enhanced prompt should help generate a more comprehensive and accurate database schema.";

    this.initialize();
  }

  initialize() {
    if (this.isInitialized()) {
      logger.info('Gemini Prompt Enhancer Service already initialized.');
      return;
    }
    if (!this.apiKey) {
      logger.error('GEMINI_API_KEY is not set in environment variables. Prompt Enhancer Service will not function.');
      return;
    }
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });
      logger.info(`Gemini Prompt Enhancer Service initialized successfully with model: ${this.modelName}`);
    } catch (error) {
      logger.error('Failed to initialize Gemini Prompt Enhancer Service', { error: error.message });
      this.model = null;
    }
  }

  isInitialized() {
    return !!this.model;
  }

  /**
   * Enhance a user prompt by adding more detail while preserving the original intent
   * @param {string} prompt - Original natural language prompt
   * @returns {Promise<Object>} - Object containing success status, enhanced prompt, and error if any
   */
  async enhancePrompt(prompt) {
    if (!this.isInitialized()) {
      this.initialize();
      if (!this.isInitialized()) {
        return {
          success: false,
          error: 'Gemini Prompt Enhancer Service is not initialized. Please check your GEMINI_API_KEY.',
          enhancedPrompt: null,
        };
      }
    }

    try {
      logger.info('Enhancing prompt with Gemini', { inputLength: prompt.length });

      const fullPrompt = `${this.systemPrompt}\n\n---\n\nPlease enhance this database design prompt by adding more detail while keeping the original intent:\n\n"${prompt}"`;

      const result = await this.model.generateContent(fullPrompt, {
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'text/plain',
        }
      });

      const response = await result.response;
      const enhancedPrompt = response.text().trim();

      if (!enhancedPrompt) {
        logger.error('Generated content is empty');
        return {
          success: false,
          error: 'The prompt enhancement process failed. Please try again with a different prompt.',
          enhancedPrompt: null,
        };
      }

      logger.info('Successfully enhanced prompt', { 
        originalLength: prompt.length, 
        enhancedLength: enhancedPrompt.length 
      });

      // Log both prompts for analysis and debugging
      logger.info('Prompt enhancement details:', {
        original: prompt,
        enhanced: enhancedPrompt
      });

      return {
        success: true,
        error: null,
        enhancedPrompt,
      };
    } catch (error) {
      logger.error('Error enhancing prompt with Gemini', { error: error.message });
      const clientError = error.message.includes('API key') 
        ? 'An authentication error occurred. Please check the server configuration.'
        : `Failed to enhance prompt: An internal error occurred.`;
      return {
        success: false,
        error: clientError,
        enhancedPrompt: null,
      };
    }
  }
}

module.exports = new GeminiPromptEnhancerService();