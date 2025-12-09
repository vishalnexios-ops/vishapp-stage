const {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
} = require("baileys-vishal2");
const qrcode = require("qrcode");
const qrcodeTerminal = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const P = require("pino");
const mime = require("mime-types"); // install: npm install mime-types
const { sendResponse, sendError } = require("../Utils/responseUtils");
const { validateSession } = require("../Utils/sessionValidator");

const sessionModel = require("../Models/loginModel");
const messageModel = require("../Models/messageModel");
const contactModel = require("../Models/contactModel");
const templateModel = require("../Models/templateModel");
const userModel = require("../Models/userModel");
const { safeSendBulk } = require("../Utils/helpers");

let ioInstance = null; // Socket.io instance

dotenv.config();

const sessions = new Map();
const sessionLoading = new Set();
const SESSIONS_PATH = "./auth_sessions";

let userId = null;

if (!fs.existsSync(SESSIONS_PATH)) fs.mkdirSync(SESSIONS_PATH);

// Enhance: Persist userId mapping for sessionId (for restoring correctly after restart)
const SESSION_USER_FILE = "./auth_sessions/_session_users.json";
let sessionUserMap = {};
try {
  if (fs.existsSync(SESSION_USER_FILE)) {
    sessionUserMap = JSON.parse(fs.readFileSync(SESSION_USER_FILE, "utf8"));
  }
} catch (e) {
  sessionUserMap = {};
}
const saveSessionUserMap = () => fs.writeFileSync(SESSION_USER_FILE, JSON.stringify(sessionUserMap, null, 2));

const initSocket = (io) => {
  ioInstance = io;
};

// Restore sessions after server restart
async function restoreSessions() {
  const dirs = fs.readdirSync(SESSIONS_PATH);

  for (const dir of dirs.filter((x) => !x.startsWith("_"))) {
    const full = path.join(SESSIONS_PATH, dir);
    if (!fs.statSync(full).isDirectory()) continue;

    console.log("Restoring session:", dir);

    const mappedUserId = sessionUserMap[dir] || null;

    try {
      const sock = await startSession(dir, null, mappedUserId);

      // ⛔ If session did NOT restore correctly
      if (!sock || !sock.user || !sock.user.id) {
        console.log(`Removing invalid session: ${dir}`);

        // Delete session folder
        try { fs.rmSync(full, { recursive: true, force: true }); } catch { }

        // Remove from memory map
        delete sessionUserMap[dir];
        saveSessionUserMap();

        // Remove from sessions cache
        sessions.delete(dir);

        continue;
      }

      console.log(`Session restored successfully: ${dir}`);
    } catch (err) {
      console.error("Restore failed:", dir, err.message);

      console.log(`Cleaning broken session folder: ${dir}`);
      try { fs.rmSync(full, { recursive: true, force: true }); } catch { }

      delete sessionUserMap[dir];
      saveSessionUserMap();

      sessions.delete(dir);
    }
  }
}


