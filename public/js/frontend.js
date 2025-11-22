const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

const socket = io()

const scoreEl = document.querySelector('#scoreEl')

const devicePixelRatio = window.devicePixelRatio || 1

canvas.width = 1024 * devicePixelRatio
canvas.height = 576 * devicePixelRatio
 
c.scale(devicePixelRatio, devicePixelRatio)

// World boundaries
const WORLD_WIDTH = 2048
const WORLD_HEIGHT = 1536

// Camera instance
let camera = null

// Background image for tiling
const bgImage = new Image()
bgImage.src = '/img/webb-dark.png'

const x = canvas.width / 2
const y = canvas.height / 2

const frontEndPlayers = {}
const frontEndProjectiles = {}



socket.on('updateProjectiles', (backEndProjectiles) => {
   for (const id in backEndProjectiles) {
    const backEndProjectile = backEndProjectiles[id]

    if (!frontEndProjectiles[id]) {
      frontEndProjectiles[id] =  new Projectile({
         x: backEndProjectile.x,
         y: backEndProjectile.y,
         radius: 5,
         color: frontEndPlayers[backEndProjectile.playerId]?.color,
         velocity: backEndProjectile.velocity
    })
    } else {
      frontEndProjectiles[id].x += backEndProjectiles[id].velocity.x
      frontEndProjectiles[id].y += backEndProjectiles[id].velocity.y
   }
  }

   for (const frontEndProjectileId in frontEndProjectiles) {
    if (!backEndProjectiles[frontEndProjectileId]) {
      delete frontEndProjectiles[frontEndProjectileId]
    }
  }
})

socket.on('updatePlayers', (backendPlayers) => {
  for (const id in backendPlayers) {
    const backEndPlayer = backendPlayers[id]

    if (!frontEndPlayers[id]) {
      frontEndPlayers[id] = new Player({
      x: backEndPlayer.x,
      y: backEndPlayer.y,
      radius: 10,
      color: backEndPlayer.color,
      username: backEndPlayer.username
      })

      document.querySelector(
        '#playerLabels'
      ).innerHTML += `<div data-id="${id}" data-score="${backEndPlayer.score}">${backEndPlayer.username}: ${backEndPlayer.score}</div>`

    } else {

     document.querySelector(`div[data-id="${id}"]`).innerHTML = `${backEndPlayer.username}: ${backEndPlayer.score}`
      
      document.querySelector(
        `div[data-id="${id}"]`
      ).setAttribute('data-score', backEndPlayer.score)
      // sorts layers divs
      const parentDiv = document.querySelector('#playerLabels')
      const childDivs = Array.from(parentDiv.querySelectorAll('div'))

      childDivs.sort((a, b) => {
         const scoreA = Number(a.getAttribute('data-score'))
         const scoreB = Number(b.getAttribute('data-score'))
        return scoreB - scoreA
      })
      // removes old elements
      childDivs.forEach(div => {
        parentDiv.removeChild(div)
      })
      // adds sorted elements
      childDivs.forEach(div => {
        parentDiv.appendChild(div)
      })

      frontEndPlayers[id].target = {
        x: backEndPlayer.x,
        y: backEndPlayer.y
      }


      if (id === socket.id) {
      const lastBackendInputIndex =  playerInputs.findIndex(input => {
        return backEndPlayer.sequenceNumber === input.sequenceNumber
      })

      if (lastBackendInputIndex > -1) {
      playerInputs.splice(0, lastBackendInputIndex + 1)
      }
       playerInputs.forEach(input => {
        frontEndPlayers[id].target.x += input.dx
        frontEndPlayers[id].target.y += input.dy
       })
      }
    }
  }
  // this is where frontend players are deleted
  for (const id in frontEndPlayers) {
    if (!backendPlayers[id]) {
      const divToDelete = document.querySelector(`div[data-id="${id}"]`)
      divToDelete.parentNode.removeChild(divToDelete)

      if (id === socket.id) {
        document.querySelector('#usernameForm').style.display = 'block'
      }

      delete frontEndPlayers[id]
    }
  }
})

