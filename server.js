// Debug version to help identify startup issues
console.log('🚀 Starting AI Email Sender...');

try {
    console.log('📁 Current directory:', process.cwd());
    console.log('📄 Loading environment variables...');
    
    require('dotenv').config();
    
    console.log('🔑 Environment check:');
    console.log('- GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('- EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
    console.log('- EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set' : '❌ Missing');
    console.log('- PORT:', process.env.PORT || 5000);
    
    console.log('📦 Loading modules...');
    const express = require('express');
    const bodyParser = require('body-parser');
    const nodemailer = require('nodemailer');
    const axios = require('axios');
    const cors = require('cors');
    const path = require('path');
    
    console.log('✅ All modules loaded successfully');
    
    const app = express();
    const PORT = process.env.PORT || 5000;
    
    console.log('⚙️ Setting up middleware...');
    
    // Middleware
    app.use(cors({
        origin: ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:5500', '*'],
        credentials: true
    }));
    app.use(bodyParser.json());
    app.use(express.static(path.join(__dirname, 'public')));
    
    console.log('🌐 Setting up routes...');
    
    // Test route
    app.get('/', (req, res) => {
        console.log('📥 GET / - Serving index.html');
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    
    // Health check endpoint
    app.get('/api/health', (req, res) => {
        console.log('📥 GET /api/health');
        const healthStatus = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            env: {
                groqApiKey: !!process.env.GROQ_API_KEY,
                emailUser: !!process.env.EMAIL_USER,
                emailPass: !!process.env.EMAIL_PASS
            }
        };
        console.log('📤 Health status:', healthStatus);
        res.json(healthStatus);
    });
    
    // AI Email Generation Endpoint
    app.post('/api/generate-email', async (req, res) => {
        console.log('📥 POST /api/generate-email');
        const { prompt } = req.body;
        console.log('📝 Prompt:', prompt);
        
        if (!prompt) {
            console.log('❌ No prompt provided');
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        try {
            if (!process.env.GROQ_API_KEY) {
                throw new Error('GROQ_API_KEY not found in environment variables');
            }
            
            console.log('🤖 Calling Groq API...');
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: 'llama3-8b-8192',
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
            console.log('✅ Email generated successfully');
            console.log('📄 Generated email preview:', generatedEmail.substring(0, 100) + '...');
            
            res.json({ email: generatedEmail });
        } catch (error) {
            console.error('❌ Error generating email:', error.response?.data || error.message);
            
            if (error.message.includes('GROQ_API_KEY')) {
                res.status(500).json({ error: 'API key not configured. Please set GROQ_API_KEY in your .env file.' });
            } else {
                res.status(500).json({ error: 'Failed to generate email. Please try again.' });
            }
        }
    });
    
    // Email Sending Endpoint
    app.post('/api/send-email', async (req, res) => {
        console.log('📥 POST /api/send-email');
        const { recipients, subject, emailBody } = req.body;
        console.log('📧 Recipients:', recipients);
        console.log('📝 Subject:', subject);
        
        if (!recipients || !subject || !emailBody) {
            console.log('❌ Missing required fields');
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        try {
            if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
                throw new Error('Email credentials not found in environment variables');
            }
            
            console.log('📮 Setting up email transporter...');
            let transporter = nodemailer.createTransporter({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });
            
            console.log('🔍 Verifying transporter...');
            await transporter.verify();
            console.log('✅ Transporter verified');
            
            let mailOptions = {
                from: process.env.EMAIL_USER,
                to: recipients,
                subject: subject,
                text: emailBody,
                html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${emailBody}</pre>`
            };
            
            console.log('📤 Sending email...');
            await transporter.sendMail(mailOptions);
            console.log('✅ Email sent successfully');
            
            res.json({ message: 'Email sent successfully!' });
        } catch (error) {
            console.error('❌ Error sending email:', error);
            
            if (error.message.includes('credentials')) {
                res.status(500).json({ error: 'Email credentials not configured. Please set EMAIL_USER and EMAIL_PASS in your .env file.' });
            } else if (error.code === 'EAUTH') {
                res.status(500).json({ error: 'Email authentication failed. Please check your email credentials or use an App Password.' });
            } else {
                res.status(500).json({ error: 'Failed to send email. Please try again.' });
            }
        }
    });
    
    console.log('🚀 Starting server...');
    app.listen(PORT, () => {
        console.log('\n🎉 Server started successfully!');
        console.log(`🌐 Server running at: http://localhost:${PORT}`);
        console.log(`📁 Serving files from: ${path.join(__dirname, 'public')}`);
        console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
        console.log('\n📋 Available endpoints:');
        console.log(`   GET  http://localhost:${PORT}/`);
        console.log(`   GET  http://localhost:${PORT}/api/health`);
        console.log(`   POST http://localhost:${PORT}/api/generate-email`);
        console.log(`   POST http://localhost:${PORT}/api/send-email`);
        console.log('\n🔧 Environment status:');
        console.log(`   GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing'}`);
        console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? '✅ Set' : '❌ Missing'}`);
        console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '✅ Set' : '❌ Missing'}`);
        console.log('\n💡 Tip: Open http://localhost:' + PORT + ' in your browser');
    });
    
} catch (error) {
    console.error('💥 Fatal error starting server:');
    console.error(error);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Make sure you ran: npm install');
    console.log('2. Check that .env file exists in the same folder as this script');
    console.log('3. Verify all required environment variables are set');
    console.log('4. Try running: npm install express cors axios nodemailer dotenv');
}