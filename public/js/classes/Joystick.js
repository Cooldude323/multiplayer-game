class Joystick {
  constructor({ x, y, radius, innerRadius }) {
    this.x = x
    this.y = y
    this.radius = radius
    this.innerRadius = innerRadius
    this.isActive = false
    this.angle = 0
    this.distance = 0
    this.touchId = null
  }

  draw(ctx) {
    // Draw outer circle (background)
    ctx.fillStyle = 'rgba(200, 200, 200, 0.3)'
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.fill()

    // Draw inner circle (stick)
    ctx.fillStyle = 'rgba(100, 150, 255, 0.6)'
    ctx.beginPath()
    ctx.arc(
      this.x + Math.cos(this.angle) * this.distance,
      this.y + Math.sin(this.angle) * this.distance,
      this.innerRadius,
      0,
      Math.PI * 2
    )
    ctx.fill()
  }

  getTouchInput() {
    if (!this.isActive) {
      return { dx: 0, dy: 0, magnitude: 0 }
    }

    const dx = Math.cos(this.angle) * this.distance
    const dy = Math.sin(this.angle) * this.distance
    const magnitude = this.distance / this.radius

    return { dx, dy, magnitude }
  }

  handleTouchStart(touch, canvasRect, padding = 0) {
    const dx = touch.clientX - canvasRect.left - this.x
    const dy = touch.clientY - canvasRect.top - this.y
    const dist = Math.hypot(dx, dy)

    // Check if touch is within joystick area (allow optional padding outside outer radius)
    if (dist < this.radius + padding) {
      this.isActive = true
      this.touchId = touch.identifier
      this.updatePosition(touch.clientX, touch.clientY, canvasRect)
      console.log('Joystick touch started')
      return true
    }
    return false
  }

  handleTouchMove(touch, canvasRect) {
    if (!this.isActive || touch.identifier !== this.touchId) return false

    this.updatePosition(touch.clientX, touch.clientY, canvasRect)
    return true
  }

  handleTouchEnd(touch) {
    if (touch.identifier === this.touchId) {
      this.isActive = false
      this.distance = 0
      this.touchId = null
      console.log('Joystick touch ended')
      return true
    }
    return false
  }

  updatePosition(clientX, clientY, canvasRect) {
    const dx = clientX - canvasRect.left - this.x
    const dy = clientY - canvasRect.top - this.y
    this.angle = Math.atan2(dy, dx)

    let dist = Math.hypot(dx, dy)
    dist = Math.min(dist, this.radius)
    this.distance = dist
  }

  isWithinBounds(clientX, clientY, canvasRect, padding = 0) {
    const dx = clientX - canvasRect.left - this.x
    const dy = clientY - canvasRect.top - this.y
    const dist = Math.hypot(dx, dy)
    return dist < (this.radius + padding)
  }
}
