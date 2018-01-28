"use strict";

const express = require('express')
const mongodb = require('mongodb')

const app = express()

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

app.get('/', (req:any, res:any) => res.send('<b>Welcome to livote!</b> Lichess shadow app with verified user names.'))

app.get('/test', (req:any, res:any) => dbFind("test",{},(content:string)=>{
    res.send(content)
}))

app.listen(PORT, () => console.log(`livote server listening on ${PORT}`))

