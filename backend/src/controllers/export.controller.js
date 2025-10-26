const Schema = require('../models/schema.model');
const sqlGeneratorService = require('../services/sqlGenerator.service');
const documentationService = require('../services/documentation.service');
const mermaidGeneratorService = require('../services/mermaidGenerator.service');
const logger = require('../utils/logger');

/**
 * Generate SQL script from schema
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.generateSQL = async (req, res) => {
  try {
    const { schemaId, dialect = 'mysql' } = req.body;
    
    if (!schemaId) {
      return res.status(400).json({ error: 'Schema ID is required' });
    }
    
    const schema = await Schema.findById(schemaId);
    
    if (!schema) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    
    const supportedDialects = ['mysql', 'postgresql', 'sqlite', 'sqlserver'];
    
    if (!supportedDialects.includes(dialect.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Unsupported SQL dialect', 
        supportedDialects 
      });
    }
    
    // Generate SQL based on the selected dialect
    const sql = await sqlGeneratorService.generateSQL(schema, dialect);
    
    return res.status(200).json({
      message: 'SQL script generated successfully',
      sql,
      dialect
    });
  } catch (error) {
    logger.error('Error generating SQL:', error);
    return res.status(500).json({
      error: 'Failed to generate SQL script',
      details: error.message
    });
  }
};

/**
 * Export ERD diagram as image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.exportERD = async (req, res) => {
  try {
    const { schemaId, format = 'svg', diagramData } = req.body;
    
    if (!schemaId) {
      return res.status(400).json({ error: 'Schema ID is required' });
    }
    
    const schema = await Schema.findById(schemaId);
    
    if (!schema) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    
    const supportedFormats = ['svg', 'png'];
    
    if (!supportedFormats.includes(format.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Unsupported export format', 
        supportedFormats 
      });
    }
    
    // If diagram data is provided (from frontend), use it
    if (diagramData) {
      logger.info(`Received diagram data for export in ${format} format`);
      
      return res.status(200).json({
        message: `ERD exported as ${format} successfully`,
        format,
        diagramData
      });
    }
    
    // If no diagram data is provided, return an error
    return res.status(400).json({
      error: 'Diagram data is required for export',
      details: 'The current diagram state must be provided to export the diagram'
    });
  } catch (error) {
    logger.error('Error exporting ERD:', error);
    return res.status(500).json({
      error: 'Failed to export ERD',
      details: error.message
    });
  }
};

/**
 * Generate schema documentation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.generateDocumentation = async (req, res) => {
  try {
    const { schemaId, format = 'markdown' } = req.body;
    
    if (!schemaId) {
      return res.status(400).json({ error: 'Schema ID is required' });
    }
    
    const schema = await Schema.findById(schemaId);
    
    if (!schema) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    
    const supportedFormats = ['markdown', 'html', 'pdf'];
    
    if (!supportedFormats.includes(format.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Unsupported documentation format', 
        supportedFormats 
      });
    }
    
    // Generate documentation
    const documentation = await documentationService.generateDocumentation(schema, format);
    
    return res.status(200).json({
      message: 'Documentation generated successfully',
      documentation,
      format
    });
  } catch (error) {
    logger.error('Error generating documentation:', error);
    return res.status(500).json({
      error: 'Failed to generate documentation',
      details: error.message
    });
  }
};

/**
 * Generate Mermaid ER diagram from schema
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.generateMermaidERD = async (req, res) => {
  try {
    const { schemaId } = req.body;
    
    if (!schemaId) {
      return res.status(400).json({ error: 'Schema ID is required' });
    }
    
    const schema = await Schema.findById(schemaId);
    
    if (!schema) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    
    // Debug: Log the schema being processed
    logger.info(`Generating Mermaid ER diagram for schema: ${schema.name} (ID: ${schemaId})`);
    
    // Generate Mermaid ER diagram syntax
    const mermaidSyntax = mermaidGeneratorService.generateMermaidERD(schema);
    
    // For debugging, include the actual syntax in the logs
    logger.info(`Generated Mermaid syntax: ${mermaidSyntax}`);
    
    return res.status(200).json({
      message: 'Mermaid ER diagram generated successfully',
      mermaidSyntax,
      schema: schema, // Include the schema in the response for debugging
      tables: schema.tables // Also include just the tables for easier inspection
    });
  } catch (error) {
    logger.error('Error generating Mermaid ER diagram:', error);
    return res.status(500).json({
      error: 'Failed to generate Mermaid ER diagram',
      details: error.message
    });
  }
};
