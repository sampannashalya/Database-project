const logger = require('../utils/logger');

/**
 * Generate documentation for a database schema
 * @param {Object} schema - Database schema
 * @param {string} format - Documentation format (markdown, html, pdf)
 * @returns {string} - Generated documentation
 */
exports.generateDocumentation = async (schema, format = 'markdown') => {
  try {
    logger.info(`Generating ${format} documentation for schema: ${schema.name}`);
    
    // Choose the appropriate generator based on format
    let documentationContent;
    switch (format.toLowerCase()) {
      case 'html':
        documentationContent = generateHtmlDocumentation(schema);
        break;
      case 'pdf':
        // In a real implementation, this would generate a PDF
        // For now, we'll just generate Markdown
        documentationContent = generateMarkdownDocumentation(schema);
        break;
      case 'markdown':
      default:
        documentationContent = generateMarkdownDocumentation(schema);
        break;
    }
    
    logger.info(`Documentation generation complete for schema: ${schema.name}`);
    
    return documentationContent;
  } catch (error) {
    logger.error('Error generating documentation:', error);
    throw new Error(`Failed to generate documentation: ${error.message}`);
  }
};

/**
 * Generate Markdown documentation for a schema
 * @param {Object} schema - Database schema
 * @returns {string} - Markdown documentation
 */
function generateMarkdownDocumentation(schema) {
  let markdown = `# Database Schema: ${schema.name}\n\n`;
  
  // Add schema description
  if (schema.description) {
    markdown += `${schema.description}\n\n`;
  }
  
  markdown += `## Overview\n\n`;
  markdown += `This schema contains ${schema.tables.length} tables and ${schema.relationships.length} relationships.\n\n`;
  
  // Table of contents
  markdown += `## Table of Contents\n\n`;
  markdown += `- [Tables](#tables)\n`;
  schema.tables.forEach(table => {
    markdown += `  - [${table.name}](#${table.name.toLowerCase().replace(/\s+/g, '-')})\n`;
  });
  markdown += `- [Relationships](#relationships)\n`;
  markdown += `- [ER Diagram](#er-diagram)\n\n`;
  
  // Tables
  markdown += `## Tables\n\n`;
  schema.tables.forEach(table => {
    markdown += `### ${table.name}\n\n`;
    
    if (table.description) {
      markdown += `${table.description}\n\n`;
    }
    
    // Add entity type information
    if (table.isWeakEntity) {
      markdown += `**Entity Type:** Weak Entity *(depends on another entity for identification)*\n\n`;
    } else if (table.isLookupTable) {
      markdown += `**Entity Type:** Lookup/Reference Table\n\n`;
    } else {
      markdown += `**Entity Type:** Strong Entity\n\n`;
    }
    
    markdown += `#### Columns\n\n`;
    markdown += `| Name | Data Type | Primary Key | Foreign Key | Nullable | Unique | Default | Description |\n`;
    markdown += `| ---- | --------- | :---------: | :---------: | :------: | :----: | ------- | ----------- |\n`;
    
    table.columns.forEach(column => {
      const isPrimaryKey = column.isPrimaryKey ? '✓' : '';
      const isForeignKey = column.isForeignKey ? '✓' : '';
      const isNullable = column.isNullable !== false ? '✓' : '';
      const isUnique = column.isUnique ? '✓' : '';
      const defaultValue = column.defaultValue || '';
      const description = column.description || '';
      
      markdown += `| ${column.name} | ${column.dataType} | ${isPrimaryKey} | ${isForeignKey} | ${isNullable} | ${isUnique} | ${defaultValue} | ${description} |\n`;
    });
    
    // Add foreign key references if any
    const foreignKeyColumns = table.columns.filter(col => col.isForeignKey && col.references);
    if (foreignKeyColumns.length > 0) {
      markdown += `\n#### Foreign Key References\n\n`;
      markdown += `| Column | References | On Delete | On Update |\n`;
      markdown += `| ------ | ---------- | --------- | --------- |\n`;
      
      foreignKeyColumns.forEach(column => {
        if (column.references) {
          const references = `${column.references.table}.${column.references.column}`;
          const onDelete = column.references.onDelete || 'NO ACTION';
          const onUpdate = column.references.onUpdate || 'NO ACTION';
          
          markdown += `| ${column.name} | ${references} | ${onDelete} | ${onUpdate} |\n`;
        }
      });
    }
    
    markdown += `\n`;
  });
  
  // Relationships
  markdown += `## Relationships\n\n`;
  markdown += `| Source Entity | Relationship | Target Entity | Type | Source Cardinality | Target Cardinality | Identifying | Description |\n`;
  markdown += `| ------------- | ------------ | ------------- | ---- | ----------------- | ----------------- | :---------: | ----------- |\n`;
  
  schema.relationships.forEach(relationship => {
    const relationshipType = formatRelationshipType(relationship.type);
    const sourceEntity = relationship.sourceEntity || relationship.sourceTable;
    const targetEntity = relationship.targetEntity || relationship.targetTable;
    const description = relationship.description || '';
    const sourceCardinality = relationship.sourceCardinality || getCardinalityFromType(relationship.type, 'source');
    const targetCardinality = relationship.targetCardinality || getCardinalityFromType(relationship.type, 'target');
    const isIdentifying = relationship.isIdentifying ? '✓' : '';
    
    markdown += `| ${sourceEntity} | ${relationship.name || 'relates to'} | ${targetEntity} | ${relationshipType} | ${sourceCardinality} | ${targetCardinality} | ${isIdentifying} | ${description} |\n`;
  });
  
  // Add relationship attributes if any exist
  const relationshipsWithAttributes = schema.relationships.filter(rel => 
    rel.attributes && Array.isArray(rel.attributes) && rel.attributes.length > 0
  );
  
  if (relationshipsWithAttributes.length > 0) {
    markdown += `\n### Relationship Attributes\n\n`;
    
    relationshipsWithAttributes.forEach(relationship => {
      const sourceEntity = relationship.sourceEntity || relationship.sourceTable;
      const targetEntity = relationship.targetEntity || relationship.targetTable;
      
      markdown += `#### ${relationship.name || 'Relationship'} (${sourceEntity} to ${targetEntity})\n\n`;
      
      markdown += `| Attribute | Data Type | Description |\n`;
      markdown += `| --------- | --------- | ----------- |\n`;
      
      relationship.attributes.forEach(attr => {
        markdown += `| ${attr.name} | ${attr.dataType || ''} | ${attr.description || ''} |\n`;
      });
      
      markdown += `\n`;
    });
  }
  
  // ER Diagram section
  markdown += `## ER Diagram\n\n`;
  markdown += `The Entity-Relationship Diagram for this schema can be visualized using the ERD Diagram viewer in the application. The diagram represents:\n\n`;
  markdown += `- Entities (tables) as rectangles\n`;
  markdown += `- Attributes as ellipses connected to their entities\n`;
  markdown += `- Relationships as diamonds connecting entities\n`;
  markdown += `- Cardinality constraints shown on the connection lines\n`;
  markdown += `- Primary keys indicated with underlined attribute names\n`;
  markdown += `- Foreign keys shown with references to their target entities\n`;
  markdown += `- Weak entities displayed with double-bordered rectangles\n\n`;
  
  // Add note about schema generation
  markdown += `\n## Notes\n\n`;
  markdown += `- This documentation was automatically generated by LaymanDB.\n`;
  markdown += `- Schema creation date: ${formatDate(schema.createdAt)}\n`;
  markdown += `- Last updated: ${formatDate(schema.updatedAt)}\n`;
  markdown += `- Schema version: ${schema.version || 1}\n\n`;
  
  return markdown;
}

