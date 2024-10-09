const db = require('./db'); 

async function createTables() {
  const enableUuidExtension = 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";';
  await db.query(enableUuidExtension); 

  const query = `
    CREATE TABLE IF NOT EXISTS tickets (
      ticket_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      vatin VARCHAR(11) NOT NULL,
      firstName VARCHAR(50) NOT NULL,
      lastName VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  try {
    await db.query(query);
    console.log("Tables created successfully!");
  } catch (err) {
    console.error("Error creating tables", err);
    throw err;
  }
}

createTables();
