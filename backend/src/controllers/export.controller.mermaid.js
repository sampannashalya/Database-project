/**
 * Mermaid ER Diagram Generator Service
 * Converts schema objects to Mermaid ER diagram syntax
 */

class MermaidGeneratorService {
  /**
   * Auto-format and repair common Mermaid syntax issues
   * @param {String} mermaidSyntax - The Mermaid syntax to format/repair
   * @returns {String} - The formatted/repaired Mermaid syntax
   */
  autoFormatMermaidSyntax(mermaidSyntax) {
    if (!mermaidSyntax) return mermaidSyntax;
    
    let formatted = mermaidSyntax;
    
    // Remove any "required" keywords that are invalid in Mermaid
    formatted = formatted.replace(/\s+required/g, '');
    
    // Fix common formatting issues - ensure entity definitions are properly separated
    // 1. Fix missing newlines before closing braces and between entities
    formatted = formatted.replace(/(\w+\s+\w+\s*(?:PK|FK)?\s*)\s*}(\w+)/g, '$1\n    }\n\n    $2');
    
    // 2. Fix missing newlines between entity blocks
    formatted = formatted.replace(/}\s*(\w+)\s*{/g, '}\n\n    $1 {');
    
    // 3. Ensure proper indentation of entity definitions
    const lines = formatted.split('\n');
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) {
        result.push('');
        continue;
      }
      
      // Handle erDiagram declaration
      if (trimmed === 'erDiagram') {
        result.push(trimmed);
        continue;
      }
      
      // Handle entity declarations
      if (/^\w+\s*{$/.test(trimmed)) {
        result.push('    ' + trimmed);
        continue;
      }
      
      // Handle closing braces
      if (trimmed === '}') {
        result.push('    }');
        continue;
      }
      
      // Handle attributes inside entities - remove any "required" keywords
      if (/^\w+\s+\w+/.test(trimmed) && !trimmed.includes('--')) {
        const cleanAttribute = trimmed.replace(/\s+required/g, '');
        result.push('        ' + cleanAttribute);
        continue;
      }
      
      // Handle relationships
      if (trimmed.includes('--')) {
        result.push('    ' + trimmed);
        continue;
      }
      
      // Handle comments
      if (trimmed.startsWith('%%')) {
        result.push('    ' + trimmed);
        continue;
      }
      
      // Default case
      result.push(line);
    }
    
    return result.join('\n');
  }
  
  /**
   * Generate Mermaid ER diagram syntax from a schema object
   * @param {Object} schema - The schema object with tables and relationships
   * @returns {String} - Mermaid ER diagram syntax
   */
  generateMermaidERD(schema) {
    if (!schema || !schema.tables || !Array.isArray(schema.tables)) {
      throw new Error('Invalid schema structure');
    }

    let mermaidSyntax = 'erDiagram\n';
    
    // Process all entities (tables)
    schema.tables.forEach(table => {
      // Add entity definitions with attributes
      mermaidSyntax += this.generateEntityDefinition(table);
    });
    
    // Process all relationships
    if (schema.relationships && Array.isArray(schema.relationships)) {
      schema.relationships.forEach(relationship => {
        mermaidSyntax += this.generateRelationshipDefinition(relationship);
      });
    }
    
    // Auto-format the syntax to fix any formatting issues
    mermaidSyntax = this.autoFormatMermaidSyntax(mermaidSyntax);
    
    // Validate the generated syntax
    const validation = this.validateMermaidSyntax(mermaidSyntax);
    if (!validation.isValid) {
      console.warn('Mermaid syntax validation warnings:', validation.errors);
      // Add validation warnings as comments to the diagram
      mermaidSyntax += '\n    %% Validation Warnings:\n';
      validation.errors.forEach(error => {
        mermaidSyntax += `    %% - ${error}\n`;
      });
    }
    
    return mermaidSyntax;
  }
  
  /**
   * Generate Mermaid entity definition with attributes
   * @param {Object} table - The table/entity object
   * @returns {String} - Mermaid entity definition
   */
  generateEntityDefinition(table) {
    if (!table || !table.name) return '';
    
    let entityDef = '';
    
    // Add entity - consistently use lowercase for entity names
    const sanitizedTableName = this.sanitizeName(table.name).toLowerCase();
    
    // Start entity definition
    entityDef += `    ${sanitizedTableName} {\n`;
    
    // Add attributes
    if (table.columns && Array.isArray(table.columns)) {
      table.columns.forEach(column => {
        const dataType = this.mapDataType(column.dataType);
        const sanitizedColumnName = this.sanitizeName(column.name);
        
        // Build attribute line - ONLY include datatype and name
        let attributeLine = `        ${dataType} ${sanitizedColumnName}`;
        
        // Add key indicators ONLY (PK/FK are the only valid suffixes)
        if (column.primaryKey) {
          attributeLine += ' PK';
        } else if (column.foreignKey) {
          attributeLine += ' FK';
        }
        
        // CRITICAL: Do NOT add "required", "nullable", or any other keywords
        // Valid Mermaid ER syntax: datatype name [PK|FK]
        
        entityDef += attributeLine + '\n';
      });
    }
    
    // Close entity definition
    entityDef += '    }\n\n';
    
    return entityDef;
  }
  
  /**
   * Generate Mermaid relationship definition
   * @param {Object} relationship - The relationship object
   * @returns {String} - Mermaid relationship definition
   */
  generateRelationshipDefinition(relationship) {
    if (!relationship || !relationship.sourceEntity || !relationship.targetEntity) return '';
    
    const sourceEntity = this.sanitizeName(relationship.sourceEntity || relationship.sourceTable).toLowerCase();
    const targetEntity = this.sanitizeName(relationship.targetEntity || relationship.targetTable).toLowerCase();
    const relationshipName = relationship.name || 'relates';
    
    // Determine cardinality
    let sourceCardinality = '||';  // Default to one
    let targetCardinality = '||';  // Default to one
    
    if (relationship.cardinality) {
      // Parse cardinality from the schema
      if (relationship.cardinality.source === 'many') {
        sourceCardinality = '}o';
      } else if (relationship.cardinality.source === 'one') {
        sourceCardinality = '||';
      } else if (relationship.cardinality.source === 'zero-or-one') {
        sourceCardinality = '|o';
      }
      
      if (relationship.cardinality.target === 'many') {
        targetCardinality = 'o{';
      } else if (relationship.cardinality.target === 'one') {
        targetCardinality = '||';
      } else if (relationship.cardinality.target === 'zero-or-one') {
        targetCardinality = 'o|';
      }
    } else if (relationship.type) {
      // Use relationship type as fallback
      if (relationship.type === 'one-to-many') {
        sourceCardinality = '||';
        targetCardinality = 'o{';
      } else if (relationship.type === 'many-to-one') {
        sourceCardinality = '}o';
        targetCardinality = '||';
      } else if (relationship.type === 'many-to-many') {
        sourceCardinality = '}o';
        targetCardinality = 'o{';
      } else if (relationship.type === 'one-to-one') {
        sourceCardinality = '||';
        targetCardinality = '||';
      }
    }
    
    // Proper relationship syntax: entity cardinality--cardinality entity : "label"
    return `    ${sourceEntity} ${sourceCardinality}--${targetCardinality} ${targetEntity} : "${relationshipName}"\n`;
  }
  
  /**
   * Sanitize name for Mermaid compatibility
   * @param {String} name - The original name
   * @returns {String} - Sanitized name
   */
  sanitizeName(name) {
    if (!name) return 'unnamed';
    
    // Replace spaces and special characters with underscores
    // Keep only alphanumeric characters and underscores
    return name.replace(/[^\w]/g, '_').replace(/_{2,}/g, '_');
  }
  
  /**
   * Map data types to simplified Mermaid types
   * @param {String} dataType - Original data type
   * @returns {String} - Simplified type for Mermaid
   */
  mapDataType(dataType) {
    if (!dataType) return 'string';
    
    const lowerType = dataType.toLowerCase();
    
    if (lowerType.includes('int') || lowerType.includes('number') || lowerType.includes('decimal') || 
        lowerType.includes('float') || lowerType.includes('double') || lowerType.includes('numeric')) {
      return 'number';
    } else if (lowerType.includes('char') || lowerType.includes('text') || lowerType.includes('string') ||
               lowerType.includes('varchar') || lowerType.includes('uuid') || lowerType.includes('json')) {
      return 'string';
    } else if (lowerType.includes('date') || lowerType.includes('time') || lowerType.includes('timestamp')) {
      return 'date';
    } else if (lowerType.includes('bool')) {
      return 'boolean';
    } else {
      return 'string';  // Default to string for unknown types
    }
  }
  
  /**
   * Validate the final Mermaid syntax to catch common issues
   * @param {String} mermaidSyntax - The generated Mermaid syntax
   * @returns {Object} - Validation result with isValid and errors
   */
  validateMermaidSyntax(mermaidSyntax) {
    const result = {
      isValid: true,
      errors: []
    };
    
    // Check for empty diagram
    if (!mermaidSyntax || mermaidSyntax === 'erDiagram\n') {
      result.isValid = false;
      result.errors.push('Empty diagram: No entities or relationships defined');
      return result;
    }
    
    // Check for basic structural errors
    this.checkStructuralErrors(mermaidSyntax, result);
    
    // Extract entities for validation
    const entityMatches = mermaidSyntax.match(/^\s*(\w+)\s*{/gm) || [];
    const entityNames = entityMatches.map(match => {
      const entityName = match.trim().replace(/\s*{$/, '').trim();
      return entityName.toLowerCase();
    }).filter(Boolean);
    
    // Extract relationships and validate entity references
    const relationshipMatches = mermaidSyntax.match(/^\s*(\w+)\s+(\|\||}\o|\o\{|\|o|o\|)--(\|\||}\o|\o\{|\|o|o\|)\s+(\w+)/gm) || [];
    
    // Validate relationships reference existing entities
    for (const relationshipMatch of relationshipMatches) {
      const parts = relationshipMatch.trim().split(/\s+/);
      if (parts.length >= 4) {
        const sourceEntity = parts[0].toLowerCase();
        // Find target entity - it's after the cardinality symbols
        const targetEntity = parts[parts.length - 1].replace(/\s*:.*$/, '').toLowerCase();
        
        if (!entityNames.includes(sourceEntity)) {
          result.isValid = false;
          result.errors.push(`Relationship references undefined source entity: ${sourceEntity}`);
        }
        
        if (!entityNames.includes(targetEntity)) {
          result.isValid = false;
          result.errors.push(`Relationship references undefined target entity: ${targetEntity}`);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Check for structural syntax errors in the Mermaid diagram
   * @param {String} mermaidSyntax - The Mermaid syntax to check
   * @param {Object} result - The validation result object to update
   */
  checkStructuralErrors(mermaidSyntax, result) {
    const lines = mermaidSyntax.split('\n');
    const openBraces = [];
    const entities = [];
    let currentEntity = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('%%')) continue;
      
      // Skip erDiagram declaration
      if (trimmed === 'erDiagram') continue;
      
      // Check for entity definition start
      const entityMatch = trimmed.match(/^(\w+)\s*{$/);
      if (entityMatch) {
        currentEntity = entityMatch[1];
        entities.push(currentEntity);
        openBraces.push({ entity: currentEntity, line: i + 1 });
        continue;
      }
      
      // Check for entity definition end
      if (trimmed === '}') {
        if (openBraces.length === 0) {
          result.isValid = false;
          result.errors.push(`Unexpected closing brace on line ${i + 1} with no matching opening brace`);
        } else {
          openBraces.pop();
          currentEntity = null;
        }
        continue;
      }
      
      // Check for relationship definition
      const relationshipMatch = trimmed.match(/^(\w+)\s+(\|\||}\o|\o\{|\|o|o\|)--(\|\||}\o|\o\{|\|o|o\|)\s+(\w+)/);
      if (relationshipMatch && openBraces.length > 0) {
        result.isValid = false;
        result.errors.push(`Relationship defined inside entity block at line ${i + 1}. Close the entity definition first.`);
      }
      
      // Check for malformed attribute lines within entities
      if (openBraces.length > 0 && currentEntity) {
        // Attributes should follow the pattern: type name [PK/FK]
        const attributeMatch = trimmed.match(/^(\w+)\s+(\w+)(\s+(PK|FK))?$/);
        if (trimmed.length > 0 && !attributeMatch && !trimmed.startsWith('%%')) {
          result.isValid = false;
          result.errors.push(`Malformed attribute on line ${i + 1} in entity "${currentEntity}": "${trimmed}"`);
          result.errors.push(`Expected format: "datatype attribute_name [PK|FK]"`);
        }
      }
      
      // Check for incomplete relationship syntax
      if (trimmed.includes('--') && !relationshipMatch) {
        result.isValid = false;
        result.errors.push(`Malformed relationship on line ${i + 1}: "${trimmed}"`);
        result.errors.push(`Expected format: "entity1 cardinality--cardinality entity2 : \\"label\\""`);
      }
    }
    
    // Check for unclosed entity definitions
    if (openBraces.length > 0) {
      for (const brace of openBraces) {
        result.isValid = false;
        result.errors.push(`Unclosed entity definition for '${brace.entity}' started on line ${brace.line}`);
      }
    }
    
    // Check for duplicate entity definitions
    const entityCounts = {};
    for (const entity of entities) {
      entityCounts[entity] = (entityCounts[entity] || 0) + 1;
    }
    
    for (const [entity, count] of Object.entries(entityCounts)) {
      if (count > 1) {
        result.isValid = false;
        result.errors.push(`Duplicate entity definition: '${entity}' defined ${count} times`);
      }
    }
  }
}

module.exports = new MermaidGeneratorService();