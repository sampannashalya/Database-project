const { format } = require('sql-formatter');
const logger = require('../utils/logger');

/**
 * Generate SQL for the given schema and dialect
 * @param {Object} schema - Database schema
 * @param {string} dialect - SQL dialect (mysql, postgresql, sqlite, sqlserver)
 * @returns {string} - Generated SQL script
 */
exports.generateSQL = async (schema, dialect = 'mysql') => {
  try {
    logger.info(`Generating ${dialect} SQL script for schema: ${schema.name}`);
    
    // Get the appropriate generator for the dialect
    const generator = getDialectGenerator(dialect);
    
    // Create a list to hold all SQL statements
    const statements = [];
    
    // Add the header comment
    statements.push(generator.headerComment(schema));
    
    // Pre-process the schema (e.g., handle many-to-many relationships)
    const processedSchema = preprocessSchema(schema, dialect);
    
    // Generate DROP statements for easier script re-running (with IF EXISTS)
    if (generator.generateDropStatements) {
      const dropStatements = generator.generateDropStatements(processedSchema);
      statements.push(...dropStatements);
    }
    
    // Generate CREATE TYPE statements for PostgreSQL enum types
    if (dialect === 'postgresql' && generator.generateEnumTypes) {
      const enumStatements = generator.generateEnumTypes(processedSchema);
      if (enumStatements.length > 0) {
        statements.push(...enumStatements);
      }
    }
    
    // Generate CREATE TABLE statements
    const tableStatements = processedSchema.tables.map(table => 
      generator.createTableStatement(table, processedSchema)
    );
    statements.push(...tableStatements);
    
    // Generate foreign key constraints as ALTER TABLE statements for dialects that need them separately
    const alterTableStatements = [];
    if (dialect === 'sqlserver' || dialect === 'sqlite') {
      processedSchema.tables.forEach(table => {
        const foreignKeys = getForeignKeyConstraints(table, processedSchema);
        if (foreignKeys.length > 0) {
          foreignKeys.forEach(fk => {
            alterTableStatements.push(
              generator.addForeignKeyStatement(table.name, fk)
            );
          });
        }
      });
      
      if (alterTableStatements.length > 0) {
        statements.push(...alterTableStatements);
      }
    }
    
    // Generate indexes
    const indexStatements = processedSchema.tables.flatMap(table => 
      generator.createIndexStatements(table, processedSchema)
    );
    
    if (indexStatements.length > 0) {
      statements.push(...indexStatements);
    }
    
    // Generate views if the dialect supports them
    if (generator.createViewStatements) {
      const viewStatements = generator.createViewStatements(processedSchema);
      if (viewStatements.length > 0) {
        statements.push(...viewStatements);
      }
    }
    
    // Generate stored procedures if the dialect supports them
    if (generator.createStoredProcedures) {
      const procedureStatements = generator.createStoredProcedures(processedSchema);
      if (procedureStatements.length > 0) {
        statements.push(...procedureStatements);
      }
    }
    
    // Generate triggers if the dialect supports them
    if (generator.createTriggerStatements) {
      const triggerStatements = generator.createTriggerStatements(processedSchema);
      if (triggerStatements.length > 0) {
        statements.push(...triggerStatements);
      }
    }
    
    // Generate initial data inserts for lookup tables
    const insertStatements = processedSchema.tables
      .filter(table => table.isLookupTable)
      .flatMap(table => generator.generateSeedData ? generator.generateSeedData(table) : []);
    
    if (insertStatements.length > 0) {
      statements.push(...insertStatements);
    }
    
    // Add footer (e.g., COMMIT for transactions)
    if (generator.footerComment) {
      statements.push(generator.footerComment(processedSchema));
    }
    
    // Format the SQL for readability
    // Map sqlserver dialect to tsql for the formatter
    const formatterDialect = dialect.toLowerCase() === 'sqlserver' ? 'tsql' : dialect;
    
    // Join statements and format the SQL
    const joinedSql = statements.join('\n\n');
    let sql;
    
    try {
      sql = format(joinedSql, { 
        language: formatterDialect,
        keywordCase: 'upper',
        indentStyle: 'standard',
        logicalOperatorNewline: 'before',
        expressionWidth: 80
      });
    } catch (formatError) {
      logger.warn(`SQL formatting failed for dialect ${dialect}, returning unformatted SQL: ${formatError.message}`);
      // Return the unformatted SQL if formatting fails
      sql = joinedSql;
    }
    
    logger.info(`SQL generation complete for schema: ${schema.name}`);
    
    return sql;
  } catch (error) {
    logger.error('Error generating SQL:', error);
    throw new Error(`Failed to generate SQL script: ${error.message}`);
  }
};

/**
 * Preprocess schema to handle special cases like many-to-many relationships
 * @param {Object} schema - Original schema
 * @param {string} dialect - SQL dialect
 * @returns {Object} - Processed schema
 */
