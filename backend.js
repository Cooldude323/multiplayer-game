const express = require('express')
const app = express()

// socket.io setup
const http = require('http')
const { console } = require('inspector')
const server = http.createServer(app)
const { Server } = require('socket.io')
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 })

const port = process.env.PORT || 3000;

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

const backEndPlayers = {}
const backEndProjectiles = {}
const SPEED = 5
const RADIUS = 10
const PROJECTILE_RADIUS = 5 
const WORLD_WIDTH = 2048
const WORLD_HEIGHT = 1536
let projectileId = 0

io.on('connection', (socket) => {
  console.log('a user connected')
  

    io.emit('updatePlayers', backEndPlayers)

    

    socket.on('shoot', ({x, y, angle}) => {
      projectileId++;

         const velocity = {
         x: Math.cos(angle) * 10,
         y: Math.sin(angle) * 10
          }
      backEndProjectiles[projectileId] = {
        x, 
        y, 
        velocity,
        playerId: socket.id
      }

    })


    socket.on('initGame', ({username, width, height,  }) => {
      backEndPlayers[socket.id] = {
     x: WORLD_WIDTH * Math.random(),
     y: WORLD_HEIGHT * Math.random(),
     color: `hsl(${360 * Math.random()}, 100%, 50%)`,
     sequenceNumber: 0,
     score: 0,
     username
    }
     // where we init canvas
     backEndPlayers[socket.id].canvas = {
        width,
        height,
      }

       backEndPlayers[socket.id].radius = RADIUS

  })

    socket.on('disconnect', (reason) => {
      console.log(reason)
      delete backEndPlayers[socket.id]
      io.emit('updatePlayers', backEndPlayers)
    })

    socket.on('keydown', ({keycode, sequenceNumber}) => {
      const backEndPlayer = backEndPlayers[socket.id]
     
      if (!backEndPlayers[socket.id]) return

      backEndPlayers[socket.id].sequenceNumber = sequenceNumber 
       switch(keycode) {
    case 'KeyW':
      backEndPlayers[socket.id].y -= SPEED
      break

    case 'KeyA':
      backEndPlayers[socket.id].x -= SPEED
      break

    case 'KeyD':
      backEndPlayers[socket.id].x += SPEED
      break

    case 'KeyS':
      backEndPlayers[socket.id].y += SPEED
      break
  }
   const playerSides = {
        left: backEndPlayer.x - backEndPlayer.radius,
        right: backEndPlayer.x + backEndPlayer.radius,
        top: backEndPlayer.y - backEndPlayer.radius,
        bottom: backEndPlayer.y + backEndPlayer.radius
      }
      if (playerSides.left < 0) backEndPlayer.x = backEndPlayer.radius
      if (playerSides.right > WORLD_WIDTH) backEndPlayer.x = WORLD_WIDTH - backEndPlayer.radius
      if (playerSides.top < 0) backEndPlayer.y = backEndPlayer.radius
      if (playerSides.bottom > WORLD_HEIGHT) backEndPlayer.y = WORLD_HEIGHT - backEndPlayer.radius
 })

    // Handle joystick/move events from clients (dx/dy are local-prediction deltas)
    socket.on('move', ({dx, dy, sequenceNumber}) => {
      const backEndPlayer = backEndPlayers[socket.id]
      if (!backEndPlayer) return
      backEndPlayer.sequenceNumber = sequenceNumber
      backEndPlayer.x += dx
      backEndPlayer.y += dy

      // clamp to world bounds using radius
      const playerSides = {
        left: backEndPlayer.x - backEndPlayer.radius,
        right: backEndPlayer.x + backEndPlayer.radius,
        top: backEndPlayer.y - backEndPlayer.radius,
        bottom: backEndPlayer.y + backEndPlayer.radius
      }
      if (playerSides.left < 0) backEndPlayer.x = backEndPlayer.radius
      if (playerSides.right > WORLD_WIDTH) backEndPlayer.x = WORLD_WIDTH - backEndPlayer.radius
      if (playerSides.top < 0) backEndPlayer.y = backEndPlayer.radius
      if (playerSides.bottom > WORLD_HEIGHT) backEndPlayer.y = WORLD_HEIGHT - backEndPlayer.radius
    })
})
// backend ticker
setInterval(() => {

  // update projectile positions
   for(const id in backEndProjectiles) {
    
     backEndProjectiles[id].x += backEndProjectiles[id].velocity.x
     backEndProjectiles[id].y += backEndProjectiles[id].velocity.y

      // remove projectiles that are out of bounds
      const PROJECTILE_RADIUS = 5 
      if (
        backEndProjectiles[id].x - PROJECTILE_RADIUS >= WORLD_WIDTH ||
        backEndProjectiles[id].x + PROJECTILE_RADIUS <= 0 ||
        backEndProjectiles[id].y - PROJECTILE_RADIUS >= WORLD_HEIGHT ||
        backEndProjectiles[id].y + PROJECTILE_RADIUS <= 0 
      ) {
        delete backEndProjectiles[id]
        continue
      }

      for (const playerId in backEndPlayers) {
        const backEndPlayer = backEndPlayers[playerId]

        const DISTANCE = Math.hypot(
          backEndProjectiles[id].x - backEndPlayer.x,
          backEndProjectiles[id].y - backEndPlayer.y
        )
        // collision detected
        if (
          DISTANCE < PROJECTILE_RADIUS + backEndPlayer.radius && 
          backEndProjectiles[id].playerId !== playerId
        ) {
          if(backEndPlayers[backEndProjectiles[id].playerId])
          backEndPlayers[backEndProjectiles[id].playerId].score++


          delete backEndProjectiles[id]
          delete backEndPlayers[playerId]
          break
        }

      }
  }

  io.emit('updatePlayers', backEndPlayers)
  io.emit('updateProjectiles', backEndProjectiles)
}, 15)



server.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

console.log('Backend running...')