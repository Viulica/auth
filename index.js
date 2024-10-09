require('dotenv').config();  
require('./initDb');
const express = require('express');
const db = require('./db'); 
const path = require('path');
const fetch = require('node-fetch'); 
const QRCode = require('qrcode'); 
const { expressjwt: jwt } = require('express-jwt'); 
const jwksRsa = require('jwks-rsa'); 
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

const { auth } = require('express-openid-connect');

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: 'a long, randomly-generated string stored in env',
  baseURL: 'https://auth-1-9m3o.onrender.com',
  clientID: 'IIC5pl9kVIIyVpWc9mT7OCz5M7okIsSJ',
  issuerBaseURL: 'https://dev-6nsq4o4pvx024k2l.us.auth0.com'
};

app.use(auth(config));


const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,  
  }),
  audience: process.env.AUTH0_AUDIENCE,  
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,  
  algorithms: ['RS256'], 
});

app.get('/', async (req, res) => {
  try {
    const query = 'SELECT COUNT(*) AS ticket_count FROM tickets';
    const result = await db.query(query);

  } catch (err) {
    console.error('Error retrieving ticket count:', err);
    res.status(500).send('Error retrieving ticket count');
  }
});


app.post('/create-ticket', checkJwt, async (req, res) => {

  const { vatin, firstName, lastName } = req.body;

  if (!vatin || !firstName || !lastName) {
    return res.status(400).send('All fields are required: vatin, firstName, lastName');
  }

  try {

    const checkQuery = 'SELECT COUNT(*) FROM tickets WHERE vatin = $1';
    const checkValues = [vatin];
    const checkResult = await db.query(checkQuery, checkValues);
    const ticketCount = parseInt(checkResult.rows[0].count);

    if (ticketCount > 3) {
      return res.status(400).json({ error: 'MaxTicketsExceeded', message: 'This VATIN (OIB) has already generated the maximum of 3 tickets.' });
    }
    

    const query = `
      INSERT INTO tickets (vatin, firstName, lastName)
      VALUES ($1, $2, $3)
      RETURNING ticket_id, vatin, firstname, lastname;
    `;
    const values = [vatin, firstName, lastName];
    const result = await db.query(query, values);

    const ticket = result.rows[0]; 
    
    const ticketUrl = `${process.env.APP_BASE_URL}/ticket/${ticket.ticket_id}`;

    const qrCode = await QRCode.toDataURL(ticketUrl); 

    res.status(201).json({
      ticket_id: ticket.ticket_id,
      qrCode, 
      message: 'Ticket created successfully!'
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error creating ticket');
  }
});


app.get('/get-token', async (req, res) => {
  try {
    console.log('Attempting to fetch token from Auth0...');
    
    const response = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        audience: process.env.AUTH0_AUDIENCE
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Token successfully fetched from Auth0');
      res.json({ token: data.access_token }); 
    } else {
      console.error('Error response from Auth0:', data);
      res.status(500).json({ error: 'Failed to retrieve token from Auth0' });
    }

  } catch (error) {
    console.error('Error fetching token from Auth0:', error);
    res.status(500).json({ error: 'Failed to retrieve token' });
  }
});

app.get('/ticket/:ticket_id', async (req, res) => {

  if (!req.oidc.isAuthenticated()) {
    return res.oidc.login();
  }

  const { ticket_id } = req.params;

  try {
    const query = 'SELECT * FROM tickets WHERE ticket_id = $1';
    const values = [ticket_id];
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).send('Ticket not found');
    }

    const ticket = result.rows[0];
    const user = req.oidc.user;
    const userName = user.name;

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ticket Details</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            padding: 0;
            line-height: 1.6;
          }
          h1 {
            color: #333;
          }
          p {
            font-size: 18px;
            color: #555;
          }
        </style>
      </head>
      <body>
        <h1>Ticket Details</h1>
        <p><strong>Prijavljeni korisnik:</strong> ${userName}</p>
        <p><strong>Ticket ID:</strong> ${ticket.ticket_id}</p>
        <p><strong>VATIN (OIB):</strong> ${ticket.vatin}</p>
        <p><strong>Name:</strong> ${ticket.firstname} ${ticket.lastname}</p>
        <p><strong>Created at:</strong> ${ticket.created_at}</p>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error retrieving ticket details');
  }
});


app.get('/api/ticket-count', async (req, res) => {
  try {
    const query = 'SELECT COUNT(*) AS ticket_count FROM tickets';
    const result = await db.query(query);

    const ticketCount = result.rows[0].ticket_count;
    res.json({ ticketCount });  

  } catch (err) {
    console.error('Error retrieving ticket count:', err);
    res.status(500).json({ error: 'Error retrieving ticket count' });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
