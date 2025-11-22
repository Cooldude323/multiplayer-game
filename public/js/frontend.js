const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

const socket = io()

const scoreEl = document.querySelector('#scoreEl')

let devicePixelRatio = window.devicePixelRatio || 1

function resizeCanvas() {
  devicePixelRatio = window.devicePixelRatio || 1
  // Use full viewport size on smaller screens so mobile fills the display.
  // Keep a maximum logical size of 1024x576 for larger screens.
  let cssWidth = Math.min(1024, window.innerWidth)
  let cssHeight = Math.min(576, window.innerHeight)

  // Maintain 16:9 if possible, but fall back to full viewport when necessary
  const aspect = 1024 / 576
  if (cssWidth / cssHeight > aspect) {
    cssWidth = Math.round(cssHeight * aspect)
  } else {
    cssHeight = Math.round(cssWidth / aspect)
  }

  canvas.width = Math.round(cssWidth * devicePixelRatio)
  canvas.height = Math.round(cssHeight * devicePixelRatio)

  // Set CSS size so the canvas displays at the intended logical size
  canvas.style.width = cssWidth + 'px'
  canvas.style.height = cssHeight + 'px'

  // Reset transform and scale for high-DPR rendering
  c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
}

resizeCanvas()
window.addEventListener('resize', () => {
  resizeCanvas()
})

// Mobile mode - determined by user checkbox
let IS_MOBILE = false

// World boundaries
const WORLD_WIDTH = 2048
const WORLD_HEIGHT = 1536

// Camera instance
let camera = null

// Background image for tiling
const bgImage = new Image()
bgImage.src = '/img/webb-dark.png'

// Joystick for mobile - will be initialized after canvas is ready
let joystick = null

// Debug state visible on-screen for devices without remote console
window.DEBUG = window.DEBUG || {
  lastTouch: null,
  lastShoot: null,
  mouseDown: false
}

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
        const usernameForm = document.querySelector('#usernameForm')
        usernameForm.style.display = 'block'
        if (usernameForm.parentElement) {
          usernameForm.parentElement.style.display = 'flex'
        }
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
  
  // Initialize joystick if mobile and not already done
  if (IS_MOBILE && !joystick && frontEndPlayers[socket.id]) {
    joystick = new Joystick({
      x: 80,
      y: (canvas.height / devicePixelRatio) - 80,
      radius: 60,
      innerRadius: 30
    })
    console.log('Joystick initialized:', joystick)
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
  // Draw in CSS (logical) pixels — canvas.width/height are device pixels, so divide by DPR
  c.fillRect(0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio)

  // Save canvas state and apply camera translation
  c.save()
  if (camera) {
    // transform already scales by devicePixelRatio via setTransform; translate in CSS pixels
    c.translate(-camera.x, -camera.y)
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
  
  // Draw joystick on top (not affected by camera translation)
  if (IS_MOBILE && joystick) {
    joystick.draw(c)
  }

  // Debug overlay removed.
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

// Single movement loop that checks IS_MOBILE flag
setInterval(() => {
  if (!frontEndPlayers[socket.id]) return
  
  // Mobile joystick movement
  if (IS_MOBILE && joystick) {
    const input = joystick.getTouchInput()
    if (input.magnitude > 0.1) {
      sequenceNumber++
      // Use magnitude to scale movement
      const moveX = input.dx * (SPEED / joystick.radius)
      const moveY = input.dy * (SPEED / joystick.radius)

      playerInputs.push({ sequenceNumber, dx: moveX, dy: moveY })
      // apply local prediction but clamp to world bounds to avoid server snap-back
      frontEndPlayers[socket.id].x = Math.max(0, Math.min(WORLD_WIDTH, frontEndPlayers[socket.id].x + moveX))
      frontEndPlayers[socket.id].y = Math.max(0, Math.min(WORLD_HEIGHT, frontEndPlayers[socket.id].y + moveY))
      // send authoritative movement to server so backend updates match client prediction
      socket.emit('move', { dx: moveX, dy: moveY, sequenceNumber })
      
      console.log('Joystick movement:', moveX, moveY)
    }
  }
  
  // Desktop keyboard movement
  if (!IS_MOBILE) {
    if (keys.w.pressed) {
      sequenceNumber++
      playerInputs.push({ sequenceNumber, dx: 0, dy: -SPEED })
      frontEndPlayers[socket.id].y = Math.max(0, frontEndPlayers[socket.id].y - SPEED)
      socket.emit('keydown', { keycode: 'KeyW', sequenceNumber })
    }

    if (keys.a.pressed) {
      sequenceNumber++
      playerInputs.push({ sequenceNumber, dx: -SPEED, dy: 0 })
      frontEndPlayers[socket.id].x = Math.max(0, frontEndPlayers[socket.id].x - SPEED)
      socket.emit('keydown', { keycode: 'KeyA', sequenceNumber })
    }

    if (keys.s.pressed) {
      sequenceNumber++
      playerInputs.push({ sequenceNumber, dx: 0, dy: SPEED })
      frontEndPlayers[socket.id].y = Math.min(WORLD_HEIGHT, frontEndPlayers[socket.id].y + SPEED)
      socket.emit('keydown', { keycode: 'KeyS', sequenceNumber })
    }

    if (keys.d.pressed) {
      sequenceNumber++
      playerInputs.push({ sequenceNumber, dx: SPEED, dy: 0 })
      frontEndPlayers[socket.id].x = Math.min(WORLD_WIDTH, frontEndPlayers[socket.id].x + SPEED)
      socket.emit('keydown', { keycode: 'KeyD', sequenceNumber })
    }
  }
}, 15) 

window.addEventListener('keydown', (event) => {
  if (!frontEndPlayers[socket.id] || IS_MOBILE) return

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
   if (!frontEndPlayers[socket.id] || IS_MOBILE) return

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
  const usernameForm = document.querySelector('#usernameForm')
  usernameForm.style.display = 'none'
  // also hide the form container overlay so it doesn't block pointer events on the canvas
  if (usernameForm.parentElement) {
    usernameForm.parentElement.style.display = 'none'
  }
  
  // Get mobile toggle checkbox value
  const mobileToggle = document.querySelector('#mobileToggle')
  IS_MOBILE = mobileToggle.checked
  
  console.log('IS_MOBILE:', IS_MOBILE)
  
  socket.emit('initGame', {width: canvas.width,
    height: canvas.height,
    devicePixelRatio,
    username: document.querySelector('#usernameInput').value})
})
