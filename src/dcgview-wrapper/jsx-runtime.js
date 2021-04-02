/**
 * This file serves only to wrap the `jsx` function for babel-transform-react-jsx
 * It cannot be renamed or moved.
 */

/**
 * If you know React, then you know DCGView.
 * Some exceptions:
 *  - DCGView was forked sometime in 2016, before React Fragments and some other features
 *  - use class instead of className
 *  - there's some function name changes, like React.Component → DCGView.Class,
 *    rerender → template.
 *    However, there are functional differences:
 *    template is only called once with the prop values, see the next point.
 *  - You don't want to write (<div color={this.props.color()}>...) because the prop value is
 *    executed only once and gives a fixed value. If that is what you want,
 *    it is more semantic to do (<div color={DCGView.const(this.props.color())}>...),
 *    but if you want the prop to change on component update, use
 *    (<div color={() => this.props.color()}>...</div>)
 *  - This wrapper automatically calls DCGView.const over bare non-function values,
 *    so be careful. Anything that needs to change should be wrapped in a function
 *  - DCGView or its components impose some requirements, like aria-label being required
 * I have not yet figured out how to set state, but most components should be
 * stateless anyway (state control in Model.js)
 */

import DCGView from 'DCGView'

export function jsx (el, props) {
  /**
   * babel-transform-react-jsx calls:
   *   jsx(el, {...props, children: child})
   * or jsxs(el, {...props, children: [child1, child2, ...]})
   * but we want
   *   DCGView.createElement(el, props, ...children)
   * see change info at https://github.com/reactjs/rfcs/blob/createlement-rfc/text/0000-create-element-changes.md
   */
  let children = props.children
  if (!Array.isArray(children)) {
    // occurs for jsx but not jsxs
    children = [children]
  }
  // "Text should be a const or a getter:"
  children = children.map(e => typeof e === 'string' ? DCGView.const(e) : e)
  delete props.children
  for (const [k, v] of Object.entries(props)) {
    // DCGView.createElement also expects 0-argument functions
    if (typeof v !== 'function') {
      props[k] = DCGView.const(v)
    }
  }
  return DCGView.createElement(el, props, ...children)
}

// jsxs is for a list of children like <Component><A/><B/></Component>
// differences get handled in jsx
export const jsxs = jsx
