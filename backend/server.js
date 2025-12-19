const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5500; // Dedicated port for Swe_Society

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const postRoutes = require('./routes/postRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const roleRoutes = require('./routes/roleRoutes');
const societyNoticeRoutes = require('./routes/societyNoticeRoutes');
const eventRoutes = require('./routes/eventRoutes');
const electionRoutes = require('./routes/electionRoutes');
const messageRoutes = require('./routes/messageRoutes');
const groupRoutes = require('./routes/groupRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const feeRoutes = require('./routes/feeRoutes');
const approvalRoutes = require('./routes/approvalRoutes');

app.use('/api', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/society-notices', societyNoticeRoutes);
app.use('/api/events', eventRoutes);
app.use('/api', electionRoutes);
app.use('/api', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/approvals', approvalRoutes);

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve static files from auth directory
app.use('/auth', express.static(path.join(__dirname, '../auth')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
