// Desktop mouse click shooting
if (!IS_MOBILE) {
  addEventListener('click', (event) => {
    if (!frontEndPlayers[socket.id] || !camera) return
    
    const canvas = document.querySelector('canvas')
    const rect = canvas.getBoundingClientRect()

    // Get screen coordinates relative to canvas (use CSS pixels directly)
    const screenX = (event.clientX - rect.left)
    const screenY = (event.clientY - rect.top)
    
    // Convert to world coordinates using camera
    const worldCoords = {
      x: screenX + camera.x,
      y: screenY + camera.y
    }
    
    const playerPosition = {
      x: frontEndPlayers[socket.id].x,
      y: frontEndPlayers[socket.id].y
    }
    
    const angle = Math.atan2(
      worldCoords.y - playerPosition.y,
      worldCoords.x - playerPosition.x
    )
    // debounce duplicate shoots (some devices emit both touch and pointer/mouse)
    try {
      window.__lastShootAt = window.__lastShootAt || 0
      const now = Date.now()
      const last = window.__lastShootAt
      const dist = window.DEBUG && window.DEBUG.lastShoot ? Math.hypot(window.DEBUG.lastShoot.x - worldCoords.x, window.DEBUG.lastShoot.y - worldCoords.y) : Infinity
      if (!(now - last < 250 && dist < 10)) {
        socket.emit('shoot',{
          x: playerPosition.x,
          y: playerPosition.y,
          angle
        })
        window.__lastShootAt = now
        try { window.DEBUG.lastShoot = { x: worldCoords.x, y: worldCoords.y, angle }; window.DEBUG.lastShootAt = now } catch(e) {}
      } else {
        console.log('Shoot suppressed (debounce)')
      }
    } catch(e) {
      socket.emit('shoot',{ x: playerPosition.x, y: playerPosition.y, angle })
    }
  })
}

// Mobile touch shooting: listeners are attached regardless of initial `IS_MOBILE` so
// toggling the checkbox later still allows input to be captured. Handlers early-return
// when `IS_MOBILE` is false so desktop behavior is unchanged.
const canvasEl = document.querySelector('canvas')

canvasEl.addEventListener('touchstart', (event) => {
  if (!IS_MOBILE) return
  if (!frontEndPlayers[socket.id] || !camera) return

  // ensure we can call preventDefault on touch events
  event.preventDefault()

  const canvasRect = canvasEl.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1

    // Check each touch
  for (let i = 0; i < event.touches.length; i++) {
    const touch = event.touches[i]

    // Check if touch is on joystick area (allow small padding so thumb can rest just outside)
    const JOYSTICK_PADDING = 24
    if (joystick && joystick.isWithinBounds(touch.clientX, touch.clientY, canvasRect, JOYSTICK_PADDING)) {
      joystick.handleTouchStart(touch, canvasRect, JOYSTICK_PADDING)
      console.log('Touch on joystick')
        try { window.DEBUG.lastTouch = { type: 'start', x: touch.clientX, y: touch.clientY } } catch (e) {}
      // mark recent touch to suppress pointer duplicates
      window.__recentTouch = true
      setTimeout(() => { window.__recentTouch = false }, 300)
    } else {
      // Touch is for shooting — convert client coords to canvas CSS-space (no DPR division)
      const screenX = (touch.clientX - canvasRect.left)
      const screenY = (touch.clientY - canvasRect.top)

      const worldCoords = {
        x: screenX + camera.x,
        y: screenY + camera.y
      }

      const playerPosition = {
        x: frontEndPlayers[socket.id].x,
        y: frontEndPlayers[socket.id].y
      }

      const angle = Math.atan2(
        worldCoords.y - playerPosition.y,
        worldCoords.x - playerPosition.x
      )

      // debounce duplicate shoots
      try {
        window.__lastShootAt = window.__lastShootAt || 0
        const now = Date.now()
        const last = window.__lastShootAt
        const dist = window.DEBUG && window.DEBUG.lastShoot ? Math.hypot(window.DEBUG.lastShoot.x - worldCoords.x, window.DEBUG.lastShoot.y - worldCoords.y) : Infinity
        if (!(now - last < 250 && dist < 10)) {
          socket.emit('shoot',{
            x: playerPosition.x,
            y: playerPosition.y,
            angle
          })
          window.__lastShootAt = now
          try { window.DEBUG.lastShoot = { x: worldCoords.x, y: worldCoords.y, angle }; window.DEBUG.lastShootAt = now } catch(e) {}
          console.log('Mobile shoot fired')
        } else {
          console.log('Mobile shoot suppressed (debounce)')
        }
      } catch(e) {
        socket.emit('shoot',{ x: playerPosition.x, y: playerPosition.y, angle })
        console.log('Mobile shoot fired (fallback)')
      }
    }
  }
}, { passive: false })

