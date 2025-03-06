// filepath: /path/to/your/backend/server.js
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import admin from "./firebaseConfig.js"; // Import the firebaseConfig module
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

const db = admin.firestore();

const app = express();

// Use CORS middleware
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
  console.log(`Checking for duplicate entry: ${email}`);
  console.log(`Query snapshot size: ${querySnapshot.size}`);
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

// ✅ Function to Check Current Entries in the Collection
const checkDeletions = async () => {
  const querySnapshot = await db.collection("waitlist").get();
  console.log("Current entries in the waitlist collection:");
  querySnapshot.forEach((doc) => {
    console.log(doc.id, " => ", doc.data());
  });
};

// ✅ Check Deletions on Server Start
checkDeletions();

// ✅ Route to Delete an Entry
app.delete("/delete-entry", async (req, res) => {
  const { email } = req.body;
  try {
    const querySnapshot = await db.collection("waitlist").where("email", "==", email).get();
    if (querySnapshot.empty) {
      console.log(`No entry found for ${email}`);
      return res.status(404).send(`No entry found for ${email}`);
    }
    querySnapshot.forEach(async (doc) => {
      await db.collection("waitlist").doc(doc.id).delete();
      console.log(`Deleted entry: ${email}`);
    });
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
      console.log("No entries found in the waitlist collection");
      return res.status(404).send("No entries found in the waitlist collection");
    }
    querySnapshot.forEach(async (doc) => {
      await db.collection("waitlist").doc(doc.id).delete();
      console.log(`Deleted entry: ${doc.id}`);
    });
    res.status(200).send("Deleted all entries");
  } catch (error) {
    console.error("Error deleting all entries:", error);
    res.status(500).send("Error deleting all entries");
  }
});

// ✅ Route to Retrieve All Entries
app.get("/get-all-entries", async (req, res) => {
  try {
    const querySnapshot = await db.collection("waitlist").get();
    const entries = [];
    querySnapshot.forEach((doc) => {
      entries.push(doc.data());
    });
    res.status(200).json(entries);
  } catch (error) {
    console.error("Error retrieving entries:", error);
    res.status(500).send("Error retrieving entries");
  }
});

// ✅ Route to Add a New Entry
app.post("/add-entry", async (req, res) => {
  const { email } = req.body;
  try {
    const isDuplicate = await isDuplicateEntry(email);
    if (!isDuplicate) {
      await db.collection("waitlist").add({ email });
      await sendConfirmationEmail(email);
      res.status(200).send(`Email sent to ${email}`);
    } else {
      res.status(409).send(`Duplicate entry detected for ${email}, no email sent.`);
    }
  } catch (error) {
    console.error("Error adding entry:", error);
    res.status(500).send("Error adding entry");
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));