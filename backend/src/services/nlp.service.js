const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const { openaiResponseLogger } = require('../utils/logger');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Helper function to sanitize JSON content with common errors
function sanitizeJSON(jsonString) {
  try {
    // If it's already valid JSON, return it as is
    JSON.parse(jsonString);
    return jsonString;
  } catch (e) {
    logger.info('Attempting to sanitize malformed JSON');
    
    // Make a copy to work with
    let result = jsonString;
    
    // Remove any markdown code block indicators
    result = result.replace(/```json/g, '').replace(/```/g, '');
    
    // Ensure the content starts and ends with curly braces
    result = result.trim();
    if (!result.startsWith('{')) {
      const firstBrace = result.indexOf('{');
      if (firstBrace >= 0) {
        result = result.substring(firstBrace);
      } else {
        result = '{' + result;
      }
    }
    
    if (!result.endsWith('}')) {
      const lastBrace = result.lastIndexOf('}');
      if (lastBrace >= 0) {
        result = result.substring(0, lastBrace + 1);
      } else {
        result = result + '}';
      }
    }
    
    // Fix unquoted property names
    result = result.replace(/([{,]\s*)([a-zA-Z0-9_$]+)(\s*:)/g, '$1"$2"$3');
    
    // Fix trailing commas in objects and arrays
    result = result.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix missing quotes around string values
    // This is trickier and might cause issues, so we're cautious
    // result = result.replace(/:(\s*)([^{}\[\]"'\d,\s][^,\s}]*)/g, ':"$2"');
    
    // Replace single quotes with double quotes (careful with nested quotes)
    result = result.replace(/:\s*'([^']*?)'/g, ':"$1"');
    
    // Handle any other specific issues found in the logs
    
    // Log the sanitized result
    logger.info('JSON after sanitization (first 100 chars):', result.substring(0, 100) + '...');
    
    // Verify it's now valid
    try {
      JSON.parse(result);
      logger.info('JSON sanitization successful');
      return result;
    } catch (parseError) {
      logger.error('JSON sanitization failed:', parseError);
      
      // As a last resort, try to construct a minimal valid JSON
      try {
        // Extract entities and relationships using regex
        const entitiesMatch = result.match(/"entities"\s*:\s*\[(.*?)\]/s);
        const relationshipsMatch = result.match(/"relationships"\s*:\s*\[(.*?)\]/s);
        
        let fallbackJSON = '{';
        if (entitiesMatch && entitiesMatch[1]) {
          fallbackJSON += '"entities": ' + fixArrayJSON(entitiesMatch[1]);
          if (relationshipsMatch && relationshipsMatch[1]) {
            fallbackJSON += ', "relationships": ' + fixArrayJSON(relationshipsMatch[1]);
          } else {
            fallbackJSON += ', "relationships": []';
          }
        } else {
          fallbackJSON += '"entities": [], "relationships": []';
        }
        fallbackJSON += '}';
        
        // Verify the fallback JSON
        JSON.parse(fallbackJSON);
        logger.info('Created fallback JSON structure');
        return fallbackJSON;
      } catch (fallbackError) {
        // If all else fails, return a minimal valid JSON structure
        logger.error('Fallback JSON creation failed:', fallbackError);
        return '{"entities":[],"relationships":[]}';
      }
    }
  }
}

// Helper to fix array JSON fragments
function fixArrayJSON(arrayContent) {
  try {
    JSON.parse('[' + arrayContent + ']');
    return '[' + arrayContent + ']';
  } catch (e) {
    // Simple fix for trailing commas
    let content = arrayContent.trim();
    if (content.endsWith(',')) {
      content = content.slice(0, -1);
    }
    
    try {
      JSON.parse('[' + content + ']');
      return '[' + content + ']';
    } catch (e2) {
      // Return empty array if we can't fix it
      return '[]';
    }
  }
}

// Make sure environment variables are loaded
dotenv.config();

