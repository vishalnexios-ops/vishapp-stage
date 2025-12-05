const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const http = require('http');
const cron = require("node-cron");
require('dotenv').config();

const { initSocket, sendScheduleMessage } = require('./Controllers/sessionControllers');
const { sendResponse } = require('./Utils/responseUtils');

const app = express();
const port = process.env.PORT || 8001;



// Middleware
app.use(bodyParser.json());
app.use(cors({
    origin: "http://localhost:3000",
    credentials: true,
}));
app.use(express.static('public'));
app.use(cookieParser());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Routes
const userRoutes = require('./Routes/userRoutes');
const sessionRoutes = require('./Routes/sessionRoutes');
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/contacts', require('./Routes/contactRoutes'));
app.use('/api/templates', require('./Routes/templateRoutes'));

app.use('/health', (req, res) => {
    sendResponse(res, 200, "API is working");
});


// Run every minute
cron.schedule("* * * * *", async () => {
    await sendScheduleMessage();
});

🔹 Socket.io connection
io.on("connection", (socket) => {
    console.log("⚡ Frontend connected via Socket.io:", socket.id);

    socket.on("disconnect", () => {
        console.log("Frontend disconnected:", socket.id);
    });
});

initSocket(io);

mongoose.connect(process.env.MONGO_URI || "mongodb+srv://paras:CZMazeyPcLZTBjd2@atlascluster.qnoiucs.mongodb.net/test?retryWrites=true&w=majority")
    .then(() => {
        console.log('MongoDB connected')
        Start server
        server.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
        });
    })
    .catch(err => console.log(err));



