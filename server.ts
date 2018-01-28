"use strict";

const express = require('express')
const mongodb = require('mongodb')
const formidable = require('formidable')
const nfetch = require('node-fetch')
const uniqid = require('uniqid')
const cookieParser = require('cookie-parser')

const app = express()

app.use(cookieParser())

let PORT = 8080

let MONGODB_URI = process.env.MONGODB_URI

console.log(`mongo uri ${MONGODB_URI}`)

let db:any = null

try{
    mongodb.connect(MONGODB_URI, function(err:any, conn:any){
        if (err){
            console.log(err)      
        }else{
            db = conn
            console.log(`connected to MongoDB database < ${db.databaseName} >`)
        }
    })
}catch(err){
    console.log(err)
}

function dbFind(collectionName:string,query:any,callback:any){
    const collection = db.collection(collectionName)
    // Find documents
    collection.find(query).toArray(function(err:any, docs:any) {
        callback("<pre>"+JSON.stringify([err,docs],null,5)+"</pre>")
    })
}

let userCookies:{[id:string]:string}={}

function loginpage(usercookie:any,message:string=""):string{
    let user    
    if(usercookie!=undefined){
        if(userCookies[usercookie]!=undefined){
            user=userCookies[usercookie]
        }
    }
    return `
    ${message==""?"":"<hr>"+message+"<hr>"}
    ${user!=undefined?`
    Logged in as ${user}.
    <hr>
    <form method="post">
    <input type="hidden" name="username" value="${user}">
    <input type="hidden" name="action" value="logout">
    <input type="submit" value="Log out">
    </form>
    `:`
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
    `
}

app.post('/', (req:any, res:any) => {
    let form = new formidable.IncomingForm()
 
    form.parse(req, function(err:any, fields:any, files:any){
        if(err){
            res.send("?")
        }else{            
            let action=fields["action"]
            let username=fields["username"]
            if(action=="login"){
                let code=uniqid()
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
                `)
            }else if(action=="checklogin"){
                let code=fields["code"]
                nfetch(`https://lichess.org/@/${username}`).then((response:any)=>response.text()).
                then((content:any)=>{
                    let index=(<string>content).indexOf(code)
                    if(index>=0){
                        let cookie=username+"_"+uniqid()
                        userCookies[cookie]=username
                        res.cookie("user",cookie,{maxAge:7*24*3600*1000})
                        res.send(loginpage(cookie,`Info: ${username} logged in ok.`))
                    }else{
                        res.send(loginpage(undefined,`Error: code was not found in ${username}'s profile.`))
                    }
                })
            }else if(action=="logout"){
                res.clearCookie("user")
                res.send(loginpage(null,`Info: ${username} logged out ok.`))
            }
        }
    })
})

app.get('/', (req:any, res:any) => res.send(loginpage(req.cookies["user"])))

app.get('/test', (req:any, res:any) => dbFind("test",{},(content:string)=>{
    res.send(content)
}))

app.listen(PORT, () => console.log(`livote server listening on ${PORT}`))

