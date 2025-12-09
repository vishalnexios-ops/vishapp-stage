const humanDelay = () => {
  return 10000 + Math.floor(Math.random() * 5000); // 10s to 15s
};

const randomVariation = (text) => {
  const variations = [text, text + " 🙂", "Hi, " + text, text + " 🙏"];
  return variations[Math.floor(Math.random() * variations.length)];
};

const toISTDate = (scheduledTime) => {
  // From "2025-12-09T21:03:00" → "2025-12-09T21:03:00+05:30"
  const iso = scheduledTime + "+05:30";
  return new Date(iso);
};

const safeSendBulk = async (sock, numbers, message, allowedToSend) => {
  let sent = 0;

  for (let num of numbers.slice(0, allowedToSend)) {
    const jid = num.includes("@s.whatsapp.net") ? num : `${num}@s.whatsapp.net`;

    try {
      const finalMessage = randomVariation(message);

      // Send
      await sock.sendMessage(jid, { text: finalMessage });
      sent++;

      console.log("Sent to:", num);

      // Human-like delay
      await new Promise((r) => setTimeout(r, humanDelay()));
    } catch (err) {
      console.log("Failed:", num, err.message);
    }
  }

  return sent;
};

// Retry system
async function safeSend(sock, jid, payload) {
  let retries = 2;

  while (retries--) {
    try {
      await sock.sendMessage(jid, payload);
      return true; // success
    } catch (err) {
      console.error(`Retry failed. Attempts left ${retries}`, err.message);
      await new Promise((res) => setTimeout(res, humanDelay()));
    }
  }

  return false; // failed after retries
}

module.exports = {
  humanDelay,
  randomVariation,
  safeSendBulk,
  safeSend,
  toISTDate,
};
