class Camera {
  constructor({ x = 0, y = 0, width, height }) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  // Follow a target (usually the player)
  follow(target, worldWidth, worldHeight) {
    if (!target) return

    // Center camera on target
    this.x = target.x - this.width / 2
    this.y = target.y - this.height / 2

    // Clamp camera to world boundaries
    if (this.x < 0) this.x = 0
    if (this.y < 0) this.y = 0
    if (this.x + this.width > worldWidth) this.x = worldWidth - this.width
    if (this.y + this.height > worldHeight) this.y = worldHeight - this.height
  }

  // Convert world coordinates to screen coordinates
  getScreenCoordinate(worldX, worldY) {
    return {
      x: worldX - this.x,
      y: worldY - this.y
    }
  }

  // Convert screen coordinates to world coordinates
  getWorldCoordinate(screenX, screenY) {
    return {
      x: screenX + this.x,
      y: screenY + this.y
    }
  }

  // Check if a point is visible in camera view
  isInView(x, y, radius = 0) {
    return (
      x + radius > this.x &&
      x - radius < this.x + this.width &&
      y + radius > this.y &&
      y - radius < this.y + this.height
    )
  }
}