// Initialize OpenAI client if API key is available
let openai;
try {
  // Check for API key in environment
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (apiKey) {
    console.log('Found OpenAI API key in environment variables. First few characters:', apiKey.substring(0, 7) + '...');
    logger.info('Found OpenAI API key in environment variables');
    
    // Configure with SSL certificate checking disabled for development environments
    // This should be removed in production for security reasons
    const httpsAgent = require('https').Agent({
      rejectUnauthorized: false, // Bypass SSL certificate validation
      timeout: 90000 // 90 second timeout
    });
    
    openai = new OpenAI({
      apiKey: apiKey,
      httpAgent: httpsAgent,
      timeout: 90000, // 90 second timeout
      maxRetries: 3 // Allow 3 retries on failures
    });
    logger.info('OpenAI client initialized successfully with SSL verification disabled');
  } else {
    // Try to read directly from .env file as a fallback
    try {
      const envPath = path.resolve(__dirname, '../../.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/OPENAI_API_KEY=([^\s\r\n]+)/);
        if (match && match[1]) {
          console.log('Found OpenAI API key in .env file. First few characters:', match[1].substring(0, 7) + '...');
          logger.info('Found OpenAI API key in .env file, using it directly');
          
          // Configure with SSL certificate checking disabled for development environments
          const httpsAgent = require('https').Agent({
            rejectUnauthorized: false, // Bypass SSL certificate validation
            timeout: 90000 // 90 second timeout
          });
          
          openai = new OpenAI({
            apiKey: match[1],
            httpAgent: httpsAgent,
            timeout: 90000, // 90 second timeout
            maxRetries: 3 // Allow 3 retries on failures
          });
          logger.info('OpenAI client initialized successfully from .env file with SSL verification disabled');
        } else {
          logger.warn('No OpenAI API key found in .env file');
        }
      } else {
        logger.warn('No .env file found');
      }
    } catch (readError) {
      logger.warn('Error reading .env file directly:', readError);
    }
    
    if (!openai) {
      logger.error('No OpenAI API key found in environment variables or .env file');
      throw new Error('OpenAI API key is required for entity extraction');
    }
  }
} catch (error) {
  logger.error('Error initializing OpenAI client:', error);
  throw error;
}

/**
 * Extract entities, relationships, and attributes from natural language input
 * @param {string} text - Natural language prompt about database design
 * @returns {Object} - Extracted entities, relationships and attributes
 */
exports.extractEntities = async (text) => {
  try {
    if (!openai) {
      throw new Error('OpenAI client is not initialized. Please check your API key configuration.');
    }

    logger.info('Using OpenAI for schema generation');
    const result = await processWithAI(text);
    logger.info('OpenAI processing successful');
    return result;
  } catch (error) {
    logger.error('Error extracting entities:', error);
    
    // Handle different types of errors
    if (error.message && error.message.includes('JSON')) {
      throw new Error(`JSON parsing error: ${error.message}`);
    } else if (error.cause && error.cause.code === 'CERT_HAS_EXPIRED') {
      throw new Error('SSL certificate has expired. This is a development environment issue.');
    } else if (error.message && error.message.includes('timeout')) {
      throw new Error('Request timed out. The model is taking too long to generate a response.');
    } else {
      throw new Error(`Failed to extract entities: ${error.message}`);
    }
  }
};

/**
 * Process text using OpenAI for entity extraction
 * @param {string} text - Natural language prompt
 * @returns {Object} - Extracted entities and relationships
 */
