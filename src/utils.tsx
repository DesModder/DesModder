import { desmosRequire } from 'globals/window'
export const jquery = desmosRequire('jquery')
export const keys = desmosRequire('keys')

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
