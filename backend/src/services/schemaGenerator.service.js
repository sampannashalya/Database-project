const logger = require('../utils/logger');

/**
 * Generate database schema from extracted entities and relationships
 * @param {Object} extractedData - Extracted entities and relationships from NLP
 * @param {Object} options - Additional options for schema generation
 * @returns {Object} - Generated database schema
 */
exports.generateSchema = async (extractedData, options = {}) => {
  try {
    const { entities = [], relationships = [] } = extractedData;
    const { name = 'New Schema', description = '' } = options;
    
    logger.info('Generating schema from extracted data', { 
      entityCount: entities.length,
      relationshipCount: relationships.length
    });
    
    // Transform entities into tables
    const tables = entities.map((entity, index) => {
      // Basic table structure
      const table = {
        name: transformTableName(entity.name),
        columns: generateColumnsFromAttributes(entity.attributes || []),
        description: entity.description || `Table for ${entity.name}`,
        isWeakEntity: entity.isWeakEntity === true,
        isLookupTable: entity.isLookupTable === true,
        assumptionsMade: entity.assumptionsMade || [],
        position: {
          x: entity.position?.x || (100 + (index % 3) * 350),
          y: entity.position?.y || (100 + Math.floor(index / 3) * 250),
          isDraggable: true
        }
      };
      
      // Ensure primary key exists
      if (!table.columns.some(col => col.isPrimaryKey)) {
        table.columns.unshift({
          name: 'id',
          dataType: 'INTEGER',
          isPrimaryKey: true,
          isForeignKey: false,
          isNullable: false,
          isUnique: true,
          description: 'Primary key'
        });
      }
      
      // Ensure timestamp columns exist for all tables
      if (!table.columns.some(col => col.name === 'created_at')) {
        table.columns.push({
          name: 'created_at',
          dataType: 'TIMESTAMP',
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          defaultValue: 'CURRENT_TIMESTAMP',
          description: 'Creation timestamp'
        });
      }
      
      if (!table.columns.some(col => col.name === 'updated_at')) {
        table.columns.push({
          name: 'updated_at',
          dataType: 'TIMESTAMP',
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          defaultValue: 'CURRENT_TIMESTAMP',
          description: 'Last update timestamp'
        });
      }
      
      return table;
    });
    
    // Transform relationships
    const transformedRelationships = relationships
      .map((rel) => transformRelationship(rel, tables))
      .filter(Boolean);
    
    // Process identifying relationships - modify tables for weak entities
    processIdentifyingRelationships(transformedRelationships, tables);
    
    // Detect lookup tables based on their structure
    detectLookupTables(tables);
    
    // Final schema
    const schema = {
      name,
      description,
      tables: tables,
      relationships: transformedRelationships,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      nodePositions: {} // Initialize empty positions object for frontend UI
    };
    
    logger.info('Schema generation completed', {
      tableCount: schema.tables.length,
      relationshipCount: schema.relationships.length
    });
    
    return schema;
  } catch (error) {
    logger.error('Error generating schema:', error);
    throw new Error(`Failed to generate schema: ${error.message}`);
  }
};

/**
 * Transform entity name to valid table name
 * @param {string} entityName - Entity name
 * @returns {string} - Transformed table name
 */
function transformTableName(entityName) {
  if (!entityName) return 'unnamed_table';
  
  // Convert to snake_case for table names
  return entityName
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^[0-9]/, '_$&');
}

/**
 * Generate columns from attributes
 * @param {Array} attributes - Entity attributes
 * @returns {Array} - Generated columns
 */
