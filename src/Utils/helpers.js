const humanDelay = () => {
      return 10000 + Math.floor(Math.random() * 5000); // 10s to 15s
}


const randomVariation = (text) => {
      const variations = [
            text,
            text + " 🙂",
            "Hi, " + text,
            text + " 🙏",
      ];
      return variations[Math.floor(Math.random() * variations.length)];
}


const safeSendBulk = async (sock, numbers, message, allowedToSend) => {
      let sent = 0;

      for (let num of numbers.slice(0, allowedToSend)) {
            const jid = num.includes("@s.whatsapp.net")
                  ? num
                  : `${num}@s.whatsapp.net`;

            try {
                  
                  const finalMessage = randomVariation(message);

                  // Send
                  await sock.sendMessage(jid, { text: finalMessage });
                  sent++;

                  console.log("Sent to:", num);

                  // Human-like delay
                  await new Promise(r => setTimeout(r, humanDelay()));
            } catch (err) {
                  console.log("Failed:", num, err.message);
            }
      }

      return sent;
}



module.exports = {
      humanDelay,
      randomVariation,
      safeSendBulk
};