canvasEl.addEventListener('touchmove', (event) => {
  if (!IS_MOBILE) return
  if (!joystick) return

  // allow preventDefault
  event.preventDefault()

  const canvasRect = canvasEl.getBoundingClientRect()

  for (let i = 0; i < event.touches.length; i++) {
    const touch = event.touches[i]
      joystick.handleTouchMove(touch, canvasRect)
      try { window.DEBUG.lastTouch = { type: 'move', x: touch.clientX, y: touch.clientY } } catch(e) {}
  }
}, { passive: false })

canvasEl.addEventListener('touchend', (event) => {
  if (!IS_MOBILE) return
  if (!joystick) return

  // allow preventDefault
  event.preventDefault()

  for (let i = 0; i < event.changedTouches.length; i++) {
    const touch = event.changedTouches[i]
      joystick.handleTouchEnd(touch)
      try { window.DEBUG.lastTouch = { type: 'end', x: touch.clientX, y: touch.clientY } } catch(e) {}
  }
}, { passive: false })

// Add mouse handlers so you can test joystick on desktop when "Mobile Controls" is checked
let mouseDownOnJoystick = false
canvasEl.addEventListener('mousedown', (e) => {
  if (!IS_MOBILE) return
  const canvasRect = canvasEl.getBoundingClientRect()
  const JOYSTICK_PADDING = 24
  if (joystick && joystick.isWithinBounds(e.clientX, e.clientY, canvasRect, JOYSTICK_PADDING)) {
    mouseDownOnJoystick = true
    joystick.handleTouchStart({ identifier: 'mouse', clientX: e.clientX, clientY: e.clientY }, canvasRect, JOYSTICK_PADDING)
    e.preventDefault()
    console.log('Mouse down on joystick')
    try { window.DEBUG.mouseDown = true; window.DEBUG.lastTouch = { type: 'mouse-start', x: e.clientX, y: e.clientY } } catch(e) {}
  }
})

canvasEl.addEventListener('mousemove', (e) => {
  if (!IS_MOBILE) return
  if (!mouseDownOnJoystick) return
  const canvasRect = canvasEl.getBoundingClientRect()
  joystick.handleTouchMove({ identifier: 'mouse', clientX: e.clientX, clientY: e.clientY }, canvasRect)
  e.preventDefault()
  try { window.DEBUG.lastTouch = { type: 'mouse-move', x: e.clientX, y: e.clientY } } catch(e) {}
})

window.addEventListener('mouseup', (e) => {
  if (!IS_MOBILE) return
  if (!mouseDownOnJoystick) return
  mouseDownOnJoystick = false
  joystick.handleTouchEnd({ identifier: 'mouse' })
  e.preventDefault()
  console.log('Mouse up - joystick released')
  try { window.DEBUG.mouseDown = false; window.DEBUG.lastTouch = { type: 'mouse-end', x: e.clientX, y: e.clientY } } catch(e) {}
})

// Pointer events fallback (unified for mouse, touch, pen). This helps on devices/browsers
// where touch or mouse events may not be delivered as expected. We early-return if
// not in mobile mode so desktop normal behavior is unchanged.
canvasEl.addEventListener('pointerdown', (e) => {
  if (!IS_MOBILE) return
  if (!joystick) return
  const canvasRect = canvasEl.getBoundingClientRect()
  const cx = e.clientX
  const cy = e.clientY
  // If pointer is inside joystick, start
  const JOYSTICK_PADDING = 24
  if (joystick.isWithinBounds(cx, cy, canvasRect, JOYSTICK_PADDING)) {
    try { canvasEl.setPointerCapture(e.pointerId) } catch (err) {}
    joystick.handleTouchStart({ identifier: e.pointerId, clientX: cx, clientY: cy }, canvasRect, JOYSTICK_PADDING)
    window.DEBUG.lastTouch = { type: 'pointer-start', x: cx, y: cy }
    window.DEBUG.mouseDown = true
    console.log('Pointer down on joystick', e.pointerType)
  }
}, { passive: false })

canvasEl.addEventListener('pointermove', (e) => {
  if (!IS_MOBILE) return
  if (!joystick) return
  if (e.pressure === 0 && e.pointerType === 'touch') return
  const canvasRect = canvasEl.getBoundingClientRect()
  joystick.handleTouchMove({ identifier: e.pointerId, clientX: e.clientX, clientY: e.clientY }, canvasRect)
  try { window.DEBUG.lastTouch = { type: 'pointer-move', x: e.clientX, y: e.clientY } } catch(e) {}
}, { passive: false })

canvasEl.addEventListener('pointerup', (e) => {
  if (!IS_MOBILE) return
  if (!joystick) return
  try { canvasEl.releasePointerCapture(e.pointerId) } catch (err) {}
  joystick.handleTouchEnd({ identifier: e.pointerId })
  try { window.DEBUG.lastTouch = { type: 'pointer-end', x: e.clientX, y: e.clientY }; window.DEBUG.mouseDown = false } catch(e) {}
  console.log('Pointer up', e.pointerType)
}, { passive: false })
