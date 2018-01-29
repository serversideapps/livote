"use strict";
const express = require('express');
const mongodb = require('mongodb');
const formidable = require('formidable');
const nfetch = require('node-fetch');
const uniqid = require('uniqid');
const cookieParser = require('cookie-parser');
const app = express();
app.use(cookieParser());
let PORT = 8080;
let MONGODB_URI = process.env.MONGODB_URI;
let USERS_COLL = "test";
let COOKIE_VALIDITY = 7 * 24 * 3600 * 1000;
let userCookies = {};
console.log(`mongo uri ${MONGODB_URI}`);
let db = null;
function usersStartup() {
    if (db != null) {
        dbFind(USERS_COLL, {}, function (result) {
            if (result[0]) {
                console.log("users startup failed", result[0]);
            }
            else {
                console.log(`users startup ok, ${result[1].length} cookie(s)`);
                for (let obj of result[1]) {
                    let now = new Date().getTime();
                    if ((now - obj.time) < 2 * COOKIE_VALIDITY)
                        userCookies[obj.cookie] = obj.username;
                }
            }
        });
    }
}
try {
    mongodb.connect(MONGODB_URI, function (err, conn) {
        if (err) {
            console.log(err);
        }
        else {
            db = conn;
            console.log(`connected to MongoDB database < ${db.databaseName} >`);
            usersStartup();
        }
    });
}
catch (err) {
    console.log(err);
}
function browserify(json) {
    return "<pre>" + JSON.stringify(json, null, 5) + "</pre>";
}
function dbFind(collectionName, query, callback) {
    const collection = db.collection(collectionName);
    // Find documents
    collection.find(query).toArray(function (err, docs) {
        callback([err, docs]);
    });
}
function dbInsertMany(collectionName, docs, callback) {
    const collection = db.collection(collectionName);
    // Find documents
    collection.insertMany(docs, function (err, result) {
        callback([err, result]);
    });
}
function dbDeleteMany(collectionName, query, callback) {
    const collection = db.collection(collectionName);
    // Find documents
    collection.deleteMany(query, function (err, result) {
        callback([err, result]);
    });
}
function loginpage(usercookie, message = "") {
    console.log("loginpage", usercookie, message);
    let user;
    if (usercookie != undefined) {
        if (userCookies[usercookie] != undefined) {
            user = userCookies[usercookie];
        }
    }
    return `
    ${message == "" ? "" : "<hr>" + message + "<hr>"}
    ${user != undefined ? `
    Logged in as ${user}.
    <hr>
    <form method="post">
    <input type="hidden" name="username" value="${user}">
    <input type="hidden" name="action" value="logout">
    <input type="submit" value="Log out">
    </form>
    ` : `
    <b>Welcome to livote!</b>
    <hr>
    To log in, enter your lichess username then press Submit.
    You will receive a code and further instructions.
    <hr>
    <form method="post">
    Username: <input type="text" name="username">
    <input type="hidden" name="action" value="login">
    <input type="submit" value="Submit">
    </form>
    `}
    `;
}
app.post('/', (req, res) => {
    let form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
        if (err) {
            res.send("?");
        }
        else {
            console.log("post/", fields);
            let action = fields["action"];
            let username = fields["username"];
            if (action == "login") {
                let code = uniqid();
                res.send(`
                    Enter this code into your profile: <input type="text" value="${code}"><hr>
                    When you are ready, press Submit.
                    The app then will verify the presence of the code in your profile page.
                    If the code is present you will be logged in ( the login cookie is valid for a week ).
                    When logged in, you can delete the code from your profile safely.
                    <hr>
                    <form method="post">
                    <input type="hidden" name="username" value="${username}">
                    <input type="hidden" name="action" value="checklogin">
                    <input type="hidden" name="code" value="${code}">
                    <input type="submit" value="Submit">                    
                    </form>                    
                `);
            }
            else if (action == "checklogin") {
                let code = fields["code"];
                nfetch(`https://lichess.org/@/${username}`).then((response) => response.text()).
                    then((content) => {
                    let index = content.indexOf(code);
                    if (index >= 0) {
                        let cookie = username + "_" + uniqid();
                        userCookies[cookie] = username;
                        let doc = {
                            cookie: cookie,
                            username: username,
                            time: new Date().getTime()
                        };
                        dbInsertMany(USERS_COLL, [doc], function (result) {
                            res.cookie("user", cookie, { maxAge: COOKIE_VALIDITY });
                            res.send(loginpage(cookie, `Info: ${username} logged in ok.`));
                        });
                    }
                    else {
                        res.send(loginpage(undefined, `Error: code was not found in ${username}'s profile.`));
                    }
                });
            }
            else if (action == "logout") {
                res.clearCookie("user");
                res.send(loginpage(null, `Info: ${username} logged out ok.`));
            }
        }
    });
});
app.get('/', (req, res) => res.send(loginpage(req.cookies["user"])));
app.get('/test', (req, res) => dbFind("test", {}, (result) => {
    res.send(browserify(result));
}));
app.get('/testi', (req, res) => dbInsertMany("test", [{ key1: "value1" }, { key2: "value2" }], (result) => {
    res.send(browserify(result));
}));
app.get('/testd', (req, res) => dbDeleteMany("test", {}, (result) => {
    res.send(browserify(result));
}));
app.listen(PORT, () => console.log(`livote server listening on ${PORT}`));