function generateColumnsFromAttributes(attributes) {
  // If no attributes are provided, create default columns
  if (!attributes || attributes.length === 0) {
    return [
      {
        name: 'id',
        dataType: 'INTEGER',
        isPrimaryKey: true,
        isForeignKey: false,
        isNullable: false,
        isUnique: true,
        description: 'Primary key'
      },
      {
        name: 'name',
        dataType: 'VARCHAR(255)',
        isPrimaryKey: false,
        isForeignKey: false,
        isNullable: false,
        isUnique: false,
        description: 'Name field'
      },
      {
        name: 'created_at',
        dataType: 'TIMESTAMP',
        isPrimaryKey: false,
        isForeignKey: false,
        isNullable: false,
        defaultValue: 'CURRENT_TIMESTAMP',
        description: 'Creation timestamp'
      },
      {
        name: 'updated_at',
        dataType: 'TIMESTAMP',
        isPrimaryKey: false,
        isForeignKey: false,
        isNullable: false,
        defaultValue: 'CURRENT_TIMESTAMP',
        description: 'Last update timestamp'
      }
    ];
  }
  
  // Transform attributes into columns
  return attributes.map(attr => ({
    name: attr.name ? attr.name.toLowerCase().replace(/\s+/g, '_') : 'unnamed_column',
    dataType: attr.dataType || inferDataType(attr.name || ''),
    isPrimaryKey: !!attr.isPrimaryKey,
    isForeignKey: !!attr.isForeignKey,
    isNullable: attr.isNullable !== false,
    isUnique: !!attr.isUnique || !!attr.isPrimaryKey,
    defaultValue: attr.defaultValue,
    references: attr.references,
    isMultivalued: !!attr.isMultivalued,
    isDerived: !!attr.isDerived,
    isComposite: !!attr.isComposite,
    description: attr.description || `${attr.name || 'Field'} column`
  }));
}

/**
 * Infer SQL data type based on attribute name
 * @param {string} attributeName - Attribute name
 * @returns {string} - Inferred SQL data type
 */
function inferDataType(attributeName) {
  if (!attributeName) return 'VARCHAR(255)';
  
  const name = attributeName.toLowerCase();
  
  if (name === 'id' || name.endsWith('_id') || name.endsWith('id')) {
    return 'INTEGER';
  } else if (name.includes('uuid') || name.includes('guid')) {
    return 'VARCHAR(36)';
  } else if (name.includes('date') || name.includes('time')) {
    return 'TIMESTAMP';
  } else if (name.includes('price') || name.includes('cost') || name.includes('amount') || 
             name.includes('fee') || name.includes('salary') || name.includes('budget')) {
    return 'DECIMAL(10,2)';
  } else if (name.includes('is_') || name.includes('has_') || name === 'active' || 
             name === 'enabled' || name === 'status' || name.includes('_flag')) {
    return 'BOOLEAN';
  } else if (name.includes('description') || name.includes('content') || 
             name.includes('text') || name.includes('comment') || name.includes('notes')) {
    return 'TEXT';
  } else if (name.includes('email')) {
    return 'VARCHAR(255)';
  } else if (name.includes('password') || name.includes('hash')) {
    return 'VARCHAR(255)';
  } else if (name.includes('phone') || name.includes('fax') || name.includes('mobile')) {
    return 'VARCHAR(20)';
  } else if (name.includes('url') || name.includes('link') || name.includes('website')) {
    return 'VARCHAR(512)';
  } else if (name.includes('code') || name.includes('key')) {
    return 'VARCHAR(50)';
  } else if (name.includes('count') || name.includes('quantity') || name.includes('number') || 
             name.includes('total') || name.includes('age')) {
    return 'INTEGER';
  } else if (name.includes('percent') || name.includes('rate') || name.includes('ratio')) {
    return 'DECIMAL(5,2)';
  } else if (name.includes('image') || name.includes('file') || name.includes('avatar') || 
             name.includes('picture') || name.includes('photo')) {
    return 'VARCHAR(512)'; // For file paths or URLs
  } else if (name.includes('json') || name.includes('data')) {
    return 'TEXT'; // For JSON data
  } else if (name.includes('ip') || name.includes('ipv4') || name.includes('ipv6')) {
    return 'VARCHAR(45)'; // Accommodate both IPv4 and IPv6
  } else if (name.includes('color')) {
    return 'VARCHAR(20)';
  } else if (name.includes('currency') || name.includes('language')) {
    return 'VARCHAR(10)';
  } else {
    return 'VARCHAR(255)'; // Default type
  }
}

/**
 * Transform relationship data into schema relationship
 * @param {Object} relationship - Relationship data
 * @param {Array} tables - Tables in the schema
 * @returns {Object|null} - Transformed relationship
 */
