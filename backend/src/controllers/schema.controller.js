const Schema = require('../models/schema.model');
const nlpService = require('../services/nlp.service');
const promptEnhancerService = require('../services/promptEnhancer.service');
const schemaGeneratorService = require('../services/schemaGenerator.service');
const logger = require('../utils/logger');

/**
 * Generate database schema from natural language input
 * @param {Object} req - Express request object with natural language prompt
 * @param {Object} res - Express response object
 */
exports.generateSchema = async (req, res) => {
  try {
    const { prompt, name = 'New Schema', description = '' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    logger.info('Generating schema from prompt', { prompt });

    // Set a longer timeout for the request (90 seconds)
    req.setTimeout(90000);
    
    // Process natural language using NLP service
    let extractedEntities;
    try {
      extractedEntities = await nlpService.extractEntities(prompt);
    } catch (nlpError) {
      logger.error('NLP service error:', nlpError);
      
      // Provide a specific message for JSON parsing errors
      let errorMessage = nlpError.message || 'Error in AI processing';
      let errorCode = 'NLP_ERROR';
      
      if (nlpError.message && (
          nlpError.message.includes('JSON') || 
          nlpError.message.includes('Unexpected') || 
          nlpError.message.includes('token') || 
          nlpError.message.includes('position') ||
          nlpError.message.includes('parse')
        )) {
        errorMessage = 'The AI response contained invalid JSON. Please try again with a simpler prompt.';
        errorCode = 'JSON_PARSE_ERROR';
      } else if (nlpError.message && nlpError.message.includes('timeout')) {
        errorMessage = 'The request timed out. Please try again with a simpler prompt.';
        errorCode = 'TIMEOUT_ERROR';
      }
      
      return res.status(500).json({ 
        error: errorMessage, 
        details: nlpError.message,
        code: errorCode
      });
    }
    
    // Generate schema from extracted entities
    let schema;
    try {
      schema = await schemaGeneratorService.generateSchema(extractedEntities, { name, description });
    } catch (schemaError) {
      logger.error('Schema generation error:', schemaError);
      return res.status(500).json({ 
        error: 'Error generating schema structure', 
        details: schemaError.message,
        code: 'SCHEMA_GEN_ERROR'
      });
    }
    
    // Save schema to memory
    try {
      const newSchema = new Schema(schema);
      await newSchema.save();
      
      return res.status(201).json({ 
        message: 'Schema generated successfully', 
        schema: newSchema 
      });
    } catch (dbError) {
      logger.error('Error saving schema:', dbError);
      return res.status(500).json({ 
        error: 'Error saving schema', 
        details: dbError.message,
        code: 'SAVE_ERROR'
      });
    }
  } catch (error) {
    logger.error('Error generating schema:', error);
    return res.status(500).json({ 
      error: 'Failed to generate schema', 
      details: error.message 
    });
  }
};

/**
 * Get a specific schema by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSchemaById = async (req, res) => {
  try {
    const schema = await Schema.findById(req.params.id);
    
    if (!schema) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    
    return res.status(200).json({ schema });
  } catch (error) {
    logger.error('Error fetching schema:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch schema', 
      details: error.message 
    });
  }
};

/**
 * Update an existing schema
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateSchema = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const schema = await Schema.findById(id);
    
    if (!schema) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    
    // Update timestamp
    updates.updatedAt = new Date();
    
    const updatedSchema = await Schema.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );
    
    return res.status(200).json({ 
      message: 'Schema updated successfully', 
      schema: updatedSchema 
    });
  } catch (error) {
    logger.error('Error updating schema:', error);
    return res.status(500).json({ 
      error: 'Failed to update schema', 
      details: error.message 
    });
  }
};

/**
 * Get available schema templates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTemplates = async (req, res) => {
  try {
    // This would typically fetch template schemas from a database or config file
    const templates = [
      { 
        id: 'ecommerce',
        name: 'E-Commerce',
        description: 'Standard e-commerce database schema with products, customers, orders, and payments'
      },
      { 
        id: 'blog',
        name: 'Blog/CMS',
        description: 'Content management system with posts, users, comments, and categories'
      },
      { 
        id: 'inventory',
        name: 'Inventory Management',
        description: 'Inventory tracking system with products, warehouses, and stock movements'
      },
      { 
        id: 'crm',
        name: 'Customer Relationship Management',
        description: 'CRM system with contacts, companies, deals, and activities'
      }
    ];
    
    return res.status(200).json({ templates });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch templates', 
      details: error.message 
    });
  }
};

/**
 * Optimize a user prompt using AI to make it more effective for schema generation
 * @param {Object} req - Express request object with original prompt
 * @param {Object} res - Express response object
 */
exports.optimizePrompt = async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    logger.info('Optimizing prompt with AI', { prompt });

    // Set a longer timeout for the request
    req.setTimeout(30000);
    
    // Process prompt optimization using NLP service
    try {
      const optimizedPrompt = await nlpService.optimizePrompt(prompt);
      return res.status(200).json({ 
        message: 'Prompt optimized successfully', 
        optimizedPrompt 
      });
    } catch (nlpError) {
      logger.error('Prompt optimization error:', nlpError);
      
      let errorMessage = nlpError.message || 'Error in AI processing';
      let errorCode = 'OPTIMIZATION_ERROR';
      
      if (nlpError.message && nlpError.message.includes('timeout')) {
        errorMessage = 'The request timed out. Please try again with a simpler prompt.';
        errorCode = 'TIMEOUT_ERROR';
      }
      
      return res.status(500).json({ 
        error: errorMessage, 
        details: nlpError.message,
        code: errorCode
      });
    }
  } catch (error) {
    logger.error('Error optimizing prompt:', error);
    return res.status(500).json({ 
      error: 'Failed to optimize prompt', 
      details: error.message 
    });
  }
};

/**
 * Enhance a user prompt by adding more detail while preserving original intent
 * @param {Object} req - Express request object with original prompt
 * @param {Object} res - Express response object
 */
exports.enhancePrompt = async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    logger.info('Enhancing prompt with AI', { prompt });

    // Set a reasonable timeout for the request
    req.setTimeout(30000);
    
    // Process prompt enhancement using promptEnhancer service
    try {
      const enhancedPrompt = await promptEnhancerService.enhancePrompt(prompt);
      return res.status(200).json({ 
        message: 'Prompt enhanced successfully', 
        enhancedPrompt 
      });
    } catch (enhancerError) {
      logger.error('Prompt enhancement error:', enhancerError);
      
      let errorMessage = enhancerError.message || 'Error in AI processing';
      let errorCode = 'ENHANCEMENT_ERROR';
      
      if (enhancerError.message && enhancerError.message.includes('timeout')) {
        errorMessage = 'The request timed out. Please try again with a simpler prompt.';
        errorCode = 'TIMEOUT_ERROR';
      }
      
      return res.status(500).json({ 
        error: errorMessage, 
        details: enhancerError.message,
        code: errorCode
      });
    }
  } catch (error) {
    logger.error('Error enhancing prompt:', error);
    return res.status(500).json({ 
      error: 'Failed to enhance prompt', 
      details: error.message 
    });
  }
};