// Start a WhatsApp session
async function startSession(sessionId, res = null, restoredUserId = null) {
  // if (sessionLoading.has(sessionId)) {
  //   console.log("⚠ Session already initializing:", sessionId);
  //   return;
  // }

  // sessionLoading.add(sessionId);

  const sessionPath = path.join(SESSIONS_PATH, sessionId);


  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      logger: P({ level: "silent" }),
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
          state.keys,
          P().child({ level: "fatal" })
        ),
      },
      browser: ["MultiBot", "Chrome", "1.0.0"],
      syncFullHistory: false,
    });

    sock._presenceInterval = null;

    // Safe save creds
    sock.ev.on("creds.update", async () => {
      try {
        await saveCreds();
      } catch (err) {
        console.error("Error saving creds:", err);
      }
    });

    let qrSent = false;

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Show QR
      if (qr && !qrSent && res) {
        qrSent = true;
        const qrGeneratedAt = new Date();
        console.log(`[${sessionId}] Scan this QR below`);
        qrcodeTerminal.generate(qr, { small: true });

        const qrImageUrl = await qrcode.toDataURL(qr);
        const acceptHeader = res?.req?.headers?.accept || "";

        if (acceptHeader.includes("text/html")) {
          res.send(`
            <html>
              <head>
                <title>WhatsApp QR - ${sessionId}</title>
                <style>
                  body { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#f4f4f4; font-family:sans-serif; }
                  img { border:5px solid #25D366; border-radius:12px; box-shadow:0 0 20px rgba(0,0,0,0.1); }
                  h2 { color:#333; }
                </style>
              </head>
              <body>
                <h2>Scan this QR to link WhatsApp</h2>
                <img src="${qrImageUrl}" alt="WhatsApp QR" />
                <p>Session ID: <b>${sessionId}</b></p>
                <p>QR Generated At: <b>${qrGeneratedAt.toLocaleTimeString()}</b></p>
              </body>
            </html>
          `);
        } else {
          // JSON response
          sendResponse(res, 200, "Scan QR", { sessionId, qr: qrImageUrl });
        }
      }

      // Connected
      if (connection === "open") {
        console.log(`[${sessionId}] Connected`)
        // if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath);

        // GET MOBILE NUMBER FROM WHATSAPP
        const loggedInMobile = sock.user.id.split(":")[0]; // ex: 919876543210

        // CHECK IF THIS NUMBER IS ALREADY LOGGED IN ANOTHER SESSION
        let alreadySession = null;
        for (const [sid, s] of sessions.entries()) {
          if (sid === sessionId) continue;
          const mobile = s?.user?.id?.split(":")[0];
          if (mobile && mobile === loggedInMobile) {
            alreadySession = sid;
            break;
          }
        }

        if (alreadySession) {
          console.log(
            `SAME NUMBER ALREADY LOGGED IN (${loggedInMobile}) in session:`,
            alreadySession
          );

          // Close new session
          try {
            await sock.logout();
          } catch { }

          sessions.delete(sessionId);
          delete sessionUserMap[sessionId];
          saveSessionUserMap();

          // Agar res mila hoga (QR login se aaya) to error bhej do, warna sirf log
          if (res) {
            return sendError(
              res,
              400,
              `This number (${loggedInMobile}) is already logged in another session.`
            );
          } else {
            return;
          }
        }

        // Start safe presence update ONLY after WhatsApp login
        if (!sock._presenceInterval) {
          sock._presenceInterval = setInterval(() => {
            try {
              if (sock.user) sock.sendPresenceUpdate("available");
            } catch (e) {
              console.log("Presence update error:", e.message);
            }
          }, 20000);
        }

        const uid =
          userId || restoredUserId || sessionUserMap[sessionId] || null;

        if (uid) {
          sessionUserMap[sessionId] = uid;
          saveSessionUserMap();;
          sessions.set(sessionId, sock);
        }

        // Mark in DB
        await sessionModel.findOneAndUpdate(
          { sessionId },
          {
            sessionId,
            userId: uid,
            mobile: loggedInMobile,
            isLoggedIn: true,
            loginTime: new Date(),
          },
          { upsert: true }
        );

        if (ioInstance)
          ioInstance.emit("whatsapp-login-success", {
            sessionId,
            mobile: loggedInMobile,
          });
      }

      // 🔴 Closed
      if (connection === "close") {
        const status = lastDisconnect?.error?.output?.statusCode;

        console.log(`[${sessionId}] Disconnected:`, status);

        // stop presence interval
        if (sock._presenceInterval) {
          clearInterval(sock._presenceInterval);
          sock._presenceInterval = null;
        }

        // LOGGED OUT ONLY HERE
        if (status === DisconnectReason.loggedOut) {
          console.log("Logged out → deleting session");
          try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
          } catch { }

          sessions.delete(sessionId);
          delete sessionUserMap[sessionId];
          // saveSessionUserMap();

          await sessionModel.findOneAndUpdate(
            { sessionId },
            { isLoggedIn: false, logoutTime: new Date() }
          );
          return;
        }

        // 🔄 Otherwise → Reconnect safely
        console.log("🔄 Reconnecting in 5 sec...");
        setTimeout(
          () =>
            startSession(
              sessionId,
              null,
              restoredUserId || sessionUserMap[sessionId]
            ),
          5000
        );
      }
    });

    return sock;
  } catch (err) {
    console.error("Error starting session:", err);
  } finally {
    sessionLoading.delete(sessionId);
  }
}

//  Create new session (for QR login)
const createSession = async (req, res) => {
  userId = req.user.userId;
  const sessionId = `session_${Date.now()}_${userId}`;

  sessionUserMap[sessionId] = userId;
  saveSessionUserMap();

  try {
    await startSession(sessionId, res, userId);
  } catch (err) {
    console.error("Error creating session:", err);
    return sendError(res, 500, err.message);
  }
};