function transformRelationship(relationship, tables) {
  // Determine source and target entities
  const sourceEntityName = relationship.sourceEntity || relationship.sourceTable;
  const targetEntityName = relationship.targetEntity || relationship.targetTable;
  
  if (!sourceEntityName || !targetEntityName) {
    logger.warn('Relationship missing source or target entity', { relationship });
    return null;
  }
  
  // Find tables by name (case-insensitive)
  const sourceTable = tables.find(t => 
    t.name.toLowerCase() === transformTableName(sourceEntityName).toLowerCase()
  );
  
  const targetTable = tables.find(t => 
    t.name.toLowerCase() === transformTableName(targetEntityName).toLowerCase()
  );
  
  // Skip if source or target table doesn't exist
  if (!sourceTable || !targetTable) {
    logger.warn('Relationship refers to missing tables', { 
      relationship, 
      sourceFound: !!sourceTable, 
      targetFound: !!targetTable 
    });
    return null;
  }
  
  // Find or create ID columns
  const sourceColumn = sourceTable.columns.find(c => c.isPrimaryKey) || { name: 'id' };
  const targetColumn = targetTable.columns.find(c => c.isPrimaryKey) || { name: 'id' };
  
  // Set up foreign keys based on relationship type
  setupForeignKeys(relationship, sourceTable, targetTable, sourceColumn, targetColumn);
  
  // Get participation types
  const sourceParticipation = 
    relationship.sourceParticipation?.toUpperCase() === 'TOTAL' ? 'TOTAL' : 'PARTIAL';
  const targetParticipation = 
    relationship.targetParticipation?.toUpperCase() === 'TOTAL' ? 'TOTAL' : 'PARTIAL';
  
  // Process relationship attributes if any
  const processedAttributes = Array.isArray(relationship.attributes) 
    ? processRelationshipAttributes(relationship.attributes)
    : [];
  
  // Calculate position for the relationship
  const position = {
    x: relationship.position?.x || (
      (sourceTable.position?.x || 0) + (targetTable.position?.x || 0)
    ) / 2,
    y: relationship.position?.y || (
      (sourceTable.position?.y || 0) + (targetTable.position?.y || 0)
    ) / 2,
    isDraggable: true
  };
  
  return {
    // Use the relationship verb or action if available, otherwise use a default
    name: relationship.name || relationship.action || relationship.verb || 
          (relationship.type === 'ONE_TO_MANY' ? 'has' : 'relates_to'),
    sourceTable: sourceTable.name,
    sourceEntity: sourceEntityName, // Preserve original entity name
    targetTable: targetTable.name,
    targetEntity: targetEntityName, // Preserve original entity name
    sourceColumn: sourceColumn.name,
    targetColumn: getTargetColumnName(relationship, sourceTable, targetTable),
    type: relationship.type || 'ONE_TO_MANY', // Default to one-to-many
    isIdentifying: relationship.isIdentifying === true,
    description: relationship.description || `Relationship between ${sourceTable.name} and ${targetTable.name}`,
    // Preserve cardinality and participation information
    sourceCardinality: relationship.sourceCardinality || null,
    targetCardinality: relationship.targetCardinality || null,
    sourceParticipation: sourceParticipation,
    targetParticipation: targetParticipation,
    // Include relationship attributes if available
    attributes: processedAttributes,
    // Include position information for UI rendering
    position: position,
    // Include any assumptions made
    assumptionsMade: relationship.assumptionsMade || []
  };
}

/**
 * Set up foreign keys based on relationship type
 * @param {Object} relationship - Relationship data
 * @param {Object} sourceTable - Source table
 * @param {Object} targetTable - Target table
 * @param {Object} sourceColumn - Source primary key column
 * @param {Object} targetColumn - Target primary key column
 */
