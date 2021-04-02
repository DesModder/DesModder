function _pollForValue (func) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const val = func()
      if (val !== null && val !== undefined) {
        clearInterval(interval)
        resolve(val)
      }
    }, 50)
  })
}

export async function pollForValue (func) {
  return await _pollForValue(func)
}
