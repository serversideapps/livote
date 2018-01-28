"use strict";

const express = require('express')
const mongodb = require('mongodb')

const app = express()

let PORT = 8080

let MONGODB_URI = process.env.MONGODB_URI

console.log(`mongo uri ${MONGODB_URI}`)

let db = null

mongodb.connect(MONGODB_URI, function(err:any, conn:any){
    if (err){
        console.log(err)      
    }else{
        db = conn
        console.log(`connected to MongoDB database < ${db.databaseName} >`)
    }
})

app.get('/', (req:any, res:any) => res.send('<b>Welcome to livote!</b> Lichess shadow app.'))

app.listen(PORT, () => console.log(`livote server listening on ${PORT}`))