function setupForeignKeys(relationship, sourceTable, targetTable, sourceColumn, targetColumn) {
  // Skip if relationship type is missing
  if (!relationship.type) {
    relationship.type = 'ONE_TO_MANY'; // Default to one-to-many
  }
  
  // Handle different relationship types
  switch (relationship.type.toUpperCase()) {
    case 'ONE_TO_MANY':
      // Add foreign key to "many" side (target table)
      addForeignKey(targetTable, sourceTable, sourceColumn);
      break;
      
    case 'MANY_TO_ONE':
      // Add foreign key to "many" side (source table)
      addForeignKey(sourceTable, targetTable, targetColumn);
      break;
      
    case 'ONE_TO_ONE':
      // For one-to-one, add foreign key to the dependent side or to target by default
      if (relationship.isIdentifying) {
        // If it's an identifying relationship, the target is dependent
        addForeignKey(targetTable, sourceTable, sourceColumn);
      } else {
        // Otherwise, add to target by default
        addForeignKey(targetTable, sourceTable, sourceColumn);
      }
      break;
      
    case 'MANY_TO_MANY':
      // Many-to-many relationships typically need a junction table
      // For now, we don't create junction tables automatically
      // Could be implemented in the future
      break;
      
    default:
      // For unknown types, default to adding FK to target
      addForeignKey(targetTable, sourceTable, sourceColumn);
  }
}

/**
 * Add a foreign key column to a table
 * @param {Object} table - Table to add foreign key to
 * @param {Object} referencedTable - Table being referenced
 * @param {Object} referencedColumn - Column being referenced
 */
