"use strict";
let TEST = false;
let UPVOTE_DIR = 1;
let DOWNVOTE_DIR = -2;
const express = require('express');
const mongodb = require('mongodb');
const formidable = require('formidable');
const nfetch = require('node-fetch');
const uniqid = require('uniqid');
const cookieParser = require('cookie-parser');
const ppath = require("path");
const app = express();
app.use(cookieParser());
app.use('/assets', express.static(ppath.join(__dirname, "assets")));
let PORT = 8080;
let MONGODB_URI = process.env.MONGODB_URI;
let USERS_COLL = "users";
let VOTES_COLL = "votes";
let ONE_HOUR = 3600 * 1000;
let ONE_DAY = 24 * ONE_HOUR;
let COOKIE_VALIDITY = 7 * ONE_DAY;
let VOTE_INTERVAL = TEST ? 10000 : ONE_DAY;
let userCookies = {};
let players = [{ name: "", lifes: 0 }];
function initPlayers() {
    players = [
        { name: "Lasker", lifes: 25 },
        { name: "Morphy", lifes: 25 },
        { name: "Steinitz", lifes: 25 },
        { name: "Capablanca", lifes: 25 },
        { name: "Karpov", lifes: 25 },
        { name: "Kasparov", lifes: 25 },
        { name: "Carlsen", lifes: 25 },
        { name: "Tal", lifes: 25 },
        { name: "Botvinnik", lifes: 25 },
        { name: "Fischer", lifes: 25 },
        { name: "Anand", lifes: 25 },
        { name: "Petrosian", lifes: 25 },
        { name: "Philidor", lifes: 25 },
        { name: "Staunton", lifes: 25 },
        { name: "Spassky", lifes: 25 },
    ];
}
initPlayers();
let votes = [];
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
function votesStartup() {
    if (db != null) {
        dbFind(VOTES_COLL, {}, function (result) {
            if (result[0]) {
                console.log("votes startup failed", result[0]);
            }
            else {
                console.log(`votes startup ok, ${result[1].length} vote(s)`);
                votes = [];
                for (let obj of result[1]) {
                    votes.push({
                        time: obj.time,
                        user: obj.user,
                        up: obj.up,
                        down: obj.down
                    });
                    votePlayer(obj.up, UPVOTE_DIR);
                    votePlayer(obj.down, DOWNVOTE_DIR);
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
            votesStartup();
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
function playersSelect(id) {
    return `
    <select id="${id}" name="${id}">
    <option value="none">Select player</option>
    ${players.map(player => `
    <option value="${player.name}">${player.name}</option>
    `)}
    </select>
    `;
}
function playerList(user) {
    players.sort((a, b) => b.lifes - a.lifes);
    let i = 1;
    return `
    <table class="maintable">
    <thead>
    <tr>
    <td>Ranking</td>
    <td>Votes</td>
    </tr>
    </thead>
    <tbody>
    <tr>
    <td>
    <table class="playerstable">
    <thead>
    <tr>
    <td>Rank</td>
    <td>Player name</td>
    <td>Lifes left</td>
    </tr>
    </thead>
    <tbody>
    ${players.map(player => `        
        <tr>
        <td class="playerranktd">${i++}.</td>
        <td class="playernametd">${player.name}</td>
        <td class="playerlifestd">${player.lifes}</td>
        </tr>        
    `).join("\n")}
    </tbody>
    </table>
    </td>
    <td>
    ${user != undefined || TEST ? `<div>
    <form method="post">
    <input type="hidden" name="action" value="vote">
    Up ${playersSelect("selectup")}
    Down ${playersSelect("selectdown")}
    <input type="submit" value="Vote">
    </form>
    </div>` : ``}    
    <div class="votesdiv">
    <ul>
    ${votes.slice().reverse().map((vote) => `
    <li>    
    ${new Date(vote.time).toLocaleString()}
    &nbsp;&nbsp;${vote.user} :
    Up ${vote.up} ,
    Down ${vote.down}
    </li>
    `).join("\n")}
    </ul>
    </div>
    </td>
    </tr>
    </tbody>
    </table>
    `;
}
function mainpage(body) {
    return `
    <!DOCTYPE html>

    <html>
    <head>
    <link rel="stylesheet" type="text/css" href="assets/stylesheets/app.css">
    </head>
    <body>
    ${body}
    </body>
    </html>
    `;
}
function loginpage(usercookie, message = "", messagekind = "normal") {
    console.log("loginpage", usercookie, message);
    let user;
    if (usercookie != undefined) {
        if (userCookies[usercookie] != undefined) {
            user = userCookies[usercookie];
        }
    }
    return `
    ${message == "" ? `` : `
    <div class="infodiv ${messagekind}">
    ${message}
    </div>
    <hr>
    `}
    ${user != undefined ? `
    <table>
    <tr>
    <td class="loggedintd">
    Logged in as ${user}.
    </td>
    <td>
    <form method="post">
    <input type="hidden" name="username" value="${user}">
    <input type="hidden" name="action" value="logout">
    <input type="submit" value="Log out">
    </form>
    </td>
    </tr>
    </table>
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
    <hr>
    ${playerList(user)}
    `;
}
function getPlayerI(name) {
    for (let i = 0; i < players.length; i++)
        if (players[i].name == name)
            return i;
    return -1;
}
function votePlayer(name, dir) {
    let i = getPlayerI(name);
    if (i >= 0) {
        players[i].lifes += dir;
    }
}
function vote(user, up, down) {
    if (user != undefined || TEST) {
        votePlayer(up, UPVOTE_DIR);
        votePlayer(down, DOWNVOTE_DIR);
        let now = new Date().getTime();
        let vote = {
            time: now,
            user: user,
            up: up,
            down: down
        };
        votes.push(vote);
        dbInsertMany(VOTES_COLL, [vote], function (result) {
            console.log(result);
        });
    }
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
                            res.send(mainpage(loginpage(cookie, `Info: ${username} logged in ok.`, "success")));
                        });
                    }
                    else {
                        res.send(mainpage(loginpage(undefined, `Error: code was not found in ${username}'s profile.`, "error")));
                    }
                });
            }
            else if (action == "logout") {
                res.clearCookie("user");
                res.send(mainpage(loginpage(null, `Info: ${username} logged out ok.`, "success")));
            }
            else if (action == "vote") {
                let usercookie = req.cookies.user;
                let up = fields["selectup"];
                let down = fields["selectdown"];
                let votesSame = (up == down);
                let upMissing = (up == "none");
                let downMissing = (down == "none");
                let canVote = true;
                let user = userCookies[usercookie];
                let minvotedist = Infinity;
                if (user != undefined) {
                    let now = new Date().getTime();
                    for (let vote of votes) {
                        let dist = (now - vote.time);
                        if ((vote.user == user) && (dist < VOTE_INTERVAL)) {
                            canVote = false;
                            if (dist < minvotedist)
                                minvotedist = dist;
                        }
                    }
                }
                let canvotedist = VOTE_INTERVAL - minvotedist;
                if (upMissing || downMissing || votesSame || (!canVote) || (user == undefined)) {
                    res.send(mainpage(loginpage(usercookie, `
                    Info: Invalid vote.
                    ${canVote ? `` : `
                    Not eligible to vote yet ( ${(canvotedist / ONE_HOUR).toLocaleString()} hours left ).
                    `}
                    ${!upMissing ? `` : `
                    You have to upvote a player.
                    `}
                    ${!downMissing ? `` : `
                    You have to downvote a player.
                    `}
                    ${!votesSame ? `` : `
                    Up and down vote has to differ.
                    `}
                    `, "error")));
                }
                else {
                    vote(user, up, down);
                    res.send(mainpage(loginpage(usercookie, `Info: Voted ok : Up ${up} , Down ${down}`, "success")));
                }
            }
        }
    });
});
app.get('/', (req, res) => res.send(mainpage(loginpage(req.cookies["user"]))));
app.get('/deletevotes', (req, res) => {
    votes = [];
    initPlayers();
    dbDeleteMany(VOTES_COLL, {}, (result) => {
        res.send(mainpage(browserify(result)));
    });
});
app.listen(PORT, () => console.log(`livote server listening on ${PORT}`));
