const admin = require("firebase-admin");

const serviceAccount = require("./quarantinegames-2f65a-865d88e642c6.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://quarantinegames-2f65a.firebaseio.com"
});

module.exports = admin;
