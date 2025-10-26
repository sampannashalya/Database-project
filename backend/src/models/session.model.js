// In-memory storage for sessions
const sessions = new Map();
let nextId = 1;

/**
 * Session model without MongoDB dependency
 */
class Session {
  /**
   * Create a new session
   * @param {Object} data Session data
   */
  constructor(data = {}) {
    this._id = data._id || String(nextId++);
    this.name = data.name || 'New Session';
    this.description = data.description || '';
    this.prompt = data.prompt || '';
    this.schemas = data.schemas || [];
    this.activeSchemaId = data.activeSchemaId || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Save the session to memory
   * @returns {Promise<Session>} The saved session
   */
  async save() {
    this.updatedAt = new Date();
    sessions.set(this._id, this);
    return this;
  }

  /**
   * Find a session by ID
   * @param {string} id Session ID
   * @returns {Promise<Session|null>} The session or null if not found
   */
  static async findById(id) {
    return sessions.get(id) || null;
  }

  /**
   * Populate schema references with actual schema objects
   * @param {string} path Path to populate
   * @returns {Promise<Session>} The populated session
   */
  async populate(path) {
    const Schema = require('./schema.model');
    
    // Simple populate implementation
    if (path === 'schemas') {
      const populatedSchemas = [];
      for (const schemaId of this.schemas) {
        const schema = await Schema.findById(schemaId);
        if (schema) populatedSchemas.push(schema);
      }
      this.schemas = populatedSchemas;
    } else if (path === 'activeSchemaId') {
      if (this.activeSchemaId) {
        this.activeSchemaId = await Schema.findById(this.activeSchemaId);
      }
    }
    
    return this;
  }
}

module.exports = Session;