async function processWithAI(text) {
  try {
    // Use a cost-efficient model
    const model = "gpt-3.5-turbo-0125"; // Using the most efficient version of gpt-3.5-turbo
    logger.info(`Starting OpenAI API request with model: ${model}`);
    
    // Validate OpenAI client is available
    if (!openai) {
      throw new Error('OpenAI client is not initialized');
    }
    
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `You are an expert database designer tasked with converting natural language descriptions into formal database schemas. Follow these comprehensive database design principles:

## 1. CONCEPTUAL DESIGN ELEMENTS

### ENTITIES
- **Strong Entities**: Independent existence (Customer, Product)
- **Weak Entities**: Existence depends on another entity (Order Line depends on Order). Weak entities must be identified by setting "isWeakEntity": true
- **Lookup/Reference Entities**: Normalize attributes with fixed sets of values (Status, PaymentMethod)

### ATTRIBUTES
- **Simple**: Atomic values (name, age)
- **Composite**: Can be divided (address = street + city + state + zip)
- **Derived**: Calculated from other attributes (age from birthdate)
- **Multi-valued**: Multiple values for one entity (phone_numbers)
- **Required vs Optional**: NOT NULL vs NULL constraint
- **Domain constraints**: Valid value ranges or patterns
- **Default values**: Values used when none provided

### DATA TYPE INFERENCE RULES
- **Text/String Attributes**: names, titles, descriptions, addresses → VARCHAR(255) or TEXT
- **Numeric Attributes**: 
  - Integer values: counts, IDs, quantities → INTEGER
  - Decimal values: prices, rates, measurements → DECIMAL(10,2)
- **Date/Time Attributes**: dates, timestamps, durations → TIMESTAMP
- **Boolean Attributes**: flags, yes/no values, status indicators → BOOLEAN
- **Enumerated Values**: gender, status codes, categories → VARCHAR(255) (in lookup tables)
- **Binary Data**: images, files, media → BLOB (for MySQL) or BYTEA (for PostgreSQL)
- **JSON/Complex Data**: nested structures, flexible schemas → JSON or JSONB (PostgreSQL)

### KEYS
- **Primary Keys**: Unique entity identifiers (use 'id' for default or entity_id pattern)
- **Natural vs Surrogate**: Prefer surrogate keys (generated id) for stability
- **Candidate Keys**: Alternative unique identifiers (set isUnique: true)
- **Foreign Keys**: References to other entities (follow naming pattern: entityname_id)
- **Composite Keys**: Multiple attributes forming unique identifier

## 2. RELATIONSHIP TYPES

### RELATIONSHIP NAMING
- **Use Descriptive Verb Phrases**: Extract from relationship descriptions - "places orders" → "places", "manages projects" → "manages"
- **Direction Matters**: "employs" vs "works for" depending on perspective - be consistent with source→target direction
- **Use Present Tense**: "orders" not "ordered" 
- **Be Specific**: "teaches" is better than generic "has" or "associated with"
- **Derive Names From Descriptions**: Always extract the key action verb from relationship descriptions

### RELATIONSHIP CLASSIFICATION
- **Identifying Relationship**: Links a weak entity to its owner (strong entity). Must be specified by setting "isIdentifying": true
- **Non-Identifying Relationship**: Regular relationship between two entities

### CARDINALITY PATTERNS
- **One-to-One (1:1)**: Each entity relates to exactly one other (type: ONE_TO_ONE)
- **One-to-Many (1:N)**: One entity relates to multiple others (type: ONE_TO_MANY)
- **Many-to-One (N:1)**: Multiple entities relate to one (type: MANY_TO_ONE)
- **Many-to-Many (M:N)**: Multiple entities relate to multiple others (type: MANY_TO_MANY)

### PARTICIPATION CONSTRAINTS
- **Total**: Every entity instance participates in relationship (sourceParticipation: "TOTAL")
- **Partial**: Some entity instances may not participate (sourceParticipation: "PARTIAL")

## 3. SQL DATA TYPE CONSIDERATIONS
- Use specific SQL data types compatible with MySQL, PostgreSQL, SQLite, and SQL Server:
  - INTEGER, BIGINT for IDs and numeric values without decimals
  - DECIMAL(10,2) for monetary values and precise decimals
  - VARCHAR(255) for most text fields, TEXT for longer content
  - TIMESTAMP for date/time values
  - BOOLEAN for true/false values

Format the output as a detailed JSON object with these EXACT properties:

### entities
Array of objects with:
- name: entity name (PascalCase or camelCase)
- description: brief description of what this entity represents
- isWeakEntity: boolean (true/false) indicating if this is a weak entity that depends on another entity for identification
- attributes: array of objects with:
  - name: attribute name (camelCase)
  - dataType: SQL data type (VARCHAR(255), INTEGER, DECIMAL(10,2), TIMESTAMP, BOOLEAN, TEXT)
  - isPrimaryKey: boolean (true/false)
  - isForeignKey: boolean (true/false) 
  - isNullable: boolean (true/false)
  - isUnique: boolean (true/false)
  - defaultValue: default value if any (string)
  - description: brief description of the attribute
- position: object with isDraggable set to true

### relationships
Array of objects with:
- name: relationship name (specific and descriptive verb or action phrase extracted from the description)
- sourceEntity: name of the source entity
- targetEntity: name of the target entity
- type: one of "ONE_TO_ONE", "ONE_TO_MANY", "MANY_TO_ONE", "MANY_TO_MANY"
- isIdentifying: boolean (true/false) indicating if this is an identifying relationship for a weak entity
- sourceCardinality: cardinality of source (e.g., "1..1", "0..*")
- targetCardinality: cardinality of target (e.g., "1..1", "0..*")
- sourceParticipation: "TOTAL" or "PARTIAL"
- targetParticipation: "TOTAL" or "PARTIAL"
- description: brief description of the relationship
- attributes: array of relationship attributes (if relevant) with same structure as entity attributes
- position: object with isDraggable set to true

For a visually appealing and technically accurate ER diagram:

1. Be thorough in identifying entities - analyze the requirements deeply to find hidden entities
2. Create 5-10 entities for most systems (more for complex systems)
3. For each entity, include 3-5 important attributes that capture essential properties
4. Identify ALL relevant relationships between entities
5. Include lookup/reference tables for enumerated values

ENTITY DISCOVERY TECHNIQUES:
- Identify nouns in the requirements that represent business objects
- Look for collections of data or information that needs to be stored
- Consider system actors (users, customers, administrators) as entities
- Create lookup tables for status values, types, and categories
- Consider historical data tracking needs (logs, history, archives)
- Identify configuration and setting-related entities

ATTRIBUTE DISCOVERY TECHNIQUES:
- Add descriptive attributes (name, title, description)
- Add categorical attributes (type, status, category)
- Add quantitative attributes (count, amount, quantity)
- Add temporal attributes (date, time, duration)
- Add contact information when relevant (email, phone)
- Add location/spatial information when appropriate

RELATIONSHIP DISCOVERY TECHNIQUES:
- Connect related entities with proper cardinality
- Identify hierarchical relationships (parent-child) → name as "isParentOf"/"isChildOf"
- Identify compositional relationships (part-of) → name as "contains"/"isPartOf"
- Identify transactional relationships (creates, processes) → use the exact action verb
- Identify ownership/association relationships → name as "owns"/"belongsTo" not just "has"
- ALWAYS extract a meaningful verb from the relationship description for the relationship name

ALWAYS include the following for EACH entity:
1. A primary key attribute named 'id' with dataType 'INTEGER' if no natural primary key exists
2. Standard timestamps: created_at and updated_at with dataType 'TIMESTAMP'
3. Concise descriptions for each entity and attribute
4. Ensure all entities have properly configured attribute data types
5. Include several business attributes that accurately represent the entity's purpose

Ensure all relationships have meaningful names and correct cardinality settings. Foreign keys should be properly defined with clear reference to the target entity.`
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" }
    });
    
    logger.info('OpenAI API response received');
    
    if (!response.choices || response.choices.length === 0) {
      throw new Error('No choices returned from OpenAI API');
    }
    
    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error('Empty response content from OpenAI API');
    }
    
    try {
      // Attempt to sanitize JSON before parsing
      // First, check if the content starts and ends with curly braces
      let sanitizedContent = responseContent.trim();
      
      // Log the raw response content for debugging (first 100 chars)
      logger.info('Raw API response beginning:', sanitizedContent.substring(0, 100) + '...');
      
      // Try to fix common JSON syntax errors
      sanitizedContent = sanitizeJSON(sanitizedContent);
      
      // Parse the sanitized response
      const parsedResponse = JSON.parse(sanitizedContent);
      
      // Enhance relationship descriptions to ensure they display correctly
      if (parsedResponse.relationships && Array.isArray(parsedResponse.relationships)) {
        parsedResponse.relationships = parsedResponse.relationships.map(relationship => {
          // Make sure the description is human-readable and properly formatted
          if (relationship.description) {
            relationship.description = relationship.description.trim();
            
            // If relationship name is missing or generic, extract from description
            if (!relationship.name || ['has', 'relates_to', 'relates', 'belongs_to', 'associated_with'].includes(relationship.name.toLowerCase())) {
              // Extract a meaningful name from the description
              const description = relationship.description.toLowerCase();
              
              // Common patterns to extract verbs from descriptions
              const verbPatterns = [
                /can ([a-z]+) /i,                  // "can place", "can have"
                /([a-z]+)s to /i,                  // "belongs to"
                /is ([a-z]+)d? by/i,               // "is owned by", "is managed by"
                /([a-z]+)s multiple/i,             // "contains multiple"
                /([a-z]+)s many/i,                 // "has many"
                /([a-z]+)s the/i,                  // "processes the"
                /([a-z]+)s to/i                    // "relates to"
              ];
              
              // Try each pattern to extract a verb
              let extractedVerb = null;
              for (const pattern of verbPatterns) {
                const match = description.match(pattern);
                if (match && match[1]) {
                  extractedVerb = match[1];
                  break;
                }
              }
              
              // If a verb was found, use it as the relationship name
              if (extractedVerb && extractedVerb.length > 2) {
                relationship.name = extractedVerb;
              } else if (description.includes('belong')) {
                relationship.name = 'belongsTo';
              } else if (description.includes('contain')) {
                relationship.name = 'contains';
              } else if (description.includes('own')) {
                relationship.name = 'owns';
              } else if (description.includes('place')) {
                relationship.name = 'places';
              } else if (description.includes('manage')) {
                relationship.name = 'manages';
              } else if (relationship.type === 'MANY_TO_MANY') {
                relationship.name = 'participatesIn';
              } else if (relationship.type === 'ONE_TO_MANY') {
                relationship.name = 'has';
              } else {
                relationship.name = 'relatesTo';
              }
            }
          }
          
          // Ensure all components in the diagram are draggable by adding position property if missing
          if (!relationship.position) {
            relationship.position = { isDraggable: true };
          } else {
            relationship.position.isDraggable = true;
          }
          return relationship;
        });
      }
      
      // Ensure all entities are draggable
      if (parsedResponse.entities && Array.isArray(parsedResponse.entities)) {
        parsedResponse.entities = parsedResponse.entities.map(entity => {
          if (!entity.position) {
            entity.position = { isDraggable: true, x: Math.random() * 500, y: Math.random() * 400 };
          } else {
            entity.position.isDraggable = true;
          }
          return entity;
        });
      }
      
      // Stringify the enhanced response
      const enhancedResponse = JSON.stringify(parsedResponse, null, 2);
      
      // Log the full OpenAI response to the dedicated log file
      openaiResponseLogger.info('OpenAI response', {
        prompt: text,
        model: model,
        response: enhancedResponse,
        usage: response.usage,
        timestamp: new Date().toISOString()
      });
      
      logger.info('AI-based entity extraction completed', { 
        entityCount: parsedResponse.entities?.length,
        relationshipCount: parsedResponse.relationships?.length
      });
      
      return parsedResponse;
    } catch (parseError) {
      logger.error('Error parsing OpenAI response:', parseError);
      
      // Log the full response content for debugging
      try {
        // Save the problematic response to a special log file for debugging
        const debugLogPath = path.join(__dirname, '../../logs/json-errors.log');
        const debugContent = `
--- ERROR LOG: ${new Date().toISOString()} ---
ERROR: ${parseError.message}
CONTENT:
${responseContent}
------------------------------------------
`;
        fs.appendFileSync(debugLogPath, debugContent);
        logger.info('Saved problematic JSON response to json-errors.log');
      } catch (logError) {
        logger.error('Failed to save debug log:', logError);
      }
      
      throw parseError;
    }
  } catch (error) {
    logger.error('OpenAI API error:', error);
    
    // Enhance error message based on error type
    if (error.cause) {
      if (error.cause.code === 'CERT_HAS_EXPIRED') {
        error.message = 'SSL certificate error with OpenAI API. This is a development environment issue.';
      } else if (error.cause.code === 'ETIMEDOUT' || error.cause.code === 'ESOCKETTIMEDOUT') {
        error.message = 'Request to OpenAI API timed out. Try again with a simpler prompt.';
      } else if (error.cause.code === 'ECONNRESET') {
        error.message = 'Connection to OpenAI API was reset. The server might be overloaded.';
      }
    }
    
    throw error;
  }
}