function addForeignKey(table, referencedTable, referencedColumn) {
  const fkName = `${referencedTable.name.toLowerCase()}_id`;
  
  // Skip if the table already has this foreign key
  if (table.columns.some(c => c.name === fkName)) {
    return;
  }
  
  // Add the foreign key column
  table.columns.push({
    name: fkName,
    dataType: referencedColumn.dataType || 'INTEGER',
    isPrimaryKey: false,
    isForeignKey: true,
    isNullable: true, // Default to nullable
    isUnique: false,
    references: {
      table: referencedTable.name,
      column: referencedColumn.name,
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    description: `Foreign key reference to ${referencedTable.name}`
  });
}

/**
 * Get the target column name for a relationship
 * @param {Object} relationship - Relationship data
 * @param {Object} sourceTable - Source table
 * @param {Object} targetTable - Target table
 * @returns {string} - Target column name
 */
function getTargetColumnName(relationship, sourceTable, targetTable) {
  // For ONE_TO_MANY, the target column is the foreign key in the target table
  if (relationship.type === 'ONE_TO_MANY') {
    return `${sourceTable.name.toLowerCase()}_id`;
  }
  
  // For MANY_TO_ONE, the target column is the primary key in the target table
  if (relationship.type === 'MANY_TO_ONE') {
    const pk = targetTable.columns.find(c => c.isPrimaryKey);
    return pk ? pk.name : 'id';
  }
  
  // For ONE_TO_ONE, depends on which side has the foreign key
  if (relationship.type === 'ONE_TO_ONE') {
    if (relationship.isIdentifying) {
      // If identifying, target has FK to source
      return `${sourceTable.name.toLowerCase()}_id`;
    } else {
      // Otherwise use target's PK
      const pk = targetTable.columns.find(c => c.isPrimaryKey);
      return pk ? pk.name : 'id';
    }
  }
  
  // For MANY_TO_MANY, return the target's primary key
  const pk = targetTable.columns.find(c => c.isPrimaryKey);
  return pk ? pk.name : 'id';
}

/**
 * Process attributes of a relationship
 * @param {Array} attributes - Relationship attributes
 * @returns {Array} - Processed attributes
 */
function processRelationshipAttributes(attributes) {
  return attributes.map(attr => {
    // Ensure all attributes have a name, defaulting to a generated one if missing
    if (!attr.name && attr.description) {
      // If name is missing but description exists, create a name from the description
      attr.name = attr.description
        .toLowerCase()
        .replace(/[^a-z0-9_\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
    }
    
    return {
      ...attr,
      name: attr.name || 'unnamed_attribute',
      dataType: attr.dataType || inferDataType(attr.name || ''),
      isPrimaryKey: !!attr.isPrimaryKey,
      isForeignKey: !!attr.isForeignKey,
      isNullable: attr.isNullable !== false,
      isMultiValued: !!attr.isMultiValued || !!attr.isMultivalued,
      isDerived: !!attr.isDerived,
      description: attr.description || `${attr.name || 'Unnamed'} attribute`
    };
  });
}

/**
 * Process identifying relationships to properly configure weak entities
 * @param {Array} relationships - All relationships
 * @param {Array} tables - All tables
 */
function processIdentifyingRelationships(relationships, tables) {
  // Find all identifying relationships
  const identifyingRels = relationships.filter(rel => rel.isIdentifying);
  
  identifyingRels.forEach(rel => {
    // Get the owner (strong entity) and dependent (weak entity)
    const ownerTable = tables.find(t => t.name === rel.sourceTable);
    const dependentTable = tables.find(t => t.name === rel.targetTable);
    
    if (!ownerTable || !dependentTable) return;
    
    // Mark the dependent entity as a weak entity
    dependentTable.isWeakEntity = true;
    
    // For weak entities, ensure they have a foreign key to their owner
    // that is part of their primary key (composite primary key)
    const fkName = `${ownerTable.name.toLowerCase()}_id`;
    
    // Find existing foreign key
    let fkColumn = dependentTable.columns.find(c => c.name === fkName);
    
    if (!fkColumn) {
      // If foreign key doesn't exist, create it
      const ownerPK = ownerTable.columns.find(c => c.isPrimaryKey) || { name: 'id', dataType: 'INTEGER' };
      
      fkColumn = {
        name: fkName,
        dataType: ownerPK.dataType,
        isPrimaryKey: true, // Part of composite PK
        isForeignKey: true,
        isNullable: false, // Required for identification
        isUnique: false, // Not unique on its own
        references: {
          table: ownerTable.name,
          column: ownerPK.name,
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        description: `Foreign key reference to ${ownerTable.name} (part of composite primary key for weak entity)`
      };
      
      // Add the foreign key column
      dependentTable.columns.unshift(fkColumn);
    } else {
      // Update existing column to be part of PK
      fkColumn.isPrimaryKey = true;
      fkColumn.isNullable = false;
      fkColumn.description = fkColumn.description || 
        `Foreign key reference to ${ownerTable.name} (part of composite primary key for weak entity)`;
    }
    
    // Ensure the dependent entity has its own primary key
    // Most weak entities will have a composite key: owner's key + a partial key
    const existingPK = dependentTable.columns.find(c => 
      c.isPrimaryKey && c.name !== fkName
    );
    
    if (!existingPK) {
      // Add a partial key if not already present
      const partialKey = {
        name: 'partial_id',
        dataType: 'INTEGER',
        isPrimaryKey: true,
        isForeignKey: false,
        isNullable: false,
        isUnique: false, // Not unique on its own
        description: 'Partial key for weak entity (forms composite primary key with owner reference)'
      };
      
      // Add after the foreign key
      const fkIndex = dependentTable.columns.findIndex(c => c.name === fkName);
      dependentTable.columns.splice(fkIndex + 1, 0, partialKey);
    }
  });
}

/**
 * Detect lookup tables based on their structure
 * @param {Array} tables - All tables
 */
function detectLookupTables(tables) {
  tables.forEach(table => {
    // Skip tables already marked as lookup tables
    if (table.isLookupTable) return;
    
    // Heuristics for lookup tables:
    // 1. Small number of columns (usually 2-4)
    // 2. Has a name or code column
    // 3. Often has words like "status", "type", "category" in table name
    
    const hasIdColumn = table.columns.some(c => c.isPrimaryKey);
    const hasNameColumn = table.columns.some(c => 
      ['name', 'title', 'label', 'value'].includes(c.name.toLowerCase())
    );
    const hasCodeColumn = table.columns.some(c => 
      ['code', 'key', 'shortname', 'abbreviation'].includes(c.name.toLowerCase())
    );
    
    const isLookupByName = [
      'status', 'type', 'category', 'state', 'priority', 'role', 
      'permission', 'gender', 'country', 'language'
    ].some(keyword => table.name.toLowerCase().includes(keyword));
    
    // Check if this has the structure of a lookup table
    const nonSystemColumns = table.columns.filter(c => 
      !['id', 'created_at', 'updated_at'].includes(c.name)
    );
    
    // Mark as lookup table if it meets the criteria
    if (hasIdColumn && (hasNameColumn || hasCodeColumn) && 
        (isLookupByName || nonSystemColumns.length <= 3)) {
      table.isLookupTable = true;
      
      // Add description if not already present
      if (!table.description || table.description === `Table for ${table.name}`) {
        table.description = `Lookup table for ${table.name.replace(/_/g, ' ')} values`;
      }
    }
  });
}

module.exports = exports;
