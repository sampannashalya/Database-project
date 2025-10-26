const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const { openaiResponseLogger } = require('../utils/logger');
const dotenv = require('dotenv');

// Make sure environment variables are loaded
dotenv.config();

// Initialize OpenAI client with the same configuration as nlp.service.js
let openai;
try {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (apiKey) {
    logger.info('Found OpenAI API key for prompt enhancer service');
    
    // Configure with SSL certificate checking disabled for development environments
    const httpsAgent = require('https').Agent({
      rejectUnauthorized: false,
      timeout: 30000 // 30 second timeout
    });
    
    openai = new OpenAI({
      apiKey: apiKey,
      httpAgent: httpsAgent,
      timeout: 30000, // 30 second timeout
      maxRetries: 2 // Allow 2 retries on failures
    });
    logger.info('OpenAI client initialized successfully for prompt enhancer');
  } else {
    logger.error('No OpenAI API key found for prompt enhancer service');
    throw new Error('OpenAI API key is required for prompt enhancement');
  }
} catch (error) {
  logger.error('Error initializing OpenAI client for prompt enhancer:', error);
  throw error;
}

/**
 * Enhance a user prompt by adding more detail while preserving the original intent
 * This makes subtle improvements without changing the core meaning of the prompt
 * @param {string} prompt - Original natural language prompt
 * @returns {string} - Enhanced prompt with more details
 */
exports.enhancePrompt = async (prompt) => {
  try {
    if (!openai) {
      throw new Error('OpenAI client is not initialized. Please check your API key configuration.');
    }

    logger.info('Using OpenAI for prompt enhancement');
    
    // Use a cost-efficient model
    const model = "gpt-3.5-turbo-0125";
    
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `You are a helpful database design assistant. Your task is to enhance database schema prompts by adding more detail while PRESERVING the original intent.

IMPORTANT REQUIREMENTS:
1. DO NOT completely rewrite or restructure the prompt
2. DO NOT change the domain or context of the original prompt
3. DO NOT add specific technical implementation details like SQL syntax
4. KEEP the original entities and core relationships intact
5. ADD more specificity to entities and their attributes
6. ADD common relationships that would be expected in the domain
7. CLARIFY vague or ambiguous descriptions
8. EXPAND on the business rules or constraints
9. KEEP your enhancements natural and conversational (not too technical)
10. The enhanced prompt should be 1.5-2 times longer than the original

EXAMPLE:

Original: "Create a hospital schema"

Enhanced: "Create a hospital management database schema with departments, doctors, patients, and appointments. Doctors belong to specific departments and have specializations. Patients have personal information, medical history, and can schedule multiple appointments. Each appointment links a patient with a doctor at a specific time and date. The system should also track prescriptions, medical records, and billing information."

Original: "Build a library database"

Enhanced: "Build a library database to manage books, members, and borrowing transactions. Books should have attributes like title, author, ISBN, publication date, and availability status. Members need to have personal details, membership status, and contact information. The system should track when books are borrowed and returned, including due dates and potential late fees. Consider including categories for books and different membership levels for users."

CORE PRINCIPLE: The goal is to make the prompt more detailed and specific without changing its fundamental meaning. The enhanced prompt should help generate a more comprehensive and accurate database schema.`
        },
        {
          role: "user",
          content: `Please enhance this database design prompt by adding more detail while keeping the original intent: "${prompt}"`
        }
      ]
    });
    
    logger.info('OpenAI API response received for prompt enhancement');
    
    if (!response.choices || response.choices.length === 0) {
      throw new Error('No choices returned from OpenAI API');
    }
    
    const enhancedPrompt = response.choices[0].message.content;
    if (!enhancedPrompt) {
      throw new Error('Empty response content from OpenAI API');
    }
    
    // Log the enhanced prompt
    logger.info('Prompt enhancement successful');
    openaiResponseLogger.info('Prompt enhancement:', { 
      original: prompt,
      enhanced: enhancedPrompt
    });
    
    return enhancedPrompt;
  } catch (error) {
    logger.error('Error enhancing prompt:', error);
    throw error;
  }
}

module.exports = exports;
