/**
 * Routes for the Gemini Prompt Enhancement feature
 */

const express = require('express');
const geminiPromptController = require('../controllers/gemini.prompt.controller');

const router = express.Router();

/**
 * @route POST /api/gemini/prompt/enhance
 * @desc Enhance a prompt using Gemini model
 * @access Public
 */
router.post('/enhance', geminiPromptController.enhancePrompt);

module.exports = router;