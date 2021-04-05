import window from 'globals/window'

interface FuncAny {
  (): any
}

function _pollForValue<T> (func: () => T) {
  return new Promise<T>((resolve) => {
    const interval = setInterval(() => {
      const val = func()
      if (val !== null && val !== undefined) {
        clearInterval(interval)
        resolve(val)
      }
    }, 50)
  })
}

export async function pollForValue (func: FuncAny) {
  return await _pollForValue(func)
}

export const jquery = window.require('jquery')
export const keys = window.require('keys')
