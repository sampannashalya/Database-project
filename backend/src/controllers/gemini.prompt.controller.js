/**
 * Controller for the Gemini Prompt Enhancement feature
 */

const geminiPromptEnhancerService = require('../services/geminiPromptEnhancer.service');
const logger = require('../utils/logger');

const MIN_INPUT_LENGTH = 5;

/**
 * Handles the request to enhance a prompt using the Gemini service.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
const enhancePrompt = async (req, res) => {
  try {
    const { prompt } = req.body;

    // Input validation
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < MIN_INPUT_LENGTH) {
      logger.warn('Invalid input for Gemini prompt enhancement', { prompt });
      return res.status(400).json({
        success: false,
        error: `Please provide a text description of at least ${MIN_INPUT_LENGTH} characters.`,
      });
    }

    // Check if the service is ready before making a call
    if (!geminiPromptEnhancerService.isInitialized()) {
      logger.error('Gemini Prompt Enhancer service not initialized. Cannot process request.');
      return res.status(503).json({
        success: false,
        error: 'The prompt enhancement service is temporarily unavailable. Please try again later.'
      });
    }

    logger.info('Received request to enhance prompt', { inputLength: prompt.length });

    const result = await geminiPromptEnhancerService.enhancePrompt(prompt);

    if (!result.success) {
      logger.error('Failed to enhance prompt', { error: result.error });
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    logger.info('Successfully enhanced prompt');

    return res.status(200).json({
      success: true,
      enhancedPrompt: result.enhancedPrompt,
    });
  } catch (error) {
    // This is a catch-all for unexpected server errors
    logger.error('Unhandled error in enhancePrompt controller', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred.',
    });
  }
};

module.exports = {
  enhancePrompt,
};