/**
 * Generate HTML documentation for a schema
 * @param {Object} schema - Database schema
 * @returns {string} - HTML documentation
 */
function generateHtmlDocumentation(schema) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Database Schema: ${schema.name}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3, h4 {
      color: #2c3e50;
      margin-top: 1.5em;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 20px;
      font-size: 0.9em;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .table-container {
      margin-bottom: 30px;
      padding: 15px;
      border-radius: 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      background-color: #ffffff;
    }
    .toc {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .toc ul {
      list-style-type: none;
      padding-left: 20px;
    }
    .toc a {
      color: #3b82f6;
      text-decoration: none;
    }
    .toc a:hover {
      text-decoration: underline;
    }
    .primary-key {
      background-color: #e8f4f8;
    }
    .foreign-key {
      background-color: #f8f4e8;
    }
    .weak-entity {
      border-left: 4px solid #f59e0b;
      padding-left: 15px;
    }
    .lookup-table {
      border-left: 4px solid #10b981;
      padding-left: 15px;
    }
    .strong-entity {
      border-left: 4px solid #3b82f6;
      padding-left: 15px;
    }
    .relationship-type {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      background-color: #dbeafe;
      color: #1e40af;
      font-size: 0.8em;
      font-weight: 600;
    }
    .identifying-relationship {
      background-color: #fef3c7;
      color: #92400e;
    }
    .entity-type-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      margin-left: 10px;
      font-size: 0.8em;
      font-weight: 600;
    }
    .weak-entity-badge {
      background-color: #fef3c7;
      color: #92400e;
    }
    .lookup-entity-badge {
      background-color: #d1fae5;
      color: #065f46;
    }
    .strong-entity-badge {
      background-color: #dbeafe;
      color: #1e40af;
    }
    .center-text {
      text-align: center;
    }
    .text-success {
      color: #22c55e;
      font-weight: bold;
    }
    .timestamp {
      font-size: 0.9em;
      color: #6b7280;
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
    }
    .note {
      background-color: #f9fafb;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #3b82f6;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <h1>Database Schema: ${schema.name}</h1>
  
  ${schema.description ? `<p>${schema.description}</p>` : ''}
  
  <h2>Overview</h2>
  <p>This schema contains ${schema.tables.length} tables and ${schema.relationships.length} relationships.</p>
  
  <div class="toc">
    <h2>Table of Contents</h2>
    <ul>
      <li><a href="#tables">Tables</a>
        <ul>
          ${schema.tables.map(table => `<li><a href="#${table.name.toLowerCase().replace(/\s+/g, '-')}">${table.name}</a></li>`).join('\n          ')}
        </ul>
      </li>
      <li><a href="#relationships">Relationships</a></li>
      <li><a href="#er-diagram">ER Diagram</a></li>
      <li><a href="#notes">Notes</a></li>
    </ul>
  </div>
  
  <h2 id="tables">Tables</h2>`;
  
  // Tables
  schema.tables.forEach(table => {
    let entityTypeClass = 'strong-entity';
    let entityTypeBadge = '<span class="entity-type-badge strong-entity-badge">Strong Entity</span>';
    
    if (table.isWeakEntity) {
      entityTypeClass = 'weak-entity';
      entityTypeBadge = '<span class="entity-type-badge weak-entity-badge">Weak Entity</span>';
    } else if (table.isLookupTable) {
      entityTypeClass = 'lookup-table';
      entityTypeBadge = '<span class="entity-type-badge lookup-entity-badge">Lookup Table</span>';
    }
    
    html += `
  <div class="table-container ${entityTypeClass}">
    <h3 id="${table.name.toLowerCase().replace(/\s+/g, '-')}">${table.name} ${entityTypeBadge}</h3>
    
    ${table.description ? `<p>${table.description}</p>` : ''}
    
    <h4>Columns</h4>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Data Type</th>
          <th class="center-text">Primary Key</th>
          <th class="center-text">Foreign Key</th>
          <th class="center-text">Nullable</th>
          <th class="center-text">Unique</th>
          <th>Default</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${table.columns.map(column => {
          const rowClass = column.isPrimaryKey ? 'primary-key' : (column.isForeignKey ? 'foreign-key' : '');
          return `<tr class="${rowClass}">
          <td>${column.name}</td>
          <td>${column.dataType}</td>
          <td class="center-text">${column.isPrimaryKey ? '<span class="text-success">✓</span>' : ''}</td>
          <td class="center-text">${column.isForeignKey ? '<span class="text-success">✓</span>' : ''}</td>
          <td class="center-text">${column.isNullable !== false ? '<span class="text-success">✓</span>' : ''}</td>
          <td class="center-text">${column.isUnique ? '<span class="text-success">✓</span>' : ''}</td>
          <td>${column.defaultValue || ''}</td>
          <td>${column.description || ''}</td>
        </tr>`;
        }).join('\n        ')}
      </tbody>
    </table>`;
    
    // Add foreign key references if any
    const foreignKeyColumns = table.columns.filter(col => col.isForeignKey && col.references);
    if (foreignKeyColumns.length > 0) {
      html += `
    <h4>Foreign Key References</h4>
    <table>
      <thead>
        <tr>
          <th>Column</th>
          <th>References</th>
          <th>On Delete</th>
          <th>On Update</th>
        </tr>
      </thead>
      <tbody>
        ${foreignKeyColumns.map(column => {
          if (column.references) {
            const references = `${column.references.table}.${column.references.column}`;
            const onDelete = column.references.onDelete || 'NO ACTION';
            const onUpdate = column.references.onUpdate || 'NO ACTION';
            
            return `<tr>
            <td>${column.name}</td>
            <td>${references}</td>
            <td>${onDelete}</td>
            <td>${onUpdate}</td>
          </tr>`;
          }
          return '';
        }).join('\n        ')}
      </tbody>
    </table>`;
    }
    
    html += `
  </div>`;
  });
  
  // Relationships
  html += `
  <h2 id="relationships">Relationships</h2>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Source Entity</th>
          <th>Relationship</th>
          <th>Target Entity</th>
          <th>Type</th>
          <th>Source Cardinality</th>
          <th>Target Cardinality</th>
          <th class="center-text">Identifying</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${schema.relationships.map(relationship => {
          const relationshipType = formatRelationshipType(relationship.type);
          const sourceEntity = relationship.sourceEntity || relationship.sourceTable;
          const targetEntity = relationship.targetEntity || relationship.targetTable;
          const description = relationship.description || '';
          const sourceCardinality = relationship.sourceCardinality || getCardinalityFromType(relationship.type, 'source');
          const targetCardinality = relationship.targetCardinality || getCardinalityFromType(relationship.type, 'target');
          const isIdentifying = relationship.isIdentifying;
          const relationshipClass = isIdentifying ? 'identifying-relationship' : '';
          
          return `<tr>
          <td>${sourceEntity}</td>
          <td>${relationship.name || 'relates to'}</td>
          <td>${targetEntity}</td>
          <td><span class="relationship-type ${relationshipClass}">${relationshipType}</span></td>
          <td>${sourceCardinality}</td>
          <td>${targetCardinality}</td>
          <td class="center-text">${isIdentifying ? '<span class="text-success">✓</span>' : ''}</td>
          <td>${description}</td>
        </tr>`;
        }).join('\n        ')}
      </tbody>
    </table>
  </div>`;
  
  // Add relationship attributes if any exist
  const relationshipsWithAttributes = schema.relationships.filter(rel => 
    rel.attributes && Array.isArray(rel.attributes) && rel.attributes.length > 0
  );
  
  if (relationshipsWithAttributes.length > 0) {
    html += `
  <h3>Relationship Attributes</h3>`;
    
    relationshipsWithAttributes.forEach(relationship => {
      const sourceEntity = relationship.sourceEntity || relationship.sourceTable;
      const targetEntity = relationship.targetEntity || relationship.targetTable;
      
      html += `
  <div class="table-container">
    <h4>${relationship.name || 'Relationship'} (${sourceEntity} to ${targetEntity})</h4>
    <table>
      <thead>
        <tr>
          <th>Attribute</th>
          <th>Data Type</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${relationship.attributes.map(attr => `<tr>
          <td>${attr.name}</td>
          <td>${attr.dataType || ''}</td>
          <td>${attr.description || ''}</td>
        </tr>`).join('\n        ')}
      </tbody>
    </table>
  </div>`;
    });
  }
  
  // ER Diagram section
  html += `
  <h2 id="er-diagram">ER Diagram</h2>
  <div class="table-container">
    <p>The Entity-Relationship Diagram for this schema can be visualized using the ERD Diagram viewer in the application. The diagram represents:</p>
    <ul>
      <li>Entities (tables) as rectangles</li>
      <li>Attributes as ellipses connected to their entities</li>
      <li>Relationships as diamonds connecting entities</li>
      <li>Cardinality constraints shown on the connection lines</li>
      <li>Primary keys indicated with underlined attribute names</li>
      <li>Foreign keys shown with references to their target entities</li>
      <li>Weak entities displayed with double-bordered rectangles</li>
    </ul>
  </div>
  
  <h2 id="notes">Notes</h2>
  <div class="note">
    <p>This documentation was automatically generated by LaymanDB.</p>
    <p>Schema creation date: ${formatDate(schema.createdAt)}</p>
    <p>Last updated: ${formatDate(schema.updatedAt)}</p>
    <p>Schema version: ${schema.version || 1}</p>
  </div>
  
  <div class="timestamp">
    <p>Generated on: ${formatDate(new Date())}</p>
  </div>
</body>
</html>`;
  
  return html;
}

/**
 * Format relationship type for display
 * @param {string} type - Relationship type
 * @returns {string} - Formatted relationship type
 */
function formatRelationshipType(type) {
  if (!type) return 'Undefined';
  
  switch (type.toUpperCase()) {
    case 'ONE_TO_ONE':
      return 'One-to-One (1:1)';
    case 'ONE_TO_MANY':
      return 'One-to-Many (1:N)';
    case 'MANY_TO_ONE':
      return 'Many-to-One (N:1)';
    case 'MANY_TO_MANY':
      return 'Many-to-Many (N:M)';
    default:
      return type;
  }
}

/**
 * Get cardinality notation based on relationship type and side
 * @param {string} type - Relationship type
 * @param {string} side - 'source' or 'target'
 * @returns {string} - Cardinality notation
 */
function getCardinalityFromType(type, side) {
  if (!type) return '1';
  
  switch (type.toUpperCase()) {
    case 'ONE_TO_ONE':
      return '1';
    case 'ONE_TO_MANY':
      return side === 'source' ? '1' : 'N';
    case 'MANY_TO_ONE':
      return side === 'source' ? 'N' : '1';
    case 'MANY_TO_MANY':
      return side === 'source' ? 'M' : 'N';
    default:
      return '1';
  }
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date
 */
function formatDate(date) {
  if (!date) return 'Unknown';
  
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }
  
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return d.toLocaleDateString('en-US', options);
}

module.exports = exports;
