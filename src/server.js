const fs = require('fs')
const path = require('path')
const request = require('request')

let config = {}

try {
  let configfile = fs.readFileSync(path.join(__dirname, './../config.json')).toString()
  config = JSON.parse(configfile)
} catch (e) {
  console.log('create config.json please!')
  process.exit(1)
}

const apiurl = `https://api.telegram.org/bot${config.token}/`

const express = require('express')
const bodyParser = require('body-parser')
const rds = require('redis').createClient(6379, '127.0.0.1', {})
const app = express()

const sendMessage = (opt, msg, chatid, cb) => {
  if (typeof opt === 'string') {
    cb = chatid
    chatid = msg
    msg = opt
    opt = {}
  }
  opt.chat_id = chatid
  opt.text = msg

  let reqopt = {
    uri: `${apiurl}sendMessage`,
    form: opt,
    proxy: config.debug ? 'http://127.0.0.1:9256' : undefined,
  }
  request(reqopt, (err, res, body) => {
    cb(err, body)
  })
}

app.use(bodyParser.urlencoded({extended: true}))

app.post('/sendMessage', (req, res) => {
  let key = req.body.key || null
  let message = req.body.message || null
  if (key && message) {
    rds.get(`foal-key-${key}`, (err, chatid) => {
      if (chatid) {
        sendMessage(message, chatid, (err, body) => {
          console.log(body)
        })
      }
    })
  }
})

app.post('/', (req, res) => {
  req.on('data', (chunk) => {
    let data = JSON.parse(chunk.toString())
    if (config.debug) console.log(JSON.stringify(data, null, 4))
    switch (data.message.text) {
      case '/start':
        let chatid = data.message.from.id
        let username = data.message.from.username
        rds.get(`foal-user-${username}`, (err, key) => {
          if (key) {
            rds.get(`foal-key-${key}`, (err, chatid) => {
              let reply = `You have started!

Your key is \`${key}\`,
You can post to foal.cnwangjie.com/sendMessage to send message to yourself like following code

\`\`\`
curl -d 'key=${key}&message=test' foal.cnwangjie.com/sendMessage
\`\`\`
`
              sendMessage({parse_mode: 'markdown'}, reply, chatid, (err, body) => {
                res.status(200).send('sended!').end()
              })
            })
          } else {
            key = ''
            for (let i = 0; i < 16; i += 1) key += '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM'[(Math.random() * 62) << 0]

            let reply = `Welcome! ${data.message.from.first_name}

Your key is \`${key}\`,
You can post to foal.cnwangjie.com/sendMessage to send message to yourself like following code

\`\`\`
curl -d 'key=${key}&message=test' foal.cnwangjie.com/sendMessage
\`\`\`
`
            rds.set(`foal-key-${key}`, chatid, (err) => {
              rds.set(`foal-user-${username}`, key, (err) => {
                sendMessage({parse_mode: 'markdown'}, reply, chatid, (err, body) => {
                  console.log(body)
                })
              })
            })
          }
        })
        break;
      default:

    }
  })

  req.on('close', () => {
    res.status(200).send('true').end()
  })
})


app.listen(9001)