function preprocessSchema(schema, dialect) {
  // Create a deep copy of the schema to avoid modifying the original
  const processedSchema = JSON.parse(JSON.stringify(schema));
  
  // Handle many-to-many relationships by creating junction tables
  const manyToManyRelationships = processedSchema.relationships.filter(rel => 
    rel.type === 'MANY_TO_MANY'
  );
  
  // Create junction tables for many-to-many relationships
  manyToManyRelationships.forEach(relationship => {
    // Find the source and target tables
    const sourceTable = processedSchema.tables.find(t => t.name === relationship.sourceTable);
    const targetTable = processedSchema.tables.find(t => t.name === relationship.targetTable);
    
    if (!sourceTable || !targetTable) {
      logger.warn(`Missing tables for many-to-many relationship: ${relationship.name}`);
      return;
    }
    
    // Get primary keys
    const sourcePK = sourceTable.columns.find(c => c.isPrimaryKey) || { name: 'id', dataType: 'INTEGER' };
    const targetPK = targetTable.columns.find(c => c.isPrimaryKey) || { name: 'id', dataType: 'INTEGER' };
    
    // Create junction table name
    const junctionTableName = `${sourceTable.name}_${targetTable.name}`;
    
    // Check if the junction table already exists
    if (processedSchema.tables.some(t => t.name === junctionTableName)) {
      logger.info(`Junction table ${junctionTableName} already exists`);
      return;
    }
    
    // Create junction table
    const junctionTable = {
      name: junctionTableName,
      description: `Junction table for many-to-many relationship between ${sourceTable.name} and ${targetTable.name}`,
      columns: [
        // Source foreign key
        {
          name: `${sourceTable.name}_${sourcePK.name}`,
          dataType: sourcePK.dataType,
          isPrimaryKey: true, // Part of composite primary key
          isForeignKey: true,
          isNullable: false,
          isUnique: false,
          references: {
            table: sourceTable.name,
            column: sourcePK.name,
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
          },
          description: `Foreign key reference to ${sourceTable.name}`
        },
        // Target foreign key
        {
          name: `${targetTable.name}_${targetPK.name}`,
          dataType: targetPK.dataType,
          isPrimaryKey: true, // Part of composite primary key
          isForeignKey: true,
          isNullable: false,
          isUnique: false,
          references: {
            table: targetTable.name,
            column: targetPK.name,
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
          },
          description: `Foreign key reference to ${targetTable.name}`
        },
        // Add any relationship attributes as columns
        ...(relationship.attributes || []).map(attr => ({
          name: attr.name,
          dataType: attr.dataType || 'VARCHAR(255)',
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: attr.isNullable !== false,
          isUnique: !!attr.isUnique,
          description: attr.description || `${attr.name} attribute`
        })),
        // Add standard timestamps
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
      ],
      isJunctionTable: true
    };
    
    // Add the junction table to the schema
    processedSchema.tables.push(junctionTable);
    
    // Remove the many-to-many relationship as it's now represented by the junction table
    // and create two one-to-many relationships instead
    
    // Create one-to-many relationship from source to junction
    const sourceToJunction = {
      name: `${relationship.name}_source`,
      sourceTable: sourceTable.name,
      sourceEntity: relationship.sourceEntity,
      targetTable: junctionTable.name,
      targetEntity: junctionTable.name,
      sourceColumn: sourcePK.name,
      targetColumn: `${sourceTable.name}_${sourcePK.name}`,
      type: 'ONE_TO_MANY',
      isIdentifying: true,
      description: `One-to-many relationship from ${sourceTable.name} to junction table`,
      sourceCardinality: '1..1',
      targetCardinality: '0..*',
      sourceParticipation: 'PARTIAL',
      targetParticipation: 'TOTAL'
    };
    
    // Create one-to-many relationship from target to junction
    const targetToJunction = {
      name: `${relationship.name}_target`,
      sourceTable: targetTable.name,
      sourceEntity: relationship.targetEntity,
      targetTable: junctionTable.name,
      targetEntity: junctionTable.name,
      sourceColumn: targetPK.name,
      targetColumn: `${targetTable.name}_${targetPK.name}`,
      type: 'ONE_TO_MANY',
      isIdentifying: true,
      description: `One-to-many relationship from ${targetTable.name} to junction table`,
      sourceCardinality: '1..1',
      targetCardinality: '0..*',
      sourceParticipation: 'PARTIAL',
      targetParticipation: 'TOTAL'
    };
    
    // Find the index of the original relationship
    const relIndex = processedSchema.relationships.findIndex(rel => 
      rel.sourceTable === relationship.sourceTable && 
      rel.targetTable === relationship.targetTable &&
      rel.type === 'MANY_TO_MANY'
    );
    
    if (relIndex !== -1) {
      // Replace the many-to-many relationship with the two one-to-many relationships
      processedSchema.relationships.splice(relIndex, 1, sourceToJunction, targetToJunction);
    } else {
      // If not found (shouldn't happen), just add the new relationships
      processedSchema.relationships.push(sourceToJunction, targetToJunction);
    }
  });
  
  return processedSchema;
}

/**
 * Get the appropriate SQL generator for the given dialect
 * @param {string} dialect - SQL dialect
 * @returns {Object} - Dialect-specific generator
 */
function getDialectGenerator(dialect) {
  const generators = {
    mysql: require('./dialects/mysql.generator'),
    postgresql: require('./dialects/postgresql.generator'),
    sqlite: require('./dialects/sqlite.generator'),
    sqlserver: require('./dialects/sqlserver.generator')
  };
  
  // Normalize dialect name
  const normalizedDialect = dialect.toLowerCase();
  
  // Return the appropriate generator or MySQL as default
  return generators[normalizedDialect] || generators.mysql;
}

/**
 * Extract foreign key constraints from a table
 * @param {Object} table - Table object
 * @param {Object} schema - Full schema
 * @returns {Array} - Foreign key constraints
 */
function getForeignKeyConstraints(table, schema) {
  return table.columns
    .filter(column => column.isForeignKey && column.references)
    .map(column => ({
      columnName: column.name,
      referenceTable: column.references.table,
      referenceColumn: column.references.column,
      onDelete: column.references.onDelete || 'NO ACTION',
      onUpdate: column.references.onUpdate || 'NO ACTION',
      constraintName: `fk_${table.name}_${column.name}`
    }));
}

module.exports = exports;
