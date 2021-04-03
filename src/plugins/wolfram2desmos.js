function onEnable () {
  import('plugins/wolfram2desmos/wolfram2desmos.user.js')
}

export default {
  name: 'wolfram2desmos',
  description: 'Convert ASCIImath into Desmos LaTeX on paste.',
  onEnable: onEnable,
  enabledByDefault: true
}
