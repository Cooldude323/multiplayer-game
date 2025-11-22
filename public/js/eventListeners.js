addEventListener('click', (event) => {
  if (!frontEndPlayers[socket.id] || !camera) return
  
  const canvas = document.querySelector('canvas')
  const {top, left} = canvas.getBoundingClientRect()
  
  // Get screen coordinates relative to canvas
  const screenX = (event.clientX - left) / devicePixelRatio
  const screenY = (event.clientY - top) / devicePixelRatio
  
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

  socket.emit('shoot',{
    x: playerPosition.x,
    y: playerPosition.y,
    angle
  }) 

  console.log(frontEndProjectiles)
})
