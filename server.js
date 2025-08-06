// File: api/index.js (Backend API for Vercel)
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const axios = require('axios');

const app = express();

app.use(bodyParser.json());

// AI Email Generation Endpoint
app.post('/api/generate-email', async (req, res) => {
    const { prompt } = req.body;

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama3-70b-8192',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 300
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const generatedEmail = response.data.choices[0].message.content;
        res.json({ email: generatedEmail });
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate email' });
    }
});

// Email Sending Endpoint
app.post('/api/send-email', async (req, res) => {
    const { recipients, subject, emailBody } = req.body;

    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    let mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipients,
        subject: subject || 'Generated Email',
        text: emailBody
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ message: 'Email sent successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

module.exports = app;