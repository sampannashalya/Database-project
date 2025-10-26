const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a separate logger for OpenAI responses with enhanced formatting
const openaiResponseLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(info => {
      // Enhanced formatting for better readability
      let output = `${info.timestamp} [${info.level}]: ${info.message}\n`;
      
      // Add model information if available
      if (info.model) {
        output += `Model: ${info.model}\n`;
      }
      
      // Add prompt if available (truncated if too long)
      if (info.prompt) {
        const truncatedPrompt = info.prompt.length > 100 
          ? info.prompt.substring(0, 100) + '...' 
          : info.prompt;
        output += `Prompt: ${truncatedPrompt}\n`;
      }
      
      // Format the response object for better readability
      if (info.response) {
        try {
          // Parse the response if it's a JSON string
          const parsed = typeof info.response === 'string' 
            ? JSON.parse(info.response) 
            : info.response;
          
          // Format and add the response with clear section markers
          output += `\n========== RESPONSE START ==========\n`;
          output += JSON.stringify(parsed, null, 2);
          output += `\n========== RESPONSE END ==========\n`;
        } catch (e) {
          // If parsing fails, output as-is
          output += `\nResponse (raw): ${info.response}\n`;
        }
      }
      
      // Add usage information if available
      if (info.usage) {
        output += `\nToken Usage: ${JSON.stringify(info.usage, null, 2)}\n`;
      }
      
      return output;
    })
  ),
  defaultMeta: { service: 'openai-responses' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'openai-responses.log')
    })
  ]
});

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let output = `${timestamp} [${level}]: ${message}`;
      
      // Add any additional metadata if it exists, with improved formatting
      if (Object.keys(meta).length) {
        // Format special fields differently if needed
        if (meta.response && typeof meta.response === 'string') {
          try {
            // Try to parse and format JSON responses
            const parsed = JSON.parse(meta.response);
            meta.response = JSON.stringify(parsed, null, 2);
          } catch (e) {
            // Keep as is if not valid JSON
          }
        }
        
        output += `\n${JSON.stringify(meta, null, 2)}`;
      }
      
      return output;
    })
  ),
  defaultMeta: { service: 'database-designer' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let output = `${timestamp} [${level}]: ${message}`;
          
          // Add any additional metadata with improved formatting for console
          if (Object.keys(meta).length) {
            // For console, we might want to truncate very long responses
            if (meta.response && typeof meta.response === 'string' && meta.response.length > 1000) {
              meta.response = meta.response.substring(0, 1000) + '... [truncated]';
            }
            
            output += `\n${JSON.stringify(meta, null, 2)}`;
          }
          
          return output;
        })
      )
    }),
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log') })
  ]
});

// If we're not in production, ensure the console has verbose output
if (process.env.NODE_ENV !== 'production') {
  // Set the log level to more verbose in development
  logger.level = 'debug';
  
  // We don't need to add another console transport as we've already configured it above
  // with good formatting
}

// Export both loggers
module.exports = logger;
module.exports.openaiResponseLogger = openaiResponseLogger;
