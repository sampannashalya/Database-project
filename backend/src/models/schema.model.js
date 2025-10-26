// In-memory storage for schemas
const schemas = new Map();
let nextId = 1;

// Schema structure definitions
// These are just plain objects now, not mongoose schemas

/**
 * Schema model without MongoDB dependency
 */
class Schema {
  /**
   * Create a new schema
   * @param {Object} data Schema data
   */
  constructor(data = {}) {
    this._id = data._id || String(nextId++);
    this.name = data.name || 'New Schema';
    this.description = data.description || '';
    this.tables = data.tables || [];
    this.relationships = data.relationships || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Save the schema to memory
   * @returns {Promise<Schema>} The saved schema
   */
  async save() {
    this.updatedAt = new Date();
    schemas.set(this._id, this);
    return this;
  }

  /**
   * Find a schema by ID
   * @param {string} id Schema ID
   * @returns {Promise<Schema|null>} The schema or null if not found
   */
  static async findById(id) {
    return schemas.get(id) || null;
  }

  /**
   * Find and update a schema
   * @param {string} id Schema ID
   * @param {Object} updates Updates to apply
   * @param {Object} options Options
   * @returns {Promise<Schema|null>} The updated schema or null if not found
   */
  static async findByIdAndUpdate(id, updates, options = {}) {
    const schema = schemas.get(id);
    if (!schema) return null;

    // Apply updates
    Object.assign(schema, updates);
    schema.updatedAt = new Date();
    
    // Save updated schema
    schemas.set(id, schema);
    
    return schema;
  }

  /**
   * Convert to plain object
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      _id: this._id,
      name: this.name,
      description: this.description,
      tables: this.tables,
      relationships: this.relationships,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Schema;
