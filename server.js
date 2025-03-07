import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import admin from "./firebaseConfig.js"; // Import the firebaseConfig module
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import validator from "validator";

dotenv.config(); // Load environment variables

const app = express(); // ✅ Define app first
const db = admin.firestore();

// ✅ Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "https://the-cube-waitlist.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: "GET,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization",
  })
);

app.options("*", cors());

app.use(express.json()); // ✅ Middleware to parse JSON

// ✅ Rate Limiting (Security)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: "Too many requests, please try again later.",
});
app.use(limiter);

// ✅ Nodemailer Setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
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
    console.log(`Email sent`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

// ✅ Function to Check for Duplicate Entries
const isDuplicateEntry = async (email) => {
  const querySnapshot = await db
    .collection("waitlist")
    .where("email", "==", email)
    .get();
  return !querySnapshot.empty;
};

// ✅ Route to Add a New Entry
app.post("/add-entry", async (req, res) => {
  const { email } = req.body;
  const cleanedEmail = email?.trim(); // Remove spaces

  // Validate email format
  if (!cleanedEmail || !validator.isEmail(cleanedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    // Check if the email already exists in Firestore
    const querySnapshot = await db.collection("waitlist").where("email", "==", cleanedEmail).get();

    if (!querySnapshot.empty) {
      return res.status(409).json({ error: "Duplicate email detected" }); // Send 409 if duplicate
    }

    // Add the new email entry
    await db.collection("waitlist").add({ email: cleanedEmail });
    await sendConfirmationEmail(cleanedEmail);

    res.status(200).json({ message: `Email sent to ${cleanedEmail}` });
  } catch (error) {
    console.error("Error adding entry:", error.message);
    res.status(500).json({ error: "Error adding entry" });
  }
});

// ✅ Route to Retrieve All Entries
app.get("/get-all-entries", async (req, res) => {
  try {
    const querySnapshot = await db.collection("waitlist").get();
    const entries = [];
    querySnapshot.forEach((doc) => entries.push(doc.data()));
    res.status(200).json(entries);
  } catch (error) {
    console.error("Error retrieving entries:", error);
    res.status(500).send("Error retrieving entries");
  }
});

// ✅ Route to Delete an Entry
app.delete("/delete-entry", async (req, res) => {
  const { email } = req.body;
  try {
    const querySnapshot = await db
      .collection("waitlist")
      .where("email", "==", email)
      .get();

    if (querySnapshot.empty) {
      return res.status(404).send(`No entry found for ${email}`);
    }

    // Delete all matching entries
    const deletePromises = querySnapshot.docs.map((doc) =>
      db.collection("waitlist").doc(doc.id).delete()
    );
    await Promise.all(deletePromises);

    res.status(200).send(`Deleted entry: ${email}`);
  } catch (error) {
    console.error("Error deleting entry:", error);
    res.status(500).send("Error deleting entry");
  }
});

// ✅ Route to Delete All Entries
app.delete("/delete-all-entries", async (req, res) => {
  try {
    const querySnapshot = await db.collection("waitlist").get();
    if (querySnapshot.empty) {
      return res.status(404).send("No entries found");
    }

    // Delete all entries
    const deletePromises = querySnapshot.docs.map((doc) =>
      db.collection("waitlist").doc(doc.id).delete()
    );
    await Promise.all(deletePromises);

    res.status(200).send("Deleted all entries");
  } catch (error) {
    console.error("Error deleting all entries:", error);
    res.status(500).send("Error deleting all entries");
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));