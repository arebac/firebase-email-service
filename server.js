import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import admin from "./firebaseConfig.js"; // Import the firebaseConfig module
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json()); // Middleware to parse JSON

// ✅ Nodemailer Transport (Use Gmail, SendGrid, or Mailgun)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail
    pass: process.env.EMAIL_PASS, // Your App Password (Not your Gmail password)
  },
});

// ✅ Function to Send Emails
const sendConfirmationEmail = async (email) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "You're on The Cube Waitlist! 🎉",
    text: `Hey! We received your registration for The Cube's Web App. We'll notify you when we go live! 🚀`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${email}`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

// ✅ Function to Check for Duplicate Entries
const isDuplicateEntry = async (email) => {
  const querySnapshot = await db.collection("waitlist").where("email", "==", email).get();
  return !querySnapshot.empty;
};

// ✅ Firestore Listener (Triggers when a new email is added)
db.collection("waitlist").onSnapshot((snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === "added") {
      const data = change.doc.data();
      console.log("New Waitlist Entry:", data.email);

      const isDuplicate = await isDuplicateEntry(data.email);
      if (!isDuplicate) {
        await sendConfirmationEmail(data.email);
      } else {
        console.log(`Duplicate entry detected for ${data.email}, no email sent.`);
      }
    }
  });
});

// ✅ Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));