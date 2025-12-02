const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

const socket = io()

const scoreEl = document.querySelector('#scoreEl')

let devicePixelRatio = window.devicePixelRatio || 1

function resizeCanvas() {
  devicePixelRatio = window.devicePixelRatio || 1
  let cssWidth = Math.min(1024, window.innerWidth)
  let cssHeight = Math.min(576, window.innerHeight)

  const aspect = 1024 / 576
  if (cssWidth / cssHeight > aspect) {
    cssWidth = Math.round(cssHeight * aspect)
  } else {
    cssHeight = Math.round(cssWidth / aspect)
  }

  canvas.width = Math.round(cssWidth * devicePixelRatio)
  canvas.height = Math.round(cssHeight * devicePixelRatio)

  canvas.style.width = cssWidth + 'px'
  canvas.style.height = cssHeight + 'px'

  c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
}

resizeCanvas()
window.addEventListener('resize', () => {
  resizeCanvas()
})

let IS_MOBILE = false

// World boundaries
const WORLD_WIDTH = 2048
const WORLD_HEIGHT = 1536
const CRATE_DRAW_SIZE = 28

// Camera instance
let camera = null

const bgImage = new Image()
bgImage.src = '/img/webb-dark.png'


let joystick = null

window.DEBUG = window.DEBUG || {
  lastTouch: null,
  lastShoot: null,
  mouseDown: false
}

const x = canvas.width / 2
const y = canvas.height / 2

const frontEndPlayers = {}
const frontEndProjectiles = {}
const frontEndCrates = {}

const crateImage = new Image()
crateImage.src = '/img/vecteezy_ammunition-vector-icon_19542811.jpg'



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
  console.log('updatePlayers received', Object.keys(backendPlayers).length, backendPlayers[socket.id] ? `me ammo=${backendPlayers[socket.id].ammo}` : '')
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
      frontEndPlayers[id].ammo = backEndPlayer.ammo || 0

      document.querySelector(
        '#playerLabels'
      ).innerHTML += `<div data-id="${id}" data-score="${backEndPlayer.score}">${backEndPlayer.username}: ${backEndPlayer.score}</div>`

    } else {

     document.querySelector(`div[data-id="${id}"]`).innerHTML = `${backEndPlayer.username}: ${backEndPlayer.score}`
      
      document.querySelector(
        `div[data-id="${id}"]`
      ).setAttribute('data-score', backEndPlayer.score)
      const parentDiv = document.querySelector('#playerLabels')
      const childDivs = Array.from(parentDiv.querySelectorAll('div'))

      childDivs.sort((a, b) => {
         const scoreA = Number(a.getAttribute('data-score'))
         const scoreB = Number(b.getAttribute('data-score'))
        return scoreB - scoreA
      })
      childDivs.forEach(div => {
        parentDiv.removeChild(div)
      })
      childDivs.forEach(div => {
        parentDiv.appendChild(div)
      })

      // ensure ammo stays in sync for existing players
      frontEndPlayers[id].ammo = backEndPlayer.ammo || 0

      frontEndPlayers[id].target = {
        x: backEndPlayer.x,
        y: backEndPlayer.y
      }
      // keep ammo in sync
      frontEndPlayers[id].ammo = backEndPlayer.ammo || 0


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

socket.on('updateCrates', (crates) => {
  console.log('updateCrates received', Object.keys(crates).length)
  // replace local crates map
  for (const k in frontEndCrates) delete frontEndCrates[k]
  for (const id in crates) {
    frontEndCrates[id] = crates[id]
  }
})

let animationId
function animate() {
  animationId = requestAnimationFrame(animate)
  
  if (!camera && frontEndPlayers[socket.id]) {
    camera = new Camera({
      x: 0,
      y: 0,
      width: canvas.width / devicePixelRatio,
      height: canvas.height / devicePixelRatio
    })
  }
  
  if (IS_MOBILE && !joystick && frontEndPlayers[socket.id]) {
    joystick = new Joystick({
      x: 80,
      y: (canvas.height / devicePixelRatio) - 80,
      radius: 60,
      innerRadius: 30
    })
    console.log('Joystick initialized:', joystick)
  }
  
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
  
  c.fillStyle = '#94a3b8'
  c.fillRect(0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio)

  c.save()
  if (camera) {
    c.translate(-camera.x, -camera.y)
  }
  
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

  // Draw crates in world space
  if (camera && crateImage.complete) {
    const size = CRATE_DRAW_SIZE || 24
    c.globalCompositeOperation = 'multiply'
    for (const id in frontEndCrates) {
      const crate = frontEndCrates[id]
      // draw centered
      c.drawImage(crateImage, crate.x - size / 2, crate.y - size / 2, size, size)
    }
    c.globalCompositeOperation = 'source-over'
  }

  for(const id in frontEndPlayers) {
    const frontEndPlayer = frontEndPlayers[id]
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
  // Draw ammo HUD for local player in top-right (so leaderboard doesn't cover it)
  try {
    const me = frontEndPlayers[socket.id]
    if (me) {
      const cssWidth = canvas.width / devicePixelRatio
      const padding = 12
      const boxW = 110
      const boxH = 32
      const x = cssWidth - boxW - padding
      const y = padding
      c.fillStyle = 'rgba(0,0,0,0.6)'
      c.fillRect(x, y, boxW, boxH)
      c.fillStyle = '#fff'
      c.font = '14px sans-serif'
      c.fillText(`Ammo: ${me.ammo || 0}`, x + 10, y + 22)
    }
  } catch (e) {}

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
