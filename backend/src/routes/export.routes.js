const express = require('express');
const router = express.Router();
const exportController = require('../controllers/export.controller');

/**
 * @route POST /api/export/sql
 * @description Generate SQL script from schema
 * @access Public
 */
router.post('/sql', exportController.generateSQL);

/**
 * @route POST /api/export/erd
 * @description Export ERD diagram as image
 * @access Public
 */
router.post('/erd', exportController.exportERD);

/**
 * @route POST /api/export/documentation
 * @description Generate schema documentation
 * @access Public
 */
router.post('/documentation', exportController.generateDocumentation);

/**
 * @route POST /api/export/mermaid
 * @description Generate Mermaid ER diagram
 * @access Public
 */
router.post('/mermaid', exportController.generateMermaidERD);

module.exports = router;