let animationId
function animate() {
  animationId = requestAnimationFrame(animate)
  
  // Initialize camera if not already done
  if (!camera && frontEndPlayers[socket.id]) {
    camera = new Camera({
      x: 0,
      y: 0,
      width: canvas.width / devicePixelRatio,
      height: canvas.height / devicePixelRatio
    })
  }
  
  // Update camera to follow player
  if (camera && frontEndPlayers[socket.id]) {
    const player = frontEndPlayers[socket.id]
    camera.x = player.x - (canvas.width / devicePixelRatio) / 2
    camera.y = player.y - (canvas.height / devicePixelRatio) / 2
    
    // Clamp camera to world bounds
    if (camera.x < 0) camera.x = 0
    if (camera.y < 0) camera.y = 0
    if (camera.x + canvas.width / devicePixelRatio > WORLD_WIDTH) {
      camera.x = WORLD_WIDTH - canvas.width / devicePixelRatio
    }
    if (camera.y + canvas.height / devicePixelRatio > WORLD_HEIGHT) {
      camera.y = WORLD_HEIGHT - canvas.height / devicePixelRatio
    }
  }
  
  // Clear canvas with base color
  c.fillStyle = '#94a3b8'
  c.fillRect(0, 0, canvas.width, canvas.height)

  // Save canvas state and apply camera translation
  c.save()
  if (camera) {
    c.translate(-camera.x * devicePixelRatio, -camera.y * devicePixelRatio)
  }
  
  // Draw tiled background image in world space
  if (camera && bgImage.complete) {
    const tileWidth = bgImage.width
    const tileHeight = bgImage.height
    
    // Calculate which tiles are visible
    const startTileX = Math.floor(camera.x / tileWidth)
    const startTileY = Math.floor(camera.y / tileHeight)
    const endTileX = Math.ceil((camera.x + canvas.width / devicePixelRatio) / tileWidth)
    const endTileY = Math.ceil((camera.y + canvas.height / devicePixelRatio) / tileHeight)
    
    // Draw visible tiles
    for (let tileY = startTileY; tileY < endTileY; tileY++) {
      for (let tileX = startTileX; tileX < endTileX; tileX++) {
        c.drawImage(bgImage, tileX * tileWidth, tileY * tileHeight)
      }
    }
  }

  for(const id in frontEndPlayers) {
    const frontEndPlayer = frontEndPlayers[id]
    // linear interpolation
    if (frontEndPlayer.target) {
      frontEndPlayers[id].x += (frontEndPlayers[id].target.x - frontEndPlayers[id].x) * 0.5
      frontEndPlayers[id].y += (frontEndPlayers[id].target.y - frontEndPlayers[id].y) * 0.5
    }

    frontEndPlayer.draw()
  }

   for(const id in frontEndProjectiles) {
    const frontEndProjectile = frontEndProjectiles[id]
    frontEndProjectile.draw()
  }
  
  // Restore canvas state
  c.restore()
}

animate()

const keys = {
  w: { pressed: false },
  a: { pressed: false },
  s: { pressed: false },
  d: { pressed: false }
}

const SPEED = 5
const playerInputs = []
let sequenceNumber = 0
setInterval(() => {
  if (keys.w.pressed) {
     sequenceNumber++
     playerInputs.push({sequenceNumber, dx: 0, dy: -SPEED})
     frontEndPlayers[socket.id].y -= SPEED
     socket.emit('keydown', {keycode:'KeyW', sequenceNumber})

  }

  if (keys.a.pressed) {
     sequenceNumber++
     playerInputs.push({sequenceNumber, dx: -SPEED, dy: 0})
     frontEndPlayers[socket.id].x -= SPEED
     socket.emit('keydown',  {keycode:'KeyA', sequenceNumber})
  }

  if (keys.s.pressed) {
     sequenceNumber++
     playerInputs.push({sequenceNumber, dx: 0, dy: SPEED})
     frontEndPlayers[socket.id].y += SPEED
     socket.emit('keydown',  {keycode:'KeyS', sequenceNumber})
  }

  if (keys.d.pressed) {
     sequenceNumber++
     playerInputs.push({sequenceNumber, dx: SPEED, dy: 0})
     frontEndPlayers[socket.id].x += SPEED
     socket.emit('keydown',  {keycode:'KeyD', sequenceNumber})
  }
}, 15) 

window.addEventListener('keydown', (event) => {
  if (!frontEndPlayers[socket.id]) return

  switch(event.code) {
    case 'KeyW':
     keys.w.pressed = true
     break

    case 'KeyA':
      keys.a.pressed = true
      break

    case 'KeyD':
      keys.d.pressed = true
      break

    case 'KeyS':
      keys.s.pressed = true
      break
  }
})

window.addEventListener('keyup', (event) => {
   if (!frontEndPlayers[socket.id]) return

  switch(event.code) {
    case 'KeyW':
     keys.w.pressed = false
     break

    case 'KeyA':
     keys.a.pressed = false
      break

    case 'KeyD':
      keys.d.pressed = false
      break

    case 'KeyS':
      keys.s.pressed = false
      break
  }
})

document.querySelector('#usernameForm').addEventListener('submit',
   (event) => {
  event.preventDefault()
  document.querySelector('#usernameForm').style.display = 'none'
  socket.emit('initGame', {width: canvas.width,
    height: canvas.height,
    devicePixelRatio,
    username: document.querySelector('#usernameInput').value})
})