/**
 * Optimize a user prompt to make it more effective for schema generation
 * @param {string} text - Original natural language prompt
 * @returns {string} - Optimized prompt for better schema generation
 */
exports.optimizePrompt = async (text) => {
  try {
    if (!openai) {
      throw new Error('OpenAI client is not initialized. Please check your API key configuration.');
    }

    logger.info('Using OpenAI for prompt optimization');
    
    // Use a cost-efficient model
    const model = "gpt-3.5-turbo-0125"; // Using the most efficient version of gpt-3.5-turbo
    
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: `You are an expert database design assistant specializing in transforming natural language descriptions into structured database schema specifications. Your task is to refine user prompts into a highly structured format that explicitly defines entities, attributes, relationships, and constraints.

OUTPUT FORMAT REQUIREMENTS:
Your output MUST follow this EXACT structured format:

## ENTITIES
- Entity1 (PascalCase) [WEAK ENTITY if applicable]
  * attribute1 (dataType, constraints)
  * attribute2 (dataType, constraints)
  * ...

- Entity2 (PascalCase)
  * attribute1 (dataType, constraints)
  * attribute2 (dataType, constraints)
  * ...

## RELATIONSHIPS
- Entity1 (1) to Entity2 (many): "Description of relationship" [IDENTIFYING if applicable]
- Entity3 (many) to Entity4 (many): "Description of relationship"
- ...

## CONSTRAINTS
- Business rule 1
- Business rule 2
- ...

REFINING GUIDELINES:
1. ALWAYS use the exact structured format above
2. Use PascalCase for entity names (Product, Customer, OrderItem)
3. Use camelCase for attribute names (firstName, orderDate, productId)
4. Specify data types for ALL attributes (VARCHAR, INTEGER, DECIMAL, TIMESTAMP, BOOLEAN)
5. Identify primary keys (PK) and foreign keys (FK) explicitly
6. Define cardinality precisely in relationships (one-to-one, one-to-many, many-to-many)
7. For many-to-many relationships, identify the junction table
8. Explicitly mark WEAK ENTITIES next to the entity name
9. Explicitly mark IDENTIFYING RELATIONSHIPS with the [IDENTIFYING] tag
10. List important business rules as constraints
11. CRITICAL: Use DESCRIPTIVE and SPECIFIC relationship names based on the relationship description provided in quotes

WEAK ENTITY AND IDENTIFYING RELATIONSHIP GUIDELINES:
- A weak entity is an entity that cannot be uniquely identified by its attributes alone and depends on another entity
- Mark any entity as [WEAK ENTITY] if it depends on another entity for identification
- An identifying relationship is a relationship between a weak entity and its owner (strong entity)
- Mark any relationship as [IDENTIFYING] if it connects a weak entity to its owner entity
- Weak entities typically have partial keys (discriminators) rather than full primary keys
- Example: "Product (1) to ProductVariant (many): 'A product has multiple variants'" should be named "hasVariants" not just "has"

For example, given "Design a system for a library with books and members":

## ENTITIES
- Book
  * id (INTEGER, PK)
  * title (VARCHAR(255), NOT NULL)
  * author (VARCHAR(255), NOT NULL)
  * isbn (VARCHAR(20), UNIQUE)
  * publicationDate (DATE)
  * category (VARCHAR(100))
  * available (BOOLEAN, DEFAULT true)

- Member
  * id (INTEGER, PK)
  * firstName (VARCHAR(100), NOT NULL)
  * lastName (VARCHAR(100), NOT NULL)
  * email (VARCHAR(255), UNIQUE)
  * joinDate (DATE, NOT NULL)
  * status (VARCHAR(20), NOT NULL)

- Borrowing
  * id (INTEGER, PK)
  * bookId (INTEGER, FK to Book.id)
  * memberId (INTEGER, FK to Member.id)
  * borrowDate (DATE, NOT NULL)
  * dueDate (DATE, NOT NULL)
  * returnDate (DATE)

- BookCopy [WEAK ENTITY]
  * copyNumber (INTEGER, Partial Key)
  * bookId (INTEGER, FK to Book.id, part of PK)
  * condition (VARCHAR(50))
  * acquisitionDate (DATE)
  * location (VARCHAR(100))

## RELATIONSHIPS
- Member (1) to Borrowing (many): "A member can borrow multiple books" → NAMED "borrows"
- Book (1) to Borrowing (many): "A book can be borrowed multiple times (sequentially)" → NAMED "isSubjectOf"
- Book (1) to BookCopy (many): "A book can have multiple physical copies" [IDENTIFYING] → NAMED "hasPhysicalCopies"

## CONSTRAINTS
- A book copy cannot be borrowed if it's already checked out
- Members can borrow a maximum of 5 books at a time
- Late returns incur a fine of $0.50 per day

If the user submits a request for examples or samples ("CREATE AN ERD DIAGRAM", "CREATE SAMPLE", "GIVE EXAMPLE"), provide the sample in the exact format above, ensuring it's comprehensive but follows the strict formatting requirements.`
        },
        {
          role: "user",
          content: `Please optimize this database design prompt to make it clearer and more specific for schema generation: "${text}"`
        }
      ]
    });
    
    logger.info('OpenAI API response received for prompt optimization');
    
    if (!response.choices || response.choices.length === 0) {
      throw new Error('No choices returned from OpenAI API');
    }
    
    const optimizedPrompt = response.choices[0].message.content;
    if (!optimizedPrompt) {
      throw new Error('Empty response content from OpenAI API');
    }
    
    // Log the optimized prompt
    logger.info('Prompt optimization successful');
    openaiResponseLogger.info('Prompt optimization:', { 
      original: text,
      optimized: optimizedPrompt
    });
    
    return optimizedPrompt;
  } catch (error) {
    logger.error('Error optimizing prompt:', error);
    throw error;
  }
}

module.exports = exports;