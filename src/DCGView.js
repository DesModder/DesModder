const DCGView = window.require('dcgview')

export default {
  ...DCGView,
  jsx: jsx
}

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

function jsx (el, props, ...children) {
  /* Handle differences between typescript's expectation and DCGView */
  if (!Array.isArray(children)) {
    children = [children]
  }
  // "Text should be a const or a getter:"
  children = children.map(e => typeof e === 'string' ? DCGView.const(e) : e)
  for (const [k, v] of Object.entries(props)) {
    // DCGView.createElement also expects 0-argument functions
    if (typeof v !== 'function') {
      props[k] = DCGView.const(v)
    }
  }
  return DCGView.createElement(el, props, ...children)
}
