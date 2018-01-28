"use strict";
const express = require('express');
const mongodb = require('mongodb');
const app = express();
let PORT = 8080;
let MONGODB_URI = process.env.MONGODB_URI;
console.log(`mongo uri ${MONGODB_URI}`);
let db = null;
try {
    mongodb.connect(MONGODB_URI, function (err, conn) {
        if (err) {
            console.log(err);
        }
        else {
            db = conn;
            console.log(`connected to MongoDB database < ${db.databaseName} >`);
        }
    });
}
catch (err) {
    console.log(err);
}
function dbFind(collectionName, query, callback) {
    const collection = db.collection(collectionName);
    // Find documents
    collection.find(query).toArray(function (err, docs) {
        callback("<pre>" + JSON.stringify([err, docs], null, 5) + "</pre>");
    });
}
app.get('/', (req, res) => res.send('<b>Welcome to livote!</b> Lichess shadow app.'));
app.get('/test', (req, res) => dbFind("test", {}, (content) => {
    res.send(content);
}));
app.listen(PORT, () => console.log(`livote server listening on ${PORT}`));
