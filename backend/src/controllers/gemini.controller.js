/**
 * Controller for the Gemini Playground feature
 */

const geminiService = require('../services/geminiService');
const logger = require('../utils/logger');

const MIN_INPUT_LENGTH = 10;

/**
 * Handles the request to generate an ER diagram using the Gemini service.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
const generateERDiagram = async (req, res) => {
  try {
    const { input } = req.body;

    // More robust input validation
    if (!input || typeof input !== 'string' || input.trim().length < MIN_INPUT_LENGTH) {
      logger.warn('Invalid input for Gemini ER diagram generation', { input });
      return res.status(400).json({
        success: false,
        error: `Please provide a text description of at least ${MIN_INPUT_LENGTH} characters.`,
      });
    }

    // Check if the service is ready before making a call
    if (!geminiService.isInitialized()) {
        logger.error('Gemini service not initialized. Cannot process request.');
        return res.status(503).json({ // 503 Service Unavailable
            success: false,
            error: 'The diagram generation service is temporarily unavailable. Please try again later.'
        });
    }

    logger.info('Received request to generate ER diagram', { inputLength: input.length });

    const result = await geminiService.generateERDiagram(input);

    if (!result.success) {
      // The service now provides client-safe error messages.
      logger.error('Failed to generate ER diagram', { error: result.error });
      // Use 500 for internal server errors
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    logger.info('Successfully generated and returned ER diagram');

    return res.status(200).json({
      success: true,
      mermaidCode: result.mermaidCode,
    });
  } catch (error) {
    // This is a catch-all for unexpected server errors (e.g., programming errors in this file).
    logger.error('Unhandled error in generateERDiagram controller', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred.',
    });
  }
};

module.exports = {
  generateERDiagram,
};