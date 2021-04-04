function replace (from, to) {
  const R = (obj, keys) => {
    const out = {}
    keys.forEach(key => {
      if (obj[key] !== undefined) {
        out[key] = obj[key].replaceAll(from, to)
      }
    })
    return out
  }
  // middle group in regex accounts for 1 layer of braces, sufficient for `a_{sub}`
  const replaceString = s => s.replaceAll(/(?<=\$\{)((?:[^{}]|\{[^}]*\})+)(?=\})/g, e => e.replaceAll(from, to))
  const simpleKeys = ['latex', 'colorLatex', 'pointOpacity', 'lineOpacity', 'pointSize', 'lineWidth']
  const rootKeys = simpleKeys.concat(['labelSize', 'labelAngle', 'center', 'opacity', 'width', 'height', 'angle', 'fillOpacity', 'residualVariable', 'fps'])
  const state = window.Calc.getState()
  state.expressions.list.forEach(expr => {
    Object.assign(expr, R(expr, rootKeys))
    if (expr.slider) {
      Object.assign(expr.slider, R(expr.slider, ['max', 'min', 'step']))
    }
    if (expr.label) {
      expr.label = replaceString(expr.label)
    }
    if (expr.columns) {
      expr.columns = expr.columns.map(col => ({
        ...col,
        ...R(col, simpleKeys),
        values: col.values.map(e => e.replaceAll(from, to))
      }))
    }
    if (expr.clickableInfo) {
      if (expr.clickableInfo.description) {
        expr.clickableInfo.description = replaceString(expr.clickableInfo.description)
      }
      if (expr.clickableInfo.rules) {
        expr.clickableInfo.rules = expr.clickableInfo.rules.map(rule => ({
          ...rule,
          ...R(rule, ['assignment', 'expression'])
        }))
      }
    }
  })
  window.Calc.setState(state, {
    allowUndo: true
  })
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
function escapeRegExp (string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

export function refactor (fromExpr, toExpr) {
  // `\b` takes \w ≡ [A-Za-z0-9_] as word characters. (digits and underscores are included).
  // For a search key of "w", we want to match the "w" in "2w", so we can't use just `\b` at start
  // the positive lookahead and lookbehind are designed to (for a search of "w")
  //   match the "w" in "\\left(w,", "2w", "w", "w\\right)"
  //   not match the "w" in "P_{aww}", "w_{1}"
  // I'm not 100% sure these protect all use cases, but they do a decent job.
  // escapeRegExp needed for any input with parentheses, powers, etc.
  replace(RegExp('(?<=\\b|\\d|\\W|^)' + escapeRegExp(fromExpr) + '(?=\\b|\\W|$)', 'g'), toExpr)
}
