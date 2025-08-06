const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:5500', '*'], // Allow local development
    credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// AI Email Generation Endpoint
app.post('/api/generate-email', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        // Check if GROQ_API_KEY is available
        if (!process.env.GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY not found in environment variables');
        }

        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama3-8b-8192', // Using a more stable model
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional email writer. Create clear, concise, and well-structured emails based on the user\'s request. Only return the email content without any additional formatting or explanations.'
                },
                {
                    role: 'user',
                    content: `Write an email for: ${prompt}`
                }
            ],
            max_tokens: 500,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const generatedEmail = response.data.choices[0].message.content.trim();
        res.json({ email: generatedEmail });
    } catch (error) {
        console.error('Error generating email:', error.response?.data || error.message);
        
        if (error.message.includes('GROQ_API_KEY')) {
            res.status(500).json({ error: 'API key not configured. Please set GROQ_API_KEY in your .env file.' });
        } else {
            res.status(500).json({ error: 'Failed to generate email. Please try again.' });
        }
    }
});

// Email Sending Endpoint
app.post('/api/send-email', async (req, res) => {
    const { recipients, subject, emailBody } = req.body;

    if (!recipients || !subject || !emailBody) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        // Check if email credentials are available
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            throw new Error('Email credentials not found in environment variables');
        }

        let transporter = nodemailer.createTransporter({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS // Use App Password for Gmail
            }
        });

        // Verify transporter configuration
        await transporter.verify();

        let mailOptions = {
            from: process.env.EMAIL_USER,
            to: recipients,
            subject: subject,
            text: emailBody,
            html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${emailBody}</pre>`
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: 'Email sent successfully!' });
    } catch (error) {
        console.error('Error sending email:', error);
        
        if (error.message.includes('credentials')) {
            res.status(500).json({ error: 'Email credentials not configured. Please set EMAIL_USER and EMAIL_PASS in your .env file.' });
        } else if (error.code === 'EAUTH') {
            res.status(500).json({ error: 'Email authentication failed. Please check your email credentials or use an App Password.' });
        } else {
            res.status(500).json({ error: 'Failed to send email. Please try again.' });
        }
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        env: {
            groqApiKey: !!process.env.GROQ_API_KEY,
            emailUser: !!process.env.EMAIL_USER,
            emailPass: !!process.env.EMAIL_PASS
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Environment check:`);
    console.log(`- GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✓ Set' : '✗ Missing'}`);
    console.log(`- EMAIL_USER: ${process.env.EMAIL_USER ? '✓ Set' : '✗ Missing'}`);
    console.log(`- EMAIL_PASS: ${process.env.EMAIL_PASS ? '✓ Set' : '✗ Missing'}`);
});