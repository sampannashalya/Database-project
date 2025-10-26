const Session = require('../models/session.model');
const Schema = require('../models/schema.model');
const logger = require('../utils/logger');

/**
 * Create a new design session
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createSession = async (req, res) => {
  try {
    const { name, description, schemaId, prompt } = req.body;
    
    const sessionData = {
      name: name || 'New Session',
      description,
      prompt,
      schemas: [],
      activeSchemaId: null
    };
    
    // If a schema ID is provided, add it to the session
    if (schemaId) {
      const schema = await Schema.findById(schemaId);
      if (schema) {
        sessionData.schemas = [schema._id];
        sessionData.activeSchemaId = schema._id;
      }
    }
    
    const session = new Session(sessionData);
    await session.save();
    
    return res.status(201).json({
      message: 'Session created successfully',
      session
    });
  } catch (error) {
    logger.error('Error creating session:', error);
    return res.status(500).json({
      error: 'Failed to create session',
      details: error.message
    });
  }
};

/**
 * Get a specific session by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSessionById = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Populate schema references
    await session.populate('schemas');
    await session.populate('activeSchemaId');
    
    return res.status(200).json({ session });
  } catch (error) {
    logger.error('Error fetching session:', error);
    return res.status(500).json({
      error: 'Failed to fetch session',
      details: error.message
    });
  }
};

/**
 * Save the current state of a session
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.saveSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { schemaId } = req.body;
    
    const session = await Session.findById(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const schema = await Schema.findById(schemaId);
    
    if (!schema) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    
    // Update session with schema reference
    if (!session.schemas.includes(schema._id)) {
      session.schemas.push(schema._id);
    }
    session.activeSchemaId = schema._id;
    session.updatedAt = new Date();
    
    await session.save();
    
    return res.status(200).json({
      message: 'Session saved successfully',
      session
    });
  } catch (error) {
    logger.error('Error saving session:', error);
    return res.status(500).json({
      error: 'Failed to save session',
      details: error.message
    });
  }
};