//  Send text message
const sendMessage = async (req, res) => {
  userId = req.user.userId;
  const { sessionId, to, message } = req.body;

  if (!validateSession(res, sessionId, userId)) return;

  const sock = sessions.get(sessionId);

  if (!sock)
    return sendError(
      res,
      404,
      `Session '${sessionId}' not found or not connected.`
    );

  try {
    const jid = to.includes("@s.whatsapp.net") ? to : `${to}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
    return sendResponse(res, 200, " Message sent successfully");
  } catch (err) {
    console.error(`[${sessionId}] Error sending message:`, err);
    return sendError(res, 500, err.message);
  }
};

//  Get active sessions
const getSessions = (req, res) => {
  const userId = req.user.userId;

  // Get all session keys
  const allSessions = Array.from(sessions.keys());

  // Filter only this user's sessions
  const userSessions = allSessions.filter((id) => id.endsWith(`_${userId}`));

  sendResponse(res, 200, "Active sessions fetched successfully", {
    activeSessions: userSessions,
  });
};

//  Send media (image/video) via URL
const sendMediaUrl = async (req, res) => {
  userId = req.user.userId;
  const { to, mediaUrl, caption, sessionId } = req.body;

  if (!validateSession(res, sessionId, userId)) return;

  const sock = sessions.get(sessionId);
  if (!sock) return sendError(res, 500, "Socket not ready");

  try {
    const jid = to.includes("@s.whatsapp.net") ? to : `${to}@s.whatsapp.net`;
    const isImage = /\.(jpg|jpeg|png|gif)$/i.test(mediaUrl);

    await sock.sendMessage(jid, {
      [isImage ? "image" : "video"]: { url: mediaUrl },
      caption: caption || (isImage ? "Image" : "Video"),
    });

    sendResponse(res, 200, ` ${isImage ? "Image" : "Video"} sent successfully`);
  } catch (err) {
    console.error("Error sending media:", err);
    sendError(res, 500, err.message);
  }
};

//  Logout a session by sessionId
const logoutSession = async (req, res) => {
  userId = req.user.userId;
  const { sessionId } = req.query; // GET /api/sessions/logout/:sessionId
  if (!sessionId) {
    return sendError(res, 400, "sessionId is required");
  }

  if (!validateSession(res, sessionId, userId)) return;
  const sock = sessions.get(sessionId);

  if (!sock) {
    return sendError(
      res,
      404,
      `Session '${sessionId}' not found or already disconnected.`
    );
  }

  try {
    // Disconnect the WhatsApp socket
    await sock.logout(); // Baileys method to log out

    // Remove session from map
    sessions.delete(sessionId);

    // Update DB
    await sessionModel.findOneAndUpdate(
      { sessionId },
      { isLoggedIn: false, logoutTime: new Date() }
    );

    // Remove this session from user mapping and file
    delete sessionUserMap[sessionId];
    saveSessionUserMap();

    // Remove session files/folders for this session
    const sessionPath = path.join(SESSIONS_PATH, sessionId);
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    } catch (e) { }

    // Notify frontend via Socket.io
    if (ioInstance) {
      ioInstance.emit("whatsapp-logout", { sessionId });
    }

    return sendResponse(
      res,
      200,
      ` Session '${sessionId}' logged out successfully.`
    );
  } catch (err) {
    console.error(`Error logging out session ${sessionId}:`, err);
    return sendError(res, 500, err.message);
  }
};

const getMessageById = async (req, res) => {
  const { messageId } = req.query;
  if (!messageId) {
    return sendError(res, 400, "messageId is required");
  }
  try {
    const message = await messageModel
      .findById(messageId)
      .populate("sender", "-password");
    return sendResponse(res, 200, " Message retrieved successfully", {
      data: message,
    });
  } catch (err) {
    console.error("Error fetching message by ID:", err);
    return sendError(res, 400, "Error fetching message by ID", err);
  }
};

const getAllMessages = async (req, res) => {
  const { search = "", userId = "", senderMobile = "" } = req.query;
  const query = {};

  if (userId) {
    query.sender = userId;
  }
  if (senderMobile) {
    query.senderMobile = senderMobile;
  }

  try {
    const messages = await messageModel
      .find(query)
      .populate("sender", "-password")
      .sort({ createdAt: -1 });
    return sendResponse(res, 200, "Messages retrieved successfully", {
      data: messages,
    });
  } catch (err) {
    console.error("Error fetching all messages:", err);
    return sendError(res, 400, "Error fetching all messages", err);
  }
};

const sendToMultiple = async (req, res) => {
  userId = req.user.userId;
  const {
    numbers,
    message,
    mediaUrl,
    caption,
    sessionId,
    delayTime = 3000,
    schedule = false,
    scheduledTime,
  } = req.body;

  if (!validateSession(res, sessionId, userId)) return;
  const sock = sessions.get(sessionId);

  if (!sock) return sendError(res, 500, "Socket not ready");

  const toNumbers = Array.isArray(numbers) ? numbers : [numbers];

  // Check for scheduled sending
  if (
    schedule === true &&
    scheduledTime &&
    new Date(scheduledTime).getTime() > Date.now()
  ) {
    // Get current user mobile for DB save
    const userMobile = sock.user?.id.split(":")[0] || "";

    // Detect contentType automatically from mediaUrl
    let contentType = "text";
    if (mediaUrl) {
      // Extract MIME type using extension
      const ext = path.extname(mediaUrl).toLowerCase();
      const mimeType = mime.lookup(ext);
      if (mimeType) {
        if (mimeType.startsWith("image/")) contentType = "image";
        else if (mimeType.startsWith("video/")) contentType = "video";
        else if (mimeType.startsWith("audio/")) contentType = "audio";
        else if (mimeType.startsWith("application/pdf"))
          contentType = "document";
        else contentType = "file";
      } else {
        contentType = "file";
      }
    }
    const scheduledConvertedTime = new Date(scheduledTime);
    console.log("scheduledConvertedTime---->", scheduledConvertedTime);
    // Schedule messages for each number
    try {
      for (let i = 0; i < toNumbers.length; i++) {
        const number = toNumbers[i];
        const receiverMobile = number;
        const newMessage = new messageModel({
          sender: userId,
          senderMobile: userMobile,
          receiverMobile: receiverMobile,
          content: caption || message || "",
          contentType,
          mediaUrl,
          sessionId,
          schedulled: true,
          scheduledTime: scheduledConvertedTime,
          scheduledStatus: "pending",
          direction: "outgoing",
        });
        await newMessage.save();
      }
      return sendResponse(
        res,
        200,
        `Message scheduled successfully for ${toNumbers} number(s).`
      );
    } catch (err) {
      console.error("Error scheduling message(s):", err);
      return sendError(res, 500, "Error scheduling messages", err);
    }
  } else {
    // Send immediately as before

    // Get current user mobile for DB save
    const userMobile = sock.user?.id.split(":")[0] || "";

    // Detect contentType automatically from mediaUrl
    let contentType = "text";
    if (mediaUrl) {
      // Extract MIME type using extension
      const ext = path.extname(mediaUrl).toLowerCase();
      const mimeType = mime.lookup(ext);
      if (mimeType) {
        if (mimeType.startsWith("image/")) contentType = "image";
        else if (mimeType.startsWith("video/")) contentType = "video";
        else if (mimeType.startsWith("audio/")) contentType = "audio";
        else if (mimeType.startsWith("application/pdf"))
          contentType = "document";
        else contentType = "file";
      } else {
        contentType = "file";
      }
    }

    //  Daily limit check
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const messagesSentToday = await messageModel.countDocuments({
      sessionId,
      direction: "outgoing",
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    const DAILY_LIMIT = process.env.DAILY_LIMIT || 500; // safe daily limit per session

    if (messagesSentToday >= DAILY_LIMIT) {
      return sendError(
        res,
        400,
        `Daily limit reached (${DAILY_LIMIT} messages). Try again tomorrow.`
      );
    }

    // Calculate how many can be sent
    const allowedToSend = Math.min(
      toNumbers.length,
      DAILY_LIMIT - messagesSentToday
    );

    let successCount = await safeSendBulk(sock, toNumbers, message, allowedToSend);
    for (let i = 0; i < allowedToSend; i++) {
      try {
        // if (mediaUrl) {
        //   const isImage = /\.(jpg|jpeg|png|gif)$/i.test(mediaUrl);
        //   await sock.sendMessage(to, {
        //     [isImage ? "image" : "video"]: { url: mediaUrl },
        //     caption: caption || message || (isImage ? "Image" : "Video"),
        //   });
        // } else if (message) {
        //   await sock.sendMessage(to, { text: message });
        // }

        // Save message to database immediately after successful send
        const newMessage = new messageModel({
          sender: userId,
          senderMobile: userMobile,
          receiverMobile: toNumbers[i],
          content: caption || message || "",
          contentType,
          mediaUrl,
          sessionId,
          schedulled: false,
          scheduledStatus: "sent",
          direction: "outgoing",
        });
        await newMessage.save();
        await new Promise((resolve) => setTimeout(resolve, delayTime));
      } catch (err) {
        console.error(`Failed to send to ${number}:`, err.message);
      }
    }
    return sendResponse(
      res,
      200,
      `Message sent to ${successCount} number(s) (with safe delay)`
    );
  }
};

const scheduleMessage = async (req, res) => {
  const { sessionId, to, mediaUrl, caption, scheduledTime } = req.body;
  const userId = req.user.userId;

  if (!validateSession(res, sessionId, userId)) return;

  const sock = sessions.get(sessionId);

  if (!sock) {
    return sendError(
      res,
      404,
      `Session '${sessionId}' not found or not connected.`
    );
  }

  const userMobile = sock.user.id.split(":")[0];

  try {
    // Detect contentType automatically from mediaUrl
    let contentType = "text";
    if (mediaUrl) {
      // Extract MIME type using extension
      const ext = path.extname(mediaUrl).toLowerCase();
      const mimeType = mime.lookup(ext);

      if (mimeType) {
        if (mimeType.startsWith("image/")) contentType = "image";
        else if (mimeType.startsWith("video/")) contentType = "video";
        else if (mimeType.startsWith("audio/")) contentType = "audio";
        else if (mimeType.startsWith("application/pdf"))
          contentType = "document";
        else contentType = "file";
      } else {
        contentType = "file";
      }
    }

    if (caption || mediaUrl) {
      const newMessage = new messageModel({
        sender: userId,
        senderMobile: userMobile,
        receiverMobile: to,
        content: caption || "",
        contentType,
        mediaUrl,
        sessionId,
        schedulled: true,
        scheduledTime: new Date(scheduledTime),
        scheduledStatus: "pending",
        direction: "outgoing",
      });

      await newMessage.save();
      return sendResponse(res, 200, "Message scheduled successfully.");
    }
  } catch (err) {
    console.error(`Error in scheduling message`, err.message);
    sendError(res, 500, err.message);
  }
};

const getScheduleMessage = async (req, res) => {
  try {
    const newMessage = await messageModel.find({ schedulled: true });
    return sendResponse(res, 200, "Message scheduled successfully.", {
      data: newMessage,
    });
  } catch (error) {
    console.error(`Error in scheduling message`, error.message);
    sendError(res, 500, error.message);
  }
};

const sendScheduleMessage = async () => {
  try {
    // const nowIST = new Date(Date.now() + (5.5 * 60 * 60 * 1000));
    const nowIST = new Date();
    console.log("nowIST---->", nowIST);
    // Get all scheduled messages whose time has arrived
    const scheduleMessages = await messageModel.find({
      schedulled: true,
      scheduledTime: { $lte: nowIST },
      scheduledStatus: "pending",
    });

    if (!scheduleMessages.length) {
      console.log("No messages to send right now in cron.");
    }

    for (const msg of scheduleMessages) {
      const sock = sessions.get(msg.sessionId);

      if (!sock) {
        console.error(`Socket not found for session ${msg.sessionId}`);
        await messageModel.findByIdAndUpdate(msg._id, {
          scheduledStatus: "failed",
          schedulled: false,
        });
        continue;
      }

      const jid = msg.receiverMobile.includes("@s.whatsapp.net")
        ? msg.receiverMobile
        : `${msg.receiverMobile}@s.whatsapp.net`;

      // Detect media type safely
      const isImage =
        msg.contentType === "image" ||
        /\.(jpg|jpeg|png|gif)$/i.test(msg.mediaUrl);
      const isVideo =
        msg.contentType === "video" ||
        /\.(mp4|mov|avi|mkv)$/i.test(msg.mediaUrl);
      const isAudio =
        msg.contentType === "audio" || /\.(mp3|ogg|wav)$/i.test(msg.mediaUrl);
      const isDocument =
        msg.contentType === "document" ||
        /\.(pdf|docx?|xlsx?)$/i.test(msg.mediaUrl);

      // Prepare message payload dynamically
      let messagePayload = {};
      if (msg.mediaUrl) {
        if (isImage) messagePayload.image = { url: msg.mediaUrl };
        else if (isVideo) messagePayload.video = { url: msg.mediaUrl };
        else if (isAudio) messagePayload.audio = { url: msg.mediaUrl };
        else if (isDocument)
          messagePayload.document = {
            url: msg.mediaUrl,
            mimetype: "application/pdf",
          };
      } else {
        messagePayload.text = msg.content || "";
      }

      if (msg.caption) messagePayload.caption = msg.caption;

      // Send message via WhatsApp socket
      await sock.sendMessage(jid, messagePayload);

      console.log("Updating ID:", msg._id);
      // Update DB after success
      await messageModel.findByIdAndUpdate(msg._id, {
        schedulled: false,
        scheduledStatus: "scheduledSent",
        sentAt: new Date(),
      });

      console.log(` Message sent to ${msg.receiverMobile}`);
    }
    console.error(`Cron run successfully...`);
  } catch (error) {
    console.error(`Error in scheduling message:`, error.message);
  }
};

const getSentMessage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get status from query (optional)
    const status = req.query.status;

    // Base query
    const query = {
      schedulled: false,
      sender: req.user.userId,
    };

    // Apply filters
    if (status === "sent") {
      query.$or = [
        { scheduledStatus: "sent" },
        { scheduledStatus: "scheduledSent" },
      ];
    } else if (status === "pending") {
      query.$or = [{ scheduledStatus: "pending" }];
    } else {
      // Default: show all
      query.$or = [
        { scheduledStatus: "pending" },
        { scheduledStatus: "sent" },
        { scheduledStatus: "scheduledSent" },
      ];
    }

    //  Count total documents
    const totalMessages = await messageModel.countDocuments(query);

    //  Fetch paginated results
    const sentMessages = await messageModel
      .find(query)
      .populate("sender", "-password")
      .sort({
        scheduledStatus: 1, // "pending" first
        createdAt: -1, // newest within each group
      })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalMessages / limit);

    return sendResponse(res, 200, " Sent messages retrieved successfully", {
      currentPage: page,
      totalPages,
      totalMessages,
      pageSize: limit,
      data: sentMessages,
    });
  } catch (err) {
    console.error("Error fetching sent messages:", err);
    return sendError(res, 500, "Error fetching sent messages", err);
  }
};

const getDashboardStats = async (req, res) => {
  try {
    // if (req.user.role !== 'admin') {
    //     return res.status(403).json({ message: 'Access denied' });
    // }
    const activeSessions = Array.from(sessions.keys()).length;
    const totalMesasge = await messageModel.countDocuments({
      sender: req.user.userId,
      $or: [
        { scheduledStatus: "pending" },
        { scheduledStatus: "sent" },
        { scheduledStatus: "scheduledSent" },
      ],
    });
    const scheduledMessages = await messageModel.countDocuments({
      sender: req.user.userId,
      schedulled: true,
      scheduledStatus: "pending",
    });
    const sentMessages = await messageModel.countDocuments({
      sender: req.user.userId,
      $or: [{ scheduledStatus: "sent" }, { scheduledStatus: "scheduledSent" }],
    });
    sendResponse(res, 200, "Dashboard stats fetched successfully", {
      activeSessions,
      totalMesasge,
      scheduledMessages,
      sentMessages,
    });
  } catch (error) {
    sendError(res, 500, "Server error", error.message);
  }
};

const getUserData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await userModel.findById(userId).select("-password");
    if (!user) {
      return sendError(res, 404, "User not found");
    }
    // Get all session keys
    const allSessions = Array.from(sessions.keys());
    // Filter only this user's sessions
    const userSessions = allSessions.filter((id) => id.endsWith(`_${userId}`));

    //get user contacts
    const contacts = await contactModel.find({ userId: userId });
    // get user templates
    const templates = await templateModel.find({ userId: userId });
    return sendResponse(res, 200, "User data fetched successfully", {
      data: {
        user,
        sessions: userSessions,
        contacts,
        templates,
      },
    });
  } catch (error) {
    return sendError(res, 500, "Server error", error.message);
  }
};

// Export all functions
module.exports = {
  createSession,
  sendMessage,
  getSessions,
  sendMediaUrl,
  logoutSession,
  initSocket,
  getMessageById,
  getAllMessages,
  sendToMultiple,
  scheduleMessage,
  getScheduleMessage,
  sendScheduleMessage,
  getDashboardStats,
  getSentMessage,
  getUserData,
};

// Restore all sessions automatically at startup
restoreSessions();
