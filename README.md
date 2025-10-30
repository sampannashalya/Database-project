# Database-project

Natural Language to Database Schemas, SQL & ER Diagrams

LaymanDB is an AI-powered database design platform that converts plain English descriptions into professional database schemas, SQL scripts, and ER diagrams.
It bridges the gap between conceptual thinking and technical implementation — enabling developers, students, and non-technical users to design robust databases effortlessly.

🚀 Features

🗣️ AI-Powered Schema Generation – Converts natural language to SQL and ER diagrams using OpenAI APIs.
🧩 Interactive ER Diagram Editor – Built with ReactFlow for real-time visualization and editing.
💾 Multi-Dialect SQL Support – Generates optimized SQL for MySQL, PostgreSQL, SQLite, and SQL Server.
📑 Smart Documentation Export – Auto-generates markdown documentation with Mermaid diagrams.
🔐 User Authentication (Clerk) – Secure login and session management.
💳 Payment Integration (Razorpay) – Enables premium exports and advanced features.
🧮 Triggers, Procedures & Views – Automates logging and reporting within generated schemas.
📊 Export/Report Functionality – Export SQL, ERDs, and documentation in multiple formats.
💬 Feedback and Version History – Tracks schema iterations and user feedback.

🧱 System Architecture

Frontend:

Next.js 15.x (React 19)
ReactFlow for ERD visualization
Tailwind CSS & ShadCN UI for styling
Mermaid.js for markdown diagrams
Framer Motion for animations

Backend:

Node.js + Express
MongoDB (Schema storage, versioning, and user sessions)
OpenAI API (Natural language processing)
Razorpay API (Payment integration)
Clerk (Authentication)
Socket.io (Real-time updates)
Winston (Logging & Error Handling)

🗂️ Database Schema Overview

Main Entities:

Users – stores user info, plan, and Clerk auth ID.
Prompts – user-submitted natural language inputs.
Schemas – AI-generated database schemas and SQL code.
Entities / Attributes / Relationships – define schema structure.
Sessions – tracks schema edits and user activity.
Payments – handles Razorpay transaction records.
Feedback – user ratings and comments.
Logs – system-level audit events.

Normalization:
Database normalized up to BCNF for consistency and minimal redundancy.

⚙️ Installation & Setup
1️⃣ Clone the repository
git clone 
cd frontend

2️⃣ Setup the backend
cd backend
npm install


Create a .env file:

PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/laymandb
LOG_LEVEL=info
OPENAI_API_KEY=your_openai_api_key
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret


Then run:
npm run dev

3️⃣ Setup the frontend
cd ../frontend
npm install
npm run dev

4️⃣ Open the application

Navigate to http://localhost:3000
 in your browser.

💡 Usage Flow

Enter Prompt: Describe the database you want to design in plain English.
Refine with AI: The system suggests improvements to clarify your prompt.
Generate Schema: AI generates a complete ER diagram and SQL script.
Visualize & Edit: Interactively adjust entities, attributes, and relationships.
Export: Download SQL, ER diagram, or documentation in multiple formats.
Pay (Optional): Use Razorpay integration to unlock premium export features.

🧮 Example Query Features

Stored Procedure Example:

CREATE PROCEDURE LogSchemaCreation(IN u_id INT, IN s_name VARCHAR(100))
BEGIN
  INSERT INTO Logs(user_id, action_type, message, timestamp)
  VALUES(u_id, 'SCHEMA_CREATED', CONCAT('New schema created: ', s_name), NOW());
END;


Trigger Example:

CREATE TRIGGER after_payment_update
AFTER UPDATE ON Payments
FOR EACH ROW
BEGIN
  IF NEW.status = 'Success' THEN
    INSERT INTO Logs(user_id, action_type, message, timestamp)
    VALUES(NEW.user_id, 'PAYMENT_SUCCESS', CONCAT('Payment of ', NEW.amount, ' confirmed.'), NOW());
  END IF;
END;


View Example:

CREATE VIEW UserSchemaSummary AS
SELECT u.name AS user_name, s.schema_name, s.created_at, p.plan_type
FROM Users u
JOIN Schemas s ON u.user_id = s.user_id;

📤 Export & Reporting

Formats: SQL, Markdown, JSON, SVG, PNG, PDF
Tools Used: Mermaid.js for diagrams, JSZip for file packaging
Auto-generated documentation includes schema explanation, ER diagram, and AI rationale.

🧪 Testing & Validation

Validated on MySQL and PostgreSQL dialects.
Unit tested backend APIs using Jest.
Razorpay sandbox tested for both successful and failed payments.
MongoDB Compass verified schema versioning and data consistency.

🧭 Future Enhancements

Add real-time collaboration for shared schema design.
Support NoSQL schema generation (MongoDB, Firestore).
Introduce AI-based optimization for query performance.
Deploy cloud-based SQL execution for instant verification.
