/**
 * Routes for the Gemini Playground feature
 */

const express = require('express');
const geminiController = require('../controllers/gemini.controller');

const router = express.Router();

/**
 * @route POST /api/gemini/generate
 * @desc Generate an ER diagram using Gemini model
 * @access Public
 */
router.post('/generate', geminiController.generateERDiagram);

module.exports = router;